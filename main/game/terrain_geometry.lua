-- Normal-Play depth geometry, version 1. Metres; never mutates collision/source data.
local M={VERSION=1,INTERVALS=64,PROJECTION={0.18,0.55},DEPTH=0.9,EDGE=0.18,LAYER_NEAR=-2,LAYER_RANGE=.8,LAYER_SAMPLES=16}
local BODY_TOP,BODY_BOTTOM={0.25,0.34,0.29,1},{0.10,0.16,0.17,1}
local TOP,BACK,EDGE,CAP={0.63,0.76,0.62,1},{0.43,0.60,0.47,1},{0.29,0.43,0.36,1},{0.17,0.25,0.22,1}
local SELECT_GAIN={1.6,.95,.5}
local function distance(a,b) return math.sqrt((b[1]-a[1])^2+(b[2]-a[2])^2) end
-- Shared preparation and section builder. Normal Play keeps its original partition/coordinates.
function M.prepare(raw,lower,arc)
    arc=arc or 0
        local p={}
        for i=1,#raw do local q=raw[raw[1][1]>raw[#raw][1] and #raw-i+1 or i];p[i]={q[1],q[2]} end
        local monotone=true
        for i=2,#p do if p[i][1]<p[i-1][1] then monotone=false end end
        -- Overhangs/curls have no unambiguous vertical solid below. Give them a bounded
        -- ribbon on the run's right-hand side; preserve the authored edge exactly.
        -- Compute shared joins on the whole run before chunking, with a bounded miter.
        local normals={}
        for i=1,#p do
            local function normal(a,b)
                local dx,dy=b[1]-a[1],b[2]-a[2];local len=math.max(distance(a,b),1e-12)
                return {dy/len,-dx/len}
            end
            local a=normal(p[math.max(1,i-1)],p[i==1 and 2 or i])
            local b=normal(p[i==#p and i-1 or i],p[math.min(#p,i+1)])
            local x,y=a[1]+b[1],a[2]+b[2];local len=math.sqrt(x*x+y*y)
            if len<1e-9 then normals[i]=a else
                x,y=x/len,y/len
                local m=math.min(2,1/math.max(0.5,x*a[1]+y*a[2]))
                normals[i]={x*m,y*m}
            end
        end
        local function offset(i,amount)
            local q=p[i];local n=normals[i]
            return monotone and {q[1],q[2]-amount,0} or {q[1]+n[1]*amount,q[2]+n[2]*amount,0}
        end
        local function bottom(i)
            local q=monotone and {p[i][1],lower,0} or offset(i,0.9);q[4]=monotone;return q
        end
        local u={arc/4}
        for i=2,#p do arc=arc+distance(p[i-1],p[i]);u[i]=arc/4 end
        return {p=p,normals=normals,monotone=monotone,u=u,arc=arc,lower=lower,offset=offset,bottom=bottom,layer_z=M.LAYER_NEAR}
end
-- Draw order of runs (#577): where two runs overlap, the one that is lower there is in front. Height along x, averaged
-- over the overlap only: a whole-run mean would put a bridge in front of the long climb passing under it.
local function height_at(prep,x)
    local p,total,count=prep.p,0,0
    if prep.monotone then
        local a,b=1,#p
        while b-a>1 do local m=math.floor((a+b)/2);if p[m][1]<=x then a=m else b=m end end
        local dx=p[b][1]-p[a][1]
        return dx>0 and p[a][2]+(p[b][2]-p[a][2])*(x-p[a][1])/dx or p[a][2]
    end
    for i=1,#p-1 do
        local a,b=p[i],p[i+1]
        if x>=math.min(a[1],b[1]) and x<=math.max(a[1],b[1]) then
            local dx=b[1]-a[1];total=total+(dx~=0 and a[2]+(b[2]-a[2])*(x-a[1])/dx or (a[2]+b[2])/2);count=count+1
        end
    end
    return count>0 and total/count or p[1][2]
end
local function x_range(prep)
    local low,high=math.huge,-math.huge
    for _,q in ipairs(prep.p) do low=math.min(low,q[1]);high=math.max(high,q[1]) end
    return low,high
end
local function identity_before(a,b,i,j)
    local p,q=a.p[1],b.p[1]
    if p[1]~=q[1] then return p[1]<q[1] end
    if p[2]~=q[2] then return p[2]<q[2] end
    return i<j
end
-- Assigns layer_z to every prepared run of a level. Deterministic for the same points, in Play and in Edit.
function M.assign_layers(preps)
    local n=#preps
    local lows,highs,means,behind,blockers={},{},{},{},{}
    for i,prep in ipairs(preps) do
        lows[i],highs[i]=x_range(prep);means[i]=0;behind[i]={};blockers[i]=0
        for s=0,M.LAYER_SAMPLES do means[i]=means[i]+height_at(prep,lows[i]+(highs[i]-lows[i])*s/M.LAYER_SAMPLES) end
        means[i]=means[i]/(M.LAYER_SAMPLES+1)
    end
    for i=1,n-1 do for j=i+1,n do
        local from,to=math.max(lows[i],lows[j]),math.min(highs[i],highs[j])
        if to>from then
            local above,below=false,false
            for s=0,M.LAYER_SAMPLES do
                local x=from+(to-from)*s/M.LAYER_SAMPLES
                local difference=height_at(preps[i],x)-height_at(preps[j],x)
                above=above or difference>1e-6;below=below or difference<-1e-6
            end
            -- Runs that truly cross add no constraint: the mean decides them below, and strict pairs cannot be overruled.
            if not (above and below) then
                local i_higher=above or (not below and identity_before(preps[i],preps[j],i,j))
                local back,front=i_higher and i or j,i_higher and j or i
                behind[back][#behind[back]+1]=front;blockers[front]=blockers[front]+1
            end
        end
    end end
    -- Back to front. Among free runs, or to break a cycle of crossing runs, the highest mean goes first.
    local done,rank={},0
    while rank<n do
        local best
        for i=1,n do if not done[i] then
            local free=blockers[i]==0;local other=best and blockers[best]==0
            if not best or (free and not other) or (free==other and (means[i]>means[best]
                or (means[i]==means[best] and identity_before(preps[i],preps[best],i,best)))) then best=i end
        end end
        done[best]=true
        for _,front in ipairs(behind[best]) do blockers[front]=blockers[front]-1 end
        preps[best].layer_z=n>1 and M.LAYER_NEAR-M.LAYER_RANGE*(1-rank/(n-1)) or M.LAYER_NEAR
        rank=rank+1
    end
end
function M.section(prep,first,last,key,editing,styles)
    local p,u,monotone=prep.p,prep.u,prep.monotone
    local offset,bottom=prep.offset,prep.bottom
    local depth,edge=M.DEPTH,M.EDGE
            local c={position={},color={},uv={},first=first,last=last,key=key,body=monotone and "filled" or "ribbon",origin={p[first][1],p[first][2]},bounds={math.huge,math.huge,0,-math.huge,-math.huge,0},u0=u[first],u1=u[last]}
            if editing then c.base_colors={};c.color_groups={} end
            local state=0
            local function vertex(q,color,uv)
                local x,y,z=q[1]-c.origin[1],q[2]-c.origin[2],q[3]
                local encoded=z
                if editing and q[4] then y=0;encoded=z>0 and -2*M.DEPTH or -M.DEPTH end
                local n=#c.position;c.position[n+1],c.position[n+2],c.position[n+3]=x,y,encoded
                for k,v in ipairs(color) do
                    if editing then c.base_colors[#c.base_colors+1]=v end
                    if state==-1 and k==4 then v=0
                    elseif state==1 and k<4 then v=v*SELECT_GAIN[k]
                    elseif state==2 and k<4 then v=v*1.2 end
                    c.color[#c.color+1]=v
                end
                c.uv[#c.uv+1],c.uv[#c.uv+2]=uv[1]-(editing and u[first] or 0),uv[2]
                local px,py=x+z*M.PROJECTION[1],q[2]-c.origin[2]+z*M.PROJECTION[2]
                c.bounds[1],c.bounds[2]=math.min(c.bounds[1],px),math.min(c.bounds[2],py)
                c.bounds[4],c.bounds[5]=math.max(c.bounds[4],px),math.max(c.bounds[5],py)
            end
            local function quad(a,b,c0,d0,ca,cb,cc,cd,ua,ub)
                vertex(a,ca,{ua,0});vertex(b,cb,{ub,0});vertex(c0,cc,{ub,1})
                vertex(a,ca,{ua,0});vertex(c0,cc,{ub,1});vertex(d0,cd,{ua,1})
            end
            for i=first,last-1 do
                state=styles and styles[i] or 0
                local a,b=p[i],p[i+1]
                quad(offset(i,edge),offset(i+1,edge),bottom(i+1),bottom(i),BODY_TOP,BODY_TOP,BODY_BOTTOM,BODY_BOTTOM,u[i],u[i+1])
                quad({a[1],a[2],0},{b[1],b[2],0},offset(i+1,edge),offset(i,edge),TOP,TOP,EDGE,EDGE,u[i],u[i+1])
                if depth>0 then
                    quad({a[1],a[2],0},{b[1],b[2],0},{b[1],b[2],depth},{a[1],a[2],depth},TOP,TOP,BACK,BACK,u[i],u[i+1])
                end
                if editing then c.color_groups[#c.color_groups+1]={first=(i-first)*72+1,last=(i-first+1)*72,interval=i} end
            end
            -- End caps belong only to physical run ends, never to chunk seams or across gaps.
            if depth>0 then
                for _,i in ipairs({first==1 and 1 or false,last==#p and #p or false}) do
                    if i then state=styles and styles[i==1 and 1 or i-1] or 0
                        local e,b=offset(i,edge),bottom(i)
                        local color_first=#c.color+1
                        quad(e,{e[1],e[2],depth},{b[1],b[2],depth,b[4]},b,CAP,CAP,BODY_BOTTOM,BODY_BOTTOM,u[i],u[i])
                        if editing then c.color_groups[#c.color_groups+1]={first=color_first,last=#c.color,interval=i==1 and 1 or i-1} end
                    end
                end
            end
            c.vertices=#c.position/3;c.bytes=c.vertices*9*4
            c.layer_z=prep.layer_z
    return c
end
function M.build(d)
    local chunks,total,arc,previous,preps={},0,0,nil,{}
    for chain_index,raw in ipairs(d.chains) do
        local start=raw[raw[1][1]>raw[#raw][1] and #raw or 1]
        if previous then arc=arc+distance(previous,start) end
        preps[chain_index]=M.prepare(raw,d.bounds[3],arc)
        arc,previous=preps[chain_index].arc,preps[chain_index].p[#preps[chain_index].p]
    end
    M.assign_layers(preps)
    for chain_index,prep in ipairs(preps) do
        for first=1,#prep.p-1,M.INTERVALS do
            local last=math.min(first+M.INTERVALS,#prep.p)
            local c=M.section(prep,first,last,"run"..chain_index.."-"..first.."-"..last)
            c.chain=chain_index
            chunks[#chunks+1]=c;total=total+c.vertices
        end
    end
    return chunks,{chunks=#chunks,vertices=total,triangles=total/3,buffer_bytes=total*36,version=M.VERSION,intervals=M.INTERVALS,lower_extent=d.bounds[3],depth=M.DEPTH,projection=M.PROJECTION}
end
-- Cheap world-space projected bounds; no emitted vertex/color/UV arrays.
function M.extent(prep,first,last)
    local b={math.huge,math.huge,-math.huge,-math.huge}
    local function include(x,y)
        b[1],b[2]=math.min(b[1],x),math.min(b[2],y)
        b[3],b[4]=math.max(b[3],x+M.DEPTH*M.PROJECTION[1]),math.max(b[4],y+M.DEPTH*M.PROJECTION[2])
    end
    for i=first,last do
        local p,n=prep.p[i],prep.normals[i];include(p[1],p[2])
        if prep.monotone then include(p[1],math.min(prep.lower,p[2]-M.EDGE))
        else include(p[1]+n[1]*M.EDGE,p[2]+n[2]*M.EDGE);include(p[1]+n[1]*.9,p[2]+n[2]*.9) end
    end
    -- Same half-engine-unit guard as the uploaded AABB, including floating conversion error.
    b[1],b[2],b[3],b[4]=b[1]-.005,b[2]-.005,b[3]+.005,b[4]+.005
    return b
end
function M.describe(d)
    local entries,total,arc,previous,preps={},0,0,nil,{}
    for chain_index,raw in ipairs(d.chains) do
        local start=raw[raw[1][1]>raw[#raw][1] and #raw or 1]
        if previous then arc=arc+distance(previous,start) end
        local prep=M.prepare(raw,d.bounds[3],arc);arc,previous=prep.arc,prep.p[#prep.p];preps[#preps+1]=prep
        for first=1,#prep.p-1,M.INTERVALS do
            local last=math.min(first+M.INTERVALS,#prep.p)
            local vertices=(last-first)*18+(first==1 and 6 or 0)+(last==#prep.p and 6 or 0)
            entries[#entries+1]={chain=chain_index,prep=prep,first=first,last=last,key="run"..chain_index.."-"..first.."-"..last,bounds=M.extent(prep,first,last),vertices=vertices,bytes=vertices*36,dirty=true}
            total=total+vertices
        end
    end
    M.assign_layers(preps)
    return entries,{chunks=#entries,vertices=total,triangles=total/3,buffer_bytes=total*36,version=M.VERSION,intervals=M.INTERVALS,lower_extent=d.bounds[3],depth=M.DEPTH,projection=M.PROJECTION}
end
return M
