-- #577: where runs overlap, the run that is lower in that overlap is in front; one z per run, deterministic.
local geometry=require 'main.game.terrain_geometry'
local function line(from,y0,to,y1,step)
    local p={}
    step=step or (to-from)
    for x=from,to,step do p[#p+1]={x,y0+(y1-y0)*(x-from)/(to-from)} end
    return p
end
local function order(chains)
    local preps={}
    for i,c in ipairs(chains) do preps[i]=geometry.prepare(c,-40,0) end
    geometry.assign_layers(preps)
    return preps
end
local a=order({line(0,0,100,0),line(0,6,100,6)})
assert(a[1].layer_z>a[2].layer_z,'the lower run must be in front')
local b=order({line(0,6,100,6),line(0,0,100,0)})
assert(b[2].layer_z>b[1].layer_z,'source order must not matter')
-- A bridge over a long climb: the climb has the higher whole-run mean but is lower where they overlap.
local c=order({line(0,0,500,100),line(10,12,30,12)})
assert(c[1].layer_z>c[2].layer_z,'height counts inside the overlap only')
-- A chain of three.
local d=order({line(0,6,100,6),line(0,0,100,0),line(0,3,100,3)})
assert(d[2].layer_z>d[3].layer_z and d[3].layer_z>d[1].layer_z,'three levels stack')
-- Same height in the overlap and shifted copies: a defined order that does not depend on source order.
local e1=order({line(0,5,50,5),line(30,5,90,5)})
local e2=order({line(30,5,90,5),line(0,5,50,5)})
assert(e1[1].layer_z~=e1[2].layer_z,'no equal z for overlapping runs')
assert(e1[1].layer_z==e2[2].layer_z and e1[2].layer_z==e2[1].layer_z,'tie independent of source order')
-- Crossing cycle: finishes with distinct values.
local f=order({line(0,0,100,10),line(0,10,100,0),line(0,5,100,5)})
assert(f[1].layer_z~=f[2].layer_z and f[2].layer_z~=f[3].layer_z and f[1].layer_z~=f[3].layer_z,'crossing runs stay distinct')
-- One z for all sections of a run; reversed input; bounded.
local long=line(0,0,300,60,1)
local g=order({long,line(0,80,300,80,1)})
local s1,s2=geometry.section(g[1],1,65,'a'),geometry.section(g[1],129,193,'b')
assert(s1.layer_z==s2.layer_z and s1.layer_z==g[1].layer_z,'one z for a whole run')
local rev={};for x=100,0,-1 do rev[#rev+1]={x,6} end
local h=order({line(0,0,100,0),rev})
assert(h[1].layer_z>h[2].layer_z,'direction-independent')
local many={};for i=1,32 do many[i]=line(0,i,100,i,1) end
local m=order(many)
for i,prep in ipairs(m) do
    assert(prep.layer_z<=-2 and prep.layer_z>=-2.8,'bounded')
    if i>1 then assert(m[i-1].layer_z>prep.layer_z,'32 levels stay ordered') end
end
-- Without overlap a single run is simply near.
assert(order({line(0,0,10,0)})[1].layer_z==geometry.LAYER_NEAR,'single run')
-- Ribbons (overhangs) work.
local curl={{0,0},{10,5},{5,10},{15,12}}
local r=order({curl,line(0,-5,20,-5)})
assert(r[2].layer_z>r[1].layer_z,'ribbon behind the lower run')
print('PASS #577 run order: overlap height, source-independent, bridge, ties, cycles, one z per run, bounded')
