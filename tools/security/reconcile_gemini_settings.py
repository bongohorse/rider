#!/usr/bin/env python3
"""Safely reconcile the original Rider Gemini policy with the current version.

Validate the security policy before removing only the obsolete deny rule.
Preserve unrelated CLI/user settings and an omitted empty allow list. Run after
verifying the parent dirs, from the restricted reviewer setup script with sudo; this script never reads
login credentials or changes other Antigravity state.
"""
import json
import os
from pathlib import Path
import stat
import sys
import tempfile


def reconcile(desired_path: Path | dict, current_path: Path, reviewer_uid: int | None = None) -> str:
    # Check every existing path component before reading through it. Setup also
    # checks the fixed reviewer home and parent ownership before invoking us.
    for parent in current_path.absolute().parents:
        if parent.is_symlink():
            raise ValueError("Symlink in Antigravity settings path")
    st = current_path.lstat()
    if not stat.S_ISREG(st.st_mode):
        raise ValueError("Existing Antigravity policy is not a regular file")
    if reviewer_uid is not None and st.st_uid != reviewer_uid:
        raise ValueError("Existing Antigravity policy has an unexpected owner")
    if os.name == "posix" and st.st_mode & 0o022:
        raise ValueError("Existing Antigravity policy is writable by another user")
    if st.st_nlink != 1:
        raise ValueError("Existing Antigravity policy has multiple hard links")

    desired = (desired_path if isinstance(desired_path, dict) else
               json.loads(desired_path.read_text(encoding="utf-8")))
    current = json.loads(current_path.read_text(encoding="utf-8"))
    message = "Unsafe or unknown permission changes; refusing overwrite"
    if not isinstance(current, dict) or current.get("enableTerminalSandbox") is not True:
        raise ValueError(message)
    permissions = current.get("permissions")
    if not isinstance(permissions, dict) or set(permissions) - {"allow", "deny", "ask"}:
        raise ValueError(message)
    # Antigravity 1.4.1 removes an empty allow list when saving settings.
    # Missing is safe; explicit null, other types, and any grant are rejected.
    if permissions.get("allow", []) != []:
        raise ValueError(message)
    for name in ("deny", "ask"):
        rules = permissions.get(name)
        if not isinstance(rules, list) or any(not isinstance(r, str) for r in rules):
            raise ValueError(message)
        permitted = set(desired["permissions"][name])
        if name == "deny":
            permitted.add("unsandboxed(*)")
        if not set(desired["permissions"][name]).issubset(rules) or set(rules) - permitted:
            raise ValueError(message)
    if "unsandboxed(*)" not in permissions["deny"]:
        return "UNCHANGED"
    permissions["deny"] = [r for r in permissions["deny"] if r != "unsandboxed(*)"]

    # Atomically save the narrowly edited document. Preserve
    # its owner and group so the isolated user can manage their own login.
    fd, tmp = tempfile.mkstemp(prefix=".gemini-policy-", dir=current_path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            if os.name == "posix":
                os.fchown(out.fileno(), st.st_uid, st.st_gid)
                os.fchmod(out.fileno(), stat.S_IMODE(st.st_mode))
            out.write(json.dumps(current, indent=2) + "\n")
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
        reviewer_uid = int(sys.argv[3])
        if reviewer_uid <= 0:
            raise ValueError("Refusing root reviewer identity")
        # Read only the maintainer-owned policy before dropping root. All
        # reviewer-controlled paths and temporary files are handled afterwards.
        desired = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        if os.name == "posix" and os.geteuid() == 0:
            import pwd
            account = pwd.getpwuid(reviewer_uid)
            os.setgroups([])
            os.setgid(account.pw_gid)
            os.setuid(reviewer_uid)
        print("Gemini settings:", reconcile(desired, Path(sys.argv[2]), reviewer_uid))
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"Refusing Gemini settings replacement: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
