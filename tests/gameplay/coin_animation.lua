-- Exercise the actual presentation adapter with a fake engine boundary (no physics claims).
local positions,scales,tints,enabled={},{},{},{};local nextid=0
sys={get_config_number=function()return .01 end};vmath={vector3=function(x,y,z)return {x=x,y=y,z=z}end,vector4=function(r,g,b,a)return {r,g,b,a}end}
factory={create=function()nextid=nextid+1;return nextid end}
sprite={play_flipbook=function(url,anim)assert(anim=='wonder-gem')end}
go={set_position=function(p,id)positions[id]=p end,set_scale=function(p,id)scales[id]=p end,set=function(url,property,v)assert(property=='tint');tints[url.id]=v end}
msg={url=function(_,id,component)return {id=id,component=component}end,post=function(url,event)if type(url)=='table' then enabled[url.id]=event=='enable' end end}
local R=require 'main.gym.coin_runtime'
local self={station={coins={version=2,items={{id='gold',position={2,3}},{id='gem',position={4,5},kind='gem'}}}}}
R.reset(self);assert(nextid==2 and scales[2].x==1.44)
self.coin_effects.gold={age=0,item=self.coins.items[1]};self.coin_effects.gem={age=0,item=self.coins.items[2]}
R.update(self,.12);assert(positions[1].y>300 and positions[2].y>500);assert(tints[1][4]<1 and tints[1][4]>0);assert(scales[2].x>1.44)
R.update(self,.4);assert(not enabled[1] and not enabled[2] and not next(self.coin_effects))
R.reset(self);assert(nextid==2 and positions[1].y==300 and positions[2].y==500 and tints[1][4]==1 and tints[2][4]==1 and enabled[1] and enabled[2]);assert(not next(self.coin_effects))
print('PASS actual upward/fade/scale adapter for gold/gems, bounded same-sprite retirement and canonical Retry position/tint/visibility reset')
