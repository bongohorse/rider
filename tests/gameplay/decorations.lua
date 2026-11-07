-- #557: decorations anchored to the track resolve on samples, stay out of collision and are versioned.
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
local S=require 'main.decorations.source'
local data=require 'main.game.station_data'
local function near(a,b,what) assert(math.abs(a-b)<1e-9,(what or 'value')..': '..tostring(a)..' ~= '..tostring(b)) end
-- Flat, offset and tilt off.
local flat={{{0,0},{10,0}}}
local x,y,angle=S.resolve(flat,4,0.5,true);near(x,4);near(y,.5);near(angle,0)
-- Slope: the angle follows, the offset stands on the line's normal.
local slope={{{0,0},{3,4}}}
x,y,angle=S.resolve(slope,2.5,1,true);near(x,1.5-.8);near(y,2+.6);near(angle,math.atan2(4,3))
x,y,angle=S.resolve(slope,2.5,1,false);near(x,.7);near(y,2.6);near(angle,0,'tilt off')
-- A run drawn right to left: same world pose, upper side stays up.
x,y,angle=S.resolve({{{3,4},{0,0}}},2.5,1,true);near(x,.7);near(y,2.6);near(angle,math.atan2(4,3))
-- Polyline: distance crosses corners; exact end resolves; beyond the end does not.
local bent={{{0,0},{4,0},{4+3,4}}}
x,y,angle=S.resolve(bent,6.5,0,true);near(x,4+1.5);near(y,2);near(angle,math.atan2(4,3))
x,y=S.resolve(bent,9,0,true);near(x,7);near(y,4)
assert(S.resolve(bent,9.01,0,true)==nil,'beyond the source is unresolved')
assert(S.resolve(nil,0,0,true)==nil and S.resolve({},0,0,true)==nil,'missing source is unresolved')
-- Prefab parts with a jump gap: the gap adds no distance.
x,y=S.resolve({{{0,0},{2,0}},{{5,0},{7,0}}},3,0,true);near(x,6);near(y,0)
near(S.length({{{0,0},{2,0}},{{5,0},{7,0}}}),4)
-- A real curve: resolved on its compiled samples.
local function base()
    local d=D.blank('deco','Deco');local e=d.editor
    e.objects[1]={id='o1',type='line',points={{-5,0},{20,0}}}
    e.objects[2]={id='o2',type='curve',anchors={
        {p={20,0},['in']={0,0},out={4,0},mode='smooth'},{p={30,5},['in']={-4,0},out={0,0},mode='smooth'}}}
    e.connections={{from='o1',to='o2'}};e.next_id=3
    return d
end
local parts=D.parts(base().editor.objects[2])
x,y,angle=S.resolve({parts[1]},S.length({parts[1]})/2,0,true)
assert(x>20 and x<30 and y>0 and y<5 and angle>0 and angle<math.pi/2,'curve sample')
near(x,25,'curve midpoint x');near(y,2.5,'curve midpoint y')
-- Invalid data is refused; only an unknown version or field counts as unsupported.
local function item(t)
    local o={id='d1',source='o1',distance=2,offset=0,placement='front',tilt=true,asset='cone'}
    for k,v in pairs(t or {}) do o[k]=v end
    return o
