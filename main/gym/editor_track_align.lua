-- Bounded editor projection, not a route engine. Sources/IDs survive; the caller owns one Undo commit.
local doc=require 'main.gym.editor_doc'
local edit=require 'main.gym.editor_edit'
local M={DEFAULT=.7,MIN=0,MAX=100}
function M.height(text)
    local n=tonumber(text)
    if not n or n~=n or n<M.MIN or n>M.MAX then return nil,'Height must be from 0 to 100 m.' end
    return n
end
function M.available(e,ids)
    for _,id in ipairs(ids) do local o=edit.find(e,id);if o and o.type=='coin' then return true end end
    return false
end
function M.plan(e,ids,height)
    local h,err=M.height(height);if not h then return nil,err end
    local errors=doc.problems(e)
    if errors[1] then return nil,'Fix track errors before Drop to Track: '..errors[1] end
    local chosen={};for _,id in ipairs(ids) do chosen[id]=true end
    local p={moves={},locked=0,unsupported=0,no_surface=0,unchanged=0}
    for _,o in ipairs(e.objects) do if chosen[o.id] then
        if o.locked then p.locked=p.locked+1
        elseif o.type~='coin' then p.unsupported=p.unsupported+1
        else
            local y=doc.surface(e,o.position,true)
            if not y then p.no_surface=p.no_surface+1
            elseif math.abs(o.position[2]-y-h)<1e-9 then p.unchanged=p.unchanged+1
            else p.moves[#p.moves+1]={id=o.id,from={o.position[1],o.position[2]},position={o.position[1],y+h}} end
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
return M
