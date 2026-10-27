local D=require 'main.gym.editor_doc';local A=require 'main.gym.editor_auto_coins';local T=require 'main.gym.editor_track_align';local R=require 'main.gym.editor_coin_route'
local function level(points)
 local d=D.blank('auto-test','Auto test');local e=d.editor;e.start.position={-2,3};e.objects={{id='o1',type='line',points=points or {{-5,0},{30,0}}}};e.next_id=2;return d
end
local function coin(d,p,locked)
 local e=d.editor;local id='o'..e.next_id;e.next_id=e.next_id+1;e.objects[#e.objects+1]={id=id,type='coin',pickup_id='coin-'..id,position=p,locked=locked};return id
end
local function near(a,b)assert(math.abs(a-b)<1e-6,tostring(a)..' ~= '..tostring(b))end
local function check_spacing(p,existing)
 for i,a in ipairs(p.positions)do for j,b in ipairs(p.positions)do if i~=j then assert((a[1]-b[1])^2+(a[2]-b[2])^2>=.75^2-1e-7)end end
 for _,b in ipairs(existing or {})do assert((a[1]-b[1])^2+(a[2]-b[2])^2>=.75^2-1e-7)end end
end
local d=level();local before=D.copy(d);local c=A.defaults();local p=assert(A.preview(d,c,{}));assert(p.possible==20 and p.desired==20);assert(A.equal(d,before));assert(A.equal(p,assert(A.preview(d,c,{}))));check_spacing(p)
local h=D.history();D.record(h,d,1);assert(A.apply(d,p));assert(#d.editor.objects==21);assert(not A.apply(d,p));local after=D.copy(d);local undone=D.step(h,d,true,1);assert(A.equal(undone,before));assert(A.equal(D.step(h,undone,false,1),after))
assert(D.validate(d));local exported=assert(D.compile(d));assert(D.validate(D.open_level(exported)))
local state=T.refresh(d.editor);T.attach(d.editor,state,p.targets);assert(T.selection(d.editor,state,p.ids).active);assert(T.adjust(d.editor,state,p.ids,1))
local oldids={};for _,o in ipairs(d.editor.objects)do if o.type=='coin'then oldids[o.pickup_id]=true end end
c.replace=true;local replacement=assert(A.preview(d,c,{}));assert(replacement.removed==20);for _,o in ipairs(replacement.objects)do if o.type=='coin'then assert(not oldids[o.pickup_id])end end
local stale=assert(A.preview(d,c,{}));d.editor.objects[2].locked=true;local unchanged=D.copy(d);assert(not A.apply(d,stale));assert(A.equal(d,unchanged))
local locked=d.editor.objects[2];replacement=assert(A.preview(d,c,{}));assert(replacement.removed==19 and not replacement.remove[locked.id]);check_spacing(replacement,{locked.position});assert(A.apply(d,replacement));assert(A.equal(d.editor.objects[2],locked))
-- Actual length, slopes, descent, reversal and explicit connected selected pieces.
d=level({{0,0},{3,4},{6,0}});c=A.defaults();c.count=4;c.randomness=40;p=assert(A.preview(d,c,{}));near(p.spacing,2.5);assert(p.possible==4)
for _,q in ipairs(p.positions)do local floor=q[1]<=3 and q[1]*4/3 or (6-q[1])*4/3;near(q[2]-floor,.7)end
local same=assert(A.preview(d,c,{}));assert(A.equal(p.positions,same.positions));c.seed=37;assert(not A.equal(p.positions,assert(A.preview(d,c,{})).positions));check_spacing(p)
d=level({{10,0},{5,0}});d.editor.objects[2]={id='o2',type='line',points={{5,0},{0,0}}};d.editor.connections={{from='o1',to='o2'}};d.editor.next_id=3;c=A.defaults();c.range='selected';c.count=3
p=assert(A.preview(d,c,{'o1'}));for _,q in ipairs(p.positions)do assert(q[1]>5 and q[1]<10)end
p=assert(A.preview(d,c,{'o2'}));for _,q in ipairs(p.positions)do assert(q[1]>0 and q[1]<5)end
assert(not A.preview(d,c,{}));assert(not A.preview(d,c,{'missing'}))
-- Gap intervals are independent; no candidate lands in the missing physical segment.
d=level({{0,0},{5,0}});d.editor.objects[2]={id='o2',type='line',points={{8,0},{13,0}}};d.editor.next_id=3;c=A.defaults();c.count=12;p=assert(A.preview(d,c,{}));assert(p.possible<=12);for _,q in ipairs(p.positions)do assert(q[1]<5 or q[1]>8)end;check_spacing(p)
c.driver='spacing';c.spacing=2;p=assert(A.preview(d,c,{}));assert(p.desired==5);near(p.spacing,2);c.count=9999;assert(A.equal(p.positions,assert(A.preview(d,c,{})).positions))
-- Existing/locked coins constrain additions; dense requests stay bounded and below budgets.
d=level({{0,0},{3,0}});coin(d,{1,.7},true);c=A.defaults();c.count=10000;c.randomness=100;p=assert(A.preview(d,c,{}));assert(p.desired==10000 and p.possible<5);check_spacing(p,{{1,.7}})
d=level();for i=1,128 do coin(d,{40+i,.7},true)end;c=A.defaults();p=assert(A.preview(d,c,{}));assert(p.possible==0 and p.removed==0);c.replace=true;assert(assert(A.preview(d,c,{})).possible==0)
-- No buried circles: high terrain/hulls block proposals, leaving manual jump arcs alone.
d=level({{0,0},{20,0}});d.editor.objects[2]={id='o2',type='hull',vertices={{3,0},{8,0},{8,4},{3,4}}};d.editor.next_id=3;c=A.defaults();c.count=16;p=assert(A.preview(d,c,{}));assert(p.possible<16);for _,q in ipairs(p.positions)do assert(q[1]<2.75 or q[1]>8.25)end
for _,pts in ipairs({{{0,0},{0,3},{3,3}},{{0,0},{4,0},{2,2}}})do assert(not A.preview(level(pts),c,{}))end
d=level({{0,0},{4,0}});d.editor.objects[2]={id='o2',type='line',points={{0,0},{4,0}}};d.editor.next_id=3;p=assert(A.preview(d,c,{}));assert(p.possible==0)
for k,v in pairs({count=1.5,spacing=.1,randomness=101,height=-1})do assert(not A.value(k,v))end;assert(not A.value('count',math.huge));assert(not A.value('height',0/0))
-- A structurally valid draft can fail playable admission: preview must leave it completely intact.
d=level();d.editor.start.position={600,3};before=D.copy(d);local bad,err=A.preview(d,A.defaults(),{});assert(not bad and err);assert(A.equal(d,before))
print('PASS deterministic bounded preview, actual arc length/selected ownership/gaps, seed variation, spacing/locks/caps/clearance, atomic stale-safe Apply, fresh IDs, Undo/reload and Along attachment')
