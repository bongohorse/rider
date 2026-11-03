-- #392 Stage A: textured terrain route. Pilot parsing, per-vertex slots, end-cap U, neutral shading,
-- 48 -> 52 B accounting and the 1 MiB Fit admission. The untextured route must stay unchanged.
local J=require 'tests.gameplay.lib.json'
json={decode=J.decode}
sys={get_config_number=function(_,d) return d end,get_engine_info=function() return {is_debug=false} end}
html5=nil
local material=require 'main.terrain_perspective.material'
local projection=require 'main.terrain_perspective.projection'
local geometry=require 'main.game.terrain_geometry'
local budget=require 'main.game.terrain_budget'

-- Parsing: one family, or left,right@x; anything else is ignored (untextured), never an error at runtime.
local s=assert(material.parse('stone'));assert(s.left==4 and s.right==4 and s.boundary==math.huge)
s=assert(material.parse('grass,stone@28'));assert(s.left==0 and s.right==4 and s.boundary==28)
s=assert(material.parse('snow,purple@-12.5'));assert(s.left==3 and s.right==5 and s.boundary==-12.5)
assert(material.parse('')==nil and material.parse(nil)==nil)
for _,bad in ipairs({'asphalt','grass,stone','grass,lava@3','grass;stone@3','grass,stone@x','grass,stone@1e9',('a'):rep(65)}) do
    local ok,err=material.parse(bad);assert(ok==nil and type(err)=='string','accepted '..bad)
end
print('PASS terrain material pilot parsing: six families, boundary form, invalid text ignored')

local f=assert(io.open('main/game/stations/gaps-landing.json'));local d=json.decode(f:read('*a'));f:close()
d._road_profile='perspective-v1'
local entries=geometry.describe(d)

-- No pilot: the accepted 48-byte route, no texture stream, legacy colours.
material.override=false
assert(projection.stride()==48)
local plain={}
for i,e in ipairs(entries) do
    local c=projection.section(e.prep,e.first,e.last,e.key)
    assert(c.texture==nil and not c.textured and c.bytes==c.vertices*48)
    plain[i]=c
end
assert(budget.measure(d).stride==48)

