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
-- A cubic Bezier q in power form per axis {c0, c1, c2, c3} (c(t) = c0 + c1 t + c2 t^2 + c3 t^3), so the parts
-- tested below cost a few multiplications and no tables (HTML5 runs plain Lua; a drag resamples every frame).
local function cubic(q)
    local c={}
    for k=1,2 do
        local p0,p1,p2,p3=q[1][k],q[2][k],q[3][k],q[4][k]
        c[k]={p0,3*(p1-p0),3*(p0-2*p1+p2),p3-p0+3*(p1-p2)}
    end
    return c
end
local function point(c,t)
    local x,y=c[1],c[2]
    return {x[1]+t*(x[2]+t*(x[3]+t*x[4])),y[1]+t*(y[2]+t*(y[3]+t*y[4]))}
end
-- One axis of the control points of the part [t0, t0 + h] (Taylor terms at t0 in Bezier form).
local function axis(a,t0,h)
    local p=a[1]+t0*(a[2]+t0*(a[3]+t0*a[4]))
    local d1=(a[2]+t0*(2*a[3]+3*t0*a[4]))*h
    local d2=(a[3]+3*t0*a[4])*h*h
    return p,p+d1/3,p+(2*d1+d2)/3,p+d1+d2+a[4]*h*h*h
end
-- Distance of (px, py) from the segment (ax, ay)-(bx, by).
local function dist(px,py,ax,ay,bx,by)
    local dx,dy=bx-ax,by-ay
    local l=dx*dx+dy*dy
    local t=l>0 and math.max(0,math.min(1,((px-ax)*dx+(py-ay)*dy)/l)) or 0
    local x,y=ax+dx*t-px,ay+dy*t-py
    return math.sqrt(x*x+y*y)
end
-- The part [t0, t1] fits when its control points lie within TOLERANCE of its chord (the curve lies in their
-- convex hull, so this bounds the deviation) and the chord is at most MAX_SEGMENT long.
local function fits(c,t0,t1)
    local h=t1-t0
    local x0,x1,x2,x3=axis(c[1],t0,h)
    local y0,y1,y2,y3=axis(c[2],t0,h)
    if (x3-x0)^2+(y3-y0)^2>M.MAX_SEGMENT^2 then return false end
    return dist(x1,y1,x0,y0,x3,y3)<=M.TOLERANCE and dist(x2,y2,x0,y0,x3,y3)<=M.TOLERANCE
end
-- Shortest chord the two ends may leave between them before they share the rest instead (no sliver).
local MIN_CHORD=0.05
-- The longest part from one end of [a, b] that fits: forwards from a (dir 1) or backwards from b (dir -1).
-- The search starts at the previous chord's span g, gallops by 1.25 and ends with 6 halvings (within
-- 0.4 % of the longest). Returns its parameter span, or nil when no part fits.
local function reach(c,a,b,dir,g)
    local span=b-a
    local function ok(d) if dir>0 then return fits(c,a,a+d) end return fits(c,b-d,b) end
    local lo,hi=math.min(g,span),nil
    if ok(lo) then
        while true do
            local n=math.min(lo*1.25,span)
            if n<=lo or not ok(n) then hi=n;break end
            lo=n
        end
    else
        hi=lo
        while true do
            lo=hi/1.25
            if lo<span*1e-9 then return nil end
            if ok(lo) then break end
            hi=lo
        end
    end
    for _=1,6 do local m=(lo+hi)/2;if ok(m) then lo=m else hi=m end end
    return lo
end
-- Adds the points of the cubic c strictly between the parameters a and b (compiler 6). Chords are taken
-- from both ends towards the middle, each as long as a part that fits allows (gf, gr: the previous spans
-- at each end). When the two ends meet, or would leave a sliver, the rest is split at its middle and each
-- half is walked the same way, so a mirrored curve samples to exactly the mirrored points. Halving whole
-- segments (compilers 4-5) cut chords to power-of-two fractions and drew far more segments than needed.
local function walk(c,a,b,add,gf,gr)
    local back={}
    while not fits(c,a,b) do
        local df,dr=reach(c,a,b,1,gf),reach(c,a,b,-1,gr)
        if not df or not dr then return false end
        local front,rear=a+df,b-dr
        gf,gr=df,dr
        if front<=a or rear>=b then return false end
        if front>=rear or length(point(c,front),point(c,rear))<MIN_CHORD then
            local m=(front+rear)/2
            if not (walk(c,a,m,add,gf,gf) and add(point(c,m)) and walk(c,m,b,add,gr,gr)) then return false end
            break
        end
        if not add(point(c,front)) then return false end
        back[#back+1]=point(c,rear)
        a,b=front,rear
    end
    for i=#back,1,-1 do if not add(back[i]) then return false end end
    return true
end
-- One cubic Bezier segment q (q[1] already collected); its end is the exact anchor. The first search
-- starts at the span of one MAX_SEGMENT along the control polygon.
local function bezier(q,add)
    local l=length(q[1],q[2])+length(q[2],q[3])+length(q[3],q[4])
    local g=math.min(1,M.MAX_SEGMENT/math.max(l,1e-9))
    return walk(cubic(q),0,1,add,g,g) and add(q[4])
end
-- A straight piece in equal chords of at most MAX_SEGMENT.
local function chords(a,b,add)
    local n=math.max(1,math.ceil(length(a,b)/M.MAX_SEGMENT-1e-9))
    for i=1,n-1 do if not add({a[1]+(b[1]-a[1])*i/n,a[2]+(b[2]-a[2])*i/n}) then return false end end
    return add(b)
end
-- A curve: anchors {p, in, out, mode} (tangents relative to p). Segment i runs from anchor i to i+1 with
-- control points p_i, p_i + out_i, p_{i+1} + in_{i+1}, p_{i+1}. A segment between two corner anchors
-- (LE5c, compiler 5) is a straight chord exactly like a line segment. Otherwise the first R8 step merges
-- consecutive straight segments on one line (never through a corner anchor: their join is no corner);
-- every other anchor is kept as a point. Returns the points, or nil when the shape needs more than
-- MAX_POINTS.
function M.curve(anchors)
    local out,add=collector(anchors[1].p)
    local i=1
    while i<#anchors do
        local a,b=anchors[i],anchors[i+1]
        local p0,p3=a.p,b.p
        local p1,p2={p0[1]+a.out[1],p0[2]+a.out[2]},{p3[1]+b["in"][1],p3[2]+b["in"][2]}
        if a.mode=="corner" and b.mode=="corner" then
            if not add(p3) then return nil end
            i=i+1
        elseif straight(p0,p1,p2,p3) then
            -- Extend over following straight segments that stay on the same line in the same direction.
            local j=i+1
            while j<#anchors do
                local c,d=anchors[j],anchors[j+1]
                local q1,q2={c.p[1]+c.out[1],c.p[2]+c.out[2]},{d.p[1]+d["in"][1],d.p[2]+d["in"][2]}
                local dx,dy=p3[1]-p0[1],p3[2]-p0[2]
                local ex,ey=d.p[1]-c.p[1],d.p[2]-c.p[2]
                if c.mode=="corner" or not straight(c.p,q1,q2,d.p) or math.abs(dx*ey-dy*ex)>1e-9*math.sqrt((dx*dx+dy*dy)*(ex*ex+ey*ey)) or dx*ex+dy*ey<=0 then break end
                p3=d.p;j=j+1
            end
            if not chords(p0,p3,add) then return nil end
            i=j
        else
            if not bezier({p0,p1,p2,p3},add) then return nil end
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
