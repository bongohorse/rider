#!/usr/bin/env python3
"""The scheduled npm audit (#101) owns one tooling issue: open/update on failure, close on recovery."""
import os
import re

from nightly_alert import api, find_issue

TITLE = "[CI audit] npm audit gate"
POLICY = "docs/TOOLING.md#dependencies-and-renovate"


def plan(existing, outcome, url, sha, summary):
    if outcome == "success":
        if not existing or existing["state"] != "open":
            return None
        old = existing.get("body") or ""
        return "PATCH", {"state": "closed", "body": old + f"\n\nRecovered: {url} ({sha})."}
    # One line in a code span: package names like @scope/pkg or #12 must not mention or link.
    # Backticks are removed, so the text cannot close the span.
    gate = re.sub(r"\s+", " ", (summary or "").replace("`", "")).strip()[:1000] or "no gate verdict (see the run)"
    body = (
        "The scheduled npm audit gate did not pass.\n\n"
        f"- Audit job: {outcome}\n- Gate: `{gate}`\n- Run: {url}\n- Commit: {sha}\n\n"
        f"Triage per `{POLICY}`: high/critical within 7 days, moderate/low within 30 days. "
        "Fix with a reviewed dependency PR, or add a reviewed exception with evidence and an "
        "expiry of at most 90 days. Never `npm audit fix --force`, unreviewed overrides or "
        "hidden warnings."
    )
    if existing:
        return "PATCH", {"state": "open", "body": body}
    return "POST", {"title": TITLE, "body": body, "labels": ["tooling", "dependencies"]}


def main():
    if os.environ.get("GITHUB_EVENT_NAME") != "schedule":
        raise SystemExit("npm audit alert is for schedule event only")
    token = os.environ["GH_TOKEN"]
    repo = os.environ["GITHUB_REPOSITORY"]
    link = os.environ["GITHUB_SERVER_URL"] + "/" + repo + "/actions/runs/" + os.environ["GITHUB_RUN_ID"]
    existing = find_issue(token, repo, TITLE)
    task = plan(existing, os.environ["AUDIT_RESULT"], link, os.environ["GITHUB_SHA"],
                os.environ.get("GATE_SUMMARY", ""))
    if task is None:
        print("npm audit passed: no open issue")
        return
    method, payload = task
    endpoint = f"/repos/{repo}/issues"
    if existing:
        endpoint += "/" + str(existing["number"])
    result = api(token, endpoint, method, payload)
    print(f"npm audit alert {method}: {result.get('html_url', endpoint)}")


if __name__ == "__main__":
    main()
