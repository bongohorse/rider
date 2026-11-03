"""tools/ci/editor_inventory.py (#331): the lexical scope scan behind the editor E0 inventory."""
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "ci"))
from editor_inventory import report, scan

SAMPLE = """local editor=require "main.editor.editor"
local LIMIT,cache=3,{}
local later
-- local commented=1
local function helper(a,b) return a+b end
local function uses(self,x)
    local LIMIT=x  -- shadows the file-scope constant
    for i,v in ipairs(self.items) do if v and i then cache[i]=helper(v,LIMIT) end end
    editor.message=self.text
    cache=nil
end
later=function() return editor.selection,[[long
string]] end
function init(self) self.items={} uses(self,1) later() end
"""


class EditorInventory(unittest.TestCase):
    def setUp(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "sample.gui_script"
            path.write_text(SAMPLE, encoding="utf-8")
            self.d = scan(path)
        self.f = {f["name"]: f for f in self.d["functions"]}

    def test_top_level_functions_and_file_locals(self):
        self.assertEqual(list(self.f), ["helper", "uses", "later", "init"])
        self.assertEqual((self.f["uses"]["start"], self.f["uses"]["end"]), (6, 11))
        self.assertEqual((self.f["later"]["start"], self.f["later"]["end"]), (12, 13))
        self.assertTrue(self.f["init"]["global"])
        self.assertEqual(set(self.d["file_locals"]), {"editor", "LIMIT", "cache", "later", "helper", "uses"})
        self.assertNotIn("commented", self.d["file_locals"])

    def test_reads_writes_shadowing_and_fields(self):
        uses = self.f["uses"]
        self.assertEqual(uses["upvalues"], ["cache", "editor", "helper"])  # local LIMIT shadows
        self.assertIn("cache", uses["write"])
        self.assertIn("cache", uses["mutate"])
        self.assertEqual(list(uses["editor_w"]), ["message"])
        self.assertEqual(set(uses["self_r"]), {"items", "text"})
        self.assertEqual(list(self.f["init"]["self_w"]), ["items"])
        self.assertIn("ipairs", uses["globals"])
        self.assertEqual(uses["complexity"], 1 + 3)  # for, if, and
        summary = list(report(self.d, "summary"))
        self.assertIn("4 top-level functions, 6 file-scope locals (3 data, 3 functions)", summary[0])
        self.assertTrue(summary[1].startswith("longest: uses 6"))

    def test_real_editor_script_matches_grep(self):
        path = ROOT / "main/editor/editor.gui_script"
        text = path.read_text(encoding="utf-8")
        grep = len(re.findall(r"^(?:local function |function |[a-z_]+=function)", text, re.M))
        d = scan(path)
        self.assertEqual(len(d["functions"]), grep)
        self.assertTrue(all(f["end"] >= f["start"] for f in d["functions"]))
        self.assertEqual(d["lines"], text.count("\n") + (not text.endswith("\n")))


if __name__ == "__main__":
    unittest.main()
