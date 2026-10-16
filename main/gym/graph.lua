local layout=require "main.gym.layout"
-- Keep all 50 min/max buckets; connect their centres without dropping spikes.
local feel=require "main.gym.feel"
local M={}
local colors={vmath.vector4(0.7,0.9,1,1),vmath.vector4(0.3,0.85,0.73,1),vmath.vector4(1,0.72,0.3,1)}
local function text(x,y,value)
    local n=layout.text(vmath.vector3(x,y,0),value,"left_top")
    gui.set_font(n,"default");gui.set_pivot(n,gui.PIVOT_W)
    gui.set_scale(n,vmath.vector3(0.4,0.4,1));return n
end
function M.new()
    local pixels={}
    for y=0,7 do
        local alpha=math.floor(255*math.max(0,1-math.abs(y-3.5)/2))
        pixels[#pixels+1]=string.rep(string.char(alpha,alpha,alpha,alpha),8)
    end
    assert(gui.new_texture("graph_line",8,8,"rgba",table.concat(pixels)),"Graph texture unavailable")
    local first=#layout.nodes+1
    local g={bars={}}
    local bg=layout.box(vmath.vector3(112,401,0),vmath.vector3(200,80,0),"left_top")
    gui.set_color(bg,vmath.vector4(0.05,0.1,0.12,0.55))
    g.origin=layout.box(vmath.vector3(12,430,0),vmath.vector3(1,1,0),"left_top")
    g.probe=layout.box(vmath.vector3(13,430,0),vmath.vector3(1,1,0),"left_top")
    gui.set_enabled(g.origin,false);gui.set_enabled(g.probe,false)
    g.speed=text(18,429,"Speed / 5 s")
    g.travel=text(18,394,"Spring / L / R")
    for i=1,3 do
        g.bars[i]={}
        for j=1,50 do
            local pair={}
            for k=1,2 do
                local n=layout.box(vmath.vector3(),vmath.vector3(1,1,0),"left_top")
                gui.set_texture(n,"graph_line");gui.set_color(n,colors[i]);gui.set_enabled(n,false)
                pair[k]=n
            end
            g.bars[i][j]=pair
        end
    end
    g.nodes={}
    for i=first,#layout.nodes do g.nodes[#g.nodes+1]=layout.nodes[i] end
    return g
end
function M.visible(g,visible)
    if g.visible==visible then return end
    g.visible=visible
    for _,n in ipairs(g.nodes) do gui.set_visible(n,visible) end
end
local function line(n,x1,y1,x2,y2,thickness)
    local dx,dy=x2-x1,y2-y1
    layout.position(n,vmath.vector3((x1+x2)/2,(y1+y2)/2,0))
    gui.set_size(n,vmath.vector3(math.max(thickness/2,math.sqrt(dx*dx+dy*dy)),thickness,0))
    gui.set_rotation(n,vmath.quat_rotation_z(math.atan2(dy,dx)))
end
function M.draw(g,data)
    local values=json.decode(data.values)
    local series=data.series
    local base,span=series==1 and 410 or 376,series==1 and 12 or 12
    -- Measure physical back-buffer pixels per local unit after resize/HiDPI.
    gui.set_position(g.origin,gui.get_position(g.origin));gui.set_position(g.probe,gui.get_position(g.probe))
    local scale=math.max(0.01,math.abs(gui.get_screen_position(g.probe).x-gui.get_screen_position(g.origin).x))
    local thickness=3/scale -- feathered texture: approximately 1.5 px bright core
    local previous
    for j,pair in ipairs(g.bars[series]) do
        local low,high=values[j*2-1],values[j*2]
        local present=type(low)=="number" and type(high)=="number"
        gui.set_enabled(pair[1],present);gui.set_enabled(pair[2],present and previous~=nil)
        if present then
            local x=18+(j-0.5)*3.76
            local y1,y2=base+low/data.scale*span,base+high/data.scale*span
            line(pair[1],x,y1,x,y2,thickness)
            local y=(y1+y2)/2
            if previous then line(pair[2],previous.x,previous.y,x,y,thickness) end
            previous={x=x,y=y}
        else previous=nil end
    end
    if series==1 then gui.set_text(g.speed,string.format("Speed <=%.1f m/s / 5 s",feel.metres(data.scale)))
    else gui.set_text(g.travel,string.format("Spring +/-%.0f L / R",data.scale)) end
end
return M
