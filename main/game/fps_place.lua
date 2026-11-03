-- #444: where the FPS counter sits. Pure logic (no Defold API): the stored position is normalised to the
-- free travel of the counter inside the visible area (x 0 = left, 1 = right; y 0 = top, 1 = bottom), so it
-- survives rotation and resolution changes. Presets and drags store the same pair; a reset returns to top left.
-- Rectangles are screen pixels with the origin bottom left (Defold screen space): {x0=left,y0=bottom,x1=right,y1=top}.
-- A counter position is its top-left corner (left, top).
local M={}
M.DEFAULT_X,M.DEFAULT_Y=0,0 -- top left, the #417 position
M.THRESHOLD_CSS_PX=10 -- pointer travel that turns a press on the counter into a drag; less stays a tap
M.GAP_CSS_PX=4 -- clearance kept to controls
M.PRESET_ORDER={'top_left','top','top_right','left','center','right','bottom_left','bottom','bottom_right'}
M.PRESETS={top_left={0,0},top={0.5,0},top_right={1,0},left={0,0.5},center={0.5,0.5},right={1,0.5},
    bottom_left={0,1},bottom={0.5,1},bottom_right={1,1}}
-- Screen positions are float32 in the engine: overlaps below 0.01 px are rounding, not covering.
local EPS=0.01
function M.valid(v) return type(v)=='number' and v==v and v>=0 and v<=1 end
-- Normalised pair of a preset name, or nil.
function M.preset(name)
    local p=type(name)=='string' and M.PRESETS[name]
    if p then return p[1],p[2] end
end
-- Name of the preset at this stored position, or nil (a dragged position).
function M.preset_of(x,y)
    for _,name in ipairs(M.PRESET_ORDER) do
        local p=M.PRESETS[name]
        if type(x)=='number' and type(y)=='number' and math.abs(p[1]-x)<EPS and math.abs(p[2]-y)<EPS then return name end
    end
end
local function travel(area,w,h) return math.max(0,area.x1-area.x0-w),math.max(0,area.y1-area.y0-h) end
-- Keep the whole counter inside the area; a counter larger than the area keeps its top-left corner inside.
function M.clamp(area,w,h,left,top)
    local rx,ry=travel(area,w,h)
    return math.min(math.max(left,area.x0),area.x0+rx),math.max(math.min(top,area.y1),area.y1-ry)
end
function M.to_screen(area,w,h,nx,ny)
    local rx,ry=travel(area,w,h)
    return area.x0+nx*rx,area.y1-ny*ry
end
function M.normalise(area,w,h,left,top)
    left,top=M.clamp(area,w,h,left,top)
    local rx,ry=travel(area,w,h)
    return rx>0 and (left-area.x0)/rx or 0,ry>0 and (area.y1-top)/ry or 0
end
-- A press becomes a drag once the pointer has moved this far from where it pressed (same units as threshold).
function M.is_drag(dx,dy,threshold) return dx*dx+dy*dy>=threshold*threshold end
-- The first blocked rectangle the counter at (left, top) would overlap, keeping `gap` clearance; touching is fine.
function M.hit(left,top,w,h,blocked,gap)
    gap=gap or 0
    for _,r in ipairs(blocked or {}) do
        if left<r.x1+gap-EPS and left+w>r.x0-gap+EPS and top-h<r.y1+gap-EPS and top>r.y0-gap+EPS then return r end
    end
end
-- Final position: clamped into the area and moved the shortest way off every blocked rectangle (pause, drive and
-- other controls). Returns left, top, clear (false only when no free position exists anywhere).
function M.place(area,w,h,left,top,blocked,gap)
    gap=gap or 0
    left,top=M.clamp(area,w,h,left,top)
    if not M.hit(left,top,w,h,blocked,gap) then return left,top,true end
    -- Breadth-first: step just past an overlapped rectangle on each side; repeat from positions that still overlap.
    local frontier,seen,best,best_d={{left,top}},{},nil,math.huge
    for _=1,3 do
        local next_frontier={}
        for _,c in ipairs(frontier) do
            for _,r in ipairs(blocked) do
                if M.hit(c[1],c[2],w,h,{r},gap) then
                    for _,p in ipairs({{r.x0-gap-w,c[2]},{r.x1+gap,c[2]},{c[1],r.y0-gap},{c[1],r.y1+gap+h}}) do
                        local cl,ct=M.clamp(area,w,h,p[1],p[2])
                        if not M.hit(cl,ct,w,h,blocked,gap) then
                            local d=(cl-left)^2+(ct-top)^2
                            if d<best_d then best,best_d={cl,ct},d end
                        else
                            -- Only blocked positions are expanded again, each once.
                            local key=string.format('%.3f,%.3f',cl,ct)
                            if not seen[key] then seen[key]=true;next_frontier[#next_frontier+1]={cl,ct} end
                        end
                    end
                end
            end
        end
        frontier=next_frontier
    end
    if best then return best[1],best[2],true end
    -- Crowded screen: the nearest free preset position.
    local candidates={}
    for _,name in ipairs(M.PRESET_ORDER) do
        local p=M.PRESETS[name]
        local cl,ct=M.to_screen(area,w,h,p[1],p[2])
        candidates[#candidates+1]={cl,ct,(cl-left)^2+(ct-top)^2}
    end
    table.sort(candidates,function(a,b) return a[3]<b[3] end)
    for _,c in ipairs(candidates) do
        if not M.hit(c[1],c[2],w,h,blocked,gap) then return c[1],c[2],true end
    end
    return left,top,false
end
return M
