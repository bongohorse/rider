#!/usr/bin/env python3
"""Scheduled npm audit gate (#101): every finding needs a reviewed, unexpired exception.

Fails on an advisory without an exception (or excepted for another package), a severity
above the reviewed one, an install path or top-level dependency the exception did not review,
an expired exception, any production (--omit=dev) finding, and a malformed exceptions file,
audit report or lockfile. Also reports how far the hand-pinned renovate devDependency is behind npm latest.
Policy: docs/TOOLING.md, "Dependencies and Renovate".
"""
import argparse
from dataclasses import dataclass, field
import datetime as dt
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
EXCEPTIONS = Path(__file__).with_name("npm-audit-exceptions.json")
MAX_EXCEPTION_DAYS = 90
WARN_DAYS = 14
TRIAGE_DAYS = {"critical": 7, "high": 7, "moderate": 30, "low": 30, "info": 30}
SEVERITY_ORDER = ("critical", "high", "moderate", "low", "info")
FIELDS = ("id", "package", "severity", "nodes", "dependents", "chain", "reason", "upstream",
          "reviewer", "reviewed", "expires")
GHSA = re.compile(r"GHSA(?:-[0-9a-z]{4}){3}")
ADVISORY_URL = re.compile(r"https://github\.com/advisories/(GHSA(?:-[0-9a-z]{4}){3})")
PACKAGE = re.compile(r"(?:@[a-z0-9][\w.-]*/)?[a-z0-9][\w.-]*", re.IGNORECASE)
_SEGMENT = r"node_modules/(?:@[a-z0-9][\w.-]*/)?[a-z0-9][\w.-]*"
NODE = re.compile(rf"{_SEGMENT}(?:/{_SEGMENT})*", re.IGNORECASE)
DEPENDENCY_KEYS = ("dependencies", "optionalDependencies", "peerDependencies")
ROOT_DEPENDENCY_KEYS = ("dependencies", "devDependencies", "optionalDependencies")
URL = re.compile(r"https://[^\s/]+/\S+")
VERSION = re.compile(r"(\d+)\.(\d+)\.(\d+)")


class Malformed(ValueError):
    """An exceptions file or audit report the gate cannot trust."""


@dataclass
class Result:
    failures: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    notes: list = field(default_factory=list)
    rows: list = field(default_factory=list)
    production: dict = field(default_factory=dict)
    tags: list = field(default_factory=list)

    @property
    def summary(self):
        verdict = "FAIL" if self.failures else "PASS"
        return verdict + (": " + "; ".join(self.tags) if self.tags else "")


def parse_date(value, where):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise Malformed(f"{where}: expected a YYYY-MM-DD date, got {value!r}")
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise Malformed(f"{where}: {exc}") from None


def text(value, where):
    if not isinstance(value, str) or not value.strip():
        raise Malformed(f"{where}: expected a non-empty string")
    return value


def text_list(value, where):
    if not isinstance(value, list) or not value:
        raise Malformed(f"{where}: expected a non-empty list of strings")
    return [text(item, f"{where}[{i}]") for i, item in enumerate(value)]


