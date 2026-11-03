-- Read-only terrain-route reference. Metres, no physics, scoring, storage or accumulated travel.
-- Initial domain: one horizontally directed corridor, with optional vertical segments and clear gaps.
local M={MAX_SEGMENTS=2048,MAX_OFFSET=20}
local EPS=1e-6
local function finite(x) return type(x)=='number' and x==x and math.abs(x)<math.huge end
local function point(p) return type(p)=='table' and finite(p[1]) and finite(p[2]) end
local function dist(a,b) return math.sqrt((b[1]-a[1])^2+(b[2]-a[2])^2) end
local function candidate(e,x,y,lo,hi)
    local dx,dy=e.b[1]-e.a[1],e.b[2]-e.a[2]
    local t=((x-e.a[1])*dx+(y-e.a[2])*dy)/(e.length*e.length)
    t=math.max(math.max(0,(lo-e.s)/e.length),math.min(math.min(1,(hi-e.s)/e.length),t))
    local px,py=e.a[1]+t*dx,e.a[2]+t*dy
    return e.s+t*e.length,(x-px)^2+(y-py)^2
end
local function project(r,x,y,lo,hi)
    local best,s,gap
    for _,e in ipairs(r.segments) do if e.s+e.length>=lo and e.s<=hi then
        local q,d=candidate(e,x,y,lo,hi)
        -- In a clear gap, the straight lip-to-landing reference owns the airborne corridor.
        local in_gap=e.gap and x>math.min(e.a[1],e.b[1])+EPS and x<math.max(e.a[1],e.b[1])-EPS
        if in_gap and d<=M.MAX_OFFSET^2 then return q,d,true end
        if not best or d<best-EPS then best,s,gap=d,q,e.gap end
    end end
    return s,best,gap
end
function M.prepare(d)
    if not d.finish then return nil,'No FINISH' end
    local f=d.finish
    if not point(d.spawn) or not f.direction or math.abs(f.direction[1] or 0)<.5 then return nil,'Only horizontally directed courses' end
    if d.sections then return nil,'Sectioned stations have no single route' end
    local chains={};local count=0
    for _,raw in ipairs(d.chains or {}) do
        if #raw<2 or not point(raw[1]) or not point(raw[#raw]) or math.abs(raw[1][1]-raw[#raw][1])<EPS then return nil,'Loops or vertical-only runs' end
        local c={};local reverse=raw[1][1]>raw[#raw][1];local vertical
        for i=1,#raw do
            local p=raw[reverse and #raw-i+1 or i]
            if not point(p) then return nil,'Invalid route point' end
            c[i]={p[1],p[2]}
            if i>1 then
                local dx,dy=p[1]-c[i-1][1],p[2]-c[i-1][2]
                if dx< -EPS then return nil,'Switchbacks or loops' end
                if math.abs(dx)<EPS then
                    if vertical and vertical*dy<0 then return nil,'Overlapping vertical route' end
                    vertical=dy~=0 and dy or vertical
                else vertical=nil end
            end
        end
        chains[#chains+1]=c;count=count+#c-1
    end
    if #chains==0 then return nil,'No terrain route' end
    if count+#chains-1>M.MAX_SEGMENTS then return nil,'Route exceeds 2048 segments' end
    table.sort(chains,function(a,b)return a[1][1]<b[1][1]end)
    local edges={};local last
    for _,c in ipairs(chains) do
        if last then
            if c[1][1]<last[1]-EPS or math.abs(c[1][1]-last[1])<EPS and dist(last,c[1])>EPS then return nil,'Overlapping routes or branches' end
            if dist(last,c[1])>EPS then edges[#edges+1]={a=last,b=c[1],gap=true} end
        end
        for i=2,#c do if dist(c[i-1],c[i])>EPS then edges[#edges+1]={a=c[i-1],b=c[i]} end end
        last=c[#c]
    end
    local r={segments={},gaps=0};local arc=0;local reverse=f.direction[1]<0
    for i=1,#edges do
        local e=edges[reverse and #edges-i+1 or i]
        local a,b=e.a,e.b;if reverse then a,b=b,a end
        local length=dist(a,b);r.segments[i]={a=a,b=b,s=arc,length=length,gap=e.gap==true};arc=arc+length
        if e.gap then r.gaps=r.gaps+1 end
    end
    if arc<EPS then return nil,'Empty route' end
    local start,offset=project(r,d.spawn[1],d.spawn[2],0,arc)
    if not start or offset>M.MAX_OFFSET^2 then return nil,'START too far from route' end
    local a,b=f.line[1],f.line[2];local lx,ly=b[1]-a[1],b[2]-a[2];local nx,ny=ly,-lx
    if nx*f.direction[1]+ny*f.direction[2]<0 then nx,ny=-nx,-ny end
    local finish
    for _,e in ipairs(r.segments) do
        local s0=(e.a[1]-a[1])*nx+(e.a[2]-a[2])*ny
        local s1=(e.b[1]-a[1])*nx+(e.b[2]-a[2])*ny
        if s0<=EPS and s1>=-EPS and s1-s0>EPS then
            local t=math.max(0,math.min(1,-s0/(s1-s0)));local x,y=e.a[1]+t*(e.b[1]-e.a[1]),e.a[2]+t*(e.b[2]-e.a[2])
            local u=((x-a[1])*lx+(y-a[2])*ly)/(lx*lx+ly*ly)
            if u>=-EPS and u<=1+EPS then
                local q=e.s+t*e.length
                if finish and math.abs(q-finish)>EPS then return nil,'FINISH crosses route more than once' end
                finish=q
            end
        end
    end
    if not finish or finish<=start+EPS then return nil,'START / FINISH do not bound one route' end
    r.start,r.finish,r.length=start,finish,finish-start
    return r
end
function M.position(r,x,y)
    if not finite(x) or not finite(y) then return nil,'Vehicle position unavailable' end
    local s,d,gap=project(r,x,y,r.start,r.finish)
    if not s or d>M.MAX_OFFSET^2 then return nil,'Vehicle off route (>20 m)' end
    return math.max(0,math.min(r.length,s-r.start)),nil,gap==true
end
return M
