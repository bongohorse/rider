"""Static checks for the restricted Gemini review policy and setup entry point."""

import copy
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import subprocess
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
SETTINGS = ROOT / "tools/security/gemini-readonly-settings.json"
SETUP = ROOT / "tools/security/setup_gemini_reviewer.sh"
sys.path.insert(0, str(ROOT / "tools/security"))
from reconcile_gemini_settings import reconcile  # noqa: E402
import reconcile_gemini_settings as migration  # noqa: E402

class GeminiReviewerPolicyTests(unittest.TestCase):
    def test_explicit_deny_with_no_permission_bypass(self):
        settings = json.loads(SETTINGS.read_text(encoding="utf-8"))
        self.assertTrue(settings["enableTerminalSandbox"])
        self.assertEqual(settings["permissions"]["allow"], [])
        for item in ("write_file(*)", "command(*)", "mcp(*)", "execute_url(*)", "read_file(/mnt/)",
                     "read_file(/home/mega/)"):
            self.assertIn(item, settings["permissions"]["deny"])
        self.assertEqual(settings["permissions"]["ask"], ["read_url(*)"])
        self.assertNotIn("unsandboxed(*)", settings["permissions"]["deny"])


    def test_known_legacy_policy_migrates_once_without_loosening_denies(self):
        with tempfile.TemporaryDirectory() as temp:
            previous = Path(temp) / "installed.json"
            desired = json.loads(SETTINGS.read_text(encoding="utf-8"))
            old = copy.deepcopy(desired)
            old["permissions"]["deny"].insert(
                old["permissions"]["deny"].index("command(*)") + 1,
                "unsandboxed(*)",
            )
            previous.write_text(json.dumps(old, indent=2) + "\n", encoding="utf-8")
            if os.name == "posix":
                previous.chmod(0o600)
            expected_uid = os.getuid() if hasattr(os, "getuid") else None
            self.assertEqual(reconcile(SETTINGS, previous, expected_uid), "MIGRATED")
            self.assertEqual(json.loads(previous.read_text(encoding="utf-8")), desired)
            self.assertEqual(reconcile(SETTINGS, previous, expected_uid), "UNCHANGED")
            if os.name == "posix":
                self.assertEqual(stat.S_IMODE(previous.stat().st_mode), 0o600)

    def test_unrecognized_custom_config_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            current = Path(temp) / "installed.json"
            custom = json.loads(SETTINGS.read_text(encoding="utf-8"))
            custom["permissions"]["allow"].append("command(git)")
            original = json.dumps(custom)
            current.write_text(original, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "refusing overwrite"):
                reconcile(SETTINGS, current)
            self.assertEqual(current.read_text(encoding="utf-8"), original)

    def test_symlinked_settings_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            real = Path(temp) / "settings.json"
            real.write_text(SETTINGS.read_text(encoding="utf-8"), encoding="utf-8")
            symlink = Path(temp) / "linked-settings.json"
            try:
                symlink.symlink_to(real)
            except (OSError, NotImplementedError):
                self.skipTest("OS disallows symlinks without privilege")
            with self.assertRaisesRegex(ValueError, "not a regular file"):
                reconcile(SETTINGS, symlink)

    def test_cli_saved_config_preserves_unknown_settings_and_missing_allow(self):
        with tempfile.TemporaryDirectory() as temp:
            current = Path(temp) / "settings.json"
            settings = json.loads(SETTINGS.read_text(encoding="utf-8"))
            del settings["permissions"]["allow"]
            settings["permissions"]["deny"].append("unsandboxed(*)")
            settings["permissions"]["deny"].reverse()
            settings["trustedWorkspaces"] = ["/opt/rider-gemini-review/example"]
            settings["theme"] = {"name": "example"}
            current.write_text(json.dumps(settings, sort_keys=True), encoding="utf-8")
            if os.name == "posix":
                current.chmod(0o640)
            before = current.stat()
            self.assertEqual(reconcile(SETTINGS, current), "MIGRATED")
            settings["permissions"]["deny"].remove("unsandboxed(*)")
            self.assertEqual(json.loads(current.read_text(encoding="utf-8")), settings)
            after = current.stat()
            if os.name == "posix":
                self.assertEqual((after.st_uid, after.st_gid, stat.S_IMODE(after.st_mode)),
                                 (before.st_uid, before.st_gid, stat.S_IMODE(before.st_mode)))
            content = current.read_bytes()
            self.assertEqual(reconcile(SETTINGS, current), "UNCHANGED")
            self.assertEqual(current.read_bytes(), content)
            self.assertEqual(current.stat().st_mtime_ns, after.st_mtime_ns)

    def test_current_policy_is_byte_for_byte_unchanged(self):
        with tempfile.TemporaryDirectory() as temp:
            current = Path(temp) / "settings.json"
            original = json.dumps(json.loads(SETTINGS.read_text()), sort_keys=True)
            current.write_text(original, encoding="utf-8")
            self.assertEqual(reconcile(SETTINGS, current), "UNCHANGED")
            self.assertEqual(current.read_text(encoding="utf-8"), original)

    def test_security_changes_are_rejected_without_modification(self):
        mutations = [
            lambda s: s.update(enableTerminalSandbox=False),
            lambda s: s["permissions"].update(allow=None),
            lambda s: s["permissions"].update(allow=["write_file(*)"]),
            lambda s: s["permissions"].update(allow=["command(*)"]),
            lambda s: s["permissions"]["deny"].remove("write_file(*)"),
            lambda s: s["permissions"]["deny"].remove("read_file(/home/mega/)"),
            lambda s: s["permissions"].update(ask=[]),
            lambda s: s["permissions"].update(bypass=True),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate), tempfile.TemporaryDirectory() as temp:
                current = Path(temp) / "settings.json"
                settings = json.loads(SETTINGS.read_text(encoding="utf-8"))
                mutate(settings)
                current.write_text(json.dumps(settings), encoding="utf-8")
                original = current.read_bytes()
                with self.assertRaisesRegex(ValueError, "refusing overwrite"):
                    reconcile(SETTINGS, current)
                self.assertEqual(current.read_bytes(), original)

    @unittest.skipUnless(hasattr(os, "getuid"), "POSIX ownership required")
    def test_unexpected_owner_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            current = Path(temp) / "settings.json"
            current.write_text(SETTINGS.read_text(encoding="utf-8"), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unexpected owner"):
                reconcile(SETTINGS, current, os.getuid() + 1)

    def test_symlinked_parent_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            real = Path(temp) / "real"
            real.mkdir()
            (real / "settings.json").write_text(SETTINGS.read_text(encoding="utf-8"), encoding="utf-8")
            link = Path(temp) / "linked"
            try:
                link.symlink_to(real, target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("OS disallows symlinks without privilege")
            with self.assertRaisesRegex(ValueError, "Symlink"):
                reconcile(SETTINGS, link / "settings.json")

    @unittest.skipUnless(os.name == "posix", "POSIX privilege drop required")
    def test_root_entrypoint_drops_privileges_before_settings_access(self):
        import pwd
        events = []
        with mock.patch.object(sys, "argv", ["helper", str(SETTINGS), "/unused/settings.json", "1234"]), \
             mock.patch.object(os, "geteuid", return_value=0), \
             mock.patch.object(pwd, "getpwuid", return_value=mock.Mock(pw_gid=1234)), \
             mock.patch.object(os, "setgroups", side_effect=lambda x: events.append(("groups", x))), \
             mock.patch.object(os, "setgid", side_effect=lambda x: events.append(("gid", x))), \
             mock.patch.object(os, "setuid", side_effect=lambda x: events.append(("uid", x))), \
             mock.patch.object(migration, "reconcile", side_effect=lambda *args: events.append(("reconcile", args[2])) or "UNCHANGED"):
            self.assertEqual(migration.main(), 0)
        self.assertEqual(events, [("groups", []), ("gid", 1234), ("uid", 1234), ("reconcile", 1234)])

    @unittest.skipUnless(os.name == "posix", "POSIX file protection required")
    def test_shared_writable_or_hardlinked_settings_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            current = Path(temp) / "settings.json"
            current.write_text(SETTINGS.read_text(encoding="utf-8"), encoding="utf-8")
            current.chmod(0o666)
            with self.assertRaisesRegex(ValueError, "writable"):
                reconcile(SETTINGS, current)
            current.chmod(0o600)
            os.link(current, Path(temp) / "alias.json")
            with self.assertRaisesRegex(ValueError, "hard links"):
                reconcile(SETTINGS, current)

    def test_bash_syntax_on_linux(self):
        bash = shutil.which("bash")
        if bash is None:
            self.skipTest("bash unavailable on this CI host")
        subprocess.run([bash, "-n", str(SETUP)], check=True)

    def test_copied_snapshot_directories_are_traversable_but_read_only(self):
        if not sys.platform.startswith("linux"):
            self.skipTest("POSIX mode preservation regression is Linux-specific")
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
        self.assertIn("os.O_DIRECTORY | os.O_NOFOLLOW", script)
        self.assertIn("os.fchown(root_fd, uid, gid)", script)
        self.assertIn("os.setuid(uid)", script)
        self.assertNotIn('sudo install -d -m 700', script)
        self.assertNotIn('sudo chown -R', script.split("# Evidence only:")[0].replace("sudo chown -R root:root", ""))
        self.assertIn('sudo find "$snapshot" -type d -exec chmod a+rx {} +', script)
        self.assertIn('sudo -u "$review_user" -H test -w', script)
        self.assertIn('sudo -u "$review_user" -H test -x "$HOME"', script)
        self.assertIn("for secret in", script)
        self.assertIn('sudo -u "$review_user" -H test -r "$secret"', script)

if __name__ == "__main__":
    unittest.main()
