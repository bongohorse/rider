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
assert(d.editor.editor_version==14 and d.editor.compiler_version==14 and d.editor.road_profile=='authored-v1' and d.editor.road_look.params.version==2)
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
-- Undo and Redo through the real history.
local h=D.history();local plain=fresh();D.record(h,plain,1)
local changed=D.copy(plain);assert(D.set_material(changed.editor,{version=1,preset='city'}))
local undone=assert(D.step(h,changed,true,1))
assert(undone.editor.material==nil and undone.editor.editor_version==13,'Undo removes the material')
local redone=assert(D.step(h,undone,false,1));assert(redone.editor.material.preset=='city','Redo restores it')
-- Opening a saved level (R1): the material stays, also when the file conflicts or comes from a newer editor.
local saved=assert(D.compile(d))
local opened,note,conflict=D.open_level(saved)
assert(opened.editor.material.preset=='quarry' and opened.editor.material.band=='meadow' and note==nil and conflict==nil)
assert(D.compare(opened,saved)==nil,'a level compares equal to its own file')
local other=J.decode(enc(saved));other.material.preset='city'
assert(D.compare(opened,other),'a changed material is a difference')
local moved=J.decode(enc(saved));moved.spawn[1]=moved.spawn[1]+1
local _,_,clash=D.open_level(moved);assert(clash and clash.lines.editor.material.preset=='quarry','keeping compiled geometry keeps the material')
assert(clash.lines.editor.editor_version==14 and D.validate(clash.lines))
local newer=J.decode(enc(saved));newer.editor.editor_version,newer.editor.compiler_version=17,17
local lines=D.open_level(newer);assert(lines.editor.material.band=='meadow','an unsupported editor block keeps the material')
-- A stored level without one stays as it was, also an older file.
local f=assert(io.open('tests/gameplay/level-fixtures/terrain-p0/mixed.json','r'));local fixture=J.decode(f:read('*a'));f:close()
local before_text=enc(fixture);assert(require('main.game.station_data').validate(fixture) and enc(fixture)==before_text and fixture.material==nil)
local fixture_doc=D.open_level(fixture);assert(fixture_doc.editor.material==nil and material.spec_for(fixture)==nil)
-- The source wins over a hand-edited top-level value, in Play and Edit alike.
local edited=J.decode(enc(saved));edited.material.preset='city';assert(material.spec_for(edited).preset=='quarry')
local bare=J.decode(enc(saved));bare.editor=nil;local no,why=require('main.game.station_data').validate(bare);assert(not no and why:find('authored',1,true))
-- Refusals: unknown IDs and versions are marked unsupported, so the file stays unchanged.
local function bad(change,text)
    local c=D.copy(d);change(c.editor);local unknown=rejected(c,text);assert(unknown==true,text..' keeps the file')
end
bad(function(e) e.material.preset='nope' end,'Unknown material preset nope')
bad(function(e) e.material.fill='nope' end,'Unknown material preset nope for fill')
bad(function(e) e.material.version=2 end,'Unsupported level material version')
bad(function(e) e.material.extra=1 end,'Unknown level material field')
bad(function(e) e.editor_version,e.compiler_version=13,13 end,'needs editor/compiler 14')
bad(function(e) e.editor_version,e.compiler_version=18,18 end,'Unsupported editor version')
local no_profile=D.copy(d);no_profile.editor.road_profile=nil;no_profile.editor.road_look=nil;rejected(no_profile,'needs the authored 3D look')
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
local held=course(10,true);held.material={version=1,preset='meadow',band='city',fill='quarry'}
assert(budget.measure(held).mesh_peak==budget.measure(course(10,true)).mesh_peak+2,'held override presets count as meshes')
assert(budget.preview(1,20164,0,0,{road_profile='authored-v1',material={version=1,preset='meadow'}}))
assert(not budget.preview(1,20165,0,0,{road_profile='authored-v1',material={version=1,preset='meadow'}}))
assert(budget.preview(1,20165,0,0,{road_profile='authored-v1'}))
material.select(nil)
print('PASS #542 level material: round trip, schema 6, Undo copy, refusal, legacy unchanged, per-document admission')
