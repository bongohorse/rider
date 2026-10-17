#!/usr/bin/env python3
"""Classify Git NUL-delimited changed paths, failing closed for everything but Markdown."""
import sys
from pathlib import Path


def is_docs_only(paths):
    """Only repository-root Markdown and Markdown in docs/ are non-runtime changes."""
    return bool(paths) and all(
        path.endswith(".md") and ("/" not in path or path.startswith("docs/"))
        for path in paths
    )


def read_paths(filename):
    data = Path(filename).read_bytes()
    if data and not data.endswith(b"\0"):
        raise ValueError("Git changed-path output is not NUL-terminated")
    paths = [part.decode("utf-8", "surrogateescape") for part in data.split(b"\0")[:-1]]
    if any(not path for path in paths):
        raise ValueError("Empty changed path")
    return paths


if __name__ == "__main__":
    paths = read_paths(sys.argv[1])
    print(f"Changed paths: {len(paths)}", file=sys.stderr)
    print(f"docs_only={'true' if is_docs_only(paths) else 'false'}")
