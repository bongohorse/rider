-- Bounded editor projection, not a route engine. Sources/IDs survive; the caller owns one Undo commit.
local doc=require 'main.gym.editor_doc'
local edit=require 'main.gym.editor_edit'
local routes=require 'main.gym.editor_coin_route'
local M={DEFAULT=.7,MIN=0,MAX=100}
function M.height(text)
    local n=tonumber(text)
    if not n or n~=n or n<M.MIN or n>M.MAX then return nil,'Height must be from 0 to 100 m.' end
    return n
end
function M.available(e,ids)
    local selected={};for _,id in ipairs(ids) do selected[id]=true end
    for _,o in ipairs(e.objects) do if selected[o.id] and o.type=='coin' then return true end end
    return false
end
function M.plan(e,ids,height)
    local h,err=M.height(height);if not h then return nil,err end
    local geometry=false
    for _,o in ipairs(e.objects) do if doc.terrain(o) or doc.outline(o) then geometry=true;break end end
    if geometry then
        local errors=doc.problems(e)
        if errors[1] then return nil,'Fix track errors before Drop to Track: '..errors[1] end
    end
    local chosen={};for _,id in ipairs(ids) do chosen[id]=true end
    local p={moves={},targets={},locked=0,unsupported=0,no_surface=0,unchanged=0}
    for _,o in ipairs(e.objects) do if chosen[o.id] then
        if o.locked then p.locked=p.locked+1
        elseif o.type~='coin' then p.unsupported=p.unsupported+1
        else
            local y=doc.surface(e,o.position,true)
            if not y then p.no_surface=p.no_surface+1
            else
                p.targets[o.id]={o.position[1],y}
                if math.abs(o.position[2]-y-h)<1e-9 then p.unchanged=p.unchanged+1
                else p.moves[#p.moves+1]={id=o.id,from={o.position[1],o.position[2]},position={o.position[1],y+h}} end
            end
        end
    end end
    return p
end
function M.apply(e,p)
    -- Verify the complete plan before changing anything (commit also runs normal lock/source checks).
    for _,m in ipairs(p.moves) do
        local o=edit.find(e,m.id)
        if not o or o.locked or o.type~='coin' or o.position[1]~=m.from[1] or o.position[2]~=m.from[2] then return nil,'Selection changed; repeat Drop to Track.' end
    end
    for _,m in ipairs(p.moves) do edit.find(e,m.id).position={m.position[1],m.position[2]} end
    return true
end
function M.summary(p)
    return string.format('Drop to Track: %d moved, %d already aligned; skipped %d locked, %d unsupported, %d without a surface.',#p.moves,p.unchanged,p.locked,p.unsupported,p.no_surface)
end
function M.distance(text)
    local n=tonumber(text)
    if not n or n~=n or math.abs(n)>=100000 then return nil,'Enter a signed distance below 100000 m.' end
    return n
end
function M.refresh(e,previous)
    local state={revision=e.revision,bindings={}}
    state.routes,state.error=routes.prepare(e)
    if not state.routes then return state end
    if #state.routes.list>0 then local errors=doc.problems(e);if errors[1] then state.error='Fix track errors before adjustment: '..errors[1];return state end end
    for id,old in pairs(previous and previous.bindings or {}) do
        local o=edit.find(e,id)
        if o and o.type=='coin' then
            local r=state.routes.by_id[old.route]
            if r and previous.routes and routes.equal(r,previous.routes.by_id[old.route]) and o.position[1]==old.p[1] and o.position[2]==old.p[2] then state.bindings[id]=old
            else state.bindings[id]=routes.bind(e,o,state.routes,old.route) end
        end
    end
    return state
end
function M.attach(e,state,targets)
    for id,p in pairs(targets or {}) do
        local o=edit.find(e,id)
        if o and o.type=='coin' and state.routes and not state.error then state.bindings[id]=routes.bind(e,o,state.routes,nil,p) end
    end
end
function M.selection(e,state,ids)
    local c={bindings={},active=true,mixed=false}
    if state.error then c.error=state.error;return c end
    for _,id in ipairs(ids) do
        local o=edit.find(e,id)
        if not o or o.type~='coin' or o.locked then c.error='Along track requires a selection of unlocked coins only.';return c end
        local b=state.bindings[id];if not b then c.active=false end
        local err;if not b then b,err=routes.bind(e,o,state.routes) end
        if not b then c.error=err;return c end
        c.bindings[#c.bindings+1]=b
        if c.height and math.abs(c.height-b.height)>1e-6 then c.mixed=true else c.height=c.height or b.height end
    end
    if #c.bindings==0 then c.error='Select coins to adjust along track.' end
    return c
end
function M.adjust(e,state,ids,delta,height)
    local n,err=M.distance(delta);if not n then return nil,err end
    if height~=nil then height,err=M.height(height);if not height then return nil,err end end
    local c=M.selection(e,state,ids);if c.error then return nil,c.error end
    local lo,hi=-math.huge,math.huge
    for _,b in ipairs(c.bindings) do lo=math.max(lo,-b.s);hi=math.min(hi,state.routes.by_id[b.route].length-b.s) end
    local actual=math.max(lo,math.min(hi,n));if math.abs(actual)<1e-9 then actual=0 end;local p={moves={},bindings={},delta=actual,limited=math.abs(n-actual)>1e-9,height=height}
    for _,b in ipairs(c.bindings) do
        local s=math.max(0,math.min(state.routes.by_id[b.route].length,b.s+actual));local h=height~=nil and height or b.height;local q=routes.at_s(state.routes.by_id[b.route],s)
        if actual==0 then q[1]=b.p[1] end;q[2]=q[2]+h
        p.bindings[b.id]={id=b.id,route=b.route,s=s,height=h,p=q}
        if math.abs(q[1]-b.p[1])>1e-9 or math.abs(q[2]-b.p[2])>1e-9 then p.moves[#p.moves+1]={id=b.id,from={b.p[1],b.p[2]},position=q} end
    end
    return p
end
function M.accept(state,plan,revision)
    for id,b in pairs(plan.bindings or {}) do state.bindings[id]=b end;state.revision=revision
end
return M
