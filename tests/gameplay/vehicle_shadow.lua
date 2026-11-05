-- #572: the shadow finds its ground through an index, and gets smaller and lighter with height.
sys=sys or {get_config_number=function(_,d) return d end,get_engine_info=function() return {is_debug=false} end}
html5=nil
local S=require 'main.terrain_perspective.vehicle_shadow'
local index=S.index({{{20,0},{0,0}},{{0,6},{10,8}},{{30,0},{30,8}}})
local y,a=S.ground(index,5,1);assert(y==0 and a==0,'the line below')
y,a=S.ground(index,5,7.5);assert(y==7 and a>0,'the higher line once above it')
assert(S.ground(index,25,1)==nil,'a gap has no ground')
assert(S.ground(index,5,-1)==nil,'no line below the wheels')
local s0,a0=S.look(0);assert(s0==1 and a0==S.ALPHA)
local s2,a2=S.look(2);assert(s2<s0 and a2<a0 and s2>S.MIN_SCALE)
local s4,a4=S.look(4);assert(s4==S.MIN_SCALE and a4==S.MIN_ALPHA)
assert(S.look(9)==s4 and S.look(-1)==1,'bounded')
-- A full-size level stays cheap per frame.
local big={};for c=1,32 do local p={};for i=1,2048 do p[i]={i*.5,c} end;big[c]=p end
local built=S.index(big);local t=os.clock();for i=1,1000 do S.ground(built,(i%1000)+.3,40) end
assert((os.clock()-t)/1000<.001,'a lookup stays under a millisecond')
print('PASS #572 vehicle shadow: indexed ground, size and strength fall with height, bounded')
