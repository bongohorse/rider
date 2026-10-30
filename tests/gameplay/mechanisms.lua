local D=require 'main.gym.mechanism_data';local L=require 'main.gym.mechanism_logic'
local spec={version=1,crates={{id='crate-a',position={6,.65}}},plates={{id='plate-a',position={10,.05},actors={'crate-a','vehicle'}}},gates={{id='gate-a',position={16,1.5},travel=4.5,speed=1.8}},links={{from='plate-a',event='active',to='gate-a',action='open'}}}
assert(D.validate(spec,{-10,48,-10,20}));local cost=D.cost(spec);assert(cost.bodies==3 and cost.shapes==5 and cost.joints==1 and cost.vertices==20)
local s=L.new(spec);local empty,occupied={['plate-a']={}},{['plate-a']={['crate-a']=true,vehicle=true}};local y={['gate-a']=0}
for _=1,4 do L.tick(s,1/60,occupied,{},y) end;assert(not s.plates['plate-a'].pressed)
L.tick(s,1/60,occupied,{},y);assert(s.plates['plate-a'].pressed and s.plates['plate-a'].count==2 and s.events==1 and s.gates['gate-a'].speed==1.8)
for _=1,120 do L.tick(s,1/60,occupied,{},y) end;assert(s.events==1,'one event per stable occupancy transition')
L.tick(s,1/60,occupied,{['gate-a']=true},y);assert(s.gates['gate-a'].state=='blocked' and s.gates['gate-a'].speed==0)
for _=1,3 do L.tick(s,1/60,empty,{},y) end;L.tick(s,1/60,occupied,{},y);assert(s.events==1,'release jitter must not rearm')
for _=1,10 do L.tick(s,1/60,empty,{},y) end;assert(s.events==2 and not s.plates['plate-a'].pressed)
y['gate-a']=2;L.tick(s,1/60,empty,{},y);assert(s.gates['gate-a'].speed==-1.8)
local old=s.generation;L.reset(s);assert(s.generation==old+1 and s.events==0 and not s.gates['gate-a'].open)
assert(not L.event(s,{generation=old,source='plate-a',event='active',active=true,serial=99}));assert(L.event(s,{generation=s.generation,source='plate-a',event='active',active=true,serial=1}));assert(not L.event(s,{generation=s.generation,source='plate-a',event='active',active=false,serial=1}))
assert(not D.validate(spec,{-10,48,-10,6}));spec.plates[1].actors={'unknown'};assert(not D.validate(spec));spec.plates[1].actors={'vehicle'}
spec.links[1].event='weight';assert(not D.validate(spec));spec.links[1].event='active';spec.gates[1].speed=0/0;assert(not D.validate(spec));spec.gates[1].speed=1.8;spec.version=999;local _,_,future=D.validate(spec);assert(future);spec.version=1
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
local function clone(t)if type(t)~='table' then return t end;local r={};for k,v in pairs(t)do r[k]=clone(v)end;return r end
local multi=clone(spec);multi.plates[1].mode='hold';multi.plates[1].initial_on=false;multi.plates[2]=clone(multi.plates[1]);multi.plates[2].id='plate-b';multi.plates[2].position={20,.05};multi.gates[2]=clone(multi.gates[1]);multi.gates[2].id='gate-b';multi.gates[2].condition='all';multi.gates[2].position={25,1.5};multi.gates[3]=clone(multi.gates[1]);multi.gates[3].id='gate-c';multi.gates[3].position={30,1.5};multi.links={}
for _,p in ipairs(multi.plates)do for _,g in ipairs(multi.gates)do multi.links[#multi.links+1]={from=p.id,event='active',to=g.id,action='open'}end end
assert(D.validate(multi,{-10,48,-10,20}));local m=L.new(multi)
assert(L.event(m,{generation=m.generation,source='plate-a',event='active',active=true,serial=1}));assert(m.gates['gate-a'].open and not m.gates['gate-b'].open and m.gates['gate-c'].open)
assert(L.event(m,{generation=m.generation,source='plate-b',event='active',active=true,serial=1}));assert(m.gates['gate-b'].open)
assert(L.event(m,{generation=m.generation,source='plate-a',event='active',active=false,serial=2}));assert(m.gates['gate-a'].open and not m.gates['gate-b'].open and m.gates['gate-c'].open)
multi.links[#multi.links+1]=clone(multi.links[1]);assert(not D.validate(multi));print('PASS 2 plates / 3 gates with 6 distinct links, ANY/ALL input rules and duplicate link protection')

local unsupported=clone(spec);unsupported.plates[1].mode='future-mode';local _,_,protected=D.validate(unsupported);assert(protected)
unsupported=clone(spec);unsupported.gates[1].condition='future-rule';local _,_,protected=D.validate(unsupported);assert(protected)
unsupported=clone(spec);unsupported.links[1].action='future-action';local _,_,protected=D.validate(unsupported);assert(protected)
print('PASS unknown modes, gate rules and typed actions remain protected future semantics')

local raw=clone(compiled);raw.editor=nil;raw.mechanisms.crates[1].id='o1';local recovered=E.open_level(raw);assert(recovered.editor.objects[1].id~='o1' and recovered.editor.mechanisms.crates[1].id=='o1');assert(E.validate(recovered));assert(E.compile(recovered))
local budget=E.blank('source-cap','Source cap');budget.editor.objects={};for i=1,256 do budget.editor.objects[i]={id='o'..i,type='label',position={i,0},text='x'}end;budget.editor.next_id=257;assert(E.validate(budget));budget.editor.mechanisms=clone(spec);local valid,why=E.validate(budget);assert(not valid and why:find('256',1,true))
print('PASS station recovery avoids source/actor ID collisions and retains combined 256 source-object cap')

local bad=E.blank('malformed-mechanisms','Malformed mechanisms');for _,invalid in ipairs({{}, {version=999}, {version=1,crates='bad',plates={},gates={},links={}}})do bad.editor.mechanisms=invalid;local ok,valid=pcall(E.validate,bad);assert(ok and not valid,'malformed/unknown data must be rejected before cost calculation')end
local precise=clone(spec);precise.plates[1].mode='pulse';precise.plates[1].pulse_seconds=.1;precise.plates[1].actors={'vehicle'};local t=L.new(precise);for i=1,5 do L.tick(t,1/60,occupied,{},y)end;assert(t.plates['plate-a'].active and t.plates['plate-a'].pulse==.1);for i=1,5 do L.tick(t,1/60,occupied,{},y)end;assert(t.plates['plate-a'].active);L.tick(t,1/60,occupied,{},y);assert(not t.plates['plate-a'].active and t.events==2)
print('PASS malformed source is refused safely and the minimum pulse lasts its full simulation duration')
