-- GUI only: changes are messages; physics writes remain in the fixed owner.
local feel=require "main.gym.feel"
local M={}
local function text(x,y,value)
    local n=gui.new_text_node(vmath.vector3(x,y,0),value)
    gui.set_font(n,"default");gui.set_scale(n,vmath.vector3(0.55,0.55,1))
    return n
end
function M.new()
    local c={rows={}}
    for i,spec in ipairs(feel.sliders) do
        local y=316-(i-1)*26
        local row={spec=spec,y=y,value=feel.values[spec.key]}
        row.label=text(780,y+10,"")
        row.track=gui.new_box_node(vmath.vector3(780,y,0),vmath.vector3(240,10,0))
        gui.set_color(row.track,vmath.vector4(0.15,0.25,0.3,1))
        row.knob=gui.new_box_node(vmath.vector3(780,y,0),vmath.vector3(12,18,0))
        gui.set_color(row.knob,vmath.vector4(0.35,0.85,0.75,1))
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
        gui.set_position(row.knob,vmath.vector3(660+240*ratio,row.y,0))
        gui.set_text(row.label,string.format("%s %.2f %s",row.spec.label,display,row.spec.unit))
    end
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
        -- action.x/y use the authored GUI coordinates for this fixed-fit scene.
        if action.x then
            local ratio=feel.clamp((action.x-660)/240,0,1)
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
