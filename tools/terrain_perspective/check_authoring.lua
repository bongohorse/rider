-- Versioned section look with actual compiler/builder: geometry and transitions remain source-owned.
local doc=require 'main.gym.editor_doc'
local look=require 'main.terrain_perspective.look'
local proj=require 'main.terrain_perspective.projection'
local geo=require 'main.gym.terrain_geometry'
local edit=require 'main.gym.editor_edit'
local function same(a,b)
 if type(a)~=type(b) then return false end;if type(a)~='table' then return a==b end
 for k,v in pairs(a) do if not same(v,b[k]) then return false end end;for k in pairs(b) do if a[k]==nil then return false end end;return true
end
for _,name in ipairs({'six-anchor','long-curves','mixed','long-over-budget'}) do
 local source=dofile(arg[1]..'/'..name..'-source.lua');local original=assert(doc.compile(source))
 source.editor.road_profile=look.ID;source.editor.road_look={version=1,params=proj.validate(proj.DEFAULT)}
 for i,o in ipairs(source.editor.objects) do if doc.terrain(o) then o.road_look={version=1,width=i%2==0 and 2 or .25,side=i%2==0 and .25 or 64,shading=i%2==0 and 0 or 1} end end
 local compiled=assert(doc.compile(source));local mapping=assert(look.mapping(compiled))
 for _,k in ipairs({'chains','hulls','labels','bounds','spawn','two_sided','finish'}) do assert(same(compiled[k],original[k]),'Look altered '..k) end
 local entries=geo.describe(compiled)
 for _,e in ipairs(entries) do
  local c=proj.section(e.prep,e.first,e.last,e.key,nil,mapping[e.chain]);assert(c.baked and c.bytes==c.vertices*48)
  local bounds=proj.bounds(e.bounds,{700,50},{version=1,mode='perspective',width=2,perspective=1,angle=45,side=64,shading=1})
  for j=1,c.vertices do local n=(j-1)*3;local x,y,z=c.position[n+1]+c.origin[1],c.position[n+2]+c.origin[2],c.position[n+3];local depth=z>0 and z or math.max(0,-z-.9)
   local u,v=proj.project(x,y,depth,{700,50},{mode='perspective',perspective=1,angle=45});assert(u>=bounds[1]-1e-8 and u<=bounds[3]+1e-8 and v>=bounds[2]-1e-8 and v<=bounds[4]+1e-8,'Clipped authored body')
  end
 end
 local reopened=assert(doc.open_level(compiled));assert(same(reopened.editor.road_look,source.editor.road_look))
 assert(same(doc.template(compiled).editor.objects,source.editor.objects),'Template lost manual source look')
 local h=doc.history();doc.record(h,source,1);local changed=doc.copy(source);changed.editor.road_look.params.angle=40
 assert(same(assert(doc.step(h,changed,true,1)).editor,source.editor));assert(same(assert(doc.step(h,source,false,1)).editor,changed.editor))
 print('PASS '..name..': source/physics equality, 48-byte baked sections, projected bounds, versioned roundtrip, template and Undo/Redo')
end
local e=dofile(arg[1]..'/long-curves-source.lua').editor;e.road_profile=look.ID;e.road_look={version=1,params=proj.validate(proj.DEFAULT)};e.objects[1].road_look={version=99}
local ok,err,unknown=look.validate(e);assert(not ok and unknown)
e.objects[1].road_look={version=1,width=.9,side=64,shading=1,angle=20};assert(not look.validate(e))
print('PASS future version and incoherent local projection refusal')

