local F=require 'main.gym.fuel';local D=require 'main.gym.editor_doc';local C=require 'main.gym.coins'
local cfg=F.defaults();cfg.start=42;cfg.time=2;cfg.drive=3;assert(F.validate(cfg))
local t=F.new(cfg);F.consume(t,2,.5);assert(t.amount==35);cfg.refill=80;F.refill(t);assert(t.amount==100 and t.collected==1 and t.feedback==65);F.refill(t);assert(t.collected==2 and t.amount==100 and t.feedback==0)
F.consume(t,100,1);assert(t.amount==0 and F.label(t):find('EMPTY'));cfg.refill=8;F.refill(t);assert(t.amount==8 and F.label(t):find('LOW'));assert(F.new(cfg).amount==42)
for _,v in ipairs({-1,101,0/0,math.huge,'x'}) do assert(not F.value('start',v)) end
local bad=F.defaults();bad.time=nil;assert(not F.validate(bad));bad=F.defaults();bad.version=99;local ok,_,future=F.validate(bad);assert(not ok and future)
local d=D.blank('fuel-test','Fuel test');local e=d.editor;e.start.position={0,2};e.fuel=cfg;e.objects={{id='o1',type='line',points={{-5,0},{40,0}}},{id='o2',type='coin',kind='fuel',pickup_id='fuel-a',position={5,1}},{id='o3',type='coin',pickup_id='gold-a',position={10,1}},{id='o4',type='coin',kind='gem',pickup_id='gem-a',position={15,1}}};e.next_id=5
assert(D.validate(d));local compiled=assert(D.compile(d));assert(compiled.schema==4 and compiled.coins.version==3 and compiled.fuel.start==42);assert(not D.compare(d,compiled));local reopened=assert(D.open_level(compiled));assert(reopened.editor.fuel.drive==3 and reopened.editor.fuel.refill==8)
local copy=require('main.gym.editor_edit');local ids=copy.paste(e,copy.copy(e,{'o2'}),{1,0});assert(e.objects[5].kind=='fuel' and e.objects[5].content==nil and e.objects[5].pickup_id~='fuel-a');assert(D.validate(d))
bad=D.copy(compiled);bad.schema=3;assert(not require('main.gym.station_data').validate(bad));bad=D.copy(d);bad.editor.editor_version=10;bad.editor.compiler_version=10;assert(not D.validate(bad));bad=D.copy(compiled);bad.coins.items[1].content=0;assert(not require('main.gym.coin_data').validate(bad.coins))
local c=C.new(compiled.coins);local hits=C.observe(c,{{5,1,radius=.1}},true);assert(#hits==1 and c.count==0 and c.gems==0);assert(#C.observe(c,{{5,1,radius=.1}},true)==0);C.reset(c);assert(#C.observe(c,{{5,1,radius=.1}},true)==1)
local gold,gems=require('main.gym.coin_data').counts(e.objects);assert(gold==1 and gems==1)
local A=require 'main.gym.editor_auto_coins';local ac=A.defaults();ac.replace=true;local plan=assert(A.preview(d,ac,{}));local n=0;for _,o in ipairs(plan.objects) do if o.kind=='fuel' then n=n+1 end end;assert(n==2)
local medals=require 'main.gym.medals';local course={id='first-run',finish={},race_revision=2,fuel=cfg};local key=medals.key(course);course.fuel=F.defaults();assert(medals.key(course)~=key)
print('PASS configurable/additive fuel, full pickup, empty/recovery, input bounds, source IDs/roundtrip/schema gates, once-per-attempt, gold/gem separation, Auto preservation and record identity')
