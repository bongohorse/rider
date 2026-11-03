-- Car Feel 3 (#201): visible suspension struts. Visual only, render frame only.
-- Called from the owner's update (never fixed_update): reads the chassis/wheel GO transforms that
-- Defold wrote after this frame's fixed steps and writes only the strut GOs' local transforms.
-- It never writes a body, joint or shape; the cf3 debug probe reads body positions (read-only)
-- to check the drawing against an independent source.
-- Module-level state is ONLY the user's display preference (`M.enabled`: URL ?struts=0, the
-- tuning-panel button), which deliberately survives world reloads like a setting, plus the strut
-- sprite's authored size (a resource constant). Everything that belongs to a world (strut GO ids,
-- counts, probe statistics) lives on the per-session vehicle table.
local feel=require "main.gym.feel"
local M={}
-- Visual top mount (chassis space, engine units): 8 u above the centre line, on the new fenders. The
-- joint anchor (wheel_x, wheel_y) coincides with the wheel centre at spring rest (local_anchor_b
-- is the wheel centre), so a strut to it would be ~1.5 u long and invisible.
M.mount_y=8
-- Local z on the chassis (0): spring above the body, below the wheel (1).
M.z=0.5
local query=html5 and html5.run("new URLSearchParams(location.search).get('struts') || ''") or ""
M.enabled=not (query=="0" or query=="off")
local debug=sys.get_engine_info().is_debug and sys.get_config_string("rider.gym_test","")=="cf3"
local SPRITE=hash("sprite")
local size -- strut.sprite size (resource constant), read once from the first strut
-- The owner's message handler; the label refreshes even in a world without a vehicle.
function M.toggle()
    M.enabled=not M.enabled
    msg.post("main:/loader#ui","struts",{enabled=M.enabled})
end
local function spawn(v)
    v.struts={}
    -- cf3 probe only: every strut ever created in this world, to prove deleted ones are gone.
    if debug then v.strut_all=v.strut_all or {} end
    for i,x in ipairs(feel.values.wheel_x) do
        local id=factory.create("#strut",vmath.vector3(x,M.mount_y,M.z))
        go.set_parent(id,v.ids.chassis,false)
        v.struts[i]=id
        if debug then v.strut_all[#v.strut_all+1]=id end
    end
    v.strut_created=(v.strut_created or 0)+#v.struts
end
local function remove(v)
    for _,id in ipairs(v.struts) do go.delete(id) end
    v.strut_deleted=(v.strut_deleted or 0)+#v.struts
    v.struts=nil
end
-- cf3 only: drawn strut geometry (chassis GO transform composed with the strut's local transform
-- set this frame) against the mount and wheel centre taken from the bodies.
local function probe(self)
    local v=self.vehicle
    local s=v.strut_stats or {frames=0,length_error=0,wheel_error=0,mount_error=0,min_length=math.huge,max_length=0}
    v.strut_stats=s
    local live=0
    for _,id in ipairs(v.strut_all or {}) do if go.exists(id) then live=live+1 end end
    local world=b2d.world.get_counters(b2d.body.get_world(v.chassis))
    -- spring_rest: strut length at zero joint translation (the travel/compression reference).
    local r={generation=self.session_generation,resets=self.reset_count,enabled=M.enabled,live=live,spring_rest=math.abs(M.mount_y-feel.values.wheel_y),
        created=v.strut_created or 0,deleted=v.strut_deleted or 0,bodies=world.body_count,joints=world.joint_count,shapes=world.shape_count,struts={}}
    r.layers={rider=go.get_position(v.ids.rider).z+go.get_position(v.ids.chassis).z,
        body=go.get_position(v.ids.chassis).z,spring=go.get_position(v.ids.chassis).z+(v.struts and go.get_position(v.struts[1]).z or M.z),
        rear=go.get_position(v.ids[1]).z,front=go.get_position(v.ids[2]).z}
    if v.struts then
        local origin,angle=b2d.body.get_position(v.chassis),b2d.body.get_angle(v.chassis)
        local c,sn=math.cos(angle),math.sin(angle)
        local cp,cq=go.get_world_position(v.ids.chassis),go.get_world_rotation(v.ids.chassis)
        for i,id in ipairs(v.struts) do
            local x=feel.values.wheel_x[i]
            local mount=vmath.vector3(origin.x+c*x-sn*M.mount_y,origin.y+sn*x+c*M.mount_y,0)
            local wheel=b2d.body.get_position(v.wheels[i])
            local distance=vmath.length(vmath.vector3(wheel.x-mount.x,wheel.y-mount.y,0))
            local length=go.get(msg.url(nil,id,SPRITE),"size").y*go.get_scale(id).y
            local centre=cp+vmath.rotate(cq,go.get_position(id))
            local half=vmath.rotate(cq*go.get_rotation(id),vmath.vector3(0,length/2,0))
            local a,b=centre-half,centre+half
            a.z,b.z,centre.z=0,0,0
            local function gap(p,q) return vmath.length(vmath.vector3(p.x-q.x,p.y-q.y,0)) end
            if gap(a,wheel)>gap(b,wheel) then a,b=b,a end
            local e={length=length,distance=distance,length_error=math.abs(length-distance),wheel_error=gap(a,wheel),mount_error=gap(b,mount),
                -- Engine-composed world position; it lags one frame behind a moving chassis (assert at rest only).
                world_error=gap(go.get_world_position(id),centre)}
            r.struts[i]=e
            s.length_error=math.max(s.length_error,e.length_error)
            s.wheel_error=math.max(s.wheel_error,e.wheel_error)
            s.mount_error=math.max(s.mount_error,e.mount_error)
            s.min_length,s.max_length=math.min(s.min_length,length),math.max(s.max_length,length)
        end
        s.frames=s.frames+1
    end
    r.drawn=#r.struts -- json.encode writes an empty table as {}, so count explicitly
    r.stats={frames=s.frames,length_error=s.length_error,wheel_error=s.wheel_error,mount_error=s.mount_error,
        min_length=s.frames>0 and s.min_length or false,max_length=s.max_length}
    html5.run("window.riderStruts="..json.encode(r))
end
-- Render frame, vehicle ready: create/delete the two struts for the toggle, then stretch each from
-- its chassis mount to its wheel centre (scale y only; the sprite is drawn end to end).
function M.update(self)
    local v=self.vehicle
    if M.enabled and not v.struts then spawn(v) elseif not M.enabled and v.struts then remove(v) end
    if v.struts_shown~=M.enabled then
        v.struts_shown=M.enabled
        msg.post("main:/loader#ui","struts",{enabled=M.enabled})
    end
    if v.struts then
        local cp=go.get_position(v.ids.chassis)
        local inverse=vmath.conj(go.get_rotation(v.ids.chassis))
        for i,id in ipairs(v.struts) do
            size=size or go.get(msg.url(nil,id,SPRITE),"size")
            local w=vmath.rotate(inverse,go.get_position(v.ids[i])-cp)
            local mx=feel.values.wheel_x[i]
            local dx,dy=w.x-mx,w.y-M.mount_y
            local length=math.sqrt(dx*dx+dy*dy)
            go.set_position(vmath.vector3(mx+dx/2,M.mount_y+dy/2,M.z),id)
            go.set_rotation(vmath.quat_rotation_z(math.atan2(dx,-dy)),id)
            -- go.set_scale rejects 0; a fully compressed strut draws as a dot.
            go.set_scale(vmath.vector3(1,math.max(length,0.01)/size.y,1),id)
        end
    end
    if debug and html5 then probe(self) end
end
return M
