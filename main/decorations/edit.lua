-- Pure decoration edits on an editor block (metres). The session in editor_decoration owns Undo through editor.commit.
local source=require 'main.decorations.source'
local M={SNAP=source.MAX_OFFSET}
-- Nearest point on visible terrain: {source,distance,offset,x,y}. offset is signed along the line's upward normal.
function M.nearest(objects,parts_of,is_terrain,p)
    local best
    for _,o in ipairs(objects) do
        if is_terrain(o) and not o.hidden then
            local walked=0
            for _,part in ipairs(parts_of(o)) do
                for i=2,#part do
                    local a,b=part[i-1],part[i]
                    local dx,dy=b[1]-a[1],b[2]-a[2]
                    local l2=dx*dx+dy*dy
                    if l2>0 then
                        local l=math.sqrt(l2)
                        local t=math.max(0,math.min(1,((p[1]-a[1])*dx+(p[2]-a[2])*dy)/l2))
                        local x,y=a[1]+dx*t,a[2]+dy*t
                        local d=(p[1]-x)^2+(p[2]-y)^2
                        if not best or d<best.d then best={d=d,source=o.id,distance=walked+l*t,x=x,y=y} end
                        walked=walked+l
                    end
                end
            end
        end
    end
    if not best or best.d>M.SNAP*M.SNAP then return nil end
    return best
end
function M.block(e) return e.decorations or {version=source.VERSION,next_id=1,items={}} end
function M.find(b,id) for i,o in ipairs(b and b.items or {}) do if o.id==id then return o,i end end end
function M.add(b,fields)
    local o={id='d'..b.next_id,source=fields.source,distance=fields.distance,offset=fields.offset or 0,
        placement=fields.placement or 'front',tilt=fields.tilt~=false,asset=fields.asset}
    b.next_id=b.next_id+1;b.items[#b.items+1]=o
    return o
end
-- Picks the decoration whose drawn box holds p and whose centre lies nearest, so a small one in front of a large one stays reachable. resolved: id -> {x,y,angle}.
function M.pick(b,resolved,p,assets)
    local hit,best
    for i=#b.items,1,-1 do
        local o=b.items[i];local r=resolved[o.id];local a=assets[o.asset]
        if r and not o.hidden then
            local c,s=math.cos(-r.angle),math.sin(-r.angle)
            local dx,dy=p[1]-r.x,p[2]-r.y
            local u,v=dx*c-dy*s,dx*s+dy*c
            if math.abs(u)<=a.width/2+.1 and v>=-a.sink-.1 and v<=a.height-a.sink+.1 then
                local d=u*u+(v-a.height/2)^2
                if not best or d<best then hit,best=o,d end
            end
        end
    end
    return hit
end
return M