-- A derived global floor change must invalidate baked bottoms of otherwise unchanged sections.
local t=dofile(arg[1]..'/long-curves-source.lua').editor;t.road_profile=look.ID;t.road_look={version=1,params=proj.validate(proj.DEFAULT)};t.objects[1].road_look={version=1,width=1,side=64,shading=1}
local terrain=require 'main.gym.editor_terrain';local plans=assert(terrain.plan(t,nil,{},nil))
local old={};for i,p in ipairs(plans) do old[i]={points=p.points,signature=p.signature,color=p.color,key=i} end
local curve=t.objects[#t.objects-1]
for _,o in ipairs(t.objects) do if o.type=='curve' then curve=o end end
curve.anchors[#curve.anchors].p[2]=curve.anchors[#curve.anchors].p[2]-30
local changed=assert(terrain.plan(t,nil,{},nil,old));assert(changed[1].changed,'Stale baked floor on unchanged first section')
local compiled=assert(doc.compile(dofile(arg[1]..'/six-anchor-source.lua')));compiled.editor=nil;compiled.road_profile=look.ID
assert(require('main.gym.station_data').validate(compiled));assert(not look.authored(compiled));assert(require('main.gym.terrain_budget').measure(compiled).stride==36)
print('PASS baked floor dependency and legacy root-extension isolation')

local values={a={width=.9,side=64,shading=1,manual=false},b={width=1.8,side=4,shading=.4,manual=true}}
local chain={points={{0,0},{1,0},{2,0}},owner={'a','a','b'}}
local before=look.samples(chain,values);values.a.width=.25;values.a.side=.25;values.a.shading=0
local after=look.samples(chain,values);assert(same(before[2],after[2]),'Level defaults altered manual boundary');assert(after[2].width==1.8)
print('PASS manual boundary pinning against level-default changes')

local future=dofile(arg[1]..'/long-curves-source.lua');future.editor.road_profile=look.ID;future.editor.road_look={version=1,params=proj.validate(proj.DEFAULT)}
future.editor.road_look.params.version=999
local valid,why,unsupported=doc.validate(future);assert(not valid and unsupported)
future.editor.road_look.params.version=1;future.editor.objects[1].road_look=false
valid,why,unsupported=doc.validate(future);assert(not valid and unsupported)
print('PASS nested future parameter version and invalid section-format protection')

local extension=dofile(arg[1]..'/long-curves-source.lua');extension.editor.schema=1;extension.editor.road_profile=look.ID;extension.editor.road_look={version=1,params=proj.validate(proj.DEFAULT)};extension.editor.objects[2].road_look={version=1,width=2,side=4,shading=.5}
local level=assert(doc.compile(extension));assert(look.params(level).width==.9 and look.has_sections(level));assert(look.has_sections({editor=extension.editor}));assert(require('main.gym.terrain_budget').preview(12,12552,0,0,extension.editor))
assert(require('main.gym.editor_terrain').create(extension.editor).perspective)
print('PASS explicit editor-context parity with preserved extension fields')

local prefab=require 'main.gym.editor_prefab';local mirrored=doc.blank('my-style','Style').editor;mirrored.road_profile=look.ID;mirrored.road_look={version=1,params=proj.validate(proj.DEFAULT)}
local id=assert(edit.add_prefab(mirrored,'ramp',prefab.defaults('ramp'),{0,0}));mirrored.objects[1].road_look={version=1,width=1.4,side=5,shading=.6}
assert(edit.mirror(mirrored,{id},1));assert(same(mirrored.objects[1].road_look,mirrored.objects[2].road_look))
mirrored.objects[1].kind='platform';assert(not look.validate(mirrored))
print('PASS prefab Mirror preserves manual look; prop styling is refused')
-- The existing two-sided curl domain also uses the baked ribbon path.
local curl=doc.blank('my-curl-look','Curl look');curl.editor.road_profile=look.ID;curl.editor.road_look={version=1,params=proj.validate(proj.DEFAULT)};curl.editor.start.position={0,3};curl.editor.next_id=2
curl.editor.objects={{id='o1',type='line',points={{-1,1},{10,1},{12,1.5},{13.5,2.5},{14.5,3.5},{15,4.5},{14.5,5.5},{13.5,6},{-2.5,6.5}},road_look={version=1,width=2,side=.25,shading=.3}}}
local cd=assert(doc.compile(curl));assert(cd.two_sided[1]);local cm=look.mapping(cd)
for _,entry in ipairs(geo.describe(cd)) do local g=proj.section(entry.prep,entry.first,entry.last,entry.key,nil,cm[entry.chain]);assert(g.baked and g.body=='ribbon')
 local p={mode='perspective',perspective=1,angle=45,width=2};local bounds=proj.bounds(entry.bounds,{700,50},p)
 for j=1,g.vertices do local n=(j-1)*3;local z=g.position[n+3];local depth=z>0 and z or math.max(0,-z-.9);local x,y=proj.project(g.position[n+1]+g.origin[1],g.position[n+2]+g.origin[2],depth,{700,50},p);assert(x>=bounds[1]-1e-8 and x<=bounds[3]+1e-8 and y>=bounds[2]-1e-8 and y<=bounds[4]+1e-8) end
end
print('PASS authored two-sided curl/ribbon bounds; original physics domain retained')
local runtime=require 'main.terrain_perspective.runtime';local base={0,-10,30,1};local state={baked=true,params=proj.validate(proj.DEFAULT),entries={{base_bounds=base,geometry={max_width=.25},dirty=true}}}
runtime.prepare(state,{0,0});assert(same(state.entries[1].bounds,proj.bounds(base,{0,0},state.params,2)),'Dirty cached narrow style underbounds a wider pending style')
print('PASS dirty/cached authored bounds cover full permitted width before upload')

-- R1: supported sources can disagree with their cached compiled geometry. Never map local
-- styles onto different samples, but keep import/recovery and stale-source opening reachable.
local recover=dofile(arg[1]..'/long-curves-source.lua')
recover.editor.road_profile=look.ID;recover.editor.road_look={version=1,params=proj.validate(proj.DEFAULT)}
recover.editor.objects[2].road_look={version=1,width=1.4,side=5,shading=.6}
local cached=assert(doc.compile(recover));assert(look.mapping(cached))
for _,o in ipairs(cached.editor.objects) do if o.type=='curve' then o.anchors[2].p[2]=o.anchors[2].p[2]+1;break end end
assert(require('main.gym.station_data').validate(cached));assert(not look.mapping(cached))
local opened,note,conflict=doc.open_level(cached);assert(opened and conflict and conflict.lines)
assert(look.mapping(assert(doc.compile(opened))))
cached.editor.revision=cached.editor.revision+1
assert(require('main.gym.station_data').validate(cached));opened,note,conflict=doc.open_level(cached)
assert(opened and not conflict);assert(look.mapping(assert(doc.compile(opened))))
print('PASS authored mismatch import/conflict and stale-source recovery without unsafe style mapping')
