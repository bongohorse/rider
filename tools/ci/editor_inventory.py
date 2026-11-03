#!/usr/bin/env python3
"""Lexical inventory of a Lua script for the editor split (#331); stdlib only, no execution.

Usage: python tools/ci/editor_inventory.py [FILE] [--section NAME] [--json OUT]
FILE defaults to main/editor/editor.gui_script; sections: summary (default), functions, locals,
self, editor, complexity. Output feeds docs/reports/EDITOR_E0_INVENTORY.md.

The scanner tokenizes Lua 5.1, tracks block scopes (function/do/then/else/repeat), locals,
parameters and for variables, and records for every top-level function (file-scope `local
function`, `name=function` or global `function name`): its line range, the file-scope locals it
reads, assigns or field-writes, `self.<field>` and `editor.<field>` reads/writes, free globals and
an approximate complexity. Limits: writes through an alias (`local c=editor.camera; c.x=1`) and
dynamic keys (`self[key]`) are not attributed; `local a=a` declares before its initializer.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "main/editor/editor.gui_script"
KEYWORDS = set("and break do else elseif end false for function if in local nil not or repeat "
               "return then true until while goto".split())
OPS = ["...", "..", "==", "~=", "<=", ">=", "::", "+", "-", "*", "/", "%", "^", "#", "<", ">",
       "=", "(", ")", "{", "}", "[", "]", ";", ":", ",", "."]
BRANCHES = {"if", "elseif", "for", "while", "repeat", "and", "or"}
DEFOLD = ["gui", "msg", "sys", "window", "html5", "go", "json", "socket", "os", "hash", "vmath"]
NUMBER = re.compile(r"0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?")
NAME = re.compile(r"[A-Za-z_][A-Za-z_0-9]*")
LONG = re.compile(r"\[(=*)\[")


def lex(src):
    """Lua 5.1 tokens as (kind, text, line); comments and whitespace dropped."""
    toks, i, line, n = [], 0, 1, len(src)
    while i < n:
        c = src[i]
        if c in " \t\r\n":
            line += c == "\n"
            i += 1
            continue
        if src.startswith("--", i):
            m = LONG.match(src, i + 2)
            if m:
                end = src.find("]" + m.group(1) + "]", m.end())
                j = n if end < 0 else end + len(m.group(1)) + 2
            else:
                j = src.find("\n", i)
                j = n if j < 0 else j
            line += src.count("\n", i, j)
            i = j
            continue
        m = LONG.match(src, i)
        if m:
            j = src.find("]" + m.group(1) + "]", m.end()) + len(m.group(1)) + 2
            toks.append(("str", "<long>", line))
            line += src.count("\n", i, j)
            i = j
            continue
        if c in "\"'":
            j = i + 1
            while src[j] != c:
                j += 2 if src[j] == "\\" else 1
            toks.append(("str", src[i:j + 1], line))
            line += src.count("\n", i, j)
            i = j + 1
            continue
        if c.isdigit() or (c == "." and src[i + 1:i + 2].isdigit()):
            m = NUMBER.match(src, i)
            toks.append(("num", m.group(0), line))
            i = m.end()
            continue
        m = NAME.match(src, i)
        if m:
            word = m.group(0)
            toks.append(("kw" if word in KEYWORDS else "name", word, line))
            i = m.end()
            continue
        op = next((o for o in OPS if src.startswith(o, i)), None)
        if op is None:
            raise SyntaxError(f"line {line}: unexpected {c!r}")
        toks.append(("op", op, line))
        i += len(op)
    toks.append(("eof", "", line))
    return toks


class Scanner:
    def __init__(self, toks):
        self.t = toks
        self.scopes = [set()]          # scopes[0] is the file scope
        self.blocks = []               # open block kinds
        self.brackets = [[]]           # bracket stack per function frame
        self.depth = 0                 # nesting of function bodies
        self.pending = []              # for-loop names declared by the next `do`
        self.local_function = False    # the next `function` token belongs to `local function`
        self.file_locals = {}          # name -> declaration line
        self.functions = []
        self.cur = None
        self.top = {"read": {}, "write": {}, "mutate": {}, "globals": {}}

    def scope_of(self, name):
        for k in range(len(self.scopes) - 1, -1, -1):
            if name in self.scopes[k]:
                return k
        return None

    def note(self, kind, name, line):
        target = self.cur if self.cur is not None else self.top
        target[kind].setdefault(name, []).append(line)

    def assigned(self, i):
        """True when the name at i (bracket depth 0) starts or belongs to an assignment target list."""
        t, j, prev = self.t, i + 1, self.t[i]
        while True:
            kind, text, _ = t[j]
            if kind == "op" and text == "=":
                return True
            if kind in ("kw", "eof", "str", "num") or text in ("(", ":", "{", ";"):
                return False
            if kind == "name" and (prev[0] == "name" or prev[1] in (")", "]")):
                return False
            if text == "[":
                depth = 0
                while True:
                    depth += {"[": 1, "]": -1}.get(t[j][1], 0)
                    if depth == 0:
                        break
                    j += 1
            elif kind != "name" and text not in (",", "."):
                return False
            prev = t[j]
            j += 1

    def start(self, name, line, global_=False):
        self.cur = {"name": name, "start": line, "end": None, "global": global_, "read": {}, "write": {},
                    "mutate": {}, "globals": {}, "self_r": {}, "self_w": {}, "editor_r": {}, "editor_w": {}}
        self.functions.append(self.cur)

    def open(self, kind, names):
        self.scopes.append(set(names))
        self.blocks.append(kind)

    def close(self, line):
        kind = self.blocks.pop()
        self.scopes.pop()
        if kind == "function":
            self.depth -= 1
            self.brackets.pop()
            if self.depth == 0 and self.cur is not None and len(self.scopes) == 1:
                self.cur["end"] = line
                self.cur = None

    def names_at(self, j):
        names = []
        while self.t[j][0] == "name":
            names.append(self.t[j][1])
            j += 2 if self.t[j + 1][1] == "," else 1
            if self.t[j - 1][1] != ",":
                break
        return names, j

    def function(self, i, line):
        t, j = self.t, i + 1
        name = None
        if t[j][0] == "name":
            chain = [t[j][1]]
            j += 1
            while t[j][1] in (".", ":"):
                chain.append(t[j + 1][1])
                j += 2
            name = ".".join(chain)
            if not self.local_function:
                k = self.scope_of(chain[0])
                if len(chain) == 1:
                    if k is not None:
                        self.note("write", chain[0], line)
                    if self.depth == 0:
                        self.start(name, line, global_=k is None)
                elif k == 0:
                    self.note("mutate", chain[0], line)
        elif self.depth == 0 and self.cur is None and t[i - 1][1] == "=" and t[i - 2][0] == "name":
            self.start(t[i - 2][1], line)  # forward-declared `x=function`
        self.local_function = False
        params = ["self"] if any(tok[1] == ":" for tok in t[i:j]) else []
        j += 1  # "("
        while t[j][1] != ")":
            if t[j][0] == "name":
                params.append(t[j][1])
            j += 1
        self.open("function", params)
        self.depth += 1
        self.brackets.append([])
        return j + 1

    def name(self, i, line):
        t = self.t
        kind_, text, _ = t[i]
        prev, nxt, br = t[i - 1], t[i + 1], self.brackets[-1]
        if prev[0] == "op" and prev[1] in (".", ":"):
            return
        if br and br[-1] == "{" and prev[1] in ("{", ",", ";") and nxt[1] == "=":
            return  # table constructor key
        assigned = not br and self.assigned(i)
        kind = ("write" if nxt[1] in ("=", ",") else "mutate") if assigned else "read"
        k = self.scope_of(text)
        if k == 0:
            self.note(kind, text, line)
        elif k is None:
            self.note("globals", text, line)
        if text in ("self", "editor") and nxt[1] == "." and t[i + 2][0] == "name" and self.cur is not None:
            write = assigned and t[i + 3][1] in ("=", ",")
            self.cur[text + ("_w" if write else "_r")].setdefault(t[i + 2][1], []).append(line)

    def run(self):
        t, i = self.t, 0
        while t[i][0] != "eof":
            kind, text, line = t[i]
            if kind == "kw" and text == "local":
                if t[i + 1][1] == "function":
                    fname = t[i + 2][1]
                    self.scopes[-1].add(fname)
                    if self.depth == 0 and len(self.scopes) == 1:
                        self.file_locals[fname] = line
                        self.start(fname, line)
                    self.local_function = True
                    i += 1
                    continue
                names, j = self.names_at(i + 1)
                for n in names:
                    self.scopes[-1].add(n)
                    if len(self.scopes) == 1:
                        self.file_locals.setdefault(n, line)
                if len(self.scopes) == 1 and len(names) == 1 and t[j][1] == "=" and t[j + 1][1] == "function":
                    self.start(names[0], line)
                i = j
            elif kind == "kw" and text == "function":
                i = self.function(i, line)
            elif kind == "kw" and text in ("do", "then", "repeat"):
                self.open(text, self.pending if text == "do" else [])
                self.pending = []
                i += 1
            elif kind == "kw" and text in ("elseif", "else"):
                self.close(line)
                if text == "else":
                    self.open(text, [])
                i += 1
            elif kind == "kw" and text in ("end", "until"):
                self.close(line)
                i += 1
            elif kind == "kw" and text == "for":
                self.pending, i = self.names_at(i + 1)
            elif kind == "op" and text in ("(", "{", "["):
                self.brackets[-1].append(text)
                i += 1
            elif kind == "op" and text in (")", "}", "]"):
                self.brackets[-1].pop()
                i += 1
            elif kind == "name":
                self.name(i, line)
                i += 1
            else:
                i += 1
        return self


def scan(path):
    src = Path(path).read_text(encoding="utf-8")
    toks = lex(src)
    s = Scanner(toks).run()
    for f in s.functions:
        f["complexity"] = 1 + sum(1 for k, x, ln in toks if k == "kw" and x in BRANCHES and f["start"] <= ln <= f["end"])
        f["upvalues"] = sorted({n for n in (*f["read"], *f["write"], *f["mutate"]) if n in s.file_locals and n != f["name"]})
    return {"file": str(path), "lines": src.count("\n") + (not src.endswith("\n")), "bytes": len(src.encode()),
            "function_keywords": sum(1 for k, x, _ in toks if k == "kw" and x == "function"),
            "file_locals": s.file_locals, "file_scope": s.top, "functions": s.functions}


def callers(d, name):
    return sorted({f["name"] for f in d["functions"] if f["name"] != name and name in f["read"]})


def fields(d, key):
    out = {}
    for f in d["functions"]:
        for field in f[key + "_w"]:
            out.setdefault(field, [set(), set()])[0].add(f["name"])
        for field in f[key + "_r"]:
            out.setdefault(field, [set(), set()])[1].add(f["name"])
    return out


def report(d, section):
    fs, fl = d["functions"], d["file_locals"]
    names = {f["name"] for f in fs}
    if section == "summary":
        data = [n for n in fl if n not in names]
        top = sorted(fs, key=lambda f: f["start"] - f["end"])[:5]
        yield (f"{d['file']}: {d['lines']} lines, {d['bytes']} bytes, {d['function_keywords']} function keywords, "
               f"{len(fs)} top-level functions, {len(fl)} file-scope locals ({len(data)} data, {len(fl) - len(data)} functions)")
        yield "longest: " + ", ".join(f"{f['name']} {f['end'] - f['start'] + 1}" for f in top)
        if fs:
            most = max(fs, key=lambda f: len(f["upvalues"]))
            yield f"most upvalues: {most['name']} {len(most['upvalues'])}; total complexity {sum(f['complexity'] for f in fs)}"
    elif section == "functions":
        yield "name\tlines\tlength\tupvalues\tcomplexity\tself\teditor\tglobals\tcalled_by"
        for f in fs:
            rw = lambda k: ("r" if f[k + "_r"] or k in f["read"] else "") + ("w" if f[k + "_w"] or k in f["mutate"] else "")
            api = ",".join(g for g in DEFOLD if g in f["globals"])
            yield "\t".join([f["name"], f"{f['start']}-{f['end']}", str(f["end"] - f["start"] + 1), str(len(f["upvalues"])),
                             str(f["complexity"]), rw("self") or "-", rw("editor") or "-", api or "-",
                             ",".join(callers(d, f["name"])) or ("Defold" if f["global"] else "-")])
    elif section == "locals":
        yield "name\tline\twritten_by\tfield_written_by\tread_by"
        for n, line in sorted(fl.items(), key=lambda x: x[1]):
            if n in names:
                continue
            col = lambda k: ",".join(f["name"] for f in fs if n in f[k]) or "-"
            yield "\t".join([n, str(line), col("write"), col("mutate"), col("read")])
    elif section in ("self", "editor"):
        yield "field\twritten_by\tread_by"
        for field, (w, r) in sorted(fields(d, section).items()):
            yield f"{field}\t{','.join(sorted(w)) or '-'}\t{','.join(sorted(r)) or '-'}"
    elif section == "complexity":
        for f in sorted(fs, key=lambda f: -f["complexity"]):
            yield f"{f['complexity']}\t{f['name']}"


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("file", nargs="?", default=str(DEFAULT))
    p.add_argument("--section", default="summary", choices=["summary", "functions", "locals", "self", "editor", "complexity"])
    p.add_argument("--json", help="also write the raw scan as JSON")
    args = p.parse_args(argv)
    d = scan(args.file)
    if args.json:
        Path(args.json).write_text(json.dumps(d, indent=1), encoding="utf-8")
    for row in report(d, args.section):
        print(row)
    return 0


if __name__ == "__main__":
    sys.exit(main())
