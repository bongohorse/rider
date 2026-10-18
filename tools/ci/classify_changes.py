#!/usr/bin/env python3
"""Classify Git NUL-delimited changed paths, failing closed for everything but Markdown."""
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
    """Markdown is non-runtime unless it lies in a bundled custom resource path."""
    bundled = bundled_paths(project)
    if bundled is None:
        # Without a readable project file, only root and docs/ Markdown are trusted.
        return bool(paths) and all(
            path.endswith(".md") and ("/" not in path or path.startswith("docs/"))
            for path in paths
        )
    return bool(paths) and all(
        path.endswith(".md") and not is_bundled(path, bundled) for path in paths
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
    """Conservative allowlist: gym paths plus normal Markdown docs only."""
    return (
        bool(paths)
        and any(path.startswith("main/gym/") for path in paths)
        and all(path.startswith("main/gym/") or is_docs_only([path]) for path in paths)
    )


def selection(paths):
    if is_docs_only(paths):
        return "true", "false", "markdown-only"
    if is_gym_only(paths):
        return "false", "true", "gym-and-markdown-only"
    return "false", "false", "unknown-or-shared-change-full"


if __name__ == "__main__":
    paths = read_paths(sys.argv[1])
    print(f"Changed paths: {len(paths)}", file=sys.stderr)
    docs_only, skip_special, reason = selection(paths)
    print(f"docs_only={docs_only}")
    print(f"skip_special={skip_special}")
    print(f"selection_reason={reason}")