def load_exceptions(data, today):
    """Validate the reviewed exceptions file; return {GHSA id: entry}."""
    if not isinstance(data, dict) or set(data) != {"schema", "exceptions"}:
        raise Malformed("exceptions file: expected exactly the keys 'schema' and 'exceptions'")
    if type(data["schema"]) is not int or data["schema"] != 1:
        raise Malformed(f"exceptions file: unsupported schema {data['schema']!r}")
    if not isinstance(data["exceptions"], list):
        raise Malformed("exceptions file: 'exceptions' must be a list")
    loaded = {}
    for index, item in enumerate(data["exceptions"]):
        where = f"exceptions[{index}]"
        if not isinstance(item, dict):
            raise Malformed(f"{where}: expected an object")
        if set(item) != set(FIELDS):
            missing = sorted(set(FIELDS) - set(item))
            unknown = sorted(set(item) - set(FIELDS))
            raise Malformed(f"{where}: missing fields {missing}, unknown fields {unknown}")
        ghsa = text(item["id"], f"{where}.id")
        if not GHSA.fullmatch(ghsa):
            raise Malformed(f"{where}.id: not a GHSA id: {ghsa!r}")
        where = f"exceptions[{index}] {ghsa}"
        if ghsa in loaded:
            raise Malformed(f"{where}: duplicate id")
        package = text(item["package"], f"{where}.package")
        if not PACKAGE.fullmatch(package):
            raise Malformed(f"{where}.package: not an npm package name")
        if item["severity"] not in TRIAGE_DAYS:
            raise Malformed(f"{where}.severity: expected one of {list(SEVERITY_ORDER)}")
        nodes = text_list(item["nodes"], f"{where}.nodes")
        for node in nodes:
            if not NODE.fullmatch(node) or not node.endswith("node_modules/" + package):
                raise Malformed(f"{where}.nodes: not an install path of {package}: {node!r}")
        dependents = text_list(item["dependents"], f"{where}.dependents")
        if not all(PACKAGE.fullmatch(name) for name in dependents):
            raise Malformed(f"{where}.dependents: expected top-level npm package names")
        if len(set(nodes)) != len(nodes) or len(set(dependents)) != len(dependents):
            raise Malformed(f"{where}: duplicate nodes or dependents")
        text_list(item["chain"], f"{where}.chain")
        text(item["reason"], f"{where}.reason")
        for url in text_list(item["upstream"], f"{where}.upstream"):
            if not URL.fullmatch(url):
                raise Malformed(f"{where}.upstream: not an https URL: {url!r}")
        text(item["reviewer"], f"{where}.reviewer")
        reviewed = parse_date(item["reviewed"], f"{where}.reviewed")
        expires = parse_date(item["expires"], f"{where}.expires")
        if reviewed > today:
            raise Malformed(f"{where}: reviewed {reviewed} lies in the future")
        if not reviewed < expires <= reviewed + dt.timedelta(days=MAX_EXCEPTION_DAYS):
            raise Malformed(f"{where}: expires {expires} must be 1 to {MAX_EXCEPTION_DAYS} days "
                            f"after reviewed {reviewed}")
        loaded[ghsa] = item
    return loaded


def advisories(report, label):
    """Advisories in an `npm audit --json` (report version 2): {GHSA id: details}."""
    if not isinstance(report, dict) or report.get("auditReportVersion") != 2:
        error = report.get("error") if isinstance(report, dict) else None
        raise Malformed(f"{label}: not an npm audit report version 2"
                        + (f" (npm error: {json.dumps(error)[:300]})" if error else ""))
    vulns = report.get("vulnerabilities")
    meta = report.get("metadata", {}).get("vulnerabilities") if isinstance(report.get("metadata"), dict) else None
    if not isinstance(vulns, dict) or not isinstance(meta, dict) or not isinstance(meta.get("total"), int):
        raise Malformed(f"{label}: missing vulnerabilities or metadata")
    if meta["total"] != len(vulns):
        raise Malformed(f"{label}: metadata total {meta['total']} != {len(vulns)} package entries")
    found = {}
    for name, item in vulns.items():
        if not isinstance(item, dict) or not isinstance(item.get("via"), list):
            raise Malformed(f"{label}: package entry {name!r} has no 'via' list")
        for via in item["via"]:
            if isinstance(via, str):
                continue  # derived entry: clears when the named package's advisory clears
            if not isinstance(via, dict):
                raise Malformed(f"{label}: unexpected 'via' value in {name!r}")
            match = ADVISORY_URL.fullmatch(str(via.get("url", "")))
            package = via.get("name")
            severity = via.get("severity")
            if not match or not isinstance(package, str) or not PACKAGE.fullmatch(package) \
                    or severity not in TRIAGE_DAYS:
                raise Malformed(f"{label}: unreadable advisory in {name!r}: {json.dumps(via)[:300]}")
            nodes = vulns.get(package, {}).get("nodes") if isinstance(vulns.get(package), dict) else None
            if not isinstance(nodes, list) or not nodes or not all(
                    isinstance(node, str) and NODE.fullmatch(node) for node in nodes):
                raise Malformed(f"{label}: no install paths ('nodes') for vulnerable package {package!r}")
            entry = found.setdefault(match.group(1), {"packages": set(), "severity": severity,
                                                      "nodes": set(), "title": str(via.get("title", ""))[:200]})
            entry["packages"].add(package)
            entry["nodes"].update(nodes)
            if SEVERITY_ORDER.index(severity) < SEVERITY_ORDER.index(entry["severity"]):
                entry["severity"] = severity
    if vulns and not found:
        raise Malformed(f"{label}: {len(vulns)} vulnerable packages but no advisory")
    return found


