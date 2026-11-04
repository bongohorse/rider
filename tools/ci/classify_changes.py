#!/usr/bin/env python3
"""Classify Git NUL-delimited paths into docs-only, gym, repo-tooling or full CI selection."""
import sys
import json
import os
import re
import subprocess
from urllib.request import Request, urlopen
from pathlib import Path

# Only presentation assets in these documentation namespaces; no fixture/data suffixes.
DOC_ASSET_PREFIXES = ("docs/editor-a/", "docs/images/")
DOC_ASSET_SUFFIXES = (".png", ".svg", ".jpg", ".jpeg", ".webp")


def is_doc_asset(path):
    return path.startswith(DOC_ASSET_PREFIXES) and path.endswith(DOC_ASSET_SUFFIXES)


PROJECT = Path(__file__).resolve().parents[2] / "game.project"


def bundled_paths(project=PROJECT):
    """custom_resources entries are packaged into builds; None when unreadable."""
    try:
        text = project.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    paths = []
    for line in text.splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip() == "custom_resources":
            paths += [entry.strip().strip("/") for entry in value.split(",") if entry.strip("/ ")]
    return paths


def is_bundled(path, bundled):
    return any(path == entry or path.startswith(entry + "/") for entry in bundled)


def doc_asset_consumers(root):
    """Fail closed on runtime/test references to presentation namespaces, including atlases.

    The three exceptions contain classifier/link-check implementation or test path data;
    Markdown and the presentation images themselves are documentation consumers.
    """
    data_only = {"tools/ci/classify_changes.py", "tests/ci/test_changes.py",
                 "tests/ci/test_docs_links.py"}
    try:
        tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root,
                                          stderr=subprocess.DEVNULL).decode().strip("\0").split("\0")
        consumers = []
        for name in tracked:
            if name.endswith(".md") or is_doc_asset(name) or name in data_only:
                continue
            file = root / name
            if not file.exists():  # Deletions are still listed until staged.
                continue
            content = file.read_bytes()
            if any(prefix.rstrip("/").encode() in content for prefix in DOC_ASSET_PREFIXES):
                consumers.append(name)
        return consumers
    except (OSError, UnicodeError, subprocess.SubprocessError):
        return ["unreadable asset dependency inventory"]


def is_docs_only(paths, project=PROJECT):
    """Non-bundled prose and explicitly allowlisted presentation assets, never fixtures."""
    bundled = bundled_paths(project)
    if any(is_doc_asset(path) for path in paths) and doc_asset_consumers(project.parent):
        return False

    def safe_doc(path):
        # Preserve previous Markdown coverage, but text files only under docs/.
        return (path.endswith(".md") or (path.startswith("docs/") and path.endswith(".txt"))
                or is_doc_asset(path))

    if bundled is None:
        # If the project manifest is unreadable, restrict all types to docs/ or root Markdown.
        return bool(paths) and all(
            (path.endswith(".md") and ("/" not in path or path.startswith("docs/")))
            or (path.startswith("docs/") and path.endswith(".txt"))
            for path in paths
        )
    return bool(paths) and all(
        safe_doc(path) and not is_bundled(path, bundled) for path in paths
    )


def read_paths(filename):
    data = Path(filename).read_bytes()
    if data and not data.endswith(b"\0"):
        raise ValueError("Git changed-path output is not NUL-terminated")
    paths = [part.decode("utf-8", "surrogateescape") for part in data.split(b"\0")[:-1]]
    if any(not path for path in paths):
        raise ValueError("Empty changed path")
    return paths


# The game, editor and Gym sources that lived together in main/gym/ until #405.
GYM_PREFIXES = ("main/game/", "main/editor/", "main/gym/")


def is_gym_only(paths):
    """Conservative allowlist: game/editor/gym paths plus approved non-runtime docs only."""
    return (
        bool(paths)
        and any(path.startswith(GYM_PREFIXES) for path in paths)
        and all(path.startswith(GYM_PREFIXES) or is_docs_only([path]) for path in paths)
    )


# Repo-only tooling (#437): files that only the change classification, Bootstrap and
# CI Node test jobs load. Only Python and CommonJS sources directly in the directories, plus
# the existing tool locks; manifests, configuration, data and anything deeper are full.
REPO_TOOLING_FILES = ("tools/bootstrap_check.py", "tools/ci/actionlint-lock.json",
                      "tools/ci/luacheck-lock.json")