end
local function block(o,n) return {version=1,next_id=n or 2,items={o}} end
assert(S.validate(nil) and S.validate(block(item())))
for why,bad in pairs({
    id=item{id='x'},future_id=item{id='d9'},source=item{source='crate-a'},distance=item{distance=-1},nan=item{distance=0/0},
    offset=item{offset=9},placement=item{placement='above'},tilt=item{tilt=1},asset=item{asset='../x.png'},field=item{extra=1},
}) do assert(not S.validate(block(bad)),why) end
assert(not S.validate({version=1,next_id=3,items={item(),item()}}),'duplicate id')
local _,_,unknown_asset=S.validate(block(item{asset='no-such-asset'}));assert(unknown_asset,'an unknown asset keeps the file')
for _,id in ipairs(require('main.decorations.assets').ORDER) do assert(S.validate(block(item{asset=id})),id) end
assert(not S.validate({version=1,next_id=2,items={[2]=item()}}),'sparse list')
local _,_,future=S.validate({version=2,next_id=1,items={}});assert(future,'unknown version keeps the file')
local over={version=1,next_id=S.MAX_ITEMS+2,items={}}
for i=1,S.MAX_ITEMS+1 do over.items[i]=item{id='d'..i} end
assert(not S.validate(over),'item limit')
-- Legacy documents stay byte-identical; decorations need version 16 and schema 8.
local legacy=base();local unchanged=enc(legacy)
assert(D.validate(legacy));local plain=assert(D.compile(legacy))
assert(plain.schema==1 and plain.decorations==nil and enc(legacy)==unchanged,'legacy source unchanged')
local d=base()
assert(D.set_decorations(d.editor,{version=1,next_id=3,items={item(),item{id='d2',source='o2',distance=1,placement='body',tilt=false}}}))
assert(d.editor.editor_version==16 and d.editor.compiler_version==16 and D.validate(d))
local out=assert(D.compile(d))
assert(out.schema==8 and #out.decorations.items==2 and out.decorations.items[1].placement=='front')
near(out.decorations.items[1].position[1],-3);near(out.decorations.items[1].position[2],0)
-- JSON round trip through the station validator and the conflict compare.
local imported=J.decode(enc(out));assert(data.validate(imported))
local opened,note,conflict=D.open_level(imported);assert(opened and not note and not conflict)
assert(enc(opened.editor.decorations)==enc(d.editor.decorations) and not D.compare(opened,out))
-- Older blocks and schemas refuse the data instead of dropping it.
local old=base();old.editor.decorations=block(item());local ok,_,unsupported=D.validate(old);assert(not ok and unsupported,'needs version 16')
local schema7=J.decode(enc(out));schema7.schema=7;ok,_,unsupported=data.validate(schema7);assert(not ok and unsupported,'needs schema 8')
local tampered=J.decode(enc(out));tampered.decorations.items[1].position[1]=0/0;assert(not data.validate(tampered),'compiled position')
-- Other blocks keep working beside them, and removing the last decoration lowers the document again.
local both=base();assert(D.set_decorations(both.editor,block(item())))
assert(D.set_backgrounds(both.editor,require('main.backgrounds.source').defaults('meadow')));assert(both.editor.editor_version==16)
assert(D.set_material(both.editor,{version=1,preset='meadow'}));assert(both.editor.editor_version==16 and D.validate(both))
local schema=assert(D.compile(both));assert(schema.schema==8 and schema.backgrounds and schema.material and data.validate(J.decode(enc(schema))))
assert(D.set_decorations(both.editor,nil));assert(both.editor.decorations==nil and both.editor.editor_version==15)
-- A missing or shortened source stays in the source and leaves Play.
local stale=base();assert(D.set_decorations(stale.editor,block(item{source='o77'})));assert(D.validate(stale))
local c=assert(D.compile(stale));assert(#c.decorations.items==0 and #c.editor.decorations.items==1)
-- Decorations cannot change anything the simulation reads.
local SIM={'spawn','start_speed','run_in','run_out','bounds','chains','two_sided','hulls','labels','finish','checkpoints','coins','fuel','mechanisms'}
for _,field in ipairs(SIM) do assert(enc(plain[field])==enc(out[field]),field..' changed by decorations') end
local undo=D.history();D.record(undo,legacy,1);assert(D.step(undo,d,true,1).editor.decorations==nil,'Undo restores the block')
-- Draw transforms: order against terrain (-2..-2.8) and vehicle (0..1), upright lift and tilt.
local L=require 'main.decorations.layout'
assert(L.Z.behind<-2.8 and L.Z.body>-2 and L.Z.body<0 and L.Z.front>2,'draw order')
local t=L.transform({asset='cone',position={1,2},angle=0,placement='front'},.01)
near(t.x,100);near(t.y,(2+.875/2-.02)*100);near(t.z,3);near(t.scale,100/96)
t=L.transform({asset='cone',position={1,2},angle=math.pi/2,placement='body'},.01)
near(t.x,(1-(.875/2-.02))*100);near(t.y,200);near(t.angle,math.pi/2);near(t.z,-1.5)
assert(L.visible(t,0,100,100,300) and not L.visible(t,t.x+t.radius+1,t.x+t.radius+100,100,300),'culling x')
assert(not L.visible(t,0,100,t.y+t.radius+1,t.y+t.radius+100),'culling y')
-- Admission counts decorations with what the course already uses, with the actual limit and a correction.
local budget=require 'main.game.terrain_budget'
local full=assert(D.compile(d));local before=budget.measure(plain).sprites
assert(budget.measure(full).sprites==before+2 and budget.measure(full).instances==budget.measure(plain).instances+2,'counted')
local crowded=J.decode(enc(full));crowded.coins={version=1,items={}}
for i=1,960 do crowded.coins.items[i]={id='c'..i,position={i%20,2}} end
local refused,why=budget.check(crowded)
assert(not refused and why:find('limit 1024',1,true) and why:find('Remove decorations (2 placed)',1,true),tostring(why))
-- #560: edits, picking, snapping, locks.
local Ed=require 'main.decorations.edit'
local assets=require('main.decorations.assets').ASSETS
local run=base()
local snapped=Ed.nearest(run.editor.objects,D.parts,D.terrain,{10,3})
assert(snapped.source=='o1');near(snapped.distance,15)
snapped=Ed.nearest(run.editor.objects,D.parts,D.terrain,{30,5.2});assert(snapped.source=='o2','nearest run wins')
assert(Ed.nearest(run.editor.objects,D.parts,D.terrain,{10,30})==nil,'too far from any track')
run.editor.objects[1].hidden=true;assert(Ed.nearest(run.editor.objects,D.parts,D.terrain,{19,1}).source~='o1','hidden terrain is skipped');run.editor.objects[1].hidden=nil
local bk=Ed.block(run.editor);local one=Ed.add(bk,{source='o1',distance=5,asset='cone',placement='body'})
local two=Ed.add(bk,{source='o1',distance=5,asset='rock-large'})
assert(one.id=='d1' and two.id=='d2' and bk.next_id==3 and one.tilt==true and one.offset==0 and S.validate(bk))
local poses={d1={x=0,y=0,angle=0},d2={x=0,y=0,angle=0}}
assert(Ed.pick(bk,poses,{0,.4},assets)==two,'last placed first');assert(Ed.pick(bk,poses,{5,.4},assets)==nil,'miss')
two.hidden=true;assert(Ed.pick(bk,poses,{0,.4},assets)==one,'hidden cannot be picked');assert(S.validate(bk));two.hidden=nil
two.hidden='no';assert(not S.validate(bk),'hidden is boolean');two.hidden=nil
local locked=base();assert(D.set_decorations(locked.editor,{version=1,next_id=2,items={item{locked=true}}}))
local moved=D.copy(locked.editor);moved.decorations.items[1].distance=9;assert(D.lock_conflict(locked.editor,moved):find('Locked',1,true),'moving a locked one')
local gone=D.copy(locked.editor);gone.decorations=nil;assert(D.lock_conflict(locked.editor,gone),'deleting a locked one')
local free=D.copy(locked.editor);free.decorations.items[1].locked=nil;free.decorations.items[1].hidden=true;assert(not D.lock_conflict(locked.editor,free),'unlock and hide stay available')
-- Edit preview counts each decoration once beside doubled line sprites.
assert(budget.preview(1,10,100,0,{decorations={items={1,2,3}}})==true)
local many={items={}};for i=1,512 do many.items[i]=i end;assert(budget.preview(1,10,300,0,{decorations=many})==false,'pool shared with decorations')
print('PASS decorations')
