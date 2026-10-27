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

local many={version=1,items={}}
for i=1,D.MAX do many.items[i]={id='coin-'..i,position={0,0}} end
assert(D.validate(many));local dense=C.new(many);C.observe(dense,parts(0),true);assert(dense.count==D.MAX)
many.items[D.MAX+1]={id='too-many',position={0,1}};assert(not D.validate(many))
assert(not D.validate({version=1,items={unexpected={id='a',position={0,0}}}}))
local exotic=E.copy(d);exotic.editor.objects[2].pickup_id='coin-o4';exotic.editor.next_id=4
local fresh=edit.paste(exotic.editor,edit.copy(exotic.editor,{'o2'}),{1,0});assert(fresh[1]=='o4' and exotic.editor.objects[#exotic.editor.objects].pickup_id=='coin-o4-2')
local prior=E.copy(level);prior.schema=1;local valid,reason,unknown=require('main.gym.station_data').validate(prior);assert(not valid and unknown)
print('PASS 128 pickup cap/dense list, imported-ID collision allocation and old runtime schema gate')

local styled=E.copy(d);styled.editor.road_profile='authored-v1';styled.editor.road_look={version=1,params=E.copy(require('main.terrain_perspective.projection').DEFAULT)}
styled.editor.objects[1].road_look={version=1,width=.9,side=8,shading=1}
local styled_level=assert(E.compile(styled));assert(styled.schema==1 and styled_level.schema==2)
assert(require('main.gym.station_data').validate(styled_level));assert(require('main.terrain_perspective.look').mapping(styled_level))
assert(not E.compare(styled,styled_level));assert(styled_level.coins.items[1].id=='pickup-original')
print('PASS authored Terrain Look and local styles on coin-bearing schema-2 stations retain schema-1 source validation')