def lock_closures(lock):
    """{top-level dependency: every install path it pulls in}, from package-lock.json v2/v3."""
    packages = lock.get("packages") if isinstance(lock, dict) else None
    if not isinstance(lock, dict) or lock.get("lockfileVersion") not in (2, 3) \
            or not isinstance(packages, dict) or not isinstance(packages.get(""), dict):
        raise Malformed("package-lock.json: expected lockfileVersion 2 or 3 with a root package")

    def names(entry, keys):
        if not isinstance(entry, dict):
            raise Malformed("package-lock.json: package entry is not an object")
        found = []
        for key in keys:
            value = entry.get(key, {})
            if not isinstance(value, dict):
                raise Malformed(f"package-lock.json: {key} is not an object")
            found += value
        return found

    def resolve(location, name):
        # Node resolution: the nearest node_modules/<name> from `location` up to the root.
        base = location
        while True:
            candidate = f"{base}/node_modules/{name}" if base else f"node_modules/{name}"
            if candidate in packages:
                entry = packages[candidate]
                return entry.get("resolved") if isinstance(entry, dict) and entry.get("link") else candidate
            if not base:
                return None  # an absent optional or peer dependency
            base = base[:base.rfind("node_modules/")].rstrip("/")

    closures = {}
    for top in names(packages[""], ROOT_DEPENDENCY_KEYS):
        start = resolve("", top)
        seen, stack = set(), [start] if start else []
        while stack:
            location = stack.pop()
            if location in seen or location not in packages:
                continue
            seen.add(location)
            stack += [t for t in (resolve(location, n) for n in names(packages[location], DEPENDENCY_KEYS)) if t]
        closures[top] = seen
    return closures


def top_level_dependents(closures, nodes, lock_packages):
    missing = sorted(node for node in nodes if node not in lock_packages)
    if missing:
        raise Malformed(f"npm audit reports install paths missing from package-lock.json: {missing}")
    return {top for top, reached in closures.items() if reached & nodes}


