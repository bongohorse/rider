"""#683: the embedded editor UI fonts match the OFL font files they are generated from."""
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


class UiFontsTest(unittest.TestCase):
    def test_generated_fonts_are_current(self):
        result = subprocess.run([sys.executable, str(ROOT / "tools/ui/build_ui_fonts.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_licences_ship_with_fonts(self):
        fonts = ROOT / "main/editor/web/fonts"
        for name in ("OFL-Baloo2.txt", "OFL-Nunito.txt"):
            self.assertIn("SIL Open Font License", (fonts / name).read_text(encoding="utf-8-sig"))


if __name__ == "__main__":
    unittest.main()
