-- Focused normal-Play coverage using the real compiler and previously accepted P1 output.
local doc=require 'main.gym.editor_doc'
local geom=require 'main.gym.terrain_geometry'
local old=require 'main.terrain_compare.geometry'
local function equal(a,b)
    if type(a)~='table' then return a==b end
    for k,v in pairs(a) do if not equal(v,b[k]) then return false end end
    for k in pairs(b) do if a[k]==nil then return false end end
    return true
end
local count=0
local function check(d)
    local before=doc.copy(d)
    local chunks,stats=geom.build(d)
    assert(equal(d,before),'Visual builder changed physical/source data')
    local previous,segments,vertices,keys={},0,0,{}
    for _,c in ipairs(chunks) do
        assert(not keys[c.key]);keys[c.key]=true
        assert(c.vertices<=1164 and #c.position==c.vertices*3 and #c.color==c.vertices*4 and #c.uv==c.vertices*2)
        if previous[c.chain] then
            local p=previous[c.chain];assert(p.last==c.first and p.u1==c.u0)
            local last=(p.last-p.first-1)*18
            for _,pair in ipairs({{last+2,1},{last+3,6},{last+8,7},{last+15,18}}) do
                for k=1,3 do
                    local a=p.position[(pair[1]-1)*3+k]+(p.origin[k] or 0)
                    local b=c.position[(pair[2]-1)*3+k]+(c.origin[k] or 0)
                    assert(math.abs(a-b)<1e-9,'Cracked body/edge/top join')
                end
            end
        end
        previous[c.chain]=c
        segments=segments+c.last-c.first;vertices=vertices+c.vertices
        for j=1,#c.position,3 do
            local x,y,z=c.position[j],c.position[j+1],c.position[j+2]
            assert(x==x and y==y and z==z)
            x,y=x+z*.18,y+z*.55
            assert(x>=c.bounds[1]-1e-9 and x<=c.bounds[4]+1e-9 and y>=c.bounds[2]-1e-9 and y<=c.bounds[5]+1e-9)
        end
    end
    local expected=0;for _,chain in ipairs(d.chains) do expected=expected+#chain-1 end
    assert(segments==expected and vertices==stats.vertices and vertices*36==stats.buffer_bytes)
    assert(#chunks<=44,'Existing 800-segment / 32-chain domain must fit default 128 meshes')
    local again=geom.build(d);assert(equal(chunks,again),'Unstable derived chunk identities/geometry')
    count=count+1
    return chunks,stats
end
for _,id in ipairs({'six-anchor','long-curves','mixed'}) do
    local d=assert(doc.compile(dofile(arg[1]..'/'..id..'-source.lua')))
    local a,s=check(d);local b,t=old.build(d,'depth',64)
    assert(s.vertices==t.vertices and #a==#b)
    for i,c in ipairs(a) do
        assert(equal(c.color,b[i].color) and equal(c.uv,b[i].uv))
        for j=1,#c.position,3 do
            assert(math.abs(c.position[j]+c.origin[1]-b[i].position[j]-b[i].origin[1])<1e-9)
            assert(math.abs(c.position[j+1]+c.origin[2]-b[i].position[j+1]-b[i].origin[2])<1e-9)
            assert(c.position[j+2]==b[i].position[j+2])
        end
    end
end
for _,id in ipairs({'straight','ramps','ramps-long','steps','steps-down','seams-chain','seams-hull','gaps','gaps-landing','balance','bumps','air'}) do
    check(dofile(arg[1]..'/'..id..'-compiled.lua'))
end
-- Compatibility: vertical walls, turnbacks/curls, disconnected runs, hull-only and old compiled orientation.
for _,chains in ipairs({{{{0,0},{10,0},{10,5},{6,8},{2,5}}},{{{0,0},{0,2},{0,4}}},{{{5,0},{0,0}},{{20,3},{10,3}}},{}}) do
    check({chains=chains,bounds={-10,40,-15,30}})
end
local dense={};for i=0,800 do dense[#dense+1]={i*.5,0} end
local chunks,stats=check({chains={dense},bounds={-10,410,-10,10}})
assert(#chunks==13 and stats.buffer_bytes==518832)
local curl={};for i=0,130 do local a=i/130*math.pi*1.5;curl[#curl+1]={math.cos(a)*10,math.sin(a)*10} end
check({chains={curl},bounds={-20,20,-20,20}})
local many={};for i=1,32 do many[i]={{i*3,0},{i*3+1,0}} end
assert(#check({chains=many,bounds={-10,110,-10,10}})==32)
local over=dofile(arg[1]..'/long-over-budget-source.lua')
local invalid,err=doc.compile(over);assert(not invalid and err:match('render budget exceeds 800'))
print('PASS: '..count..' routes; unchanged P1 world geometry, immutable source/collision, deterministic sections, seams/UV/bounds, general-domain compatibility, unchanged 800 guard')
