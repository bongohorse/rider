#!/usr/bin/env python3
"""Classify Git NUL-delimited paths; allow only non-runtime Markdown and docs text."""
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


def is_gym_only(paths):
    """Conservative allowlist: gym paths plus approved non-runtime docs only."""
    return (
        bool(paths)
        and any(path.startswith("main/gym/") for path in paths)
        and all(path.startswith("main/gym/") or is_docs_only([path]) for path in paths)
    )


def selection(paths):
    if is_docs_only(paths):
        return "true", "false", "docs-text-only"
    if is_gym_only(paths):
        return "false", "true", "gym-and-docs-only"
    return "false", "false", "unknown-or-shared-change-full"


if __name__ == "__main__":
    paths = read_paths(sys.argv[1])
    print(f"Changed paths: {len(paths)}", file=sys.stderr)
    docs_only, skip_special, reason = selection(paths)
    print(f"docs_only={docs_only}")
    print(f"skip_special={skip_special}")
    print(f"selection_reason={reason}")
