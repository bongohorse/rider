#!/usr/bin/env python3
"""Scheduled CI owns one tooling issue for full-suite regression failures."""
import json
import os
from urllib.request import Request, urlopen

TITLE = "[CI nightly] Rider full-suite regression"


def plan(existing, outcome, url, sha):
    if outcome == "success":
        if not existing or existing["state"] != "open":
            return None
        old = existing.get("body") or ""
        return "PATCH", {"state": "closed", "body": old + f"\n\nRecovered: {url} ({sha})."}
    body = (
        "The scheduled Rider full CI suite did not pass.\n\n"
        f"- Required gate: {outcome}\n- Run: {url}\n- Commit: {sha}\n\n"
        "Investigate the run; do not weaken checks or bypass required."
    )
    if existing:
        return "PATCH", {"state": "open", "body": body}
    return "POST", {"title": TITLE, "body": body, "labels": ["tooling"]}


def api(token, endpoint, method="GET", payload=None):
    headers = {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Rider-nightly-CI",
    }
    data = json.dumps(payload).encode() if payload is not None else None
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = Request("https://api.github.com" + endpoint, data=data,
                  headers=headers, method=method)
    with urlopen(req, timeout=25) as response:
        contents = response.read()
    return json.loads(contents) if contents else {}


def find_issue(token, repo):
    for page in range(1, 21):
        issues = api(token, f"/repos/{repo}/issues?state=all&labels=tooling&per_page=100&page={page}")
        for issue in issues:
            if issue.get("title") == TITLE and "pull_request" not in issue:
                return issue
        if len(issues) < 100:
            return None
    raise RuntimeError("More than 20 pages of issues; refusing to create duplicates")


def main():
    if os.environ.get("GITHUB_EVENT_NAME") != "schedule":
        raise SystemExit("Nightly alert is for schedule event only")
    token = os.environ["GH_TOKEN"]
    repo = os.environ["GITHUB_REPOSITORY"]
    outcome = os.environ["REQUIRED_RESULT"]
    link = os.environ["GITHUB_SERVER_URL"] + "/" + repo + "/actions/runs/" + os.environ["GITHUB_RUN_ID"]
    sha = os.environ["GITHUB_SHA"]
    existing = find_issue(token, repo)
    task = plan(existing, outcome, link, sha)
    if task is None:
        print("Nightly passed: no open issue")
        return
    method, payload = task
    endpoint = f"/repos/{repo}/issues"
    if existing:
        endpoint += "/" + str(existing["number"])
    result = api(token, endpoint, method, payload)
    print(f"Nightly alert {method}: {result.get('html_url', endpoint)}")


if __name__ == "__main__":
    main()
