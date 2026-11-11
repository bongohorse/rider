-- #669: the off-screen pickup indicators of the native HUD (GUI side only; used by ui.gui_script).
-- One small box per type (fuel, coins, gem): a coloured dot and the distance in metres, on the screen edge towards
-- the nearest pickup ahead. pickup_edges.lua chooses the pickups (controller side) and the spots. Not a control:
-- it takes no input. Placeholder look until the final icon art (#358).
local layout=require "main.game.layout"
local edges=require "main.game.pickup_edges"
local M={}
-- Local units in the left_top root, which the HUD scales to at least 1 CSS px per unit (as camera_hud).
M.W,M.H=104,30
local BG=vmath.vector4(0.05,0.1,0.13,0.85)
local TEXT=vmath.vector4(0.92,0.97,0.95,1)
-- Play bar chip colours (play_bar.js): coins #ffd23f, gems #b48cff, fuel #ff4f5e.
local COLORS={fuel=vmath.vector4(1,0.31,0.37,1),coin=vmath.vector4(1,0.82,0.25,1),gem=vmath.vector4(0.71,0.55,1,1)}
function M.new()
    local h={items={}}
    for _,k in ipairs(edges.KINDS) do
        local i={}
        i.bg=layout.box(vmath.vector3(0,540,0),vmath.vector3(M.W,M.H,0),"left_top");gui.set_color(i.bg,BG)
        i.dot=layout.box(vmath.vector3(0,540,0),vmath.vector3(14,14,0),"left_top");gui.set_texture(i.dot,"hud_dot");gui.set_color(i.dot,COLORS[k])
        i.text=layout.text(vmath.vector3(0,540,0),"","left_top");gui.set_font(i.text,"default");gui.set_scale(i.text,vmath.vector3(0.5,0.5,1))
        gui.set_pivot(i.text,gui.PIVOT_W);gui.set_color(i.text,TEXT)
        for _,n in ipairs({i.bg,i.dot,i.text}) do gui.set_visible(n,false) end
        h.items[k]=i
    end
    return h
end
-- Screen pixels per local unit (x, y) of the left_top root, from a node in it.
local function units(n)
    local p=gui.get_screen_position(n)
    local a,b=gui.screen_to_local(n,p),gui.screen_to_local(n,p+vmath.vector3(100,100,0))
    local ux,uy=math.abs(b.x-a.x),math.abs(b.y-a.y)
    if not (ux>0 and uy>0) then return nil end
    return 100/ux,100/uy
end
-- targets: the controller's list (nil hides all); area/screen: safe area and full screen; blocked: every control
-- and readout (screen rectangles); gap: clearance in screen pixels. Returns the placement (debug state).
function M.update(h,targets,area,screen,blocked,gap)
    local placed={}
    local first=h.items[edges.KINDS[1]]
    local ux,uy=units(first.bg)
    if targets and ux then placed=edges.place(area,screen,targets,M.W*ux,M.H*uy,blocked,gap) end
    local on={}
    for _,p in ipairs(placed) do
        if p.clear then
            on[p.kind]=true
            local i=h.items[p.kind]
            local origin=gui.screen_to_local(i.bg,vmath.vector3(p.left,p.top,0))
            gui.set_position(i.bg,origin+vmath.vector3(M.W/2,-M.H/2,0))
            gui.set_position(i.dot,origin+vmath.vector3(14,-M.H/2,0))
            gui.set_position(i.text,origin+vmath.vector3(26,-M.H/2,0))
            gui.set_text(i.text,edges.text(p))
        end
    end
    for _,k in ipairs(edges.KINDS) do
        local i=h.items[k]
        for _,n in ipairs({i.bg,i.dot,i.text}) do gui.set_visible(n,on[k] or false) end
    end
    h.placed=placed
    return placed
end
return M
