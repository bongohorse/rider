local layout=require "main.gym.layout"
-- GUI only: changes are messages; physics writes remain in the fixed owner.
local feel=require "main.gym.feel"
local M={}
local function text(x,y,value)
    local n=layout.text(vmath.vector3(x,y,0),value,"right_top")
    gui.set_font(n,"default");gui.set_scale(n,vmath.vector3(0.55,0.55,1))
    return n
end
function M.new()
    local c={rows={}}
    for i,spec in ipairs(feel.sliders) do
        local y=316-(i-1)*26
        local row={spec=spec,y=y,value=feel.values[spec.key]}
        row.label=text(780,y+10,"")
        row.track=layout.box(vmath.vector3(780,y,0),vmath.vector3(240,10,0),"right_top")
        gui.set_color(row.track,vmath.vector4(0.15,0.25,0.3,1))
        row.knob=layout.box(vmath.vector3(780,y,0),vmath.vector3(12,18,0),"right_top")
        gui.set_color(row.knob,vmath.vector4(0.35,0.85,0.75,1))
        row.left=layout.box(vmath.vector3(660,y,0),vmath.vector3(1,1,0),"right_top")
        row.right=layout.box(vmath.vector3(900,y,0),vmath.vector3(1,1,0),"right_top")
        gui.set_enabled(row.left,false);gui.set_enabled(row.right,false)
        c.rows[i]=row
    end
    M.sync(c,feel.values)
    return c
end
function M.sync(c,values)
    for _,row in ipairs(c.rows) do
        if values[row.spec.key] then row.value=values[row.spec.key] end
        local display=row.value*(row.spec.sign or 1)
        local ratio=feel.clamp((display-row.spec.min)/(row.spec.max-row.spec.min),0,1)
        layout.position(row.knob,vmath.vector3(660+240*ratio,row.y,0))
        gui.set_text(row.label,string.format("%s %.2f %s",row.spec.label,display,row.spec.unit))
    end
end
function M.geometry(c)
    local rows={}
    for _,row in ipairs(c.rows) do
        -- Disabled probe nodes do not render, so invalidate their cached transforms
        -- explicitly after a window resize before reading their screen positions.
        gui.set_position(row.left,gui.get_position(row.left))
        gui.set_position(row.right,gui.get_position(row.right))
        local left,right=gui.get_screen_position(row.left),gui.get_screen_position(row.right)
        rows[#rows+1]={key=row.spec.key,value=row.value,min=row.spec.min,max=row.spec.max,sign=row.spec.sign or 1,
            left={x=left.x,y=left.y},right={x=right.x,y=right.y}}
    end
    return rows
end
function M.input(c,id,action,owner)
    if not owner then return end
    if id==hash("ui_pointer") and action.pressed then
        for _,row in ipairs(c.rows) do
            if gui.pick_node(row.track,action.x,action.y) or gui.pick_node(row.knob,action.x,action.y) then
                c.drag=row
                msg.post(owner,"ui_capture",{active=true})
                break
            end
        end
    end
    if c.drag then
        local row=c.drag
        -- screen_to_local reverses anchors, adjust scale and safe-area offsets.
        -- action.x remains design-scaled and cannot be used as a track coordinate.
        if action.screen_x then
            local pos=gui.screen_to_local(row.track,vmath.vector3(action.screen_x,action.screen_y,0))
            local centre=gui.get_position(row.track).x
            local width=gui.get_size(row.track).x
            local ratio=feel.clamp((pos.x-(centre-width/2))/width,0,1)
            local value=(row.spec.min+ratio*(row.spec.max-row.spec.min))*(row.spec.sign or 1)
            msg.post(owner,"tune",{key=row.spec.key,value=value})
        end
        if id==hash("ui_pointer") and action.released then
            c.drag=nil
            msg.post(owner,"ui_capture",{active=false})
        end
        return true
    end
end
return M
