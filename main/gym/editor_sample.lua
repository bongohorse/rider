-- Shared adaptive sampling for curves and Bump/wave (LE5b; contract R8). Pure, metres throughout.
-- The result depends only on the source and these compiler settings, never on the editor zoom:
-- every compiled point lies on the shape, and every chord stays within TOLERANCE of the shape and is
-- at most MAX_SEGMENT long. Both bounds are rigorous (control polygon of a Bezier segment, curvature
-- bound of the wave), so subdivision never relies on spot checks.
local M={TOLERANCE=0.005,MAX_SEGMENT=0.5,MAX_POINTS=2048}
local function dist_segment(p,a,b)
    local dx,dy=b[1]-a[1],b[2]-a[2]
    local l=dx*dx+dy*dy
    local t=l>0 and math.max(0,math.min(1,((p[1]-a[1])*dx+(p[2]-a[2])*dy)/l)) or 0
    local x,y=a[1]+dx*t-p[1],a[2]+dy*t-p[2]
    return math.sqrt(x*x+y*y)
end
M.dist_segment=dist_segment
local function length(a,b) return math.sqrt((b[1]-a[1])^2+(b[2]-a[2])^2) end
local function mid(a,b) return {(a[1]+b[1])/2,(a[2]+b[2])/2} end
-- A collector that refuses more than MAX_POINTS points (an over-budget shape is an error, R16).
local function collector(first)
    local out={{first[1],first[2]}}
    return out,function(p)
        if #out>=M.MAX_POINTS then return false end
        out[#out+1]={p[1],p[2]};return true
    end
end
-- Straight: control points on the chord (the redundant source points of R8).
local function straight(p0,p1,p2,p3) return dist_segment(p1,p0,p3)<=1e-9 and dist_segment(p2,p0,p3)<=1e-9 end
-- One cubic Bezier segment p0..p3 (p0 already collected). The curve lies in the convex hull of its
-- control points, so the larger distance of p1 and p2 from the chord bounds the deviation.
local function bezier(p0,p1,p2,p3,add,depth)
    if math.max(dist_segment(p1,p0,p3),dist_segment(p2,p0,p3))<=M.TOLERANCE and length(p0,p3)<=M.MAX_SEGMENT then return add(p3) end
    if depth>=30 then return false end
    local a,b,c=mid(p0,p1),mid(p1,p2),mid(p2,p3)
    local d,f=mid(a,b),mid(b,c)
    local m=mid(d,f)
    return bezier(p0,a,d,m,add,depth+1) and bezier(m,f,c,p3,add,depth+1)
end
-- A straight piece in equal chords of at most MAX_SEGMENT.
local function chords(a,b,add)
    local n=math.max(1,math.ceil(length(a,b)/M.MAX_SEGMENT-1e-9))
    for i=1,n-1 do if not add({a[1]+(b[1]-a[1])*i/n,a[2]+(b[2]-a[2])*i/n}) then return false end end
    return add(b)
end
-- A curve: anchors {p, in, out} (tangents relative to p). Segment i runs from anchor i to i+1 with
-- control points p_i, p_i + out_i, p_{i+1} + in_{i+1}, p_{i+1}. First R8 step: consecutive straight
-- segments on one line are merged (their join is no corner); every other anchor is kept as a point.
-- Returns the points, or nil when the shape needs more than MAX_POINTS.
function M.curve(anchors)
    local out,add=collector(anchors[1].p)
    local i=1
    while i<#anchors do
        local a,b=anchors[i],anchors[i+1]
        local p0,p3=a.p,b.p
        local p1,p2={p0[1]+a.out[1],p0[2]+a.out[2]},{p3[1]+b["in"][1],p3[2]+b["in"][2]}
        if straight(p0,p1,p2,p3) then
            -- Extend over following straight segments that stay on the same line in the same direction.
            local j=i+1
            while j<#anchors do
                local c,d=anchors[j],anchors[j+1]
                local q1,q2={c.p[1]+c.out[1],c.p[2]+c.out[2]},{d.p[1]+d["in"][1],d.p[2]+d["in"][2]}
                local dx,dy=p3[1]-p0[1],p3[2]-p0[2]
                local ex,ey=d.p[1]-c.p[1],d.p[2]-c.p[2]
                if not straight(c.p,q1,q2,d.p) or math.abs(dx*ey-dy*ex)>1e-9*math.sqrt((dx*dx+dy*dy)*(ex*ex+ey*ey)) or dx*ex+dy*ey<=0 then break end
                p3=d.p;j=j+1
            end
            if not chords(p0,p3,add) then return nil end
            i=j
        else
            if not bezier(p0,p1,p2,p3,add,0) then return nil end
            i=i+1
        end
    end
    return out
end
-- Bump/wave from the origin: y = h/2 (1 - cos(2 pi x / wavelength)) over count wavelengths. On an
-- interval the chord's vertical (hence also perpendicular) deviation is at most width^2/8 times the
-- largest |y''| there; |y''| = h/2 (2 pi / wavelength)^2 |cos(2 pi x / wavelength)|.
function M.wave(h,wavelength,count)
    local k=2*math.pi/wavelength
    local amp=h/2
    local function y(x) return amp*(1-math.cos(k*x)) end
    local function curvature(x0,x1)
        -- |cos| peaks at multiples of half a wavelength inside the interval, else at an end.
        local half=wavelength/2
        if math.floor(x1/half)~=math.floor(x0/half) then return math.abs(amp)*k*k end
        return math.abs(amp)*k*k*math.max(math.abs(math.cos(k*x0)),math.abs(math.cos(k*x1)))
    end
    local out,add=collector({0,0})
    local function split(x0,x1,depth)
        local a,b={x0,y(x0)},{x1,y(x1)}
        if (x1-x0)^2/8*curvature(x0,x1)<=M.TOLERANCE and length(a,b)<=M.MAX_SEGMENT then return add(b) end
        if depth>=30 then return false end
        local m=(x0+x1)/2
        return split(x0,m,depth+1) and split(m,x1,depth+1)
    end
    -- Whole wavelengths end exactly at entry level.
    for i=1,count do
        if not split((i-1)*wavelength,i*wavelength,0) then return nil end
        out[#out][2]=0
    end
    return out
end
return M