-- Grass -> Stone at x=28 m.
material.override=assert(material.parse('grass,stone@28'))
assert(projection.stride()==52 and budget.measure(d).stride==52)
local grass,stone=0,0
for i,e in ipairs(entries) do
    local c=projection.section(e.prep,e.first,e.last,e.key)
    local q=plain[i]
    assert(c.textured and #c.texture==c.vertices and c.bytes==c.vertices*52)
    -- Visual stream only: positions, look_data and the partition are identical to the untextured build.
    assert(c.vertices==q.vertices and #c.position==#q.position)
    for k,v in ipairs(q.position) do assert(c.position[k]==v,'position changed at '..k) end
    for k,v in ipairs(q.look_data) do assert(c.look_data[k]==v,'look_data changed at '..k) end
    local p=e.prep.p
    for interval=e.first,e.last-1 do
        local n=(interval-e.first)*18
        local family=(p[interval][1]+p[interval+1][1])/2<28 and 0 or 4
        if family==0 then grass=grass+1 else stone=stone+1 end
        for j=1,18 do
            local face=j<=6 and material.SIDE or j<=12 and material.RIM or material.SURFACE
            assert(c.texture[n+j]==family*4+face,'slot at interval '..interval..' vertex '..j)
            local k=(n+j-1)*4
            assert(c.base_colors[k+1]==material.SHADE[face] and c.base_colors[k+1]==c.base_colors[k+2] and c.base_colors[k+2]==c.base_colors[k+3],'face shading is not neutral')
            assert(c.color[k+4]==q.color[k+4],'alpha must stay the selection/visibility channel')
            -- Arc-length U of side/rim/surface is unchanged (continuous across chunks and joins).
            assert(c.uv[(n+j-1)*2+1]==q.uv[(n+j-1)*2+1] and c.uv[(n+j-1)*2+2]==q.uv[(n+j-1)*2+2])
        end
    end
    -- End caps only at real run ends: END face, U 0 at the front and 1 at the back.
    local n=(e.last-e.first)*18
    for _,cap in ipairs({e.first==1 and 1 or false,e.last==#p and e.last-1 or false}) do if cap then
        local family=(p[cap][1]+p[cap+1][1])/2<28 and 0 or 4
        local u={}
        for j=1,6 do assert(c.texture[n+j]==family*4+material.END);u[j]=c.uv[(n+j-1)*2+1] end
        assert(table.concat(u,',')=='0,1,1,0,1,0','cap U '..table.concat(u,','))
        n=n+6
    end end
    assert(n==c.vertices)
end
assert(grass>0 and stone>0,'gaps-landing must show both families at x=28 m')
print(string.format('PASS gaps-landing Grass|Stone at 28 m: %d grass and %d stone intervals, slots per face, cap U, geometry unchanged',grass,stone))

-- Selection gains multiply the neutral base (the existing terrain_mesh.colors contract).
local e=entries[1]
local styles={};for i=e.first,e.last do styles[i]=1 end
local c=projection.section(e.prep,e.first,e.last,e.key,styles)
assert(math.abs(c.color[1]-material.SHADE[material.SIDE]*1.6)<1e-12 and math.abs(c.color[3]-material.SHADE[material.SIDE]*.5)<1e-12)

-- Saved Terrain Look sections (baked width/side/shading) and an overhang (non-monotone ribbon):
-- the textured build keeps the baked geometry and look_data and only replaces colours with neutral shading.
local function compare(prep,first,last,looks,label)
    material.override=false
    local q=projection.section(prep,first,last,'k',nil,looks)
    material.override=assert(material.parse('snow'))
    local c=projection.section(prep,first,last,'k',nil,looks)
    assert(c.textured and #c.texture==c.vertices and c.vertices==q.vertices,label)
    for k,v in ipairs(q.position) do assert(c.position[k]==v,label..': position changed at '..k) end
    for k,v in ipairs(q.look_data) do assert(c.look_data[k]==v,label..': look_data changed at '..k) end
    for i=1,c.vertices do
        local face=c.texture[i]-3*4
        assert(face>=0 and face<=3,label..': not a snow slot')
        assert(c.base_colors[(i-1)*4+1]==material.SHADE[face],label..': shading not neutral')
    end
end
local looks={};for i=1,#entries[1].prep.p do looks[i]={width=1.4,side=3,shading=.4} end
compare(entries[1].prep,entries[1].first,entries[1].last,looks,'Terrain Look sections')
local curl={{0,0},{2,0},{3,1},{2.5,2.2},{1.2,2},{1,3},{4,4},{6,4}}
local prep=geometry.prepare(curl,-8,0);assert(not prep.monotone)
compare(prep,1,#curl,nil,'overhang ribbon')
print('PASS textured route keeps baked Terrain Look geometry and overhang ribbons; only shading and slots change')

-- 1 MiB Fit: the P5 660 m course (1016 segments in two chains, 17 sections, 18,312 vertices).
local long={chains={},hulls={},labels={},bounds={-10,700,-40,50}}
for k,n in ipairs({520,496}) do local chain={};for i=0,n do chain[i+1]={i+(k-1)*600,0} end;long.chains[k]=chain end
long._road_profile='perspective-v1'
local r=assert(budget.check(long))
assert(r.vertices==18312 and r.sections==17 and r.stride==52 and r.payload==952224 and budget.PAYLOAD-r.payload==96352)
material.override=false
assert(assert(budget.check(long)).payload==878976)
print('PASS 660 m Fit payload: 18,312 vertices x 52 B = 952,224 B (96,352 B under 1 MiB); untextured 878,976 B')
-- Largest admitted vertex count: 21,845 untextured, 20,164 textured.
assert(math.floor(budget.PAYLOAD/48)==21845 and math.floor(budget.PAYLOAD/52)==20164)
material.override=nil
print('PASS terrain material')
