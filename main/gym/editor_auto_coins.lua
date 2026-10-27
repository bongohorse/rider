-- Coin-only authoring plan. Source routes/IDs/admission stay owned by existing editor systems.
local D=require 'main.gym.editor_doc'
local E=require 'main.gym.editor_edit'
local R=require 'main.gym.editor_coin_route'
local M={MIN_SPACING=.75,RADIUS=.25,MAX_COUNT=10000}
local EPS=1e-7
function M.defaults() return {range='whole',driver='count',count=20,spacing=3,randomness=0,height=.7,seed=1,replace=false} end
local limits={count={1,10000},spacing={.75,100000},randomness={0,100},height={.25,100}}
function M.value(key,text)
    local n=tonumber(text);local lim=limits[key]
    if not lim or not n or n~=n or n<lim[1] or n>lim[2] or key=='count' and n%1~=0 then
        return nil,key..' must be '..(key=='count' and 'a whole number ' or '')..'from '..tostring(lim and lim[1])..' to '..tostring(lim and lim[2])..'.'
    end
    return n
end
function M.equal(a,b)
    if type(a)~=type(b) then return false end
    if type(a)~='table' then return a==b end
    for k,v in pairs(a) do if not M.equal(v,b[k]) then return false end end
    for k in pairs(b) do if a[k]==nil then return false end end
    return true
