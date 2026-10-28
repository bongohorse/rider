local D=require 'main.gym.editor_doc';local A=require 'main.gym.editor_track_align';local P=require 'main.gym.editor_prefab'
local d=D.blank('drop-test','Drop test');local e=d.editor;e.start.position={-2,2}
e.objects={{id='o1',type='line',points={{-5,0},{10,0},{20,5},{30,0}}},{id='o2',type='hull',vertices={{4,3},{8,3},{8,5},{4,5}}}}
for i,p in ipairs({{2,10},{6,10},{6,4},{15,8},{40,10},{2,-1},{25,7}}) do e.objects[#e.objects+1]={id='o'..(i+2),type='coin',pickup_id='drop-'..i,position=p,locked=i==7 or nil} end
e.next_id=10;assert(D.validate(d));local ids={};for _,o in ipairs(e.objects) do ids[#ids+1]=o.id end
local plan=assert(A.plan(e,ids,.7));assert(#plan.moves==4 and plan.locked==1 and plan.unsupported==2 and plan.no_surface==2)
local original=D.copy(e);assert(A.apply(e,plan));for _,v in ipairs({{'o3',.7},{'o4',5.7},{'o5',.7},{'o6',3.2}}) do local o=require('main.gym.editor_edit').find(e,v[1]);assert(math.abs(o.position[2]-v[2])<1e-9) end
for i,o in ipairs(e.objects) do if o.type=='coin' then assert(o.position[1]==original.objects[i].position[1] and o.pickup_id==original.objects[i].pickup_id) end end
assert(e.objects[9].position[2]==7 and e.objects[9].locked)
local again=assert(A.plan(e,ids,.7));assert(#again.moves==0 and again.unchanged==4)
assert(A.available(e,{'o3'}) and not A.available(e,{'o1','o2'}))
for _,h in ipairs({'abc',-1,101,math.huge,0/0}) do assert(not A.height(h));assert(not A.plan(e,ids,h)) end
assert(A.height(0)==0 and A.height(100)==100)
local stale=D.copy(original);stale.objects[4].locked=true;assert(not A.apply(stale,plan));assert(stale.objects[3].position[2]==10,'plan partially applied before lock refusal')
local changed=D.copy(original);changed.objects[4].position[1]=7;assert(not A.apply(changed,plan));assert(changed.objects[3].position[2]==10)
local empty=D.blank('empty-drop','Empty drop').editor;empty.objects={{id='o1',type='coin',pickup_id='empty-coin',position={0,5}}};local miss=assert(A.plan(empty,{'o1'},.7));assert(miss.no_surface==1 and #miss.moves==0)
local backwards=D.copy(original);backwards.objects[1].points={{30,0},{20,5},{10,0},{-5,0}};assert(#assert(A.plan(backwards,ids,.7)).moves==4)
local invalid=D.copy(original);invalid.objects[1].points={{0,0},{10,0},{5,0}};assert(not A.plan(invalid,ids,.7))
for _,kind in ipairs({'gap','kicker','wave'}) do
 local t=D.blank('drop-'..kind,'Drop '..kind).editor;t.objects={{id='o1',type='prefab',kind=kind,at={0,0},params=P.defaults(kind)}};t.next_id=3
 local parts=D.parts(t.objects[1]);local p
 if #parts>1 then p={(parts[1][#parts[1]][1]+parts[2][1][1])/2,30}
 else local a,b=parts[1][2],parts[1][3];p={(a[1]+b[1])/2,30} end
 t.objects[2]={id='o2',type='coin',pickup_id='drop-prefab',position=p}
 local q=assert(A.plan(t,{'o2'},.7));if #parts>1 then assert(#q.moves==0 and q.no_surface==1,kind..' bridged gap') else assert(#q.moves==1);assert(math.abs(q.moves[1].position[2]-(parts[1][2][2]+parts[1][3][2])/2-.7)<1e-9) end
end
local saved=assert(D.compile(d));assert(saved.schema==2 and saved.coins.items[1].id=='drop-1');assert(D.validate(D.open_level(saved)))
print('PASS vertical slopes/nearest top face/underside exclusion/reverse/gap/kicker/wave, locks/skips/no-op, finite height, atomic stale-plan refusal and coin source roundtrip')
