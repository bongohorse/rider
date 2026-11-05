-- #573: the Terrain Look session with parameter set 2: scopes, preview, Apply, Reset, Undo, removal.
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
sys={get_config_number=function(_,d) return d end,get_engine_info=function() return {is_debug=false} end,get_config_int=function(_,d) return d end,get_config_string=function(_,d) return d end}
html5=nil
package.loaded.socket={gettime=function() return 1 end}
local D=require 'main.editor.editor_doc'
local look=require 'main.terrain_perspective.look'
local P=require 'main.terrain_perspective.projection'
local function fresh()
 local d=D.blank('look','Look');d.editor.objects[1]={id='o1',type='line',points={{0,0},{20,0}}};d.editor.objects[2]={id='o2',type='line',points={{30,0},{50,0}}};d.editor.next_id=3;return d
end
local E={doc=fresh(),opened=1,mode='edit',ids={'o1'}}
function E.selected_ids() return E.ids end
function E.touch() end
local hist={}
function E.commit(fn)
 local before=D.copy(E.doc);fn(E.doc.editor)
 local conflict=D.lock_conflict(before.editor,E.doc.editor);if conflict then E.message=conflict;E.doc=before;return nil end
 local ok,err=D.validate(E.doc);if not ok then E.message=err;E.doc=before;return nil end
 hist[#hist+1]=before;E.doc.editor.revision=E.doc.editor.revision+1;return true
end
function E.undo() local b=table.remove(hist);b.editor.revision=E.doc.editor.revision+1;E.doc=b end
package.loaded['main.editor.editor']=E
local S=require 'main.editor.editor_look'
local function p() return enc(E.doc.editor.road_look and E.doc.editor.road_look.params) end
local function T(name,fn) local ok,err=pcall(fn);print((ok and 'ok   ' or 'FAIL ')..name,ok and '' or err) end
T('legacy level apply is set 1',function() S.open();S.scope('level');assert(S.change('width',1.4));assert(S.apply());assert(E.doc.editor.road_look.params.version==1);assert(S.change('vehicle_position',.5)==nil) end)
T('first material updates session',function() assert(E.commit(function(t) assert(D.set_material(t,{version=1,preset='meadow'})) end));S.sync();assert(S.session.params.version==2 and S.session.params.width==.6) end)
T('undo first material returns session to set 1',function() E.undo();S.sync();assert(S.session.params.version==1,enc(S.session.params));assert(S.session.params.width==1.4);assert(E.doc.editor.material==nil) ; assert(D.validate(E.doc)) end)
T('dirty set 1 draft + material: draft dropped',function() assert(S.change('width',1.9));assert(S.preview());assert(E.commit(function(t) D.set_material(t,{version=1,preset='meadow'}) end));S.sync();assert(S.session.params.version==2 and not S.session.dirty and not E.look_preview) end)
T('v2 typed wide values preview+apply',function() assert(S.change('width',3.5));assert(S.change('perspective',6));assert(S.change('angle',75));assert(S.change('shading',2));assert(S.change('vehicle_position',0));assert(S.preview());assert(S.apply());assert(E.doc.editor.road_look.params.vehicle_position==0 and E.doc.editor.road_look.params.width==3.5) end)
T('vehicle only change is seen by apply',function() assert(S.change('vehicle_position',.7));assert(S.apply());assert(E.doc.editor.road_look.params.vehicle_position==.7) end)
T('selected scope set 2',function() S.scope('selected');assert(S.session.params.version==2 and S.session.params.vehicle_position==.7);assert(S.change('width',3.9));assert(S.change('vehicle_position',.1)==nil);assert(S.session.params.vehicle_position==.7);assert(S.preview());assert(S.apply());assert(E.doc.editor.objects[1].road_look.width==3.9);assert(E.doc.editor.road_look.params.vehicle_position==.7);assert(D.validate(E.doc)) end)
T('selected reset clears override',function() S.reset();assert(S.apply());assert(E.doc.editor.objects[1].road_look==nil);assert(S.change('width',3.9));assert(S.apply()) end)
T('level reset is v2 default and keeps override',function() S.scope('level');S.reset();assert(S.session.params.width==.6 and S.session.params.version==2);assert(S.apply());assert(E.doc.editor.objects[1].road_look.width==3.9) end)
T('remove material with dirty v2 draft',function() S.change('width',3);assert(S.preview());assert(E.commit(function(t) D.set_material(t,nil) end));S.sync();assert(S.session.params.version==1 and not S.session.dirty and not E.look_preview,enc(S.session.params));assert(E.doc.editor.objects[1].road_look.width==2 and E.doc.editor.objects[1].road_look.shading<=1);assert(D.validate(E.doc)) end)
T('undo removal restores override',function() E.undo();S.sync();assert(S.session.params.version==2);assert(E.doc.editor.objects[1].road_look.width==3.9);assert(D.validate(E.doc)) end)
T('open field vehicle_position then removal then confirm',function() S.session.field={key='vehicle_position',text='.5'};assert(E.commit(function(t) D.set_material(t,nil) end));S.sync();local r=S.confirm();print('   confirm->',r,S.session.error) end)
S.session.field=nil
T('v1+material level reset goes v2',function() E.doc=fresh();E.opened=2;assert(D.set_material(E.doc.editor,{version=1,preset='meadow'}));E.doc.editor.road_look={version=1,params=P.validate(P.DEFAULT)};assert(D.validate(E.doc));S.sync();assert(S.session.params.version==1);S.reset();assert(S.session.params.version==2);assert(S.apply());assert(E.doc.editor.road_look.params.version==2);print('  ',p()) end)
T('locked terrain: set_material vs lock_conflict',function() local d=fresh();d.editor.objects[1].locked=true;local a=D.copy(d.editor);D.set_material(d.editor,{version=1,preset='meadow'});print('   first material on locked level conflict=',D.lock_conflict(a,d.editor)) end)
T('locked terrain: removal clamp',function() local d=fresh();d.editor.objects[1].road_look={version=1,width=1,side=1,shading=.5};D.set_material(d.editor,{version=1,preset='meadow'});d.editor.objects[1].road_look.width=3;d.editor.objects[1].locked=true;local a=D.copy(d.editor);D.set_material(d.editor,nil);print('   removal conflict=',D.lock_conflict(a,d.editor)) end)
print('bounds w4 p6 a75',enc(P.bounds({0,0,10,10},{5,5},{mode='perspective',perspective=6,angle=75,width=4},4)))
print('angle0 p6',enc(P.bounds({0,0,10,10},{5,5},{mode='perspective',perspective=6,angle=0,width=4},4)))
