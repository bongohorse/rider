-- Level editor overlays in the editor GUI (LE3; contract R6, R7): grid, point handles, snap indicator,
-- draw/selection previews and the cursor readout. GUI nodes have their own per-scene budget
-- (editor.gui max_nodes), so overlays never take sprites or labels from the level. Every pool is
-- created once in init; nodes a frame does not use are disabled. Positions are canvas pixels; sizes
-- are reference pixels (a 1280 x 720 CSS canvas) scaled by o.s, so HiDPI or larger windows keep them
-- in proportion to the editor panels.
-- BOUNDS: the R13 bounds rectangle (LE6), its own 4 lines so previews never take them.
local M={GRID=96,HANDLES=192,LINES=64,BOUNDS=4}
local POOLS={"grid","handles","lines","bounds"}
-- The grid is drawn at the snap step or a coarser 1-2-5 step, at least 24 px apart and never more
-- lines than the pool holds (a 4K canvas gets a coarser grid, not a partial one).
M.STEPS={0.1,0.5,1,2,5,10,20,50,100,200,500,1000,2000,5000}
local GRID=vmath.vector4(0.65,0.85,0.9,0.09)
local GRID_MAJOR=vmath.vector4(0.65,0.85,0.9,0.2)
local function box(o,color)
    local n=gui.new_box_node(vmath.vector3(0,0,0),vmath.vector3(1,1,0))
    gui.set_color(n,color or vmath.vector4(1,1,1,1));gui.set_enabled(n,false)
    o.nodes=o.nodes+1
    return n
end
-- Call first in init: GUI nodes draw in creation order, so the panels created later stay on top.
function M.init()
    local o={nodes=0,k=4/3,s=1,grid={},handles={},lines={},bounds={},used={grid=0,handles=0,lines=0,bounds=0},dropped=0}
    for i=1,M.GRID do o.grid[i]=box(o,GRID) end
    for i=1,M.LINES do o.lines[i]=box(o) end
    for i=1,M.HANDLES do o.handles[i]=box(o) end
    for i=1,M.BOUNDS do o.bounds[i]=box(o) end
    o.snap=box(o)
    o.readout=gui.new_text_node(vmath.vector3(0,0,0),"");o.nodes=o.nodes+1
    gui.set_font(o.readout,"default");gui.set_pivot(o.readout,gui.PIVOT_SW);gui.set_scale(o.readout,vmath.vector3(0.42,0.42,1))
    gui.set_enabled(o.readout,false)
    -- Two fixed probes measure canvas pixels per GUI unit (adjust mode and window size included).
    o.probe0=box(o,vmath.vector4(0,0,0,0));o.probe1=box(o,vmath.vector4(0,0,0,0))
    gui.set_position(o.probe1,vmath.vector3(100,100,0))
    return o
end
function M.begin(o)
    local a,b=gui.get_screen_position(o.probe0),gui.get_screen_position(o.probe1)
    o.k=math.max(1e-6,(b.x-a.x)/100)
    -- 960 x 540 GUI units fill a 1280 x 720 canvas at scale 1.
    o.s=o.k*0.75
    local used=o.used
    o.last,o.used={},{}
    for _,pool in ipairs(POOLS) do o.last[pool],o.used[pool]=used[pool],0 end
    o.dropped=0
end
local function take(o,pool)
    local i=o.used[pool]+1
    local n=o[pool][i]
    if not n then o.dropped=o.dropped+1;return nil end
    o.used[pool]=i
    gui.set_enabled(n,true)
    return n
end
-- A straight line between two canvas points, width in pixels.
function M.line(o,a,b,color,width,pool)
    local n=take(o,pool or "lines")
    if not n then return end
    local dx,dy=b[1]-a[1],b[2]-a[2]
    gui.set_screen_position(n,vmath.vector3((a[1]+b[1])/2,(a[2]+b[2])/2,0))
    gui.set_size(n,vmath.vector3(math.sqrt(dx*dx+dy*dy)/o.k,(width or 2)*o.s/o.k,0))
    gui.set_euler(n,vmath.vector3(0,0,math.deg(math.atan2(dy,dx))))
    gui.set_color(n,color)
    return n
