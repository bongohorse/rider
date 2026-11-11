-- #666: short comic callouts ("CRASH!", "New best!") that pop, tilt and fade in the native GUI. Presentation
-- only: reads the run/reset messages the GUI already receives, never writes gameplay, physics or scoring state.
-- Queue and placement are pure (no engine calls); render() is the only part that touches gui.*. Reusable for
-- trick (#667) and start (#668) feedback through M.show with a style name or a spec table.
local M={}
M.MAX=2            -- callouts on screen at once; a third replaces the oldest
M.DURATION=1.2     -- seconds per callout, pop included
M.POP=0.24         -- pop-in: grows to OVERSHOOT, then settles to 1
M.FADE=0.35        -- last seconds fade to transparent
M.OVERSHOOT=1.25
-- size: text scale in GUI reference units (the built-in font is 14 units high); tilt: degrees.
M.STYLES={
    crash={text='CRASH!',color={1,.32,.18},size=2.4,tilt=-8},
    best={text='New best!',color={1,.84,.2},size=1.9,tilt=6},
}
-- Candidate centre heights as fractions of the screen height, top first. All lie in the upper half, well
-- above the touch drive zones (bottom row, at most 8+100 CSS px high) and above the result card's text.
M.ROWS={.82,.66,.5}
-- Conservative glyph box of the built-in font per scale unit (reference units).
local CHAR_W,LINE_H=10,16
local function overlaps(a,b) return a.x0<b.x1 and b.x0<a.x1 and a.y0<b.y1 and b.y0<a.y1 end
function M.new() return {enabled=true,items={},seen={}} end
function M.set_enabled(q,on)
    q.enabled=on and true or false
    if not q.enabled then q.items={} end
end
function M.clear(q) q.items={} end
-- Screen rectangle (pixels, origin bottom left) of a callout at its largest (overshoot), tilt margin included.
-- area: {w,h} screen pixels; the GUI's FIT adjust scales reference units by min(w/960,h/540).
function M.rect(spec,cx,cy,area)
    local fit=math.min(area.w/960,area.h/540)
    local s=spec.size*M.OVERSHOOT*fit
    local hw,hh=#spec.text*CHAR_W*s/2,LINE_H*s/2
    local tilt=math.rad(math.abs(spec.tilt or 0))
    hw,hh=hw*math.cos(tilt)+hh*math.sin(tilt),hh*math.cos(tilt)+hw*math.sin(tilt)
    return {x0=cx-hw,y0=cy-hh,x1=cx+hw,y1=cy+hh}
end
-- First candidate row whose rectangle stays inside the screen and clear of the blocked rectangles and the
-- callouts already shown; the top row when none is clear.
function M.place(q,spec,area,blocked)
    local cx=area.w/2
    for _,f in ipairs(M.ROWS) do
        local r=M.rect(spec,cx,area.h*f,area);local clear=r.y1<=area.h and r.y0>=0
        for _,b in ipairs(blocked or {}) do if clear and overlaps(r,b) then clear=false end end
        for _,it in ipairs(q.items) do if clear and overlaps(r,it.rect) then clear=false end end
        if clear then return cx,area.h*f,r end
    end
    local cy=area.h*M.ROWS[1];return cx,cy,M.rect(spec,cx,cy,area)
end
-- Queue a callout. style: a name in M.STYLES or a spec {text,color={r,g,b},size,tilt,duration}.
-- Returns the item, or nil while callouts are switched off.
function M.show(q,style,area,blocked)
    if not q.enabled then return nil end
    local spec=type(style)=='string' and assert(M.STYLES[style],'unknown callout style') or style
    while #q.items>=M.MAX do table.remove(q.items,1) end
    local x,y,r=M.place(q,spec,area,blocked)
    local item={spec=spec,text=spec.text,age=0,duration=spec.duration or M.DURATION,x=x,y=y,rect=r}
    q.items[#q.items+1]=item
    return item
end
-- Render frame: age the callouts and drop the expired ones.
function M.update(q,dt)
    for i=#q.items,1,-1 do
        local it=q.items[i];it.age=it.age+dt
        if it.age>=it.duration then table.remove(q.items,i) end
    end
end
-- Scale factor and alpha of a callout at its age: pop to OVERSHOOT, settle to 1, hold, fade out.
function M.pose(it)
    local t,half=it.age,M.POP/2
    local scale=t<half and .4+(M.OVERSHOOT-.4)*t/half or t<M.POP and M.OVERSHOOT-(M.OVERSHOOT-1)*(t-half)/half or 1
    local alpha=math.max(0,math.min(1,(it.duration-t)/M.FADE))
    return scale,alpha
end
-- Once per key (an attempt id or a reset count): the run/reset messages repeat every frame.
local function once(q,key)
    if q.seen[key] then return false end
    q.seen[key]=true;return true
end
-- run_state message data: CRASH! when the attempt ended on a head crash (the run only fails on the head when
-- the crash rule is on), New best! when a finished attempt set a new personal best.
function M.observe_run(q,data,area,blocked)
    if not data or not data.id then return end
    if data.state=='failed' and data.reason=='head' and once(q,'crash:'..data.id) then M.show(q,'crash',area,blocked) end
    if data.state=='finished' and data.new_best and once(q,'best:'..data.id) then M.show(q,'best',area,blocked) end
end
-- retry_done message: worlds without a run reset at once on a head crash (only while the crash rule is on).
function M.observe_reset(q,reason,area,blocked)
    if reason=='head' then M.show(q,'crash',area,blocked) end
end
-- Draw onto M.MAX text nodes (made by the caller, centre pivot, no parent).
function M.render(q,nodes)
    for i,n in ipairs(nodes) do
        local it=q.items[i]
        gui.set_visible(n,it~=nil)
        if it then
            local s,a=M.pose(it);local c=it.spec.color;local size=it.spec.size*s
            gui.set_text(n,it.text)
            gui.set_color(n,vmath.vector4(c[1],c[2],c[3],a));gui.set_outline(n,vmath.vector4(0,0,0,a))
            gui.set_scale(n,vmath.vector3(size,size,1));gui.set_euler(n,vmath.vector3(0,0,it.spec.tilt or 0))
            gui.set_screen_position(n,vmath.vector3(it.x,it.y,0))
        end
    end
end
return M
