-- #669: edge indicators for off-screen pickups. Pure logic (no Defold API).
-- targets: per type (fuel, gold coin, Wonder Gem) the nearest pickup still ahead of the vehicle, in metres; a type
-- shows nothing once that pickup is in the camera view, taken or passed (behind the vehicle).
-- place: where each indicator sits on the screen edge towards its pickup, inside the safe area and clear of every
-- control (drive zones, toolbar, ...) and of the other indicators. Rectangles are screen pixels with the origin
-- bottom left (Defold screen space): {x0=left,y0=bottom,x1=right,y1=top}, as in fps_place.
local fps_place=require 'main.game.fps_place'
local M={}
M.KINDS={'fuel','coin','gem'}
M.LABELS={fuel='Fuel',coin='Coins',gem='Gem'}
function M.kind(p) return (p.kind=='gem' or p.kind=='fuel') and p.kind or 'coin' end
local function inside(r,x,y) return x>=r.x0 and x<=r.x1 and y>=r.y0 and y<=r.y1 end
-- items: authored pickups ({id, position={x,y}, kind}); taken: id -> true; vehicle: {x,y}; view: the camera view
-- (all metres). Returns {kind, u, v, metres} in KINDS order: u/v the pickup in the view (0 left/bottom .. 1
-- right/top, outside 0..1 when off-screen), metres the rounded straight-line distance from the vehicle.
function M.targets(items,taken,vehicle,view)
    local best={}
    for _,p in ipairs(items or {}) do
        local x,y=p.position[1],p.position[2]
        if not taken[p.id] and p.indicator~=false and x>=vehicle[1] then
            local k=M.kind(p);local d=math.sqrt((x-vehicle[1])^2+(y-vehicle[2])^2)
            if not best[k] or d<best[k].d then best[k]={x=x,y=y,d=d} end
        end
    end
    local out={}
    local w,h=view.x1-view.x0,view.y1-view.y0
    if not (w>0 and h>0) then return out end
    for _,k in ipairs(M.KINDS) do
        local b=best[k]
        if b and not inside(view,b.x,b.y) then
            out[#out+1]={kind=k,u=(b.x-view.x0)/w,v=(b.y-view.y0)/h,metres=math.floor(b.d+.5)}
        end
    end
    return out
end
-- One indicator w x h (screen px) per target, on the edge of `area` (the safe area, kept `gap` inside it) where
-- the line from the area's centre to the pickup leaves it. A spot on a control slides along that edge to the
-- nearest free spot; with none free on that edge the indicator is hidden (clear false), never drawn over a control.
-- screen: the full screen the view u/v map onto. Returns {kind, metres, left, top, rect, edge, clear} per target.
function M.place(area,screen,targets,w,h,blocked,gap)
    gap=gap or 0
    local lo_x,hi_x=area.x0+gap+w/2,area.x1-gap-w/2
    local lo_y,hi_y=area.y0+gap+h/2,area.y1-gap-h/2
    local avoid={}
    for i,r in ipairs(blocked or {}) do avoid[i]=r end
    local out={}
    for _,t in ipairs(targets) do
        local r={kind=t.kind,metres=t.metres,clear=false}
        out[#out+1]=r
        if hi_x>=lo_x and hi_y>=lo_y then
            local cx,cy=(lo_x+hi_x)/2,(lo_y+hi_y)/2
            local dx=screen.x0+t.u*(screen.x1-screen.x0)-cx
            local dy=screen.y0+t.v*(screen.y1-screen.y0)-cy
            local hx,hy=(hi_x-lo_x)/2,(hi_y-lo_y)/2
            -- Ray to the edge: the axis that reaches its half extent first names the edge.
            local sx=dx~=0 and hx/math.abs(dx) or math.huge
            local sy=dy~=0 and hy/math.abs(dy) or math.huge
            local vertical=sx<=sy -- on the left or right edge: slides up and down
            local s=math.min(sx,sy);if s==math.huge then s=0 end
            local px,py=math.max(lo_x,math.min(hi_x,cx+dx*s)),math.max(lo_y,math.min(hi_y,cy+dy*s))
            r.edge=vertical and (dx>=0 and 'right' or 'left') or (dy>=0 and 'top' or 'bottom')
            -- Free spots along the edge lie at a range end or just past a blocker's end: test those and the start.
            local start=vertical and py or px
            local lo,hi=vertical and lo_y or lo_x,vertical and hi_y or hi_x
            local half=vertical and h/2 or w/2
            local candidates={start,lo,hi}
            for _,b in ipairs(avoid) do
                if vertical then candidates[#candidates+1]=b.y0-gap-half;candidates[#candidates+1]=b.y1+gap+half
                else candidates[#candidates+1]=b.x0-gap-half;candidates[#candidates+1]=b.x1+gap+half end
            end
            local best,best_d
            for _,c in ipairs(candidates) do
                c=math.max(lo,math.min(hi,c))
                local ax,ay=vertical and px or c,vertical and c or py
                local d=math.abs(c-start)
                if (not best_d or d<best_d) and not fps_place.hit(ax-w/2,ay+h/2,w,h,avoid,gap) then best,best_d={ax,ay},d end
            end
            if best then
                r.clear=true;r.left,r.top=best[1]-w/2,best[2]+h/2
                r.rect={x0=r.left,y0=r.top-h,x1=r.left+w,y1=r.top}
                avoid[#avoid+1]=r.rect
            end
        end
    end
    return out
end
function M.text(t) return string.format('%s %d m',M.LABELS[t.kind] or t.kind,t.metres) end
return M