def evaluate(full_report, prod_report, exceptions_data, today, lock):
    """Compare both audit reports with the exceptions; raises Malformed on bad input."""
    excepted = load_exceptions(exceptions_data, today)
    found = advisories(full_report, "npm audit")
    prod = advisories(prod_report, "npm audit --omit=dev")
    audited = full_report["metadata"].get("dependencies")
    if not isinstance(audited, dict) or type(audited.get("dev")) is not int or audited["dev"] <= 0:
        raise Malformed("npm audit: the full report audited no dev dependencies "
                        "(an omit=dev npm setting?); refusing to pass a partial audit")
    if not set(prod) <= set(found):
        raise Malformed(f"npm audit --omit=dev reports advisories missing from the full audit: "
                        f"{sorted(set(prod) - set(found))}")
    closures = lock_closures(lock)
    result = Result(production=prod)
    for ghsa in sorted(found, key=lambda g: (SEVERITY_ORDER.index(found[g]["severity"]), g)):
        info = found[ghsa]
        packages = ", ".join(sorted(info["packages"]))
        severity = info["severity"]
        row = {"id": ghsa, "packages": packages, "severity": severity, "title": info["title"]}
        exception = excepted.get(ghsa)
        if exception is None or info["packages"] != {exception["package"]}:
            row["status"] = "new"
            other = f" (exception covers only {exception['package']})" if exception else ""
            result.failures.append(
                f"new advisory {ghsa} ({packages}, {severity}){other}: triage within "
                f"{TRIAGE_DAYS[severity]} days (fix PR or reviewed exception)")
            result.tags.append(f"NEW {ghsa} ({packages}, {severity})")
        else:
            expires = dt.date.fromisoformat(exception["expires"])
            left = (expires - today).days
            row["expires"] = exception["expires"]
            problems = []
            reviewed_severity = exception["severity"]
            if SEVERITY_ORDER.index(severity) < SEVERITY_ORDER.index(reviewed_severity):
                problems.append(("severity raised", f"SEVERITY {ghsa} ({packages}, {reviewed_severity} to {severity})",
                                 f"exception {ghsa} ({packages}) was reviewed at {reviewed_severity}, now "
                                 f"{severity}: re-triage within {TRIAGE_DAYS[severity]} days"))
            new_nodes = sorted(info["nodes"] - set(exception["nodes"]))
            dependents = top_level_dependents(closures, info["nodes"], lock["packages"])
            new_dependents = sorted(dependents - set(exception["dependents"]))
            if new_nodes or new_dependents:
                detail = "; ".join(part for part in (
                    f"install paths {', '.join(new_nodes)}" if new_nodes else "",
                    f"top-level dependencies {', '.join(new_dependents)}" if new_dependents else "") if part)
                problems.append(("new path", f"NEW PATH {ghsa} ({packages})",
                                 f"exception {ghsa} ({packages}) was not reviewed for {detail}: "
                                 "check reachability and update the entry with a new review"))
            if left <= 0:
                problems.append(("expired", f"EXPIRED {ghsa} ({packages})",
                                 f"exception {ghsa} ({packages}) expired on {expires}: "
                                 "re-triage and renew it with a new review, or fix"))
            for _, tag, failure in problems:
                result.failures.append(failure)
                result.tags.append(tag)
            row["status"] = ", ".join(status for status, _, _ in problems) or "excepted"
            if not problems and left <= WARN_DAYS:
                result.warnings.append(f"exception {ghsa} ({packages}) expires {expires} "
                                       f"({left} days): re-triage before then")
        result.rows.append(row)
    for ghsa in sorted(set(excepted) - set(found)):
        result.notes.append(f"exception {ghsa} ({excepted[ghsa]['package']}) is no longer reported; "
                            "remove it in the next dependency PR")
    if prod:
        names = ", ".join(f"{g} ({', '.join(sorted(v['packages']))})" for g, v in sorted(prod.items()))
        result.failures.append(f"production (--omit=dev) findings are never excepted: {names}")
        result.tags.append(f"PRODUCTION {len(prod)} advisory(ies)")
    return result


def parse_version(value):
    match = VERSION.fullmatch(value) if isinstance(value, str) else None
    return tuple(int(part) for part in match.groups()) if match else None


