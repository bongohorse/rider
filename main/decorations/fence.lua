-- Pure fence geometry: a strip that follows the driving line between two distances, standing upright.
-- U runs on with arc length, so the repeating texture has no gap at a repeat or a corner.
-- POST_U: the post column of fence-wood (centre 0.25 of the period, 0.07 wide); 0.14 m at a 2 m period.
local M={HEIGHT=1,PERIOD=2,MAX_POINTS=256,POST_WIDTH=.14,POST_U={.215,.285}}
-- Points of the source between two distances, within one part (a jump gap ends the fence).
function M.points(parts,from,to,offset)
    local out={}
    local walked=0
    for _,part in ipairs(parts or {}) do
        for i=2,#part do
            local a,b=part[i-1],part[i]
            local dx,dy=b[1]-a[1],b[2]-a[2]
            local l=math.sqrt(dx*dx+dy*dy)
            if l>0 then
                local s0,s1=walked,walked+l
                if s1>=from and s0<=to then
                    if #out==0 then local t=math.max(0,(from-s0)/l);out[1]={a[1]+dx*t,a[2]+dy*t+offset} end
                    local t=math.min(1,(to-s0)/l)
                    if t>0 then out[#out+1]={a[1]+dx*t,a[2]+dy*t+offset} end
                end
                walked=s1
            end
        end
        if #out>0 then break end
        -- A gap adds no distance: the next part goes on counting from here.
    end
    -- Coinciding points would draw nothing or degenerate triangles.
    local clean={}
    for _,q in ipairs(out) do
        local last=clean[#clean]
        if not last or (q[1]-last[1])^2+(q[2]-last[2])^2>1e-8 then clean[#clean+1]=q end
    end
    if #clean<2 then return nil end
    -- A long fence over fine samples is thinned, keeping both ends, so it always fits the compiled limit.
    if #clean>M.MAX_POINTS then
        local thin={}
        for i=1,M.MAX_POINTS do thin[i]=clean[1+math.floor((i-1)*(#clean-1)/(M.MAX_POINTS-1)+.5)] end
        clean=thin
    end
    return clean
end
-- Triangle list in metres: {x,y,u,v} per vertex.
function M.strip(points,height,period,posts)
    height,period=height or M.HEIGHT,period or M.PERIOD
    local v,u={},0
    local function add(x,y,tu,tv) v[#v+1]={x,y,tu,tv} end
    for i=2,#points do
        local a,b=points[i-1],points[i]
        local next_u=u+math.sqrt((b[1]-a[1])^2+(b[2]-a[2])^2)/period
        add(a[1],a[2],u,0);add(b[1],b[2],next_u,0);add(b[1],b[2]+height,next_u,1)
        add(a[1],a[2],u,0);add(b[1],b[2]+height,next_u,1);add(a[1],a[2]+height,u,1)
        u=next_u
    end
    -- A post at each end, cut from the texture's post column (#635); drawn last, over the rails.
    if posts~=false and #points>=2 then
        local half=M.POST_WIDTH/2
        for _,q in ipairs({points[1],points[#points]}) do
            local x,y=q[1],q[2]
            add(x-half,y,M.POST_U[1],0);add(x+half,y,M.POST_U[2],0);add(x+half,y+height,M.POST_U[2],1)
            add(x-half,y,M.POST_U[1],0);add(x+half,y+height,M.POST_U[2],1);add(x-half,y+height,M.POST_U[1],1)
        end
    end
    return v
end
-- Distance of p from a fence's strip, for picking: inside its height over a segment, else nil.
function M.hit(points,p,height,margin)
    height,margin=height or M.HEIGHT,margin or .1
    for i=2,#points do
        local a,b=points[i-1],points[i]
        local lo,hi=math.min(a[1],b[1]),math.max(a[1],b[1])
        if hi>lo and p[1]>=lo-margin and p[1]<=hi+margin then
            local y=a[2]+(b[2]-a[2])*(math.max(lo,math.min(hi,p[1]))-a[1])/(b[1]-a[1])
            if p[2]>=y-margin and p[2]<=y+height+margin then return true end
        end
    end
    return false
end
return M
