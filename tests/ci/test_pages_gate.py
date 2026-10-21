"""Pages must deploy after a green gate even with intentionally skipped ancestors."""
from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[2]


class PagesGate(unittest.TestCase):
    def test_deployment_requires_green_main_code_change_and_overrides_implicit_success(self):
        workflow = yaml.load(
            (ROOT / '.github/workflows/ci.yml').read_text(), Loader=yaml.BaseLoader
        )
        pages = workflow['jobs']['pages']
        self.assertEqual(set(pages['needs']), {'changes', 'required'})
        # Without a status function GitHub adds success(), which also checks
        # skipped ancestors (e.g. Bridge on the gameplay fast path, issue #242).
        # Keep the explicit gate: always() alone could publish a failed build.
        self.assertEqual(
            pages['if'],
            "always() && github.ref == 'refs/heads/main' "
            "&& needs.changes.outputs.docs_only != 'true' "
            "&& needs.required.result == 'success'",
        )
        self.assertEqual(pages['uses'], './.github/workflows/pages.yml')


if __name__ == '__main__':
    unittest.main()
