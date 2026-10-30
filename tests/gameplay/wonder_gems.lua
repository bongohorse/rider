local D=require 'main.gym.editor_doc';local C=require 'main.gym.coins';local data=require 'main.gym.coin_data'
local d=D.blank('gem-test','Gem test');local e=d.editor;e.start.position={0,2}
e.objects={{id='o1',type='line',points={{-5,0},{50,0}}},{id='o2',type='coin',pickup_id='gold-a',position={5,1}},{id='o3',type='coin',kind='gem',pickup_id='gem-a',position={10,1}},{id='o4',type='coin',kind='gem',pickup_id='gem-b',position={20,1}}};e.next_id=5
assert(D.validate(d));local compiled=assert(D.compile(d));assert(compiled.schema==3 and compiled.coins.version==2);assert(require('main.gym.station_data').validate(compiled));assert(not D.compare(d,compiled))
local round=assert(D.open_level(compiled));assert(round.editor.objects[3].kind=='gem');assert(data.counts(e.objects)==1);local g,s=data.counts(e.objects);assert(g==1 and s==2)
local edit=require 'main.gym.editor_edit';local ids=edit.paste(e,edit.copy(e,{'o3'}),{2,0});assert(#ids==1);assert(e.objects[5].kind=='gem' and e.objects[5].pickup_id~='gem-a');assert(D.validate(d))
local old=D.copy(d);old.editor.editor_version=9;old.editor.compiler_version=9;local ok,_,unknown=D.validate(old);assert(not ok and unknown)
local bad=D.copy(compiled);bad.schema=2;assert(not require('main.gym.station_data').validate(bad));bad=D.copy(compiled);bad.coins.version=1;assert(not data.validate(bad.coins));bad=D.copy(d);bad.editor.objects[3].kind='other';assert(not D.validate(bad))
local c=C.new(compiled.coins);local function parts(x)return {{x,1,radius=.1}}end
C.observe(c,parts(0),false);C.observe(c,parts(21),true);assert(c.count==1 and c.gems==2);assert(#C.observe(c,parts(0),true)==0);C.reset(c);assert(c.count==0 and c.gems==0 and not c.previous)
-- The larger pickup radius belongs to the same sweep; no extra body or tick.
C.observe(c,{{10,1.45,radius=.1}},true);assert(c.gems==1 and c.count==0)
-- Ordinary Auto Add never replaces special pickups, including unlocked gems.
local A=require 'main.gym.editor_auto_coins';local cfg=A.defaults();cfg.replace=true;cfg.count=8;local plan=assert(A.preview(d,cfg,{}));local found=0;for _,o in ipairs(plan.objects) do if o.kind=='gem' then found=found+1 end end;assert(found==3)
print('PASS multiple gems, gold/gem counts, paste IDs, version gates, roundtrip, larger swept radius, Retry and ordinary-only replacement')
