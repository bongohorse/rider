-- #573: parameter set 2: the accepted look on a level with a material, wider ranges, older sets unchanged.
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
local look=require 'main.terrain_perspective.look'
local P=require 'main.terrain_perspective.projection'
local function fresh()
    local d=D.blank('look','Look')
    d.editor.objects[1]={id='o1',type='line',points={{0,0},{20,0}}}
    d.editor.next_id=2
    return d
end
-- The chosen values are the default for a first material, also on an authored level.
local d=fresh()
d.editor.road_profile=look.ID;d.editor.road_look={version=1,params=P.validate(P.DEFAULT)}
d.editor.objects[1].road_look={version=1,width=1.2,side=8,shading=.7}
assert(D.validate(d))
assert(D.set_material(d.editor,{version=1,preset='meadow'}))
local p=d.editor.road_look.params
assert(p.version==2 and p.width==.6 and p.perspective==6 and p.angle==45 and p.side==64 and p.shading==1.15 and p.vehicle_position==.5)
assert(d.editor.objects[1].road_look.width==1.2,'section overrides stay')
assert(D.validate(d))
-- A second material keeps the author's values.
d.editor.road_look.params.width=1.5
assert(D.set_material(d.editor,{version=1,preset='city'}));assert(d.editor.road_look.params.width==1.5)
-- Survives compile, text and opening.
local out=assert(D.compile(d));local text=J.decode(enc(out))
assert(text.editor.road_look.params.version==2 and text.editor.road_look.params.vehicle_position==.5)
local opened=D.open_level(text);assert(opened.editor.road_look.params.width==1.5 and D.compare(opened,text)==nil)
assert(look.params(out).version==2 and look.params(opened).perspective==6)
-- Range edges and refusals.
local function params(change)
    local q={};for k,v in pairs(P.DEFAULT_V2) do q[k]=v end;change(q);return q
end
assert(P.validate(params(function(q) q.width=4;q.perspective=0;q.angle=75;q.shading=2;q.vehicle_position=1 end)))
assert(P.validate(params(function(q) q.width=.05;q.angle=0;q.shading=0;q.vehicle_position=0 end)))
for _,bad in ipairs({{'width',4.01},{'width',.04},{'perspective',6.01},{'angle',75.1},{'shading',2.1},{'vehicle_position',1.1},{'vehicle_position',-.1}}) do
    assert(not P.validate(params(function(q) q[bad[1]]=bad[2] end)),bad[1])
end
assert(not P.validate(params(function(q) q.vehicle_position=nil end)),'set 2 needs the vehicle position')
local _,err=P.validate(params(function(q) q.version=3 end));assert(err:find('Unsupported',1,true))
-- Set 1 keeps its ranges and fields.
local v1={version=1,mode='perspective',width=.9,perspective=.35,angle=28.8,side=64,shading=1}
assert(P.validate(v1) and P.validate(v1).vehicle_position==nil)
v1.perspective=1.5;assert(not P.validate(v1));v1.perspective=.35
v1.vehicle_position=.5;local _,unknown=P.validate(v1);assert(unknown and unknown:find('Unknown',1,true))
-- Set 2 needs a material; a level without one is refused, and set 1 stays untouched.
local bare=fresh();bare.editor.road_profile=look.ID;bare.editor.road_look={version=1,params=P.validate(P.DEFAULT_V2)}
local ok,why=D.validate(bare);assert(not ok and why:find('needs a level material',1,true))
local plain=fresh();local before=enc(plain);assert(D.validate(plain) and enc(plain)==before and look.params(plain).version==1)
-- Section overrides use the level's set.
local wide=D.copy(d);wide.editor.objects[1].road_look={version=1,width=3.5,side=8,shading=1.8};assert(D.validate(wide))
local narrow=fresh();narrow.editor.road_profile=look.ID;narrow.editor.road_look={version=1,params=P.validate(P.DEFAULT)}
narrow.editor.objects[1].road_look={version=1,width=3.5,side=8,shading=.5};assert(not D.validate(narrow))
-- Removing the material returns to set 1 inside its ranges.
assert(D.set_material(wide.editor,nil));assert(wide.editor.road_look.params.version==1 and wide.editor.objects[1].road_look.width==2 and wide.editor.objects[1].road_look.shading==1)
assert(D.validate(wide) and wide.editor.editor_version==13)
-- The panel gets a control for every value of the set.
assert(#P.controls(P.DEFAULT_V2)==#P.CONTROLS+1 and #P.controls(P.DEFAULT)==#P.CONTROLS)
for _,c in ipairs(P.controls(P.DEFAULT_V2)) do assert(P.RANGES_V2[c.key],c.key) end
print('PASS #573 parameter set 2: accepted defaults, ranges, refusal, round trip, older sets unchanged')
