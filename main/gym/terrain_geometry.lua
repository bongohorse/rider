-- Normal-Play depth geometry, version 1. Metres; never mutates collision/source data.
local M={VERSION=1,INTERVALS=64,PROJECTION={0.18,0.55},DEPTH=0.9,EDGE=0.18}
local BODY_TOP,BODY_BOTTOM={0.25,0.34,0.29,1},{0.10,0.16,0.17,1}
local TOP,BACK,EDGE,CAP={0.63,0.76,0.62,1},{0.43,0.60,0.47,1},{0.29,0.43,0.36,1},{0.17,0.25,0.22,1}
local function distance(a,b) return math.sqrt((b[1]-a[1])^2+(b[2]-a[2])^2) end
function M.build(d)
    local intervals=M.INTERVALS
    local chunks,total,arc,previous={},0,0,nil
    local depth,edge=M.DEPTH,M.EDGE
    for chain_index,raw in ipairs(d.chains) do
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
                local dx,dy=b[1]-a[1],b[2]-a[2];local len=distance(a,b)
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
            return monotone and {p[i][1],d.bounds[3],0} or offset(i,0.9)
        end
        if previous then arc=arc+distance(previous,p[1]) end
        local u={arc/4}
        for i=2,#p do arc=arc+distance(p[i-1],p[i]);u[i]=arc/4 end
        previous=p[#p]
        for first=1,#p-1,intervals do
            local last=math.min(first+intervals,#p)
            local c={position={},color={},uv={},chain=chain_index,first=first,last=last,key="run"..chain_index.."-"..first.."-"..last,body=monotone and "filled" or "ribbon",origin={p[first][1],p[first][2]},bounds={math.huge,math.huge,0,-math.huge,-math.huge,0},u0=u[first],u1=u[last]}
            local function vertex(q,color,uv)
                local x,y,z=q[1]-c.origin[1],q[2]-c.origin[2],q[3]
                for _,v in ipairs({x,y,z}) do c.position[#c.position+1]=v end
                for _,v in ipairs(color) do c.color[#c.color+1]=v end
                c.uv[#c.uv+1],c.uv[#c.uv+2]=uv[1],uv[2]
                local px,py=x+z*M.PROJECTION[1],y+z*M.PROJECTION[2]
                c.bounds[1],c.bounds[2]=math.min(c.bounds[1],px),math.min(c.bounds[2],py)
                c.bounds[4],c.bounds[5]=math.max(c.bounds[4],px),math.max(c.bounds[5],py)
            end
            local function quad(a,b,c0,d0,ca,cb,cc,cd,ua,ub)
                vertex(a,ca,{ua,0});vertex(b,cb,{ub,0});vertex(c0,cc,{ub,1})
                vertex(a,ca,{ua,0});vertex(c0,cc,{ub,1});vertex(d0,cd,{ua,1})
            end
            for i=first,last-1 do
                local a,b=p[i],p[i+1]
                quad(offset(i,edge),offset(i+1,edge),bottom(i+1),bottom(i),BODY_TOP,BODY_TOP,BODY_BOTTOM,BODY_BOTTOM,u[i],u[i+1])
                quad({a[1],a[2],0},{b[1],b[2],0},offset(i+1,edge),offset(i,edge),TOP,TOP,EDGE,EDGE,u[i],u[i+1])
                if depth>0 then
                    quad({a[1],a[2],0},{b[1],b[2],0},{b[1],b[2],depth},{a[1],a[2],depth},TOP,TOP,BACK,BACK,u[i],u[i+1])
                end
            end
            -- End caps belong only to physical run ends, never to chunk seams or across gaps.
            if depth>0 then
                for _,i in ipairs({first==1 and 1 or false,last==#p and #p or false}) do
                    if i then local q=p[i]
                        local e,b=offset(i,edge),bottom(i)
                        quad(e,{e[1],e[2],depth},{b[1],b[2],depth},b,CAP,CAP,BODY_BOTTOM,BODY_BOTTOM,u[i],u[i])
                    end
                end
            end
            c.vertices=#c.position/3;c.bytes=c.vertices*9*4
            chunks[#chunks+1]=c;total=total+c.vertices

        end
    end
    return chunks,{chunks=#chunks,vertices=total,triangles=total/3,buffer_bytes=total*36,version=M.VERSION,intervals=intervals,lower_extent=d.bounds[3],depth=depth,projection=M.PROJECTION}
end
return M
