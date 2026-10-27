local C=require 'main.gym.coins';local D=require 'main.gym.coin_data'
local authored={version=1,items={{id='coin-a',position={5,0}},{id='coin-b',position={10,0}}}}
assert(D.validate(authored));assert(not D.validate({version=1,items={{id='same',position={1,1}},{id='same',position={2,2}}}}))
assert(not D.validate({version=1,items={{id='a',position={0/0,0}}}}));local ok,err,future=D.validate({version=99});assert(not ok and future)
local c=C.new(authored);local function parts(x)return {{x,0,radius=.65},{x-.5,0,radius=.22},{x+.5,0,radius=.22}} end
C.observe(c,parts(0),false);assert(c.count==0)
local found=C.observe(c,parts(15),true);assert(#found==2 and c.count==2)
C.observe(c,parts(0),true);C.observe(c,parts(15),true);assert(c.count==2)
C.reset(c);assert(c.count==0 and not next(c.taken) and not c.previous)
C.observe(c,parts(15),false);C.observe(c,parts(15),true);assert(c.count==0,'Reset/ready teleport must not sweep old positions')
C.observe(c,parts(5),false);assert(c.count==0);C.observe(c,parts(5),true);assert(c.count==1)
local E=require 'main.gym.editor_doc';local edit=require 'main.gym.editor_edit'
local d=E.blank('coin-test','Coin test');local e=d.editor;e.objects={{id='o1',type='line',points={{-10,0},{50,0}}},{id='o2',type='coin',pickup_id='pickup-original',position={5,1}}};e.next_id=3;e.start.position={0,2}
assert(E.validate(d));local level=assert(E.compile(d));assert(level.schema==2 and level.coins.items[1].id=='pickup-original');assert(not E.compare(d,level))
edit.translate(e,{'o2'},{2,3});assert(e.objects[2].position[1]==7 and e.objects[2].pickup_id=='pickup-original')
local copied=edit.paste(e,edit.copy(e,{'o2'}),{2,0});assert(#copied==1 and e.objects[3].pickup_id~='pickup-original');assert(E.validate(d))
local round=E.open_level(assert(E.compile(d)));assert(round.editor.objects[2].pickup_id=='pickup-original')
local old=E.copy(d);old.editor.editor_version=8;old.editor.compiler_version=8;local valid,why,unknown=E.validate(old);assert(not valid and unknown)
local collision=E.copy(d);collision.editor.objects[3].pickup_id='pickup-original';assert(not E.validate(collision))
assert(require('main.gym.terrain_budget').measure(level).sprites==1)
print('PASS swept multipart pickups, once-per-ID/reverse/pause/reset; stable source IDs, move/duplicate/compile/import, version and sprite budget')
