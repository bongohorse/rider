-- Bounded editor coin references from existing physical source chains. Never bridge a gap.
local doc=require 'main.gym.editor_doc'
local M={MAX_SEGMENTS=2048};local EPS=1e-7
local function same(a,b) return math.abs(a[1]-b[1])<EPS and math.abs(a[2]-b[2])<EPS end
local function route(id,raw)
    local r={id=id,points={},segments={},length=0,valid=true}
    local reverse=raw[1][1]>raw[#raw][1]
    for i=1,#raw do local p=raw[reverse and #raw-i+1 or i];r.points[i]={p[1],p[2]} end
    for i=2,#r.points do
        local a,b=r.points[i-1],r.points[i];local dx,dy=b[1]-a[1],b[2]-a[2]
        if dx<=EPS then r.valid=false end -- an x value must identify exactly one route height
        local length=math.sqrt(dx*dx+dy*dy)
        r.segments[#r.segments+1]={a=a,b=b,s=r.length,length=length};r.length=r.length+length
    end
    return r
end
function M.prepare(e)
    local list,by_id,count={},{},0;local exceeded=false;local limit_error='Track adjustment supports at most 2048 source segments.';local pieces=doc.pieces(e)
    local function add(id,pts)
        if #pts<2 then return end
        if exceeded or count+#pts-1>M.MAX_SEGMENTS then exceeded=true;return end
        local r=route(id,pts);list[#list+1]=r;by_id[id]=r;count=count+#r.segments
    end
    for _,run in ipairs(doc.runs(e)) do
        for i,c in ipairs(doc.run_chains(e,run,pieces)) do add('terrain:'..run[1]..':'..i,c.points);if exceeded then return nil,limit_error end end
    end
    for _,o in ipairs(e.objects) do
        local outline=doc.outline(o)
        if outline then
            local edges={}
            for i,a in ipairs(outline) do local b=outline[i%#outline+1];if b[1]<a[1]-EPS then edges[#edges+1]={{b[1],b[2]},{a[1],a[2]}} end end
            table.sort(edges,function(a,b)return a[1][1]<b[1][1]end)
            local pts={};local part=1
            for _,edge in ipairs(edges) do
                if #pts>0 and not same(pts[#pts],edge[1]) then add('hull:'..o.id..':'..part,pts);if exceeded then return nil,limit_error end;part=part+1;pts={} end
                if #pts==0 then pts[1]=edge[1] end;pts[#pts+1]=edge[2]
            end
            add('hull:'..o.id..':'..part,pts);if exceeded then return nil,limit_error end
        end
    end
    return {list=list,by_id=by_id}
end
function M.at_x(r,x)
    if not r or not r.valid then return end
    for _,e in ipairs(r.segments) do if x>=e.a[1]-EPS and x<=e.b[1]+EPS then
        local t=math.max(0,math.min(1,(x-e.a[1])/(e.b[1]-e.a[1])))
        return e.a[2]+(e.b[2]-e.a[2])*t,e.s+e.length*t
    end end
end
function M.at_s(r,s)
    s=math.max(0,math.min(r.length,s))
    for i,e in ipairs(r.segments) do if s<=e.s+e.length+1e-9 or i==#r.segments then
        local t=math.max(0,math.min(1,(s-e.s)/e.length))
        return {e.a[1]+(e.b[1]-e.a[1])*t,e.a[2]+(e.b[2]-e.a[2])*t}
    end end
end
function M.equal(a,b)
    if not a or not b or a.valid~=b.valid or #a.points~=#b.points then return false end
    for i,p in ipairs(a.points) do if not same(p,b.points[i]) then return false end end
    return true
end
function M.bind(e,o,routes,preferred,hint)
    if preferred and not hint then
        local y,s=M.at_x(routes.by_id[preferred],o.position[1])
        if y and y<=o.position[2]+EPS then return {id=o.id,route=preferred,s=s,height=math.max(0,o.position[2]-y),p={o.position[1],o.position[2]}} end
    end
    local y=hint and hint[2] or doc.surface(e,o.position,true)
    if not y then return nil,'No driving surface below coin '..o.id..'. Use Drop to Track after moving it above a route.' end
    local found
    for _,r in ipairs(routes.list) do
        if not r.valid then
            for _,edge in ipairs(r.segments) do
                local dx=edge.b[1]-edge.a[1];local x=o.position[1]
                if math.abs(dx)<=EPS then
                    if math.abs(x-edge.a[1])<EPS and y>=math.min(edge.a[2],edge.b[2])-EPS and y<=math.max(edge.a[2],edge.b[2])+EPS then return nil,'Unsupported vertical or overlapping route at coin '..o.id..'.' end
                elseif x>=math.min(edge.a[1],edge.b[1])-EPS and x<=math.max(edge.a[1],edge.b[1])+EPS then
                    local ry=edge.a[2]+(edge.b[2]-edge.a[2])*(x-edge.a[1])/dx
                    if math.abs(ry-y)<EPS then return nil,'Unsupported loop or switchback at coin '..o.id..'.' end
                end
            end
        end
        local ry,s=M.at_x(r,o.position[1])
        if ry and math.abs(ry-y)<EPS then
            if found then return nil,'Ambiguous routes at coin '..o.id..'; connect the track or move the coin.' end
            found={id=o.id,route=r.id,s=s,height=math.max(0,o.position[2]-ry),p={o.position[1],o.position[2]}}
        end
    end
    if not found then return nil,'Unsupported route at coin '..o.id..': vertical sections, loops and switchbacks cannot be adjusted along track.' end
    return found
end
return M
