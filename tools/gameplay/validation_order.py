#!/usr/bin/env python3
"""Characterize 3D look initialization in 20 fresh pinned-Bob LuaJIT processes (#511).

Writes evidence outside source by default. This tests source interfaces, not the engine's loader.
"""
import argparse
import copy
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/gameplay'))
from lua_tests import luajit_from_bob
sys.path.insert(0, str(ROOT / 'tools/g1'))
import build

ORDERS = ('station-first', 'document-first', 'look-first', 'boot')
VARIANTS = ('legacy', 'authored', 'invalid', 'newer', 'mismatch')


def lua_value(value):
    """Encode JSON fixture values as Lua literals, without loading a JSON decoder or editor module."""
    if value is None:
        return 'nil'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, str):
        return '"' + ''.join(f'\\{byte:03d}' for byte in value.encode('utf-8')) + '"'
    if isinstance(value, (int, float)):
        return json.dumps(value, allow_nan=False)
    if isinstance(value, list):
        return '{' + ','.join(lua_value(item) for item in value) + '}'
    if isinstance(value, dict):
        return '{' + ','.join('[' + lua_value(key) + ']=' + lua_value(item) for key, item in value.items()) + '}'
    raise TypeError(type(value).__name__)


PROBE = r'''
local function snapshot(label)
 local look=require 'main.terrain_perspective.look'
 local station=require 'main.game.station_data'
 local valid,err,unknown=station.validate(input)
 local mapped=look.mapping(input)~=nil
 local expected=variant=='legacy' or registered and variant~='invalid' and variant~='newer'
 assert(not not valid==not not expected,label..': unexpected station validation: '..tostring(err))
 assert(mapped==(registered and variant=='authored'),label..': unexpected local-style mapping')
 if not registered and variant~='legacy' then
  assert(err=='3D look requires supported editor source validation; open the source in the editor.')
 elseif variant=='invalid' then
  assert(err and err:find('width',1,true) and not unknown,label..': invalid source classification')
 elseif variant=='newer' then
  assert(err and err:find('Unsupported editor version',1,true) and unknown,label..': newer source protection')
 end
 print(table.concat({label,valid and 'accepted' or 'rejected',tostring(unknown==true),tostring(mapped),tostring(err)},'\t'))
end
-- Engine I/O is substituted: the unchanged A preset is decoded in Python, not by Defold's JSON library.
-- Validation/compilation and all boot-prefix modules remain real. No clock calls are needed.
sys={get_config_string=function(_,default)return default end,
 load_resource=function(path)assert(path=='/main/game/presets/a.json');return 'fixture-preset-a' end}
json={decode=function(text)assert(text=='fixture-preset-a');return preset end}
vmath={vector4=function(...)return {...} end} -- unused station-render tint constants
package.preload.socket=function()return {} end
local look,station,document
if order=='station-first' then station=require 'main.game.station_data'
elseif order=='document-first' then document=require 'main.editor.editor_doc'
elseif order=='look-first' then look=require 'main.terrain_perspective.look'
elseif order=='boot' then
 -- Execute the actual loader's leading require sequence, through editor_doc, without its engine callbacks.
 local file=assert(io.open('main/game/boot.script','r'));local source=file:read('*a');file:close()
 local reached=false
 for line in source:gmatch('[^\n]+') do
  local name=line:match('^local [%w_]+=require "([%w_.]+)"')
  if name then require(name);if name=='main.editor.editor_doc' then reached=true;break end end
 end
 assert(reached,'loader editor_doc startup import not found; re-evaluate boot characterization')
else error('Unknown entry order') end
look=require 'main.terrain_perspective.look'
registered=look.document~=nil
assert(registered==(order=='document-first' or order=='boot'),'unexpected early document registration')
snapshot('before-editor-registration')
document=require 'main.editor.editor_doc';station=require 'main.game.station_data'
assert(look.document==document,'document registration missing')
registered=true
snapshot('after-editor-registration')
local opened,note,conflict=document.open_level(input)
if variant=='invalid' or variant=='newer' then
 -- R1 retains playable cached geometry as source lines when the source cannot be opened.
 assert(opened and note and not conflict,'unsupported/invalid source must retain cached-geometry fallback')
else
 assert(opened,'supported source did not open')
 local compiled=assert(document.compile(opened))
 assert(station.validate(compiled),'compiled station validation failed')
 if variant=='mismatch' then assert(conflict and conflict.summary,'R1 cached/source mismatch disappeared')
 else assert(not conflict,'matching fixture unexpectedly conflicts') end
end
print('PASS '..order..' '..variant)
'''


def fixtures():
    directory = ROOT / 'tests/gameplay/level-fixtures'
    legacy = json.loads((directory / 'terrain-292/legacy-export.json').read_text())
    authored = json.loads((directory / 'terrain-278/applied-export.json').read_text())
    # Retained level-wide fixture plus one valid source section override exercises source-to-cache mapping.
    authored['editor']['objects'][0]['road_look'] = {'version': 1, 'width': .9, 'side': 8, 'shading': 1}
    result = {'legacy': legacy, 'authored': authored}
    for name in ('invalid', 'newer', 'mismatch'):
        result[name] = copy.deepcopy(authored)
    result['invalid']['editor']['objects'][0]['road_look']['width'] = -1
    result['newer']['editor']['editor_version'] = 999
    result['newer']['editor']['compiler_version'] = 999
    result['mismatch']['chains'][0][0][1] += .1
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/validation-order/results.json')
    args = parser.parse_args(argv)
    luajit = luajit_from_bob(build.bob_jar(), ROOT / '.cache/g1/luajit')
    inputs = fixtures()
    preset = json.loads((ROOT / 'main/game/presets/a.json').read_text())
    results = []
    for order in ORDERS:
        for variant in VARIANTS:
            source = (f'local order={lua_value(order)};local variant={lua_value(variant)};'
                      f'local input={lua_value(inputs[variant])};local preset={lua_value(preset)}\n' + PROBE)
            process = subprocess.run([str(luajit), '-joff', '-'], input=source, cwd=ROOT,
                                     env={'LUA_PATH': './?.lua', 'LUA_CPATH': '', 'PATH': os.defpath},
                                     text=True, capture_output=True, timeout=30)
            passed = process.returncode == 0 and process.stdout.splitlines()[-1:] == [f'PASS {order} {variant}']
            results.append({'order': order, 'variant': variant, 'status': 'PASS' if passed else 'FAIL',
                            'stdout': process.stdout, 'stderr': process.stderr})
    status = 'PASS' if all(row['status'] == 'PASS' for row in results) else 'FAIL'
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    report = {'status': status, 'source_sha': sha, 'matrix': results,
              'limitations': 'Pinned Bob LuaJIT source interfaces; not Defold startup/device acceptance. Engine input checks are separate.'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(f'{status}: {len(results)} fresh processes; {args.output}')
    for row in results:
        if row['status'] == 'FAIL':
            print(row['order'], row['variant'], row['stderr'])
    return 0 if status == 'PASS' else 1


if __name__ == '__main__':
    sys.exit(main())
