#!/usr/bin/env python3
"""Safely reconcile the original Rider Gemini policy with the current version.

Only an *exact* known legacy policy is upgraded. Unknown/user-edited settings
cause a nonzero exit without overwriting. Run after verifying the parent dirs,
from the restricted reviewer setup script with sudo; this script never reads
login credentials or changes other Antigravity state.
"""
import copy
import json
import os
from pathlib import Path
import stat
import sys
import tempfile


def reconcile(desired_path: Path, current_path: Path, reviewer_uid: int | None = None) -> str:
    st = current_path.lstat()
    if not stat.S_ISREG(st.st_mode):
        raise ValueError("Existing Antigravity policy is not a regular file")
    if reviewer_uid is not None and st.st_uid != reviewer_uid:
        raise ValueError("Existing Antigravity policy has an unexpected owner")

    desired = json.loads(desired_path.read_text(encoding="utf-8"))
    current = json.loads(current_path.read_text(encoding="utf-8"))
    if current == desired:
        return "UNCHANGED"

    old = copy.deepcopy(desired)
    old_rules = old["permissions"]["deny"]
    index = old_rules.index("command(*)") + 1
    old_rules.insert(index, "unsandboxed(*)")
    if current != old:
        raise ValueError("Existing Antigravity settings differ from the known previous policy; refusing overwrite")

    # Atomically replace only the known obsolete settings file. Preserve
    # its owner and group so the isolated user can manage their own login.
    fd, tmp = tempfile.mkstemp(prefix=".gemini-policy-", dir=current_path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            if os.name == "posix":
                os.fchown(out.fileno(), st.st_uid, st.st_gid)
                os.fchmod(out.fileno(), 0o600)
            out.write(json.dumps(desired, indent=2) + "\n")
        os.replace(tmp, current_path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    return "MIGRATED"


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: reconcile_gemini_settings.py <policy> <installed> <reviewer_uid>", file=sys.stderr)
        return 2
    try:
        print("Gemini settings:", reconcile(Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])))
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"Refusing Gemini settings replacement: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
