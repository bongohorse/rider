-- #577: where runs overlap, the lower run is in front and the higher behind, stable for all sections of a run.
local geometry=require 'main.game.terrain_geometry'
local function line(y,from,to)
    local p={}
    for x=from,to do p[#p+1]={x,y} end
    return p
end
local low=geometry.prepare(line(0,0,100),-20,0)
local high=geometry.prepare(line(6,0,100),-20,0)
assert(low.layer_z>high.layer_z,'the lower run must be in front')
-- All sections of a run share one z, also when the run climbs.
local climb={};for x=0,200 do climb[#climb+1]={x,x*.2} end
local prep=geometry.prepare(climb,-20,0)
local a=geometry.section(prep,1,65,'a');local b=geometry.section(prep,129,193,'b')
assert(a.layer_z==b.layer_z and a.layer_z==prep.layer_z,'one z for a whole run')
-- Height means along the run, not per point: dense points on one part do not pull it.
local dense={{0,0},{50,0}};for x=51,60 do dense[#dense+1]={x,0} end;dense[#dense+1]={100,10}
local sparse={{0,0},{60,0},{100,10}}
assert(math.abs(geometry.layer_z(dense)-geometry.layer_z(sparse))<1e-9,'height is arc-weighted')
-- Input direction does not matter: prepare orders the points.
local reversed={};for x=100,0,-1 do reversed[#reversed+1]={x,6} end
assert(geometry.prepare(reversed,-20,0).layer_z==high.layer_z,'direction-independent')
-- Bounded behind every other world object, also far away.
for _,y in ipairs({-100000,-50,0,50,100000}) do
    local z=geometry.layer_z({{0,y},{10,y}})
    assert(z<=-2 and z>=-2.8,'z stays in the terrain range: '..z)
end
-- Small height differences stay ordered.
assert(geometry.layer_z({{0,.01},{10,.01}})<geometry.layer_z({{0,0},{10,0}}),'one centimetre is ordered')
print('PASS #577 run order: lower in front, one z per run, arc-weighted, bounded')
