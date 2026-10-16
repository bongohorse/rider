-- Debug scenarios only. Called by the sole controller tick owner; no callbacks.
local vehicle = require "main.gym.vehicle"
local M = {}
local emit, request_reset
function M.bind(emitter, resetter) emit, request_reset = emitter, resetter end
function M.drive(self)
    self.drive_tick = self.drive_tick + 1
    local t = self.drive_tick
    local state = vehicle.state(self.vehicle)
    self.max_angle = math.max(self.max_angle,math.abs(state.angle))
    assert(self.max_angle < 0.6,"Buggy tipped on flat launch: "..self.max_angle)
    if t == 60 then
        self.start_x = state.x
        emit(self,"phase",{name="throttle"})
    elseif t == 240 then
        self.drive_dx, self.drive_speed = state.x-self.start_x,state.vx
        assert(self.drive_dx > 150 and self.drive_speed > 100,"Buggy did not drive forward")
        emit(self,"phase",{name="brake"})
    elseif t == 300 then
        assert(self.last_command.brake_reverse==1 and self.last_command.throttle==0,"Brake did not win over throttle")
        emit(self,"phase",{name="brake_priority_confirmed"})
    elseif t == 360 then
        assert(math.abs(state.vx)<12,"Buggy did not brake: "..state.vx)
        for _,wheel in ipairs(self.vehicle.wheels) do
            assert(#b2d.body.get_contact_data(wheel)>0,"Wheel lost floor contact")
        end
        assert(math.abs(go.get_position("/camera").x-state.x)<12,"Camera did not follow buggy")
        local m=self.measurements_shown
        assert(m and m.fps>0 and m.physics_ms>=0 and m.contact1 and m.contact2,"Overlay did not display plausible live measurements")
        assert(math.abs(m.travel1)<30 and math.abs(m.travel2)<30,"Implausible spring travel")
        local observer=require "main.gym.telemetry"
        assert(observer.budget.fps_min==60 and observer.over(30,60,true) and observer.over(40,16.67) and not observer.over(1,nil),"Budget configuration/classification failed")
        self.drive_cases = {drive_dx=self.drive_dx,drive_speed=self.drive_speed,
            stopped_speed=state.vx,max_angle=self.max_angle,wheel_contact=true,camera_follow=true,brake_priority=true}
        if self.testcase=="a6" then
            self.feel_phase,self.feel_tick= "reverse",0
            self.reverse_start=state.x
            emit(self,"phase",{name="reverse_request"})
        elseif self.testcase=="a3" then
            self.reset_phase="await_manual"
            emit(self,"phase",{name="retry_held"})
        else
            emit(self,"suite_end",{status="PASS",cases=self.drive_cases})
            self.testcase = "done"
        end
    end
end
function M.reset(self)
    if self.reset_phase=="await_manual" and self.reset_count>0 then
        assert(self.reset_count==1 and self.last_reset_reason=="manual","Keyboard retry was not consumed before bounds recovery")
        emit(self,"phase",{name="retry_release"})
        assert(self.last_command.throttle==0 and self.last_command.brake_reverse==0,"Retry kept held command")
        self.reset_phase="stress"
    elseif self.reset_phase=="stress" then
        if self.reset_count<100 then
            if self.reset_count==49 then
                -- Explicit fault injection; only a3 test mode mutates this pose.
                self.check_reset_pose = false
                for _,body in ipairs({self.vehicle.chassis,self.vehicle.wheels[1],self.vehicle.wheels[2]}) do
                    local p=b2d.body.get_position(body)
                    local id=body==self.vehicle.chassis and self.vehicle.ids.chassis or nil
                    for i,wheel in ipairs(self.vehicle.wheels) do if body==wheel then id=self.vehicle.ids[i] end end
                    local visual=go.get_position(id)
                    go.set_position(vmath.vector3(p.x,p.y-800,visual.z),id)
                    b2d.body.set_transform(body,vmath.vector3(p.x,p.y-800,0),0)
                end
            else request_reset(self,"manual") end
        else
            assert(self.bounds_count==1,"Bounds recovery not exercised exactly once: "..self.bounds_count)
            self.reset_phase="settle"
            self.settle_tick=0
        end
    elseif self.reset_phase=="settle" then
        self.settle_tick=self.settle_tick+1
        assert(self.last_command.throttle==0,"Held throttle reactivated after retry")
        if self.settle_tick==120 then
            for _,body in ipairs({self.vehicle.chassis,self.vehicle.wheels[1],self.vehicle.wheels[2]}) do
                assert(not b2d.body.is_awake(body),"Re-drive must exercise a sleeping vehicle")
            end
            assert(math.abs(vehicle.state(self.vehicle).x)<2,"Reset drifted from spawn")
            self.redrive_x=vehicle.state(self.vehicle).x
            self.reset_phase="await_release"
            emit(self,"phase",{name="release_for_redrive"})
        end
    elseif self.reset_phase=="redrive" then
        self.redrive_tick=self.redrive_tick+1
        if self.redrive_tick==120 then
            local state=vehicle.state(self.vehicle)
            assert(state.x-self.redrive_x>150,"Fresh input did not drive after resets: "..json.encode({dx=state.x-self.redrive_x,y=state.y,vx=state.vx,command=self.last_command}))
            local cases=self.drive_cases
            table.sort(self.reset_ms)
            cases.resets=self.reset_count
            cases.bounds_recovery=self.bounds_count==1
            cases.input_cleared=true
            cases.redrive=true
            cases.asleep_before_redrive=true
            assert(self.world_loads==1,"Retry reloaded the world")
            assert(self.bounds_labelled,"Bounds recovery reason was not displayed")
            cases.no_collection_reload=self.world_loads==1
            cases.reason_visible=self.bounds_labelled
            cases.reset_ms_min=self.reset_ms[1]
            cases.reset_ms_p50=self.reset_ms[50]
            cases.reset_ms_max=self.reset_ms[100]
            cases.request_ready_ms_max=self.latency_ms
            emit(self,"suite_end",{status="PASS",cases=cases})
            self.testcase="done"
        end
    end
end
function M.input(self, action_id, action)
    if self.testcase=="a3" and self.reset_phase=="await_release" and action_id==hash("throttle_up") and action.released then
        self.reset_phase="await_press"
        emit(self,"phase",{name="redrive"})
    elseif self.testcase=="a3" and self.reset_phase=="await_press" and action_id==hash("throttle_up") and action.pressed then
        self.reset_phase="redrive"
        self.redrive_tick=0
    end
end
function M.check_pose(self, state)
        if self.check_reset_pose then
            assert(math.abs(state.x-vehicle.config.spawn_x)<0.1 and math.abs(state.y-vehicle.config.spawn_y)<2,"Retry pose was overwritten before the next tick")
            self.check_reset_pose=false
        end
end
function M.setup(self)
    if self.test then
        self.probe_id = factory.create("#probe", vmath.vector3(0, 350, 0))
        self.test_phase = "probe_init"
    end
end
function M.update_before(self)
    if self.test_phase == "probe_init" then
        self.probe = b2d.get_body(msg.url(nil, self.probe_id, "body"))
        if b2d.body.is_valid(self.probe) then self.test_phase = "drop" end
    end
end
function M.update_after(self)
    if self.test_phase == "camera" then
        assert(math.abs(go.get_position("/camera").x - 180) < 0.01, "Camera did not follow target")
        go.set_position(vmath.vector3(0, 180, 0), "/focus")
        self.test_phase = "done"
        emit(self, "suite_end", {status = "PASS", cases = {chain_contact = self.rest_y, camera_follow = true}})
    end
end
function M.probe_tick(self, dt)
    if not self.ready or self.test_phase ~= "drop" then return end
    self.tick = self.tick + 1
    assert(math.abs(dt - 1/60) < 0.00001, "Gym fixed timestep changed")
    if self.tick == 180 then
        local y = b2d.body.get_position(self.probe).y
        assert(math.abs(y - 95) < 2, "Chain did not support falling probe: " .. y)
        self.rest_y = y
        go.delete(self.probe_id)
        go.set_position(vmath.vector3(180, 180, 0), "/focus")
        self.test_phase = "camera"
    end
end
-- Controlled airborne probe is debug-only; no station/jump feature is added.
function M.feel_tick(self,dt)
    self.feel_tick=self.feel_tick+1
    local state=vehicle.state(self.vehicle)
    if self.feel_phase=="reverse" and self.feel_tick==150 then
        assert(state.vx < -50 and state.x<self.reverse_start-50,"Held brake did not transition to reverse")
        self.drive_cases.reverse_speed=state.vx
        self.drive_cases.reverse_dx=state.x-self.reverse_start
        vehicle.reset(self.vehicle)
        for i,body in ipairs({self.vehicle.chassis,self.vehicle.wheels[1],self.vehicle.wheels[2]}) do
            local p=b2d.body.get_position(body)
            local id=i==1 and self.vehicle.ids.chassis or self.vehicle.ids[i-1]
            go.set_position(vmath.vector3(p.x,p.y+400,go.get_position(id).z),id)
            b2d.body.set_transform(body,vmath.vector3(p.x,p.y+400,0),0)
        end
        self.held={}
        self.feel_phase,self.feel_tick="air",0
        emit(self,"phase",{name="air_lean"})
    elseif self.feel_phase=="air" then
        if self.last_command.lean~=0 then self.air_ticks=(self.air_ticks or 0)+1 end
        if self.air_ticks==30 then
            assert(#b2d.body.get_contact_data(self.vehicle.wheels[1])==0 and #b2d.body.get_contact_data(self.vehicle.wheels[2])==0,"Lean probe was not airborne")
            assert(state.angle>0.1,"Air lean did not rotate chassis")
            self.drive_cases.air_angle=state.angle
            local c=require "main.gym.feel"
            local right,zr=c.camera(vmath.vector3(0,170,0),350,vmath.vector3(0,250,500),1,1)
            local left,zl=c.camera(vmath.vector3(0,170,0),-350,vmath.vector3(0,250,500),1,1)
            assert(right.x>0 and left.x<0 and zr<1 and math.abs(zr-zl)<0.001,"Camera direction/zoom failed")
            assert(math.abs(go.get("/camera#camera","orthographic_zoom")-self.camera_zoom)<0.001,"Camera zoom was not applied")
            self.drive_cases.camera_direction_zoom=true
            emit(self,"suite_end",{status="PASS",cases=self.drive_cases})
            self.testcase,self.feel_phase="done",nil
        end
    end
end
local function head_pose(self)
    local v=self.vehicle
    vehicle.reset(v)
    for i,body in ipairs({v.chassis,v.wheels[1],v.wheels[2]}) do
        local p=b2d.body.get_position(body)
        local pos=vmath.vector3(-p.x,130-(p.y-vehicle.config.spawn_y),0)
        local id=i==1 and v.ids.chassis or v.ids[i-1]
        go.set_position(vmath.vector3(pos.x,pos.y,go.get_position(id).z),id)
        go.set_rotation(vmath.quat_rotation_z(math.pi),id)
        b2d.body.set_transform(body,pos,math.pi)
        b2d.body.set_gravity_scale(body,0)
    end
end
function M.crash_tick(self,dt)
    self.crash_tick=(self.crash_tick or 0)+1
    if self.crash_tick==60 then
        assert(not self.crash_enabled,"Crash reset must default off")
        head_pose(self)
        self.crash_phase="observe"
    elseif self.crash_phase=="observe" and self.head_seen and self.measurements_shown and self.measurements_shown.head_contact then
        assert(self.reset_count==0,"Disabled crash rule reset the vehicle")
        self.crash_phase="enable"
        emit(self,"phase",{name="enable_crash"})
    elseif self.crash_phase=="enable" and self.crash_enabled then
        -- The frozen overlap is still active; the normal owner may already
        -- have consumed its reset before this observer sees the key.
        self.crash_phase="reset"
    elseif self.crash_phase=="reset" and self.reset_count>0 then
        assert(self.reset_count==1 and self.last_reset_reason=="head","Enabled head contact did not use canonical reset")
        assert(b2d.shape.is_valid(self.vehicle.head) and #b2d.body.get_shapes(self.vehicle.chassis)==2,"Retry leaked/replaced head sensor")
        for _,body in ipairs({self.vehicle.chassis,self.vehicle.wheels[1],self.vehicle.wheels[2]}) do b2d.body.set_gravity_scale(body,1) end
        self.crash_phase="overlay"
        emit(self,"phase",{name="disable_crash_overlay"})
    elseif self.crash_phase=="overlay" and not self.crash_enabled and self.measurements_shown and not self.measurements_shown.crash_enabled then
        emit(self,"suite_end",{status="PASS",cases={head_detected=true,default_off=true,head_reset=true,sensor_retained=true,keyboard_toggle=true,overlay_toggle=true}})
        self.testcase="done"
    end
end
function M.slider_tick(self,dt)
    self.slider_tick=(self.slider_tick or 0)+1
    if self.slider_tick==60 then
        self.slider_phase="capture"
        emit(self,"phase",{name="slider_begin"})
    elseif self.slider_phase=="capture" and self.ui_captured then
        self.slider_phase="change"
        emit(self,"phase",{name="slider_move"})
    elseif self.slider_phase=="change" then
        assert(self.last_command.throttle==0 and self.last_command.brake_reverse==0,"Slider leaked driving commands")
        if self.last_tune and self.last_tune.key=="spring_hz" and self.last_tune.value>11.8 then
            assert(math.abs(b2d.joint.get_spring_hertz(self.vehicle.joints[1])-12)<0.2,"Spring change not applied live")
            assert(self.reset_count==0 and self.world_loads==1,"Tuning restarted the world")
            self.slider_phase="release"
            emit(self,"phase",{name="slider_release"})
        end
    elseif self.slider_phase=="release" and not self.ui_captured then
        assert(self.last_command.throttle==0,"Slider release retained held throttle")
        local feel=require "main.gym.feel"
        assert(not feel.set("spawn_x",1) and not feel.set("spring_hz",0),"Tuner accepted invalid parameter")
        emit(self,"suite_end",{status="PASS",cases={live_spring=true,no_restart=true,input_isolated=true,release_cleared=true,invalid_rejected=true}})
        self.testcase="done"
    end
end
function M.preset_tick(self,dt)
    self.preset_ticks=(self.preset_ticks or 0)+1
    if self.preset_ticks==60 then
        local expected=self.testcase=="a9invalid" and "a" or "b"
        assert(self.preset==expected and self.measurements_shown.preset==expected,"URL preset not applied/displayed")
        assert(self.invalid_preset==(self.testcase=="a9invalid"),"Invalid preset fallback not labelled")
        self.preset_order,self.preset_index={"a","b","c"},1
        self.preset_phase="select"
        emit(self,"phase",{name="select_preset",key="a"})
    elseif self.preset_phase=="select" and self.preset==self.preset_order[self.preset_index] and self.last_reset_reason=="preset" then
        self.preset_phase="drive";self.preset_drive_ticks=0
        self.preset_x=vehicle.state(self.vehicle).x
        emit(self,"phase",{name="preset_drive",key=self.preset})
    elseif self.preset_phase=="drive" then
        if self.last_command.throttle==1 then self.preset_drive_ticks=self.preset_drive_ticks+1 end
        if self.preset_drive_ticks==120 then
            local state=vehicle.state(self.vehicle)
            assert(state.x-self.preset_x>100 and math.abs(state.angle)<0.6,"Preset is not drivable")
            assert(math.abs(b2d.joint.get_spring_hertz(self.vehicle.joints[1])-vehicle.config.spring_hz)<0.001,"Preset did not replace spring")
            self.preset_index=self.preset_index+1
            if self.preset_index<=3 then
                self.preset_phase="select"
                emit(self,"phase",{name="select_preset",key=self.preset_order[self.preset_index]})
            else
                assert(self.reset_count==3 and self.world_loads==1,"Preset switch reloaded/leaked resets")
                emit(self,"suite_end",{status="PASS",cases={url_selected=true,invalid_fallback=self.testcase=="a9invalid",three_drivable=true,full_replacement=true,no_reload=true}})
                self.testcase="done"
            end
        end
    end
end
function M.fixed(self,dt)
    if self.vehicle and self.vehicle.ready then
        if self.testcase=="a2" or self.testcase=="a3" or self.testcase=="a6" then
            if self.feel_phase then M.feel_tick(self,dt) elseif self.reset_phase then M.reset(self) else M.drive(self) end
        elseif self.testcase=="a7" then M.crash_tick(self,dt)
        elseif self.testcase=="a8" then M.slider_tick(self,dt)
        elseif self.testcase=="a9" or self.testcase=="a9invalid" then M.preset_tick(self,dt) end
    end
    M.probe_tick(self,dt)
end
return M
