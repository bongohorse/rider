-- Versioned visual-only contract for #290; #278 can reuse it after visual acceptance.
-- World metres. The z=0 collision plane is invariant under this central projection.
local geometry=require 'main.gym.terrain_geometry'
local M={VERSION=1,FOCAL=40,STRIDE=48,WORKING=560}
M.DEFAULT={version=1,mode='perspective',width=.9,perspective=.35,angle=math.atan(.55)*180/math.pi,side=64,shading=1}
M.RANGES={width={.25,2},perspective={0,1},angle={10,45},side={.25,64},shading={0,1}}
function M.validate(p)
    if type(p)~='table' or p.version~=1 or (p.mode~='fixed' and p.mode~='perspective') then return nil,'Unsupported look version/mode' end
    local out={version=1,mode=p.mode}
    for k,r in pairs(M.RANGES) do
        local v=p[k]
        if type(v)~='number' or v~=v or v<r[1] or v>r[2] then return nil,k..' must be '..r[1]..'..'..r[2] end
        out[k]=v
    end
    for k in pairs(p) do if out[k]==nil then return nil,'Unknown look parameter: '..tostring(k) end end
    return out
end
function M.project(x,y,z,c,p)
    if z==0 then return x,y end
    local a=p.mode=='perspective' and p.perspective/M.FOCAL or 0
    local w=1+a*z
    return c[1]+(x-c[1]+z*.18)/w,c[2]+(y-c[2]+z*math.tan(p.angle*math.pi/180))/w
end
-- A linear-fractional map with positive denominator: extrema occur at box corners and z endpoints.
function M.bounds(base,c,p)
    local b={math.huge,math.huge,-math.huge,-math.huge}
    for _,x in ipairs({base[1],base[3]}) do for _,y in ipairs({base[2],base[4]}) do
        for _,z in ipairs({0,p.width}) do
            local u,v=M.project(x,y,z,c,p)
            b[1],b[2],b[3],b[4]=math.min(b[1],u),math.min(b[2],v),math.max(b[3],u),math.max(b[4],v)
        end
    end end
    return {b[1]-.01,b[2]-.01,b[3]+.01,b[4]+.01}
end
function M.section(prep,first,last,key,styles)
    -- Retain the accepted builder, partition, front contour, colors and UV phase.
    local c=geometry.section(prep,first,last,key,true,styles)
    c.look_data={};for i=1,c.vertices*3 do c.look_data[i]=0 end
    local function bottom(vertex,index)
        local offset=(vertex-1)*3
        local p=prep.p[index]
        c.look_data[offset+1],c.look_data[offset+2],c.look_data[offset+3]=p[1]-c.origin[1],p[2]-c.origin[2],prep.monotone and 1 or 0
        if not prep.monotone then c.position[offset+3]=c.position[offset+3]>0 and -2*geometry.DEPTH or -geometry.DEPTH end
    end
    for i=first,last-1 do
        local n=(i-first)*18
        bottom(n+3,i+1);bottom(n+5,i+1);bottom(n+6,i)
    end
    local n=(last-first)*18
    for _,i in ipairs({first==1 and first or false,last==#prep.p and last or false}) do
        if i then bottom(n+3,i);bottom(n+5,i);bottom(n+6,i);n=n+6 end
    end
    c.bytes,c.perspective,c.lower=c.vertices*M.STRIDE,true,prep.lower
    return c
end
return M
