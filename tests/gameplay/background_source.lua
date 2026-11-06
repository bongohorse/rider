-- #548: authored references, save/export compilation, Undo and legacy compatibility.
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
local S=require 'main.backgrounds.source'
local function fresh()
    local d=D.blank('backgrounds','Backgrounds')
    d.editor.objects[1]={id='o1',type='line',points={{0,0},{20,0}}};d.editor.next_id=2
    return d
end
local legacy=fresh();local unchanged=enc(legacy)
assert(D.validate(legacy));local plain=assert(D.compile(legacy));assert(plain.schema==1 and plain.backgrounds==nil)
assert(enc(legacy)==unchanged,'legacy source is unchanged by validation and compilation')
local d=fresh();local b=S.defaults('meadow')
b.enabled=false;b.layers[2].visible=false;b.layers[3].auto=false;b.layers[3].depth=.27
b.layers[4].image={preset='city',hash=string.rep('a',64)}
assert(D.set_backgrounds(d.editor,b));b.layers[3].depth=.9
assert(d.editor.backgrounds.layers[3].depth==.27,'set copies its input')
assert(d.editor.editor_version==15 and d.editor.compiler_version==15 and D.validate(d))
local out=assert(D.compile(d));assert(out.schema==7 and out.backgrounds.enabled==false)
local imported=J.decode(enc(out));assert(require('main.game.station_data').validate(imported))
local opened,note,conflict=D.open_level(imported);assert(opened and not note and not conflict)
assert(enc(opened.editor.backgrounds)==enc(d.editor.backgrounds) and not D.compare(opened,out))
local play,warning=S.resolve(out.backgrounds);local edit=S.resolve(opened.editor.backgrounds)
assert(enc(play)==enc(edit) and warning:find('missing',1,true),'Play and Edit resolve identically with a visible missing-image warning')
assert(play.enabled==false and play.layers[2].visible==false and play.layers[3].auto==false and play.layers[3].depth==.27)
assert(play.layers[4].image=='/main/background_presets/city/layer4.png')
assert(out.backgrounds.layers[4].image.hash==string.rep('a',64),'fallback never alters saved image reference')
local h=D.history();D.record(h,legacy,1)
local undone=assert(D.step(h,d,true,1));assert(undone.editor.backgrounds==nil and undone.editor.editor_version==13)
local redone=assert(D.step(h,undone,false,1));assert(enc(redone.editor.backgrounds)==enc(d.editor.backgrounds))
local kept=D.copy(d);assert(D.set_material(kept.editor,{version=1,preset='quarry'}));assert(kept.editor.editor_version==15)
local compiled,compile_error=D.compile(kept);assert(compiled,compile_error);assert(compiled.schema==7 and D.validate(kept))
assert(D.set_material(kept.editor,nil));assert(kept.editor.backgrounds and kept.editor.editor_version==15)
assert(D.set_backgrounds(kept.editor,nil));assert(kept.editor.editor_version==13 and D.compile(kept).backgrounds==nil)
local mismatch=D.copy(out);mismatch.backgrounds.preset='city';assert(D.compare(opened,mismatch),'compiled mismatch includes backgrounds')
mismatch=D.copy(out);mismatch.spawn[1]=1
local _,_,clash=D.open_level(mismatch);assert(clash and enc(clash.lines.editor.backgrounds)==enc(out.backgrounds))
local function bad(change,part,unsupported)
    local c=D.copy(d);change(c.editor);local before=enc(c)
    local ok,err,unknown=D.validate(c)
    assert(not ok and err:find(part,1,true),tostring(err)..' expected '..part)
    if unsupported then assert(unknown==true) end
    assert(enc(c)==before,'refusal leaves original source untouched')
end
bad(function(e) e.backgrounds.version=3 end,'Unsupported backgrounds',true)
bad(function(e) e.backgrounds.preset='unknown' end,'Unknown background preset',true)
bad(function(e) e.backgrounds.extra=true end,'Unknown background field',true)
bad(function(e) e.backgrounds.layers[1].image={preset='unknown'} end,'Unknown background image preset',true)
bad(function(e) e.backgrounds.layers[1].image={preset='city',hash='bad'} end,'image hash')
bad(function(e) e.backgrounds.layers[1].depth=0/0 end,'Depth')
bad(function(e) e.backgrounds.layers[1].depth=1.01 end,'Depth')
bad(function(e) e.backgrounds.layers[1].visible=1 end,'visibility')
bad(function(e) e.backgrounds.layers[1].auto='true' end,'Auto')
bad(function(e) e.backgrounds.layers[3]=nil end,'six dense')
bad(function(e) e.backgrounds.layers.extra={} end,'six dense')
bad(function(e) e.backgrounds.enabled=1 end,'enabled')
bad(function(e) e.editor_version,e.compiler_version=14,14 end,'editor/compiler 15',true)
local old=D.copy(out);old.schema=6;local ok,why,unknown=require('main.game.station_data').validate(old)
assert(not ok and why:find('schema 7',1,true) and unknown)
local f=assert(io.open('tests/gameplay/level-fixtures/terrain-p0/mixed.json'));local text=f:read('*a');f:close()
local fixture=J.decode(text);local before=enc(fixture);assert(D.validate(D.open_level(fixture)))
assert(enc(fixture)==before and fixture.backgrounds==nil)
print('PASS #548 backgrounds source: round trip, Undo/Redo, export/import, schema/version refusal, missing fallback, legacy unchanged, Play/Edit resolution')

-- #614: only authoring vertical settings opts into v2; v1 stays byte-identical.
local v1=S.defaults();local original=enc(v1);assert(S.resolve(v1));assert(enc(v1)==original)
assert(v1.version==1 and v1.layers[1].vertical_position==nil)
local v2=D.copy(v1);v2.version=2;v2.layers[1].vertical_position=-4;v2.layers[1].vertical_parallax=1
v2.layers[5].vertical_position=4;v2.layers[5].vertical_parallax=0
local vertical=fresh();assert(D.set_backgrounds(vertical.editor,v2));assert(D.validate(vertical))
local result=assert(D.compile(vertical));assert(result.schema==7)
local reopened=assert(D.open_level(J.decode(enc(result))))
assert(enc(reopened.editor.backgrounds)==enc(v2))
local resolved=assert(S.resolve(result.backgrounds));assert(resolved.layers[1].vertical_position==-4 and resolved.layers[5].vertical_parallax==0)
local hist=D.history();D.record(hist,d,1)
local undo=assert(D.step(hist,vertical,true,1));assert(enc(undo.editor.backgrounds)==enc(d.editor.backgrounds))
local redo=assert(D.step(hist,undo,false,1));assert(enc(redo.editor.backgrounds)==enc(v2))
for field,values in pairs({vertical_position={-4.01,4.01,math.huge,0/0,'0',false},vertical_parallax={-.01,1.01,math.huge,0/0,'0',false}}) do
 for _,value in ipairs(values) do local b2=D.copy(v2);b2.layers[1][field]=value;assert(not S.validate(b2)) end
 local b1=D.copy(v1);b1.layers[1][field]=0;local ok1,_,unknown1=S.validate(b1);assert(not ok1 and unknown1)
 local fg=D.copy(v2);fg.layers[6][field]=0;local ok6,_,unknown6=S.validate(fg);assert(not ok6 and unknown6)
end
print('PASS #614 vertical source: optional v2 round trip, bounds, Undo/Redo, v1 unchanged and foreground refused')
