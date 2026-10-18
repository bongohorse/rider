"""Docs-only PRs must reject broken local links without network calls."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "ci"))
from check_docs_links import check_paths, targets


class RelativeLinks(unittest.TestCase):
    def test_broken_link_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "docs").mkdir()
            (root / "docs" / "readme.md").write_text("[broken](missing.md)\n")
            self.assertEqual(len(check_paths(root, ["docs/readme.md"])), 1)
            (root / "docs" / "missing.md").write_text("ok\n")
            self.assertEqual(check_paths(root, ["docs/readme.md"]), [])

    def test_fragment_and_links_to_parent(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "README.md").write_text("# Home\n")
            (root / "docs").mkdir()
            (root / "docs" / "readme.md").write_text(
                "# Heading\n"
                "[home](../README.md#home) [anchor](#heading) "
                "[site](https://example.org/foo) ![icon](../README.md)\n"
            )
            self.assertEqual(check_paths(root, ["docs/readme.md"]), [])

    def test_missing_anchor_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "README.md").write_text("# Home\n\n## Stop points (R1–R2)\n\n```md\n## Fake\n```\n## Dup\n## Dup\n")
            (root / "a.md").write_text(
                "[ok](README.md#stop-points-r1r2) [dup](README.md#dup-1) [self](#local)\n## Local\n"
                "[gone](README.md#level-editor) [fenced](README.md#fake) [selfgone](#nope)\n"
            )
            errors = check_paths(root, ["a.md"])
            self.assertEqual([e.split(": ", 1)[0] for e in errors], ["a.md:3", "a.md:3", "a.md:3"])
            self.assertTrue(all("missing anchor" in e for e in errors))

    def test_reference_and_fenced_code(self):
        inline = chr(96) + "[inline](missing.md)" + chr(96)
        lines = list(targets(
            "~~~md\n[fake](missing.md)\n~~~\n" + inline + "\n"
            "[thing][id]\n[id]: other.md\n"
            "[real](ok.md)\n"
        ))
        self.assertEqual(lines, [(6, "other.md"), (7, "ok.md")])

    def test_deleted_path(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(check_paths(Path(td), ["docs/deleted.md"]), [])


if __name__ == "__main__":
    unittest.main()