end
function M.scope(e,c,ids)
    local routes,err=R.prepare(e);if not routes then return nil,err end
    local selected={};for _,id in ipairs(ids or {}) do selected[id]=true end
    local spans,map,total={}, {},0
    for _,r in ipairs(routes.list) do if r.id:match('^terrain:') then
        local current
        for _,s in ipairs(r.segments) do
            if c.range=='whole' or selected[s.owner] then
                if not r.valid then return nil,'Auto Add supports strictly x-monotone terrain only; exclude vertical sections, loops and switchbacks.' end
                map[s.owner]=true
                if current and math.abs(current.b-s.s)<EPS then current.b=s.s+s.length
                else current={route=r,a=s.s,b=s.s+s.length};spans[#spans+1]=current end
                total=total+s.length
            else current=nil end
        end
    end end
    if #spans==0 then return nil,c.range=='selected' and 'Select terrain objects with Select [S], then return to Coin. Range uses those whole pieces.' or 'No supported terrain in this level.' end
    return {routes=routes,spans=spans,map=map,length=total}
end
function M.metrics(scope,c)
    local n=c.driver=='spacing' and math.max(1,math.floor(scope.length/c.spacing)) or c.count
    return n,c.driver=='spacing' and c.spacing or scope.length/n,n/scope.length
end
local function in_scope(scope,b)
    if not b then return false end
    for _,s in ipairs(scope.spans) do if s.route.id==b.route and b.s>=s.a-EPS and b.s<=s.b+EPS then return true end end
    return false
end
local function distance2(a,b) return (a[1]-b[1])^2+(a[2]-b[2])^2 end
local function edge_distance2(p,a,b)
    local dx,dy=b[1]-a[1],b[2]-a[2];local ll=dx*dx+dy*dy
    local t=ll>0 and math.max(0,math.min(1,((p[1]-a[1])*dx+(p[2]-a[2])*dy)/ll)) or 0
    return distance2(p,{a[1]+t*dx,a[2]+t*dy})
end
local function geometry(e,scope)
    local edges,hulls={},{}
    for _,r in ipairs(scope.routes.list) do if r.id:match('^terrain:') then for _,s in ipairs(r.segments) do edges[#edges+1]={s.a,s.b} end end end
    for _,o in ipairs(e.objects) do local pts=D.outline(o);if pts then
        hulls[#hulls+1]=pts;for i,a in ipairs(pts) do edges[#edges+1]={a,pts[i%#pts+1]} end
    end end
    return function(p)
        -- Terrain is solid below its surface. No automatic tunnel/overlap interpretation.
        for _,r in ipairs(scope.routes.list) do if r.id:match('^terrain:') then
            if not r.valid then
                for _,s in ipairs(r.segments) do if p[1]>=math.min(s.a[1],s.b[1])-M.RADIUS and p[1]<=math.max(s.a[1],s.b[1])+M.RADIUS then return false end end
            else local y=R.at_x(r,p[1]);if y and p[2]<y+M.RADIUS-EPS then return false end end
        end end
        for _,s in ipairs(edges) do if edge_distance2(p,s[1],s[2])<M.RADIUS^2-EPS then return false end end
        for _,pts in ipairs(hulls) do local inside=true
            for i,a in ipairs(pts) do local b=pts[i%#pts+1];if (b[1]-a[1])*(p[2]-a[2])-(b[2]-a[2])*(p[1]-a[1])<0 then inside=false;break end end
            if inside then return false end
        end
        return true
    end
end
local function stage(d,positions,remove)
    local staged=D.copy(d);local e=staged.editor;local clip={objects={},connections={}}
    for i,p in ipairs(positions) do clip.objects[i]={id='preview'..i,type='coin',pickup_id='preview-'..i,position=p} end
    -- Allocate while old IDs still exist, including IDs previewed for removal.
    local ids=E.paste(e,clip,{0,0});local keep={}
    for _,o in ipairs(e.objects) do if not remove[o.id] then keep[#keep+1]=o end end;e.objects=keep
    local ok,err=D.validate(staged);if not ok then return nil,err end
    local compiled;compiled,err=D.compile(staged);if not compiled then return nil,err end
    return staged,ids
end
function M.preview(d,c,ids)
    for key in pairs(limits) do local n,err=M.value(key,c[key]);if not n then return nil,err end end
    if c.range~='whole' and c.range~='selected' or c.driver~='count' and c.driver~='spacing' then return nil,'Invalid coin range or count/spacing mode.' end
    if type(c.seed)~='number' or c.seed%1~=0 or c.seed<1 or c.seed>2147483646 then return nil,'Invalid preview seed.' end
    local e=d.editor;local scope,err=M.scope(e,c,ids);if not scope then return nil,err end
    local desired,spacing,density=M.metrics(scope,c)
    local remove,old,removed,totalcoins={}, {},0,0
    for _,o in ipairs(e.objects) do if o.type=='coin' then
        totalcoins=totalcoins+1
        local b=R.bind(e,o,scope.routes)
        if c.replace and not o.locked and in_scope(scope,b) then remove[o.id]=true;removed=removed+1 else old[#old+1]=o.position end
    end end
    local cap=math.max(0,math.min(desired,128-totalcoins+removed,D.MAX_OBJECTS-#e.objects+removed))
    -- At most 128 cells x 9 probes, regardless of requested count or track length.
    local usable,total={},0
    for _,s in ipairs(scope.spans) do
        local n=s.b-s.a-M.MIN_SPACING
        if n>EPS then usable[#usable+1]={route=s.route,a=s.a+M.MIN_SPACING/2,length=n,offset=total};total=total+n end
    end
    local clear=geometry(e,scope)
    local function distribute(n)
        local result,targets={},{};local seed=c.seed
        local function random() seed=seed*16807%2147483647;return seed/2147483647 end
        if n==0 or total<=0 then return result,targets end
        local step=total/n
        for i=1,n do
            local jitter=(random()*2-1)*.3*c.randomness/100
            for probe=1,9 do
                -- Stratified, bounded local search; never jump to a different cell to force a coin.
                local shift=probe==1 and jitter or ((probe%2==0 and 1 or -1)*math.floor(probe/2)*.09)
                local t=(i-.5+shift)*step;local span
                for _,s in ipairs(usable) do if t>=s.offset and t<=s.offset+s.length+EPS then span=s;break end end
                if span then
                    local s=span.a+t-span.offset;local floor=R.at_s(span.route,s);local p={floor[1],floor[2]+c.height}
                    local safe=clear(p)
                    if safe then for _,q in ipairs(old) do if distance2(p,q)<M.MIN_SPACING^2-EPS then safe=false;break end end end
                    if safe then for _,q in ipairs(result) do if distance2(p,q)<M.MIN_SPACING^2-EPS then safe=false;break end end end
                    -- A unique floor reference is required for immediate Along track adjustment.
                    local b=safe and R.bind(e,{id='preview',position=p},scope.routes,nil,floor)
                    if safe and b and b.route==span.route.id then result[#result+1]=p;targets[#targets+1]={floor[1],floor[2]};break end
                end
            end
        end
        return result,targets
    end
    local positions,targets=distribute(cap)
    local staged,newids=stage(d,positions,remove)
    if not staged then
        -- Resource admission can be tighter than the coin/object caps. Reduce the plan, never bypass it.
        local lo,hi=0,#positions-1;local best,bestids,bestp,bestt
        while lo<=hi do local n=math.floor((lo+hi)/2);local p,t=distribute(n);local v,allocated=stage(d,p,remove)
            if v then best,bestids,bestp,bestt=v,allocated,p,t;lo=n+1 else hi=n-1;err=allocated end
        end
        if not best then return nil,'Auto Add blocked by level/resource validation: '..tostring(err or newids) end
        staged,newids,positions,targets=best,bestids,bestp,bestt
    end
    local attached={};for i,id in ipairs(newids) do attached[id]=targets[i] end
    return {base=D.copy(d),objects=staged.editor.objects,next_id=staged.editor.next_id,ids=newids,positions=positions,targets=attached,remove=remove,removed=removed,range=scope.map,desired=desired,possible=#positions,spacing=spacing,density=density,seed=c.seed}
end
function M.apply(d,plan)
    if not plan or not M.equal(d,plan.base) then return nil,'Coin preview is stale. Preview again before Apply.' end
    d.editor.objects=D.copy(plan.objects);d.editor.next_id=plan.next_id
    return true
end
return M