def parse_time(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def renovate_lag(pinned, view, now, release_age_days):
    """How far the exact renovate pin trails npm latest; ValueError when the view is unusable."""
    try:
        latest = view["dist-tags"]["latest"]
        times = view["time"]
        pin, top = parse_version(pinned), parse_version(latest)
        if pin is None or top is None:
            raise ValueError(f"not exact versions: pinned {pinned!r}, latest {latest!r}")
        newer = sorted((parse_version(v), v) for v in times
                       if parse_version(v) and pin < parse_version(v) <= top)
        pinned_at, latest_at = parse_time(times[pinned]), parse_time(times[latest])
        cutoff = now - dt.timedelta(days=release_age_days)
        eligible = [v for _, v in newer if parse_time(times[v]) <= cutoff]
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError(f"unusable npm view output: {exc!r}") from None
    return {"pinned": pinned, "pinned_at": pinned_at.date().isoformat(), "latest": latest,
            "latest_at": latest_at.date().isoformat(), "releases_behind": len(newer),
            "days_behind": max(0, (latest_at - pinned_at).days),
            "release_age_days": release_age_days,
            "newest_past_release_age": eligible[-1] if eligible else None}


def describe_lag(lag):
    if not lag["releases_behind"]:
        return f"renovate {lag['pinned']} is npm latest."
    eligible = lag["newest_past_release_age"] or "none yet"
    return (f"renovate {lag['pinned']} ({lag['pinned_at']}) is {lag['releases_behind']} releases and "
            f"{lag['days_behind']} days behind npm latest {lag['latest']} ({lag['latest_at']}). "
            f"Newest release past the {lag['release_age_days']}-day minimumReleaseAge: {eligible}. "
            "renovate.json disables Renovate's own updates for it, so bump it by hand in a dependency PR.")


def release_age_days(config_path):
    config = json.loads(Path(config_path).read_text(encoding="utf-8"))
    match = re.fullmatch(r"(\d+) days?", str(config.get("minimumReleaseAge", "")))
    if not match:
        raise ValueError("renovate.json minimumReleaseAge is not '<n> days'")
    return int(match.group(1))


def render(result, error, lag_text):
    lines = ["## npm audit gate (#101)", ""]
    if error:
        lines += [f"**FAIL**: {error}", ""]
    else:
        lines += [f"**{'FAIL' if result.failures else 'PASS'}**", ""]
        items = ([f"- FAIL: {f}" for f in result.failures] + [f"- WARNING: {w}" for w in result.warnings]
                 + [f"- Note: {n}" for n in result.notes])
        lines += items + ([""] if items else [])
        lines += ["| Advisory | Severity | Package | Status | Exception expires |",
                  "| --- | --- | --- | --- | --- |"]
        lines += [f"| [{r['id']}](https://github.com/advisories/{r['id']}) | {r['severity']} | "
                  f"{r['packages']} | {r['status']} | {r.get('expires', '-')} |" for r in result.rows]
        if not result.rows:
            lines.append("| none | | | | |")
        lines += ["", f"Production (`--omit=dev`) advisories: {len(result.production)}."]
    lines += ["", f"Renovate pin: {lag_text}", "",
              "Policy: docs/TOOLING.md, Dependencies and Renovate.", ""]
    return "\n".join(lines)


def read_json(path, label):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise Malformed(f"{label}: cannot read {path}: {exc}") from None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--audit", required=True, help="npm audit --json output")
    parser.add_argument("--audit-prod", required=True, help="npm audit --omit=dev --json output")
    parser.add_argument("--exceptions", default=str(EXCEPTIONS))
    parser.add_argument("--renovate-view", help="npm view renovate dist-tags time --json output")
    parser.add_argument("--package-json", default=str(ROOT / "package.json"))
    parser.add_argument("--renovate-config", default=str(ROOT / "renovate.json"))
    parser.add_argument("--package-lock", default=str(ROOT / "package-lock.json"))
    parser.add_argument("--today", type=dt.date.fromisoformat, help="YYYY-MM-DD (default: now, UTC)")
    parser.add_argument("--report", help="write the Markdown report here")
    parser.add_argument("--step-summary", help="append the Markdown report (GITHUB_STEP_SUMMARY)")
    parser.add_argument("--github-output", help="append verdict= and summary= (GITHUB_OUTPUT)")
    args = parser.parse_args(argv)
    now = dt.datetime.now(dt.timezone.utc)
    if args.today:
        now = dt.datetime.combine(args.today, dt.time(23, 59, 59), dt.timezone.utc)
    args.today = now.date()

    result, error = Result(), None
    try:
        result = evaluate(read_json(args.audit, "npm audit"), read_json(args.audit_prod, "npm audit --omit=dev"),
                          read_json(args.exceptions, "exceptions file"), args.today,
                          read_json(args.package_lock, "package-lock.json"))
    except Malformed as exc:
        error = str(exc)
    failed = bool(error or result.failures)

    lag_text = "not checked (no --renovate-view)."
    if args.renovate_view:
        try:
            pinned = read_json(args.package_json, "package.json")["devDependencies"]["renovate"]
            lag = renovate_lag(pinned, read_json(args.renovate_view, "npm view renovate"), now,
                               release_age_days(args.renovate_config))
            lag_text = describe_lag(lag)
        except (Malformed, ValueError, KeyError, TypeError) as exc:
            lag_text = f"unavailable ({exc})."
            print(f"::warning::renovate lag {lag_text}")

    report = render(result, error, lag_text)
    print(report)
    for line in result.warnings:
        print(f"::warning::{line}")
    for line in ([error] if error else result.failures):
        print(f"::error::{line}")
    summary = f"FAIL: {error}" if error else result.summary
    summary = re.sub(r"[^\w .,:;()@/#'+-]", " ", summary)[:900]
    print(summary)
    if args.report:
        Path(args.report).write_text(report, encoding="utf-8")
    if args.step_summary:
        with open(args.step_summary, "a", encoding="utf-8") as handle:
            handle.write(report)
    if args.github_output:
        with open(args.github_output, "a", encoding="utf-8") as handle:
            handle.write(f"verdict={'fail' if failed else 'pass'}\nsummary={summary}\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