end
-- A square handle centred on a canvas point; diamond=true turns it 45 degrees.
function M.handle(o,p,color,size,diamond)
    local n=take(o,"handles")
    if not n then return end
    gui.set_screen_position(n,vmath.vector3(p[1],p[2],0))
    gui.set_size(n,vmath.vector3(size*o.s/o.k,size*o.s/o.k,0))
    gui.set_euler(n,vmath.vector3(0,0,diamond and 45 or 0))
    gui.set_color(n,color)
    return n
end
function M.snap(o,p,color)
    gui.set_enabled(o.snap,p~=nil)
    if not p then return end
    gui.set_screen_position(o.snap,vmath.vector3(p[1],p[2],0))
    gui.set_size(o.snap,vmath.vector3(11*o.s/o.k,11*o.s/o.k,0))
    gui.set_euler(o.snap,vmath.vector3(0,0,45))
    gui.set_color(o.snap,color)
end
function M.readout(o,p,text)
    gui.set_enabled(o.readout,p~=nil and text~="")
    if not p then return end
    gui.set_text(o.readout,text)
    gui.set_screen_position(o.readout,vmath.vector3(p[1]+14*o.s,p[2]+12*o.s,0))
end
-- Grid lines for the visible area. map: world -> canvas mapping; w, h: canvas size in pixels.
function M.grid(o,map,w,h,step)
    local ppm=math.abs(map.ppm_x)
    local spacing
    for _,s in ipairs(M.STEPS) do
        if s>=step-1e-9 and s*ppm>=24*o.s and w/(s*ppm)+h/(s*ppm)+2<=M.GRID then spacing=s;break end
    end
    if not spacing then return end
    local x0,x1=(0-map.ox)/map.ppm_x,(w-map.ox)/map.ppm_x
    local y0,y1=(0-map.oy)/map.ppm_y,(h-map.oy)/map.ppm_y
    local major=spacing*5
    for i=math.ceil(math.min(x0,x1)/spacing),math.floor(math.max(x0,x1)/spacing) do
        local px=map.ox+i*spacing*map.ppm_x
        M.line(o,{px,0},{px,h},i%5==0 and GRID_MAJOR or GRID,1,"grid")
    end
    for i=math.ceil(math.min(y0,y1)/spacing),math.floor(math.max(y0,y1)/spacing) do
        local py=map.oy+i*spacing*map.ppm_y
        M.line(o,{0,py},{w,py},i%5==0 and GRID_MAJOR or GRID,1,"grid")
    end
    o.spacing=spacing
    return spacing,major
end
-- A rectangle between two canvas corners in the bounds pool (LE6). Only the sides inside the canvas
-- (w x h pixels) are drawn, clipped to it, so a far-away side never becomes a huge node.
function M.rect(o,a,b,w,h,color,width)
    local x0,x1,y0,y1=math.min(a[1],b[1]),math.max(a[1],b[1]),math.min(a[2],b[2]),math.max(a[2],b[2])
    local cx0,cx1,cy0,cy1=math.max(x0,-4),math.min(x1,w+4),math.max(y0,-4),math.min(y1,h+4)
    if cx0>cx1 or cy0>cy1 then return end
    for _,y in ipairs({y0,y1}) do if y>=-4 and y<=h+4 then M.line(o,{cx0,y},{cx1,y},color,width,"bounds") end end
    for _,x in ipairs({x0,x1}) do if x>=-4 and x<=w+4 then M.line(o,{x,cy0},{x,cy1},color,width,"bounds") end end
end
-- Disable what this frame did not use.
function M.finish(o)
    for pool,count in pairs(o.last or {}) do
        for i=o.used[pool]+1,count do gui.set_enabled(o[pool][i],false) end
    end
end
function M.hide(o)
    for _,pool in ipairs(POOLS) do for _,n in ipairs(o[pool]) do gui.set_enabled(n,false) end end
    o.used,o.last={grid=0,handles=0,lines=0,bounds=0},nil
    gui.set_enabled(o.snap,false);gui.set_enabled(o.readout,false)
end
return M
