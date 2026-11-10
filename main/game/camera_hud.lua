-- #443: HUD camera control and its live settings panel (GUI side only; used by ui.gui_script).
-- The control is two buttons: "Cam A"/"Cam B" switches the camera live, "Set" opens the panel. The panel steps each
-- camera setting (camera_settings.lua) with -/+, resets to camera A and every default, and closes. Every change is
-- one camera_set message to the loader, which stores it (player settings) and forwards it to the controller, the
-- single camera owner. A tap here is consumed by this GUI and is never drive input (drive is keys or DOM zones).
-- Placement reuses fps_place: the control and the open panel are clamped into the visible area and moved the
-- shortest way off every other control (the FPS counter included) with the same 4 CSS px gap. No restyle: the
-- existing HUD button colour and the built-in font.
local layout=require "main.game.layout"
local fps_place=require "main.game.fps_place"
local camera_settings=require "main.game.camera_settings"
local M={}
-- Local units in the left_top root, which the HUD scales to at least 1 CSS px per unit, so 40-46 unit tall buttons
-- stay near the 44 px touch minimum (the FPS counter's tap area is 46 units for the same reason).
M.CONTROL={w=132,h=44}
-- Panel: a title row (Reset, Close) over two columns of three settings, so it stays a short band under the control
-- and the buggy stays in view while the settings change (a single column covered it on a phone).
M.ROW,M.PAD,M.CELL=46,8,270
M.ROWS=math.ceil(#camera_settings.SPECS/2)
M.PANEL_W=2*M.CELL+3*M.PAD
M.PANEL_H=2*M.PAD+(M.ROWS+1)*M.ROW
M.DEFAULT_X,M.DEFAULT_Y=0.5,0 -- preferred place: top centre (free on desktop and phone; moved off any control there)
local COLOR=vmath.vector4(0.13,0.24,0.28,1)
local ACTIVE=vmath.vector4(0.15,0.5,0.45,1)
local PANEL=vmath.vector4(0.05,0.1,0.13,0.92)
local TEXT=vmath.vector4(0.86,0.95,0.91,1)
local DIM=vmath.vector4(0.55,0.65,0.65,1)
-- An element: a node and the offset of its position from its group's top-left corner (local units, y down).
local function element(group,node,ox,oy,w,h)
    group[#group+1]={node=node,ox=ox,oy=oy,w=w,h=h}
    return node
end
local function box(group,ox,oy,w,h,color)
    local n=layout.box(vmath.vector3(0,540,0),vmath.vector3(w,h,0),"left_top")
    gui.set_color(n,color)
    return element(group,n,ox,oy,w,h)
end
local function text(group,ox,oy,value,scale,left)
    local n=layout.text(vmath.vector3(0,540,0),value,"left_top")
    gui.set_font(n,"default");gui.set_scale(n,vmath.vector3(scale,scale,1))
    if left then gui.set_pivot(n,gui.PIVOT_W) end
    return element(group,n,ox,oy)
end
-- forced: "a"/"b" when the debug ?camera352 route forces the camera mode; the control then stays hidden.
function M.new(forced)
    local h={control={},panel={},rows={},open=false,placed=false,taps=0,seq=0,place_seq=0,forced=forced or false,
        settings=camera_settings.defaults(),status=false,saved=false,settings_seq=0,layout_seq=0}
    local c=h.control
    h.hit=box(c,66,22,132,44,vmath.vector4(0,0,0,0))
    h.toggle=box(c,38,22,76,40,COLOR)
    h.toggle_label=text(c,38,22,"Cam A",0.55)
    h.set=box(c,106,22,52,40,COLOR)
    h.set_label=text(c,106,22,"Set",0.55)
    local p,W=h.panel,M.PANEL_W
    h.bg=box(p,W/2,M.PANEL_H/2,W,M.PANEL_H,PANEL)
    local y0=M.PAD+M.ROW/2
    h.title=text(p,M.PAD+4,y0,"Camera A",0.5,true)
    h.reset=box(p,W-M.PAD-102,y0,72,40,COLOR);text(p,W-M.PAD-102,y0,"Reset",0.5)
    h.close=box(p,W-M.PAD-30,y0,60,40,COLOR);text(p,W-M.PAD-30,y0,"Close",0.5)
    for i,spec in ipairs(camera_settings.SPECS) do
        -- Left column: follow, look-ahead, zoom; right column: height and the two B-only settings.
        local column=math.floor((i-1)/M.ROWS)
        local x0,y=M.PAD+column*(M.CELL+M.PAD),y0+((i-1)%M.ROWS+1)*M.ROW
        local row={spec=spec}
        row.label=text(p,x0+4,y,"",0.45,true)
        row.minus=box(p,x0+M.CELL-78,y,48,40,COLOR);text(p,x0+M.CELL-78,y,"-",0.7)
        row.plus=box(p,x0+M.CELL-24,y,48,40,COLOR);text(p,x0+M.CELL-24,y,"+",0.7)
        h.rows[i]=row
    end
    for _,e in ipairs(c) do gui.set_visible(e.node,false) end
    for _,e in ipairs(p) do gui.set_visible(e.node,false) end
    M.show(h)
    return h
end
-- Labels for the current settings: the toggle names the camera in use; B-only rows are dimmed on camera A.
function M.show(h)
    local s=h.settings
    gui.set_text(h.toggle_label,"Cam "..string.upper(s.mode))
    gui.set_color(h.toggle,s.mode=="b" and ACTIVE or COLOR)
    gui.set_color(h.set,h.open and ACTIVE or COLOR)
    gui.set_text(h.title,"Camera "..string.upper(s.mode).." - live")
    for _,row in ipairs(h.rows) do
        gui.set_text(row.label,camera_settings.text(row.spec,s[row.spec.key]))
        gui.set_color(row.label,(row.spec.b and s.mode~="b") and DIM or TEXT)
    end
    -- #678: with the HTML5 play bar the kit draws this control from riderCamera443; the nodes stay as the transparent
    -- tap targets (picks, placement and the #443 checks are unchanged).
    if h.skin then
        for _,g in ipairs({h.control,h.panel}) do for _,e in ipairs(g) do
            local col=gui.get_color(e.node);col.w=0;gui.set_color(e.node,col)
        end end
    end
end
function M.skin(h) h.skin=true;M.show(h) end
-- The loader applied (and stored) these settings.
function M.settings(h,data)
    h.settings=camera_settings.sanitize(data)
    h.saved,h.status,h.settings_seq=data.saved or false,data.status or false,data.seq or 0
    M.show(h)
end
-- Screen pixels per local unit (x, y) of the left_top root, from a node in it.
local function units(n)
    local p=gui.get_screen_position(n)
    local a,b=gui.screen_to_local(n,p),gui.screen_to_local(n,p+vmath.vector3(100,100,0))
    local ux,uy=math.abs(b.x-a.x),math.abs(b.y-a.y)
    if not (ux>0 and uy>0) then return nil end
    return 100/ux,100/uy
end
-- Move a group so its top-left corner is at (left, top) screen pixels; returns each element's screen rectangle.
local function move(group,left,top,ux,uy,visible)
    local origin=gui.screen_to_local(group[1].node,vmath.vector3(left,top,0))
    for _,e in ipairs(group) do
        gui.set_position(e.node,origin+vmath.vector3(e.ox,-e.oy,0))
        gui.set_visible(e.node,visible)
        if e.w then
            local cx,cy=left+e.ox*ux,top-e.oy*uy
            e.rect={x0=cx-e.w*ux/2,y0=cy-e.h*uy/2,x1=cx+e.w*ux/2,y1=cy+e.h*uy/2}
        end
    end
end
-- Flat numeric signature of a placement (no strings): changed when any value moved by half a pixel or more.
local function push(sig,r)
    if r then sig[#sig+1]=r.x0;sig[#sig+1]=r.y0;sig[#sig+1]=r.x1;sig[#sig+1]=r.y1 else sig[#sig+1]=-1 end
end
local function same(a,b)
    if not a or #a~=#b then return false end
    for i=1,#a do if math.abs(a[i]-b[i])>=0.5 then return false end end
    return true
end
-- Place the control (and the open panel) in the visible area, clear of `blocked` (screen rectangles of every other
-- control) with `gap` pixels. layout_seq: the DOM layout count this placement used. Returns true when the placement
-- (or what it avoided) changed.
function M.place(h,area,blocked,gap,layout_seq)
    if h.forced then
        for _,g in ipairs({h.control,h.panel}) do for _,e in ipairs(g) do gui.set_visible(e.node,false) end end
        local changed=not h.forced_published;h.forced_published=true
        return changed
    end
    local ux,uy=units(h.hit)
    if not ux then return false end
    local w,hh=M.CONTROL.w*ux,M.CONTROL.h*uy
    local left,top=fps_place.to_screen(area,w,hh,M.DEFAULT_X,M.DEFAULT_Y)
    local clear
    left,top,clear=fps_place.place(area,w,hh,left,top,blocked,gap)
    move(h.control,left,top,ux,uy,true)
    h.rect={x0=left,y0=top-hh,x1=left+w,y1=top}
    h.clear=clear
    local panel_rect,panel_clear=false,true
    if h.open then
        local pw,ph=M.PANEL_W*ux,M.PANEL_H*uy
        local around={}
        for i,b in ipairs(blocked) do around[i]=b end
        around[#around+1]=h.rect
        -- Preferred: just below the control, centred under it.
        local pl,pt
        pl,pt,panel_clear=fps_place.place(area,pw,ph,left+w/2-pw/2,top-hh-gap,around,gap)
        move(h.panel,pl,pt,ux,uy,true)
        panel_rect={x0=pl,y0=pt-ph,x1=pl+pw,y1=pt}
    else
        for _,e in ipairs(h.panel) do gui.set_visible(e.node,false) end
    end
    h.panel_rect,h.panel_clear=panel_rect,panel_clear
    h.placed=true
    local sig={clear and 1 or 0,panel_clear and 1 or 0,layout_seq or 0}
    push(sig,h.rect);push(sig,panel_rect or nil)
    for _,b in ipairs(blocked) do push(sig,b) end
    h.blocked,h.layout_seq=blocked,layout_seq or 0
    if same(h.signature,sig) then return false end
    h.signature=sig
    h.place_seq=h.place_seq+1
    return true
end
local function send(command) msg.post("#script","camera_set",command) end
-- A press on the control or the open panel. Returns true when consumed (always for a press inside them).
function M.input(h,id,action)
    if h.forced or id~=hash("ui_pointer") or not action.pressed or not h.placed then return false end
    if gui.pick_node(h.toggle,action.x,action.y) then
        h.taps=h.taps+1;send({command="toggle"});return true
    end
    if gui.pick_node(h.set,action.x,action.y) then
        h.taps=h.taps+1;h.open=not h.open;h.signature=nil;M.show(h);return true
    end
    if gui.pick_node(h.hit,action.x,action.y) then return true end
    if not h.open then return false end
    if gui.pick_node(h.close,action.x,action.y) then
        h.taps=h.taps+1;h.open=false;h.signature=nil;M.show(h);return true
    end
    if gui.pick_node(h.reset,action.x,action.y) then h.taps=h.taps+1;send({command="reset"});return true end
    for _,row in ipairs(h.rows) do
        if gui.pick_node(row.minus,action.x,action.y) then h.taps=h.taps+1;send({command="step",key=row.spec.key,dir=-1});return true end
        if gui.pick_node(row.plus,action.x,action.y) then h.taps=h.taps+1;send({command="step",key=row.spec.key,dir=1});return true end
    end
    -- Anywhere else on the open panel: consumed, nothing happens.
    return gui.pick_node(h.bg,action.x,action.y)
end
-- Close the panel (editor, world switch); the control stays.
function M.close(h)
    if h.open then h.open=false;h.signature=nil;M.show(h) end
end
-- Debug/test state (HTML5): settings, placement rectangles (GUI screen pixels, origin bottom left) and taps.
-- nodes: {used, max} of the HUD GUI (debug budget check).
function M.publish(h,pixel_ratio,nodes)
    if not html5 then return end
    h.seq=h.seq+1
    local s=h.settings
    local rows={}
    for i,row in ipairs(h.rows) do
        local minus,plus
        for _,e in ipairs(h.panel) do
            if e.node==row.minus then minus=e.rect elseif e.node==row.plus then plus=e.rect end
        end
        rows[i]={key=row.spec.key,text=gui.get_text(row.label),minus=h.open and minus or false,plus=h.open and plus or false}
    end
    local function rect_of(node)
        for _,g in ipairs({h.control,h.panel}) do
            for _,e in ipairs(g) do if e.node==node then return e.rect end end
        end
    end
    local values={}
    for _,k in ipairs(camera_settings.KEYS) do values[k]=s[k] end
    html5.run("window.riderCamera443="..json.encode({seq=h.seq,place_seq=h.place_seq,settings_seq=h.settings_seq,mode=s.mode,
        values=values,saved=h.saved,status=h.status,open=h.open,taps=h.taps,label=gui.get_text(h.toggle_label),
        title=gui.get_text(h.title),clear=h.clear or false,panel_clear=h.panel_clear,pixel_ratio=pixel_ratio or 1,
        control=h.rect or false,toggle=rect_of(h.toggle) or false,set=rect_of(h.set) or false,
        toggle_screen=(function() local p=gui.get_screen_position(h.toggle);return {x=p.x,y=p.y} end)(),
        panel=h.panel_rect or false,reset=h.open and rect_of(h.reset) or false,close=h.open and rect_of(h.close) or false,
        b_only=(function() local r={};for i,row in ipairs(h.rows) do r[i]=row.spec.b or false end;return r end)(),
        rows=rows,blocked=h.blocked or {},layout_seq=h.layout_seq,forced=h.forced,nodes=nodes or false}))
end
return M
