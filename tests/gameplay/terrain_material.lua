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
-- material.PERIOD must match the shader's tile period (a mismatch would seam every quad).
do
    local f=assert(io.open('main/terrain_perspective/textured.vp','r'));local vp=f:read('*a');f:close()
    local surface,side=vp:match('float period=face<1%.5%?([%d%.]+):([%d%.]+);')
    assert(surface and tonumber(surface)==material.PERIOD[material.SURFACE] and tonumber(surface)==material.PERIOD[material.RIM] and tonumber(side)==material.PERIOD[material.SIDE],'material.PERIOD differs from textured.vp')
end

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
            -- Per-quad U drops whole tiles only (same fract as the continuous arc length) and stays small; V unchanged.
            local tiles=4/material.PERIOD[face];local k=(n+j-1)*2+1
            local shift=(q.uv[k]-c.uv[k])*tiles
            assert(math.abs(shift-math.floor(shift+.5))<1e-9,'U shift is not whole tiles')
            assert(c.uv[k]*tiles>=-1e-9 and c.uv[k]*tiles<1+(q.uv[(n+(j<=6 and 2 or j<=12 and 8 or 14)-1)*2+1]-q.uv[(n+(j<=6 and 1 or j<=12 and 7 or 13)-1)*2+1])*tiles+1e-9,'per-quad U not bounded')
            assert(c.uv[k+1]==q.uv[k+1])
            -- All six vertices of a quad share one shift (else U compresses or reverses inside the quad).
            local a=(n+(j<=6 and 1 or j<=12 and 7 or 13)-1)*2+1
            assert(math.abs((c.uv[k]-c.uv[a])-(q.uv[k]-q.uv[a]))<1e-12,'per-quad U shift differs inside a quad at interval '..interval..' vertex '..j)
            assert(c.color[(n+j-1)*4+1]==material.SHADE[face],'uploaded colour is not the neutral shade')
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
    if looks then
        local plain=projection.section(prep,first,last,'k',nil,nil)
        assert(q.baked and not plain.baked,label..': looks were not applied')
    end
    material.override=assert(material.parse('snow'))
    local c=projection.section(prep,first,last,'k',nil,looks)
    assert(c.textured and #c.texture==c.vertices and c.vertices==q.vertices and c.baked==q.baked,label)
    for k,v in ipairs(q.position) do assert(c.position[k]==v,label..': position changed at '..k) end
    for k,v in ipairs(q.look_data) do assert(c.look_data[k]==v,label..': look_data changed at '..k) end
    for i=1,c.vertices do
        local face=c.texture[i]-3*4
        assert(face>=0 and face<=3,label..': not a snow slot')
        assert(c.base_colors[(i-1)*4+1]==material.SHADE[face] and c.color[(i-1)*4+1]==material.SHADE[face],label..': shading not neutral')
    end
    local caps=(first==1 and 1 or 0)+(last==#prep.p and 1 or 0)
    for cap=1,caps do
        local n=(last-first)*18+(cap-1)*6;local u={}
        for j=1,6 do assert(c.texture[n+j]==3*4+material.END,label..': cap slot');u[j]=c.uv[(n+j-1)*2+1] end
        assert(table.concat(u,',')=='0,1,1,0,1,0',label..': cap U '..table.concat(u,','))
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
-- CPU working estimate: 576 B/vertex retained + 512 B/physics vertex + two payload copies.
assert(r.cpu_estimate==18312*576+r.physics_vertices*512+2*952224)
material.override=false
assert(assert(budget.check(long)).payload==878976)
print('PASS 660 m Fit payload: 18,312 vertices x 52 B = 952,224 B (96,352 B under 1 MiB); untextured 878,976 B')
-- Largest admitted vertex count: 21,845 untextured, 20,164 textured.
assert(math.floor(budget.PAYLOAD/48)==21845 and math.floor(budget.PAYLOAD/52)==20164)
material.override=nil
-- #539 level material presets: slot is the face, Band data on rim and side, 52 bytes, continuous U.
do
    local spec=assert(material.parse('meadow'));assert(spec.preset=='meadow')
    for _,id in ipairs(material.PRESETS) do assert(material.parse(id).preset==id) end
    assert(material.PRESETS[1]=='meadow')
    material.override=spec
    local points={};for x=0,140 do points[#points+1]={x,math.sin(x*.1)*3} end
    local prep=geometry.prepare(points,-30,0)
    local a=projection.section(prep,1,65,'a')
    local b=projection.section(prep,65,129,'b')
    assert(a.preset=='meadow' and a.textured and a.bytes==a.vertices*52)
    for i,v in ipairs(a.texture) do assert(v>=0 and v<=3,'slot is a face; the first section has no flipped end') end
    assert(a.texture[1]==material.SIDE and a.texture[7]==material.RIM and a.texture[13]==material.SURFACE)
    -- Side tops start below the rim; rim runs from the line down to that start.
    assert(a.look_data[1]==material.BAND_START and a.look_data[4]==material.BAND_START)
    assert(a.look_data[(7-1)*3+1]==0 and a.look_data[(9-1)*3+1]==material.BAND_START)
    -- Slope factor: 1 on flat ground, smaller on a slope, positive everywhere.
    local slopes=false
    for i=1,a.vertices do local f=a.uv[(i-1)*2+2];if a.texture[i]==material.SIDE then assert(f>0 and f<=1);slopes=slopes or f<.999 end end
    assert(slopes,'the course has slopes')
    -- Quads drop whole images only: at the section boundary U agrees modulo 1, with the phase.
    local function u_at(c,vertex,phase) local v=c.uv[(vertex-1)*2+1]+phase;return v-math.floor(v) end
    local last=(64-1)*18+2 -- side quad's upper right vertex in section a
    local near=math.abs(u_at(a,last,prep.u[1]%1)-u_at(b,1,prep.u[65]%1))
    assert(near<1e-6 or math.abs(near-1)<1e-6,'U continuous across sections: '..near)
    -- A run end closes up to the driving line.
    local n=64*18
    assert(a.texture[n+1]==material.END and a.look_data[n*3+1]==0,'the left run end is not flipped')
    local c=projection.section(prep,129,#prep.p,'c');local m=(#prep.p-129)*18
    assert(c.texture[m+1]==material.END+material.FLIPPED,'the right run end is flipped')
    -- First end never flipped, last end always, for every run shape: a wall, a step, overhangs running either way.
    for name,run in pairs({wall={{40,0},{40,8}},step={{0,0},{20,0},{20,4}},back_start={{88,8},{84,4},{90,2},{95,3}},back_end={{60,0},{70,4},{70,8},{66,8}}}) do
        local shape=geometry.prepare(run,-30,0)
        local r=projection.section(shape,1,#shape.p,'r')
        local cap=(#shape.p-1)*18
        assert(r.texture[cap+1]==material.END,name..': first end')
        assert(r.texture[cap+7]==material.END+material.FLIPPED,name..': last end')
        for q=1,cap do assert(r.texture[q]<=2,name..': no flip on other faces') end
    end
    assert(math.abs(a.position[n*3+1]-(prep.p[1][1]-a.origin[1]))<1e-9 and math.abs(a.position[n*3+2]-(prep.p[1][2]-a.origin[2]))<1e-9)
    assert(material.describe().preset=='meadow')
    -- Rim and Surface U also agree across sections.
    for _,offset in ipairs({6,12}) do
        local near2=math.abs(u_at(a,63*18+offset+2,prep.u[1]%1)-u_at(b,offset+1,prep.u[65]%1))
        assert(near2<1e-6 or math.abs(near2-1)<1e-6,'U continuous across sections on face at '..offset)
    end
    -- #541 light: rising brighter, falling darker, flat neutral, equal across sections, Surface back darker.
    do
        local hill={};for x=0,200 do hill[#hill+1]={x,x<80 and x*.5 or (x<120 and 40 or 40-(x-120)*.5)} end
        local shape=geometry.prepare(hill,-30,0)
        local s1=projection.section(shape,1,65,'l1');local s2=projection.section(shape,65,129,'l2');local s3=projection.section(shape,129,193,'l3')
        local function grey(c,vertex) return c.color[(vertex-1)*4+1] end
        assert(grey(s1,1)>1.05,'rising is brighter: '..grey(s1,1))
        assert(grey(s3,18*20+1)<.95,'falling is darker')
        assert(math.abs(grey(s2,18*30+1)-1)<1e-9,'flat is neutral')
        assert(math.abs(grey(s1,63*18+2)-grey(s2,1))<1e-9,'sections agree at their joint')
        assert(grey(s2,18*30+13+2)<grey(s2,18*30+13),'the Surface darkens to its back edge')
        assert(math.abs(s1.base_colors[1]-s1.color[1])<1e-9 and s1.bytes==s1.vertices*52)
    end
    -- Budgets with a preset: the 660 m course and the near-limit refusal.
    local preset_long={chains={},hulls={},labels={},bounds={-10,700,-40,50},_road_profile='perspective-v1'}
    for k,n in ipairs({520,496}) do local chain={};for i=0,n do chain[i+1]={i+(k-1)*600,0} end;preset_long.chains[k]=chain end
    local measured=assert(budget.check(preset_long))
    assert(measured.stride==52 and measured.payload==952224 and measured.cpu_estimate==18312*576+measured.physics_vertices*512+2*952224)
    assert(measured.cpu_estimate<budget.CPU,'CPU working estimate under the limit: '..measured.cpu_estimate)
    local function course(segments)
        local chain={};for i=0,segments do chain[i+1]={i,0} end
        return {chains={chain},hulls={},labels={},bounds={-10,segments+10,-40,50},_road_profile='perspective-v1'}
    end
    local fits=assert(budget.check(course(1119)));assert(fits.vertices==20154 and fits.payload==20154*52)
    local refused,why=budget.check(course(1120));assert(not refused and why:find('payload',1,true),'near-limit refusal: '..tostring(why))
    print('PASS #539 preset budgets: 660 m '..measured.payload..' B, CPU '..measured.cpu_estimate..' B; 1119 segments admitted, 1120 refused')
    material.override=nil
end
print('PASS terrain material')
