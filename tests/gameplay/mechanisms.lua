local D=require 'main.gym.mechanism_data';local L=require 'main.gym.mechanism_logic'
local spec={version=1,crates={{id='crate-a',position={6,.65}}},plates={{id='plate-a',position={10,.05},actors={'crate-a','vehicle'}}},gates={{id='gate-a',position={16,1.5},travel=4.5,speed=1.8}},links={{from='plate-a',event='occupied',to='gate-a',action='open'}}}
assert(D.validate(spec,{-10,48,-10,20}));local cost=D.cost(spec);assert(cost.bodies==3 and cost.shapes==5 and cost.joints==1 and cost.vertices==20)
local s=L.new(spec);local empty={['plate-a']={}},occupied={['plate-a']={['crate-a']=true,vehicle=true}};local y={['gate-a']=0}
for _=1,4 do L.tick(s,1/60,occupied,{},y) end;assert(not s.plates['plate-a'].pressed)
L.tick(s,1/60,occupied,{},y);assert(s.plates['plate-a'].pressed and s.plates['plate-a'].count==2 and s.events==1 and s.gates['gate-a'].speed==1.8)
for _=1,120 do L.tick(s,1/60,occupied,{},y) end;assert(s.events==1,'one event per stable occupancy transition')
L.tick(s,1/60,occupied,{['gate-a']=true},y);assert(s.gates['gate-a'].state=='blocked' and s.gates['gate-a'].speed==0)
for _=1,3 do L.tick(s,1/60,empty,{},y) end;L.tick(s,1/60,occupied,{},y);assert(s.events==1,'release jitter must not rearm')
for _=1,10 do L.tick(s,1/60,empty,{},y) end;assert(s.events==2 and not s.plates['plate-a'].pressed)
y['gate-a']=2;L.tick(s,1/60,empty,{},y);assert(s.gates['gate-a'].speed==-1.8)
local old=s.generation;L.reset(s);assert(s.generation==old+1 and s.events==0 and not s.gates['gate-a'].open)
assert(not L.event(s,{generation=old,source='plate-a',event='occupied',active=true,serial=99}));assert(L.event(s,{generation=s.generation,source='plate-a',event='occupied',active=true,serial=1}));assert(not L.event(s,{generation=s.generation,source='plate-a',event='occupied',active=false,serial=1}))
assert(not D.validate(spec,{-10,48,-10,6}));spec.plates[1].actors={'unknown'};assert(not D.validate(spec));spec.plates[1].actors={'vehicle'}
spec.links[1].event='weight';assert(not D.validate(spec));spec.links[1].event='occupied';spec.gates[1].speed=0/0;assert(not D.validate(spec));spec.gates[1].speed=1.8;spec.version=999;local _,_,future=D.validate(spec);assert(future);spec.version=1
-- Toggle holds after release and flips once on the next debounced press, including Reset initial ON.
spec.plates[1].mode='toggle';s=L.new(spec);local function ticks(n,on)for _=1,n do L.tick(s,1/60,on and occupied or empty,{},y)end end
ticks(10,true);assert(s.plates['plate-a'].active);ticks(20,false);assert(s.plates['plate-a'].active);ticks(60,true);assert(not s.plates['plate-a'].active and s.events==2)
spec.plates[1].initial_on=true;L.reset(s);ticks(1,false);assert(s.gates['gate-a'].open)
-- Pulse expires even if held; a new press after release re-arms. No physical time integration.
spec.plates[1].mode='pulse';spec.plates[1].pulse_seconds=.2;s=L.new(spec);ticks(10,true);assert(s.plates['plate-a'].active);ticks(40,true);assert(not s.plates['plate-a'].active and s.events==2);ticks(12,false);ticks(6,true);assert(s.plates['plate-a'].active and s.events==3)
local E=require 'main.gym.editor_doc';local d=E.blank('mechanism-course','Mechanism course');d.editor.objects={{id='o1',type='line',points={{-6,0},{40,0}}}};d.editor.next_id=2;d.editor.start.position={2,1.7};d.editor.mechanisms=spec
assert(E.validate(d));local compiled=assert(E.compile(d));assert(compiled.schema==5 and compiled.mechanisms.links[1].to=='gate-a');assert(not E.compare(d,compiled));local reopened=assert(E.open_level(compiled));assert(reopened.editor.mechanisms.crates[1].id=='crate-a');local copied=E.copy(d);copied.editor.mechanisms.crates[1].position[1]=7;assert(d.editor.mechanisms.crates[1].position[1]==6)
d.editor.editor_version=11;d.editor.compiler_version=11;local _,_,unknown=E.validate(d);assert(unknown)
print('PASS typed bounded mechanisms/source roundtrip, occupancy dedup/debounce, all3 modes, stale/duplicate events, reset, blocked motion and future protection')
