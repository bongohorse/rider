-- Focused P1 checks on the actual compiler output, not a parallel sampler.
local doc=require "main.gym.editor_doc"
local geometry=require "main.terrain_compare.geometry"
local checks=0
for _,id in ipairs({"six-anchor","long-curves","mixed"}) do
    local source=dofile(arg[1].."/"..id.."-source.lua")
    assert(doc.validate(source));local d=assert(doc.compile(source))
    local before=doc.copy(d)
    local segments=0;for _,c in ipairs(d.chains) do segments=segments+#c-1 end
    assert(segments==(id=="six-anchor" and 666 or 696))
    for _,variant in ipairs({"flat","depth"}) do for _,size in ipairs({32,64,128}) do
        local chunks,stats=geometry.build(d,variant,size)
        assert(stats.chunks<=geometry.MAX_CHUNKS)
        local intervals=0;local previous={};local vertices=0
        for _,c in ipairs(chunks) do
            assert(#c.position==c.vertices*3 and #c.color==c.vertices*4 and #c.uv==c.vertices*2)
            assert(c.bytes==c.vertices*36 and c.vertices%3==0)
            intervals=intervals+c.last-c.first;vertices=vertices+c.vertices
            if previous[c.chain] then
                local p=previous[c.chain];assert(p.last==c.first and p.u1==c.u0,"Chunk seam/UV discontinuity")
            end
            previous[c.chain]=c
            local raw=d.chains[c.chain];local lo,hi=math.min(raw[1][1],raw[#raw][1]),math.max(raw[1][1],raw[#raw][1])
            for j=1,#c.position,3 do
                local x,y,z=c.position[j],c.position[j+1],c.position[j+2]
                assert(x+c.origin[1]>=lo-1e-9 and x+c.origin[1]<=hi+1e-9,"Filled geometry crosses a physical gap")
                local px,py=x+z*geometry.PROJECTION[1],y+z*geometry.PROJECTION[2]
                assert(px>=c.bounds[1]-1e-9 and px<=c.bounds[4]+1e-9 and py>=c.bounds[2]-1e-9 and py<=c.bounds[5]+1e-9,"Invalid visual bounds")
            end
        end
        assert(intervals==segments and vertices==stats.vertices)
        checks=checks+1
    end end
    -- Deep equality, including original chain orientation and all start/bounds/source fields.
    local function equal(a,b) if type(a)~="table" then return a==b end;for k,v in pairs(a) do if not equal(v,b[k]) then return false end end;for k in pairs(b) do if a[k]==nil then return false end end;return true end
    assert(equal(d,before),"Visual build mutated its physical/source input")
end
local over=dofile(arg[1].."/long-over-budget-source.lua")
assert(doc.validate(over));local invalid,err=doc.compile(over)
assert(not invalid and err:match("render budget exceeds 800"),"Original admission guard changed")
print("PASS: "..checks.." fixture/variant/chunk combinations; immutable collision/source, seams, UVs, gaps, bounds, allocations and original admission guard")
