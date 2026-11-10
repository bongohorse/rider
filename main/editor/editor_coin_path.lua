-- Coin paths (#672): an editable curve of control points that lays ordinary coins at a fixed spacing.
-- Source: e.coin_paths={version=1,items={{id='p1',points={{x,y},...},spacing=m}}} (editor/compiler 17).
-- The coins are ordinary coin objects carrying path=<path id>; Play and the station file see only them,
-- so the runtime is unchanged. Editing a path replaces its member coins in the same Undo step.
-- Pure: no engine calls.
local M={VERSION=1,MIN_POINTS=2,MAX_POINTS=16,MAX_PATHS=32,MIN_SPACING=.75,MAX_SPACING=20,SPACING=1.5,STEPS=24}
local function finite(x) return type(x)=='number' and x==x and math.abs(x)<100000 end
local function point(p) return type(p)=='table' and #p==2 and finite(p[1]) and finite(p[2]) end
-- Catmull-Rom through the control points (ends repeated): the curve passes every point.
function M.curve(pts)
    local n=#pts
    if n<2 then return {{pts[1][1],pts[1][2]}} end
    local out={{pts[1][1],pts[1][2]}}
    for i=1,n-1 do
        local p0,p1,p2,p3=pts[math.max(1,i-1)],pts[i],pts[i+1],pts[math.min(n,i+2)]
        for k=1,M.STEPS do
            local t=k/M.STEPS;local t2,t3=t*t,t*t*t
            local function c(a,b,c2,d) return .5*(2*b+(-a+c2)*t+(2*a-5*b+4*c2-d)*t2+(-a+3*b-3*c2+d)*t3) end
            out[#out+1]={c(p0[1],p1[1],p2[1],p3[1]),c(p0[2],p1[2],p2[2],p3[2])}
        end
    end
    return out
end
function M.length(pts)
    local c,l=M.curve(pts),0
    for i=2,#c do l=l+math.sqrt((c[i][1]-c[i-1][1])^2+(c[i][2]-c[i-1][2])^2) end
    return l
end
-- Coin centres: both ends plus an even spread whose gap is closest to the spacing.
function M.positions(path)
    local c=M.curve(path.points)
    local acc={0}
    for i=2,#c do acc[i]=acc[i-1]+math.sqrt((c[i][1]-c[i-1][1])^2+(c[i][2]-c[i-1][2])^2) end
    local total=acc[#acc]
    if total<1e-6 then return {{c[1][1],c[1][2]}} end
    local n=math.max(1,math.floor(total/path.spacing+.5))
    local out,j={},2
    for k=0,n do
        local s=total*k/n
        while j<#c and acc[j]<s do j=j+1 end
        local a,b=c[j-1],c[j];local seg=acc[j]-acc[j-1]
        local t=seg>0 and (s-acc[j-1])/seg or 0
        out[#out+1]={a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t}
    end
    return out
end
function M.find(e,id)
    for i,p in ipairs(e.coin_paths and e.coin_paths.items or {}) do if p.id==id then return p,i end end
end
-- Source check; returns nil, error, future.
function M.validate(e)
    local b=e.coin_paths
    if b==nil then
        for _,o in ipairs(e.objects) do if type(o)=='table' and o.type=='coin' and o.path~=nil then return nil,'Coin '..tostring(o.id)..' belongs to a missing coin path' end end
        return true
    end
    if type(b)~='table' or b.version~=M.VERSION then return nil,'Unsupported coin path version',true end
    for k in pairs(b) do if k~='version' and k~='items' then return nil,'Unsupported coin path field '..tostring(k),true end end
    if type(b.items)~='table' or #b.items<1 or #b.items>M.MAX_PATHS then return nil,'Coin paths: 1 to '..M.MAX_PATHS..' paths' end
    local seen={}
    for i,p in ipairs(b.items) do
        if type(p)~='table' or type(p.id)~='string' or not p.id:match('^p%d+$') or seen[p.id] then return nil,'Invalid/duplicate coin path id at entry '..i end
        seen[p.id]=true
        for k in pairs(p) do if k~='id' and k~='points' and k~='spacing' then return nil,'Unsupported coin path field '..tostring(k),true end end
        if type(p.points)~='table' or #p.points<M.MIN_POINTS or #p.points>M.MAX_POINTS then return nil,'Coin path '..p.id..' needs '..M.MIN_POINTS..' to '..M.MAX_POINTS..' points' end
        for _,q in ipairs(p.points) do if not point(q) then return nil,'Invalid point in coin path '..p.id end end
        if not finite(p.spacing) or p.spacing<M.MIN_SPACING or p.spacing>M.MAX_SPACING then return nil,'Coin path spacing must be '..M.MIN_SPACING..' to '..M.MAX_SPACING..' m' end
    end
    for _,o in ipairs(e.objects) do
        if type(o)=='table' and o.type=='coin' and o.path~=nil then
            if not seen[o.path] then return nil,'Coin '..tostring(o.id)..' belongs to a missing coin path' end
            if o.kind~=nil then return nil,'Coin paths hold gold coins only: '..tostring(o.id) end
        end
    end
    return true
end
local function next_path_id(e)
    local n=0
    for _,p in ipairs(e.coin_paths and e.coin_paths.items or {}) do n=math.max(n,tonumber(p.id:sub(2)) or 0) end
    return 'p'..(n+1)
end
-- Replace the member coins of a path with coins at its current positions. new_id(e) allocates object ids,
-- pickup(e,id) pickup ids. Returns the new coin ids, or nil, error.
function M.lay(e,path,new_id,pickup,max)
    local keep={}
    for _,o in ipairs(e.objects) do if not (o.type=='coin' and o.path==path.id) then keep[#keep+1]=o end end
    local others=0
    for _,o in ipairs(keep) do if o.type=='coin' then others=others+1 end end
    local pos=M.positions(path)
    if others+#pos>max then return nil,string.format('This path needs %d coins; only %d of %d are left. Increase the spacing or shorten it.',#pos,math.max(0,max-others),max) end
    e.objects=keep
    local ids={}
    for _,q in ipairs(pos) do
        local id=new_id(e)
        e.objects[#e.objects+1]={id=id,type='coin',path=path.id,pickup_id=pickup(e,id),position={q[1],q[2]}}
        ids[#ids+1]=id
    end
    return ids
end
-- Edits (inside editor.commit). Each refuses with nil, error and leaves no partial change to keep.
function M.add(e,points,spacing,new_id,pickup,max)
    e.coin_paths=e.coin_paths or {version=M.VERSION,items={}}
    if #e.coin_paths.items>=M.MAX_PATHS then return nil,'A level holds at most '..M.MAX_PATHS..' coin paths' end
    local p={id=next_path_id(e),points={},spacing=spacing or M.SPACING}
    for i,q in ipairs(points) do p.points[i]={q[1],q[2]} end
    e.coin_paths.items[#e.coin_paths.items+1]=p
    local ok,err=M.lay(e,p,new_id,pickup,max)
    if not ok then return nil,err end
    return p
end
function M.set(e,id,points,spacing,new_id,pickup,max)
    local p=M.find(e,id)
    if not p then return nil,'Coin path '..tostring(id)..' no longer exists' end
    if points then p.points={};for i,q in ipairs(points) do p.points[i]={q[1],q[2]} end end
    if spacing then p.spacing=spacing end
    return M.lay(e,p,new_id,pickup,max)
end
function M.remove(e,id)
    local _,i=M.find(e,id)
    if not i then return nil,'Coin path '..tostring(id)..' no longer exists' end
    table.remove(e.coin_paths.items,i)
    local keep={}
    for _,o in ipairs(e.objects) do if not (o.type=='coin' and o.path==id) then keep[#keep+1]=o end end
    e.objects=keep
    if #e.coin_paths.items==0 then e.coin_paths=nil end
    return true
end
-- Paths whose last coin was deleted by hand keep their curve; Delete in the Coin path tool removes them.
function M.members(e,id)
    local n=0
    for _,o in ipairs(e.objects) do if o.type=='coin' and o.path==id then n=n+1 end end
    return n
end
return M
