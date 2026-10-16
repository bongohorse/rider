local layout=require "main.gym.layout"
-- Fifty 100-ms min/max bars per signal preserve short spikes from 60-Hz samples.
local feel=require "main.gym.feel"
local M={}
local colors={vmath.vector4(0.7,0.9,1,1),vmath.vector4(0.3,0.85,0.73,1),vmath.vector4(1,0.72,0.3,1)}
local function text(x,y,value)
    local n=layout.text(vmath.vector3(x,y,0),value)
    gui.set_font(n,"default");gui.set_pivot(n,gui.PIVOT_W)
    gui.set_scale(n,vmath.vector3(0.55,0.55,1));return n
end
function M.new()
    local g={bars={}}
    local bg=layout.box(vmath.vector3(160,145,0),vmath.vector3(280,220,0))
    gui.set_color(bg,vmath.vector4(0.05,0.1,0.12,0.92))
    for _,y in ipairs({86,168}) do
        local zero=layout.box(vmath.vector3(153,y,0),vmath.vector3(250,1,0))
        gui.set_color(zero,vmath.vector4(0.4,0.55,0.6,0.5))
    end
    g.speed=text(28,238,"Speed - last 5 s")
    g.travel=text(28,144,"Spring travel - L teal / R amber")
    for i=1,3 do
        g.bars[i]={}
        for j=1,50 do
            local n=layout.box(vmath.vector3(),vmath.vector3(i==1 and 4 or 2,2,0))
            gui.set_color(n,colors[i]);gui.set_enabled(n,false);g.bars[i][j]=n
        end
    end
    return g
end
function M.draw(g,data)
    local values=json.decode(data.values)
    local series=data.series
    local base,span=series==1 and 168 or 86,series==1 and 55 or 42
    for j,n in ipairs(g.bars[series]) do
        local low,high=values[j*2-1],values[j*2]
        local present=type(low)=="number" and type(high)=="number"
        gui.set_enabled(n,present)
        if present then
            gui.set_position(n,vmath.vector3(28+(j-0.5)*5+(series==3 and 2 or 0),base+(low+high)*0.5/data.scale*span,0))
            gui.set_size(n,vmath.vector3(series==1 and 4 or 2,math.max(2,(high-low)/data.scale*span),0))
        end
    end
    if series==1 then gui.set_text(g.speed,string.format("Speed 0-%.1f m/s | last 5 s",feel.metres(data.scale)))
    else gui.set_text(g.travel,string.format("Spring ±%.0f u | L teal / R amber",data.scale)) end
end
return M
