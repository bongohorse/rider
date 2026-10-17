#!/usr/bin/env python3
"""Fail docs-only CI for missing local Markdown link targets (no network)."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

from classify_changes import read_paths

ROOT = Path(__file__).resolve().parents[2]
INLINE = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>]+>|[^\s)]+)")
REFERENCE = re.compile(r"^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)")
FENCE = re.compile(r"^\s{0,3}(\x60{3,}|~{3,})")


def targets(text):
    """Ignore fenced code and inline code while parsing ordinary Markdown links."""
    marker = None
    for line_number, line in enumerate(text.splitlines(), 1):
        match = FENCE.match(line)
        if match:
            chars = match.group(1)
            if marker is None:
                marker = chars
            elif chars[0] == marker[0] and len(chars) >= len(marker):
                marker = None
            continue
        if marker:
            continue
        line = re.sub(r"\x60+[^\x60]*\x60+", "", line)
        for match in INLINE.finditer(line):
            yield line_number, match.group(1)
        ref = REFERENCE.match(line)
        if ref:
            yield line_number, ref.group(1)


def missing(root, filename, raw):
    url = raw.strip().strip("<>")
    if not url or url.startswith(("#", "/", "//")):
        return False
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc:
        return False
    path = unquote(parsed.path)
    if not path:
        return False
    target = (root / filename).parent.joinpath(path).resolve()
    return not target.is_relative_to(root.resolve()) or not target.exists()


def check_paths(root, paths):
    errors = []
    for name in paths:
        file = root / name
        if not file.is_file() or file.suffix.lower() != ".md":
            continue
        for line, dest in targets(file.read_text(encoding="utf-8")):
            if missing(root, name, dest):
                errors.append(f"{name}:{line}: missing relative link target {dest}")
    return errors


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: check_docs_links.py <NUL-delimited-git-path-file>")
    paths = read_paths(sys.argv[1])
    errors = check_paths(ROOT, paths)
    for error in errors:
        print(f"FAIL: {error}", file=sys.stderr)
    print(f"Markdown links: {len(paths)} changed paths, {len(errors)} errors")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
