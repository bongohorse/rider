#!/usr/bin/env bash
# Prepare an isolated, read-only Rider source snapshot for Google Antigravity CLI.
# Run from the ordinary WSL user; this script asks sudo only for OS account and
# root-owned snapshot setup. It never reads or copies account credentials.
set -euo pipefail

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
review_user="rider-gemini"
snapshots="/opt/rider-gemini-review"
policy="$repo/tools/security/gemini-readonly-settings.json"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as your ordinary WSL user, not root." >&2
  exit 2
fi
for tool in git tar sudo python3; do
  command -v "$tool" >/dev/null || { echo "Missing command: $tool" >&2; exit 2; }
done
if [[ "$(git -C "$repo" rev-parse --show-toplevel)" != "$repo" ]]; then
  echo "Expected a normal Rider working tree." >&2
  exit 2
fi
if [[ -n "$(git -C "$repo" status --porcelain)" ]]; then
  echo "Repository is dirty; commit/reconcile changes before creating a snapshot." >&2
  exit 2
fi

sha="$(git -C "$repo" rev-parse HEAD)"
snapshot="$snapshots/$sha"
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT

# Extract tracked source as the ordinary user, never as root.
git -C "$repo" archive --format=tar "$sha" | tar -xf - -C "$scratch"
if [[ -n "$(find "$scratch" -type l -print -quit)" ]]; then
  echo "Refusing snapshot with symlink entries; review source paths first." >&2
  exit 2
fi

python3 - "$policy" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    settings = json.load(f)
expected = {"write_file(*)", "command(*)", "mcp(*)", "execute_url(*)"}
actual = set(settings.get("permissions", {}).get("deny", []))
if (not expected.issubset(actual) or "unsandboxed(*)" in actual
        or settings.get("enableTerminalSandbox") is not True):
    raise SystemExit("Gemini deny/sandbox policy is incomplete")
PY

if ! id "$review_user" >/dev/null 2>&1; then
  sudo useradd -m -U -s /bin/bash "$review_user"
fi
if [[ "$(id -u "$review_user")" -eq 0 ]]; then
  echo "Refusing reviewer account with UID 0" >&2
  exit 2
fi
for group in $(id -nG "$review_user"); do
  case "$group" in
    sudo|wheel|docker|adm) echo "Reviewer is in privileged group: $group" >&2; exit 2 ;;
  esac
done

review_home="$(getent passwd "$review_user" | cut -d: -f6)"
review_group="$(id -gn "$review_user")"
review_uid="$(id -u "$review_user")"
settings_root="$review_home/.gemini"
settings_dir="$settings_root/antigravity-cli"
settings="$settings_dir/settings.json"

# GNU install -d -o USER on a deep path can create *intermediate*
# directories as root. Prior versions created ~/.gemini as root-owned,
# making Antigravity's ~/.gemini/config/projects creation fail.
# Repair only that specific directory, never recursively chown the home.
if [[ "$review_home" != "/home/$review_user" ]]; then
  echo "Unexpected reviewer home: $review_home" >&2
  exit 2
fi
for path in "$settings_root" "$settings_dir" "$settings"; do
  if sudo test -L "$path"; then
    echo "Refusing symbolic link in Gemini settings path: $path" >&2
    exit 2
  fi
done
if sudo test -e "$settings_root"; then
  current_owner="$(sudo stat -c '%u' "$settings_root")"
  if [[ "$current_owner" != 0 && "$current_owner" != "$review_uid" ]]; then
    echo "Unexpected owner of Gemini settings root: $current_owner" >&2
    exit 2
  fi
fi
sudo install -d -m 700 -o "$review_user" -g "$review_group" "$settings_root"
sudo install -d -m 700 -o "$review_user" -g "$review_group" "$settings_dir"

# Never overwrite unexpected user-edited settings or auth state. The sole
# supported migration removes obsolete unsandboxed(*) from the exact
# previous repo policy; the already-denied command(*) covers commands.
if sudo test -e "$settings"; then
  sudo python3 "$repo/tools/security/reconcile_gemini_settings.py" \
    "$policy" "$settings" "$review_uid"
else
  sudo install -m 600 -o "$review_user" -g "$review_group" "$policy" "$settings"
fi

sudo install -d -m 755 -o root -g root "$snapshots"
if ! sudo test -d "$snapshot"; then
  sudo install -d -m 755 -o root -g root "$snapshot"
  sudo cp -a "$scratch/." "$snapshot/"
  sudo chown -R root:root "$snapshot"
  sudo chmod -R a-w "$snapshot"
fi

# `cp -a "$scratch/." "$snapshot/"` copies the mktemp source directory's 0700
# mode onto the existing destination directory. After a-w it becomes 0500:
# root can read it, but rider-gemini cannot traverse it. Repair even on a
# repeat run, where the snapshot already exists and copying is skipped.
# Grant directory search/read only; never grant reviewer write permission.
sudo find "$snapshot" -type d -exec chmod a+rx {} +

# Evidence only: never print or read the secret contents.
if ! sudo -u "$review_user" -H test -r "$snapshot/AGENTS.md"; then
  echo "FAIL: Gemini reviewer cannot read the snapshot" >&2
  exit 1
fi
if sudo -u "$review_user" -H test -w "$snapshot/AGENTS.md" ||
   sudo -u "$review_user" -H test -w "$snapshot"; then
  echo "FAIL: Gemini reviewer can write to snapshot" >&2
  exit 1
fi
# The reviewer must not be able to enter the maintainer's home directory,
# even if some non-secret individual files have loose permissions.
if sudo -u "$review_user" -H test -x "$HOME"; then
  echo "FAIL: reviewer can traverse maintainer HOME ($HOME)." >&2
  echo "After checking that no other local users need access, run: chmod 700 \"$HOME\"" >&2
  exit 1
fi
for secret in "$HOME/.config/gh/hosts.yml" "$HOME/.codex/auth.json" \
              "$HOME/.claude/.credentials.json"; do
  if [[ -e "$secret" ]] && sudo -u "$review_user" -H test -r "$secret"; then
    echo "FAIL: reviewer can read a maintainer credential path" >&2
    exit 1
  fi
done

echo "PASS: separate unprivileged OS identity: $review_user"
echo "PASS: root-owned read-only snapshot: $snapshot"
echo "PASS: non-traversable maintainer home and credential negative checks"
echo "PASS: restrictive Antigravity config: $settings"
echo "Next: install and authenticate agy while logged into the separate reviewer OS user."
echo "Use: sudo -iu $review_user"
echo "Then: cd $snapshot && agy"
