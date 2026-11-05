-- #542: the level material lives in the source: round trip, Undo, export, refusal, unchanged legacy files, admission.
local J=require 'tests.gameplay.lib.json'
local function enc(v)
    if type(v)=='string' then return string.format('%q',v) end
    if type(v)~='table' then return tostring(v) end
    if #v>0 or next(v)==nil then local o={};for i,x in ipairs(v) do o[i]=enc(x) end;return '['..table.concat(o,',')..']' end
    local keys={};for k in pairs(v) do keys[#keys+1]=k end;table.sort(keys,function(a,b) return tostring(a)<tostring(b) end)
    local o={};for i,k in ipairs(keys) do o[i]=string.format('%q',tostring(k))..':'..enc(v[k]) end
    return '{'..table.concat(o,',')..'}'
end
json={decode=J.decode,encode=enc}
sys=sys or {get_config_number=function(_,d) return d end,get_engine_info=function() return {is_debug=false} end,get_config_int=function(_,d) return d end,get_config_string=function(_,d) return d end}
html5=nil
local D=require 'main.editor.editor_doc'
local material=require 'main.terrain_perspective.material'
local budget=require 'main.game.terrain_budget'
local function fresh()
    local d=D.new and D.new('mat','Material') or D.blank('mat','Material')
    d.editor.objects[1]={id='o1',type='line',points={{0,0},{20,0}}}
    d.editor.next_id=2
    return d
end
local function rejected(d,text)
    local ok,err,unknown=D.validate(d)
    assert(not ok and err:find(text,1,true),'expected refusal: '..text..' got '..tostring(err))
    return unknown
end
-- A level without a material stays at 13, with no field, and uses the untextured route.
local legacy=fresh();local before=enc(legacy)
assert(D.validate(legacy) and legacy.editor.editor_version==13 and legacy.editor.material==nil)
local compiled=assert(D.compile(legacy));assert(compiled.material==nil and compiled.schema==1)
assert(enc(legacy)==before,'validating and compiling leave a legacy document unchanged')
assert(material.spec_for(legacy)==nil and material.stride_for(legacy)==48)
-- First material raises the version, enables the authored profile and validates.
local d=fresh()
assert(D.set_material(d.editor,{version=1,preset='quarry',band='meadow'}))
assert(d.editor.editor_version==14 and d.editor.compiler_version==14 and d.editor.road_profile=='authored-v1' and d.editor.road_look.version==1)
assert(D.validate(d))
-- Round trip through compile and export text.
local out=assert(D.compile(d));assert(out.schema==6 and out.material.preset=='quarry' and out.material.band=='meadow')
local again=J.decode(enc(out))
assert(require('main.game.station_data').validate(again))
assert(again.editor.material.preset=='quarry' and again.material.band=='meadow')
-- Play and Edit read one selection from one document.
local play,edit=material.spec_for(out),material.spec_for({editor=d.editor})
assert(play.preset=='quarry' and play.band=='meadow' and play.text==edit.text and material.stride_for(out)==52)
material.select(out);assert(material.key()==play.text);material.select({editor=d.editor});assert(material.key()==play.text)
material.select(legacy);assert(material.key()=='' and material.stride()==48)
-- Undo: the history restores the earlier document.
local h=D.history();local plain=fresh();D.record(h,plain,1)
local changed=D.copy(plain);assert(D.set_material(changed.editor,{version=1,preset='city'}));D.record(h,changed,1)
assert(changed.editor.material.preset=='city' and plain.editor.material==nil and plain.editor.editor_version==13,'the earlier document is unchanged')
-- Refusals: unknown IDs and versions are marked unsupported, so the file stays unchanged.
local function bad(change,text)
    local c=D.copy(d);change(c.editor);local unknown=rejected(c,text);assert(unknown==true,text..' keeps the file')
end
bad(function(e) e.material.preset='nope' end,'Unknown material preset nope')
bad(function(e) e.material.fill='nope' end,'Unknown material preset nope for fill')
bad(function(e) e.material.version=2 end,'Unsupported level material version')
bad(function(e) e.material.extra=1 end,'Unknown level material field')
bad(function(e) e.editor_version,e.compiler_version=13,13 end,'needs editor/compiler 14')
bad(function(e) e.editor_version,e.compiler_version=15,15 end,'Unsupported editor version')
local no_profile=D.copy(d);no_profile.editor.road_profile=nil;no_profile.editor.road_look=nil;rejected(no_profile,'needs the authored Terrain Look')
assert(not D.set_material(fresh().editor,{version=1,preset='nope'}),'set_material refuses too')
-- Station schema gates.
local station=J.decode(enc(out));station.schema=5
local ok,err,unknown=require('main.game.station_data').validate(station);assert(not ok and err:find('schema 6',1,true) and unknown==true)
-- Admission uses the document's stride before any world exists.
local function course(segments,with)
    local chain={};for i=0,segments do chain[i+1]={i,0} end
    local c={chains={chain},hulls={},labels={},bounds={-10,segments+10,-40,50},_road_profile='perspective-v1'}
    if with then c.material={version=1,preset='meadow'} end
    return c
end
assert(budget.measure(course(10)).stride==48 and budget.measure(course(10,true)).stride==52)
assert(budget.check(course(1119,true)))
local refused,why=budget.check(course(1120,true));assert(not refused and why:find('payload',1,true))
assert(budget.check(course(1120)),'the same course fits without a material')
assert(budget.preview(1,20164,0,0,{road_profile='authored-v1',material={version=1,preset='meadow'}}))
assert(not budget.preview(1,20165,0,0,{road_profile='authored-v1',material={version=1,preset='meadow'}}))
assert(budget.preview(1,20165,0,0,{road_profile='authored-v1'}))
material.select(nil)
print('PASS #542 level material: round trip, schema 6, Undo copy, refusal, legacy unchanged, per-document admission')
