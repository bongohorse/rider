#!/usr/bin/env python3
"""Classify Git NUL-delimited paths into docs-only, gym, repo-tooling or full CI selection."""
import sys
from pathlib import Path

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


def is_docs_only(paths, project=PROJECT):
    """Only plain Markdown and docs/*.txt are non-runtime; never admit data fixtures."""
    bundled = bundled_paths(project)

    def safe_doc(path):
        # Preserve previous Markdown coverage, but text files only under docs/.
        return path.endswith(".md") or (path.startswith("docs/") and path.endswith(".txt"))

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
# CI Node test jobs load. Direct children of the directories only; anything deeper is full.
REPO_TOOLING_FILES = ("tools/bootstrap_check.py",)
REPO_TOOLING_DIRS = ("tools/ci/", "tests/ci/")
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
    return any(path.startswith(d) and "/" not in path[len(d):] and path != d
               for d in REPO_TOOLING_DIRS)


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
    if is_docs_only(paths):
        return "true", "false", "false", "docs-text-only"
    if is_gym_only(paths):
        return "false", "true", "false", "gym-and-docs-only"
    if is_repo_tooling(paths):
        return "false", "false", "true", "repo-tooling-and-docs-only"
    return "false", "false", "false", "unknown-or-shared-change-full"


if __name__ == "__main__":
    paths = read_paths(sys.argv[1])
    print(f"Changed paths: {len(paths)}", file=sys.stderr)
    docs_only, skip_special, repo_tooling, reason = selection(paths)
    print(f"docs_only={docs_only}")
    print(f"skip_special={skip_special}")
    print(f"repo_tooling={repo_tooling}")
    print(f"selection_reason={reason}")
