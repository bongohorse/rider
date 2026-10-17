"""Static checks for the restricted Gemini review policy and setup entry point."""

import json
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SETTINGS = ROOT / "tools/security/gemini-readonly-settings.json"
SETUP = ROOT / "tools/security/setup_gemini_reviewer.sh"

class GeminiReviewerPolicyTests(unittest.TestCase):
    def test_explicit_deny_with_no_permission_bypass(self):
        settings = json.loads(SETTINGS.read_text(encoding="utf-8"))
        self.assertTrue(settings["enableTerminalSandbox"])
        self.assertEqual(settings["permissions"]["allow"], [])
        for item in ("write_file(*)", "command(*)", "unsandboxed(*)",
                     "mcp(*)", "execute_url(*)", "read_file(/mnt/)",
                     "read_file(/home/mega/)"):
            self.assertIn(item, settings["permissions"]["deny"])
        self.assertEqual(settings["permissions"]["ask"], ["read_url(*)"])

    def test_bash_syntax_on_linux(self):
        bash = shutil.which("bash")
        if bash is None:
            self.skipTest("bash unavailable on this CI host")
        subprocess.run([bash, "-n", str(SETUP)], check=True)

    def test_copied_snapshot_directories_are_traversable_but_read_only(self):
        # Reproduces GNU cp -a preserving mktemp's private 0700 directory
        # mode on an already-existing destination. Does not use sudo or
        # change the actual WSL user/snapshot.
        if any(shutil.which(cmd) is None for cmd in ("cp", "chmod", "find")):
            self.skipTest("POSIX file tools unavailable")
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "private-archive"
            destination = Path(temp) / "snapshot"
            source.mkdir(mode=0o700)
            destination.mkdir(mode=0o755)
            (source / "AGENTS.md").write_text("test", encoding="utf-8")

            subprocess.run(["cp", "-a", str(source) + "/.", str(destination)], check=True)
            subprocess.run(["chmod", "-R", "a-w", str(destination)], check=True)
            self.assertFalse(stat.S_IMODE(destination.stat().st_mode) & stat.S_IXOTH)

            # Exact repair included in the setup script, safe to repeat.
            command = ["find", str(destination), "-type", "d",
                       "-exec", "chmod", "a+rx", "{}", "+"]
            subprocess.run(command, check=True)
            subprocess.run(command, check=True)
            directory_mode = stat.S_IMODE(destination.stat().st_mode)
            self.assertTrue(directory_mode & stat.S_IXOTH)
            self.assertTrue(directory_mode & stat.S_IROTH)
            self.assertFalse(directory_mode & stat.S_IWOTH)
            file_mode = stat.S_IMODE((destination / "AGENTS.md").stat().st_mode)
            self.assertTrue(file_mode & stat.S_IROTH)
            self.assertFalse(file_mode & stat.S_IWOTH)

    def test_script_refuses_root_and_reserves_snapshot_for_root(self):
        script = SETUP.read_text(encoding="utf-8")
        self.assertIn("id -u", script)
        self.assertIn("git -C \"$repo\" archive", script)
        self.assertIn("sudo chown -R root:root", script)
        self.assertIn("sudo chmod -R a-w", script)
        self.assertIn('sudo find "$snapshot" -type d -exec chmod a+rx {} +', script)
        self.assertIn('sudo -u "$review_user" -H test -w', script)
        self.assertIn('sudo -u "$review_user" -H test -x "$HOME"', script)
        self.assertIn("for secret in", script)
        self.assertIn('sudo -u "$review_user" -H test -r "$secret"', script)

if __name__ == "__main__":
    unittest.main()