REPO_TOOLING_DIRS = ("tools/ci/", "tests/ci/")
REPO_TOOLING_SUFFIXES = (".py", ".cjs")
# Tooling-directory files that always select the full run. tests/ci/test_repo_tooling.py fails
# when a file the skipped jobs load is missing here.
FULL_RUN_TOOLING = {
    "tools/ci/classify_changes.py":
        "the selection itself: a classifier change must never pick its own short path",
    "tools/ci/required_gate.py":
        "the required gate decides which skips are allowed; a change must face every job",
    "tools/ci/setup_playwright.cjs":
        "G1 HTML5, every Gym group and every release verify group install Chromium with it",
}


def is_repo_tooling_path(path, bundled):
    if path in FULL_RUN_TOOLING or is_bundled(path, bundled):
        return False
    if path in REPO_TOOLING_FILES:
        return True
    return path.endswith(REPO_TOOLING_SUFFIXES) and any(
        path.startswith(d) and "/" not in path[len(d):] for d in REPO_TOOLING_DIRS)


def is_repo_tooling(paths, project=PROJECT):
    """Repo tooling plus non-runtime docs, never .github/ (not even its Markdown)."""
    bundled = bundled_paths(project)
    if bundled is None or not paths or any(path.startswith(".github/") for path in paths):
        return False
    tooling = [is_repo_tooling_path(path, bundled) for path in paths]
    return any(tooling) and all(
        is_tool or is_docs_only([path], project) for path, is_tool in zip(paths, tooling)
    )


def selection(paths):
    """Return (docs_only, skip_special, repo_tooling, selection_reason); unknown is full."""
    if any(path.startswith(".github/") for path in paths):
        # Workflows and their templates never take a fast path; ci.yml enforces this too.
        return "false", "false", "false", "unknown-or-shared-change-full"
    if is_docs_only(paths):
        return "true", "false", "false", ("docs-assets-and-text-only" if any(is_doc_asset(p) for p in paths)
                                               else "docs-text-only")
    if is_gym_only(paths):
        return "false", "true", "false", "gym-and-docs-only"
    if is_repo_tooling(paths):
        return "false", "false", "true", "repo-tooling-and-docs-only"
    return "false", "false", "false", "unknown-or-shared-change-full"


def successful_main_base(runs, ancestor):
    """Only a completed successful push CI on an ancestor proves tests AND Pages finished.

    A successful docs-fast run inherits that guarantee by its cumulative docs-only diff.
    Never trust the event's before SHA or a merely green required job with Pages pending.
    """
    for run in runs:
        sha = run.get("head_sha", "")
        if (run.get("event") == "push" and run.get("head_branch") == "main"
                and run.get("path") == ".github/workflows/ci.yml"
                and run.get("status") == "completed" and run.get("conclusion") == "success"
                and re.fullmatch(r"[0-9a-f]{40}", sha) and ancestor(sha)):
            return sha
    return None


def main_push_base():
    """Bounded read-only API lookup. Missing history/API failure safely keeps main full."""
    try:
        repo = os.environ["GITHUB_REPOSITORY"]
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
            return None
        request = Request(
            f"https://api.github.com/repos/{repo}/actions/workflows/ci.yml/runs"
            "?branch=main&event=push&status=success&per_page=100",
            headers={"Accept": "application/vnd.github+json",
                     "Authorization": "Bearer " + os.environ["GH_TOKEN"]})
        with urlopen(request, timeout=15) as response:
            runs = json.load(response)["workflow_runs"]
        def ancestor(sha):
            return subprocess.run(["git", "merge-base", "--is-ancestor", sha, "HEAD"],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                  timeout=5).returncode == 0
        return successful_main_base(runs, ancestor)
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        # Never print HTTP exceptions: they can include request details.
        print("Main baseline unavailable; retain full CI", file=sys.stderr)
        return None


if __name__ == "__main__":
    if sys.argv[1:] == ["--main-base"]:
        base = main_push_base()
        if base:
            print(base)
        raise SystemExit(0)
    paths = read_paths(sys.argv[1])
    print(f"Changed paths: {len(paths)}", file=sys.stderr)
    docs_only, skip_special, repo_tooling, reason = selection(paths)
    print(f"docs_only={docs_only}")
    print(f"skip_special={skip_special}")
    print(f"repo_tooling={repo_tooling}")
    print(f"selection_reason={reason}")
