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
        if self.testcase=="a10" then assert(not self.audio_started,"Engine autoplayed before input") end
        self.start_x = state.x
        emit(self,"phase",{name="throttle"})
    elseif t == 240 then
        if self.testcase=="a10" then
            local audio=require "main.gym.audio"
            assert(self.audio_started and self.audio_starts==1 and self.audio_pitch>audio.idle_pitch+0.2,"Wheel pitch did not rise after input")
            assert(math.abs(go.get("#engine","speed")-self.audio_pitch)<0.001,"Audio playback property not updated")
            self.measured_audio_pitch=self.audio_pitch
        end
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
        if self.testcase=="a10" then
            self.drive_cases.audio_once=self.audio_starts==1
            self.drive_cases.audio_pitch=self.measured_audio_pitch
            self.drive_cases.no_autoplay=true
        end
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
            local v3,f=vmath.vector3,c.follow
            local s=c.camera_start(0,90,0,0)
            local right,zr=c.camera(s,v3(0,46,0),v3(350,0,0),true,v3(0,250,500),1,270,1)
            -- Dual forward focus: rolling back 0.2 m keeps the look-ahead side, more than 1 m switches it.
            c.camera(s,v3(0,46,0),v3(-100,0,0),true,v3(0,250,500),1,270,0.2)
            assert(s.dir==1,"Camera look-ahead switched on a short roll back")
            local left,zl=c.camera(s,v3(0,46,0),v3(-350,0,0),true,v3(0,250,500),1,270,1)
            assert(right.x>0 and left.x<0 and zr<1 and math.abs(zr-zl)<0.001,"Camera direction/zoom failed")
            -- At a steady 6 m/s the view settles the full look-ahead in front of the chassis (the smoothing lag is led).
            local run,cam,tx=c.camera_start(0,90,0,0),v3(0,250,500),0
            for _=1,180 do tx=tx+600/60;cam=c.camera(run,v3(tx,46,0),v3(600,0,0),true,cam,1,270,1/60,480) end
            assert(math.abs(cam.x-tx-c.values.camera_look_max*f.look_scale)<5,"Camera look-ahead lags at speed")
            -- A deep fall stays inside the safe view; landing 20 m lower realigns to the start framing.
            local fall=c.camera_start(0,90,0,0)
            local pos=c.camera(fall,v3(0,-2000,0),v3(0,-1500,0),false,v3(0,250,500),1,270,1/60)
            assert(pos.y-(-2000)<=270-f.margin_bottom+1e-3,"Camera lost a falling chassis")
            for _=1,600 do pos=c.camera(fall,v3(0,-1954,0),v3(0,0,0),true,pos,1,270,1/60) end
            assert(not fall.snapping and math.abs(pos.y-(-1954+c.values.camera_height-f.rest))<f.snap_done,"Camera did not realign after landing")
            self.drive_cases.camera_follow_window=true
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
-- Runtime refusal rules on copies of A (#199): range, sign, missing/extra key, non-finite.
local function preset_rules(feel)
    local base=assert(feel.load("a"),"Preset A must validate")
    local function variant(name,value)
        local values={}
        for k,v in pairs(base.values) do values[k]=v end
        values[name]=value
        return {schema=1,key="a",values=values}
    end
    assert(feel.validate(variant("spring_hz",base.values.spring_hz),"a")==nil,"Unchanged A copy refused")
    for _,case in ipairs({{"spring_hz",13},{"motor_speed",32},{"coast_torque",nil},{"unknown_key",1},{"damping",0/0},{"brake_torque",7000}}) do
        assert(feel.validate(variant(case[1],case[2]),"a"),"Invalid preset accepted: "..case[1])
    end
    assert(feel.validate(variant("spring_hz",5),"b"),"Preset key/file mismatch accepted")
    -- #211: the optional air_pitch_damping may be absent (A) or inside 0..20 N m s; anything else is refused.
    assert(base.values.air_pitch_damping==nil and feel.validate(variant("air_pitch_damping",8),"a")==nil,"Optional air damping not optional")
    for _,value in ipairs({-1,21,0/0}) do
        assert(feel.validate(variant("air_pitch_damping",value),"a"),"Invalid air damping accepted: "..tostring(value))
    end
    -- A file with a very long unknown key: its refusal reason is long; the stubbed D file returns it.
    local long=variant("\1"..string.rep("k",600),1)
    return assert(feel.validate(long,"a"))
end
function M.preset_tick(self,dt)
    local feel=require "main.gym.feel"
    self.preset_ticks=(self.preset_ticks or 0)+1
    if self.preset_ticks==60 and self.world_loads==2 then
        local m=self.measurements_shown
        assert(self.preset=="a" and string.find(self.preset_refused or "","^D refused: ") and string.find(m.preset_note or "","D refused",1,true)
            and string.find(m.report_preset or "","D refused",1,true),"Refusal lost on station switch: "..tostring(m.preset_note))
        emit(self,"phase",{name="screenshot",file="preset-refused-switch.png"})
        emit(self,"suite_end",{status="PASS",cases={url_selected=true,invalid_fallback=self.testcase=="a9invalid",all_drivable=true,full_replacement=true,no_reload=true,refused_visible=true}})
        self.testcase="done"
    elseif self.preset_ticks==60 then
        local expected=self.testcase=="a9invalid" and "a" or "b"
        assert(self.preset==expected and self.measurements_shown.preset==expected,"URL preset not applied/displayed")
        assert(self.invalid_preset==(self.testcase=="a9invalid"),"Invalid preset fallback not labelled")
        self.preset_long_reason=preset_rules(feel)
        -- Every registered preset, in registry order (#199; was a fixed A/B/C list).
        self.preset_order,self.preset_index=feel.order,1
        self.preset_phase="select"
        emit(self,"phase",{name="select_preset",key="a"})
    elseif self.preset_phase=="select" and self.preset==self.preset_order[self.preset_index] and self.last_reset_reason=="preset" then
        self.preset_phase="drive";self.preset_drive_ticks=0
        self.preset_x=vehicle.state(self.vehicle).x
        -- #211: an absent optional key applies its default (0), also after a preset that set it; the reset
        -- tick (this one: the preset reset ran before vehicle.apply) never damps.
        local k=feel.load(self.preset).values.air_pitch_damping or 0
        assert(feel.values.air_pitch_damping==k and not self.vehicle.damped,"Air damping not replaced by preset "..self.preset)
        -- The replay identity covers the optional key: a D recording replayed on F is COMPARED, never MATCH.
        self.preset_identity=self.preset_identity or {}
        self.preset_identity[self.preset]=require("main.gym.replay").identity()
        if self.preset=="f" then
            assert(self.preset_identity.d and self.preset_identity.d~=self.preset_identity.f,"D and F share a replay identity")
        end
        emit(self,"phase",{name="preset_drive",key=self.preset})
    elseif self.preset_phase=="drive" then
        if self.last_command.throttle==1 then self.preset_drive_ticks=self.preset_drive_ticks+1 end
        if self.preset_drive_ticks==120 then
            local state=vehicle.state(self.vehicle)
            assert(state.x-self.preset_x>100 and math.abs(state.angle)<0.6,"Preset is not drivable")
            assert(math.abs(b2d.joint.get_spring_hertz(self.vehicle.joints[1])-vehicle.config.spring_hz)<0.001,"Preset did not replace spring")
            assert(not self.invalid_preset and not self.preset_refused,"Registered preset refused")
            assert(feel.values.air_pitch_damping>0 or self.vehicle.damped_ticks==0,"Air damping applied without the preset key")
            assert(self.preset~="a" or self.vehicle.damped_ticks==0,"Air damping applied on preset A")
            self.preset_index=self.preset_index+1
            if self.preset_index<=#self.preset_order then
                self.preset_phase="select"
                emit(self,"phase",{name="select_preset",key=self.preset_order[self.preset_index]})
            else
                assert(self.reset_count==#self.preset_order and self.world_loads==1,"Preset switch reloaded/leaked resets")
                -- A refused file falls back to A visibly: stub D's file for one selection only (debug probe).
                assert(sys.get_engine_info().is_debug,"Refusal probe requires debug engine")
                self.preset_load=feel.load
                local reason=self.preset_long_reason
                feel.load=function(key) if key=="d" then return nil,reason end return self.preset_load(key) end
                self.preset_phase,self.preset_drive_ticks="refuse",0
                emit(self,"phase",{name="select_refused",key="d"})
            end
        end
    elseif self.preset_phase=="refuse" and self.preset_refused and self.last_reset_reason=="preset" then
        feel.load,self.preset_load=self.preset_load,nil
        -- Long reasons are cut to 60 printable bytes: the note rides in every measurement sample (2048-byte cap).
        assert(#self.preset_long_reason>600 and #self.preset_refused==#"D refused: "+60 and string.find(self.preset_refused,"^D refused: unknown key %?kkk"),"Refusal note not bounded: "..#self.preset_refused)
        assert(self.preset=="a" and self.invalid_preset and feel.values.motor_speed==feel.load("a").values.motor_speed,"Refused preset did not fall back to A")
        self.preset_phase,self.preset_drive_ticks="refused",0
    elseif self.preset_phase=="refused" then
        self.preset_drive_ticks=self.preset_drive_ticks+1
        local m=self.measurements_shown
        if self.preset_drive_ticks==30 then
            -- HUD note and the copied report both name the refusal.
            assert(m.preset=="a" and string.find(m.preset_note or "","D refused",1,true) and string.find(m.report_preset or "","D refused",1,true),
                "Refusal not shown: "..tostring(m.preset_note).." | "..tostring(m.report_preset))
            emit(self,"phase",{name="screenshot",file="preset-refused.png"})
        elseif self.preset_drive_ticks==90 then
            -- The refusal must survive a world reload (station switch); the new world finishes the case.
            msg.post("main:/loader#script","select_station",{id="straight",preset=self.preset})
            self.preset_phase="switching"
        end
    end
end
function M.feedback_tick(self,dt)
    self.feedback_ticks=(self.feedback_ticks or 0)+1
    if self.feedback_ticks==60 then
        assert(self.measurements_shown,"Feedback needs real measurements")
        emit(self,"phase",{name="copy_feedback"})
    elseif self.feedback_visible and self.feedback_status=="Select text to copy" then
        emit(self,"suite_end",{status="PASS",cases={report_requested=true,visible_failure=true}})
        self.testcase="done"
    end
end
function M.graph_tick(self,dt)
    local history=require "main.gym.history"
    self.graph_ticks=(self.graph_ticks or 0)+1
    if self.graph_ticks==120 then
        self.history=history.new(self.history.generation+1)
        self.graph_peaks,self.graph_seen_peak={},0
        -- Focused test-only physical stop probe before the M4 step station.
        for i,joint in ipairs(self.vehicle.joints) do
            b2d.joint.set_limits(joint,-20,18)
            b2d.joint.enable_limit(joint,true)
            b2d.joint.wake_bodies(joint)
            assert(math.abs(b2d.joint.get_upper_limit(joint)-18)<0.001,"Probe stop not applied")
            b2d.body.set_linear_velocity(self.vehicle.wheels[i],vmath.vector3(0,1000,0))
        end
    elseif self.graph_ticks==180 then
        local series=history.series(self.history)
        local peak=math.max(series[2].positive_peak,series[3].positive_peak)
        assert(peak>=16 and peak<=20,"Controlled stop did not create a bounded compression spike: "..peak)
        assert((self.graph_seen_peak or 0)>=16,"Compression spike was not drawn/acknowledged")
        self.bottom_peak=peak
        emit(self,"phase",{name="graph_spike"})
        for _,joint in ipairs(self.vehicle.joints) do b2d.joint.enable_limit(joint,false) end
    elseif self.graph_ticks==480 then
        local series=history.series(self.history)
        assert(self.reset_count==0 and self.world_loads==1,"History expiry was replaced by reset/reload")
        for _,joint in ipairs(self.vehicle.joints) do assert(not b2d.joint.is_limit_enabled(joint),"Probe limits not restored") end
        assert(self.history.size<=history.capacity and series[1].count<=301,"History exceeded five-second bound")
        assert(series[1].oldest_age<=5.00001,"History retained stale samples")
        assert(math.max(series[2].peak,series[3].peak)<12,"Old stop spike did not expire")
        assert(math.max(self.graph_peaks[2] or 100,self.graph_peaks[3] or 100)<12,"GUI kept expired spike")
        emit(self,"suite_end",{status="PASS",cases={bottoming_peak=self.bottom_peak,spike_drawn=true,bounded=true,expired=true,limits_restored=true,no_reset=true,
            samples=series[1].count,oldest_age=series[1].oldest_age}})
        self.testcase="done"
    end
end
-- Flat-ground input probe only; ramps and human air-control acceptance stay M4.
function M.feedback_feel_tick(self,dt)
    local feel=require "main.gym.feel"
    self.feedback_feel_ticks=(self.feedback_feel_ticks or 0)+1
    local state=vehicle.state(self.vehicle)
    if not self.ground_phase and self.feedback_feel_ticks==60 then
        assert(#b2d.body.get_contact_data(self.vehicle.wheels[1])>0 and #b2d.body.get_contact_data(self.vehicle.wheels[2])>0,"Ground lean must start on both wheels")
        assert(feel.set("motor_speed",-140) and not feel.set("motor_speed",-141),"Expanded speed range invalid")
        assert(feel.set("lean_torque",200) and feel.set("lean_rate_max",16) and feel.set("ground_lean_torque",400),"New lean controls unavailable")
        feel.preset("a")
        local a=feel.load("a").values
        assert(feel.values.motor_speed==a.motor_speed and feel.values.lean_rate_max==a.lean_rate_max and feel.values.ground_lean_torque==a.ground_lean_torque,"Preset did not restore expanded tuning")
        assert(feel.set("ground_lean_torque",0),"Cannot disable ground assistance")
        self.ground_phase,self.ground_ticks="disabled",0
        emit(self,"phase",{name="ground_left"})
    elseif self.ground_phase=="disabled" then
        if self.last_command.lean==1 then self.ground_ticks=self.ground_ticks+1 end
        if self.ground_ticks==24 then
            assert(math.abs(state.angle)<0.01,"Zero ground torque still pitched chassis")
            assert(feel.set("ground_lean_torque",120),"Cannot enable ground assistance")
            self.ground_phase,self.ground_ticks="left",0
        end
    elseif self.ground_phase=="left" or self.ground_phase=="right" then
        local sign=self.ground_phase=="left" and 1 or -1
        if self.last_command.lean==sign then self.ground_ticks=self.ground_ticks+1 end
        if self.ground_ticks==24 then
            assert(state.angle*sign>0.03,"Ground lean did not produce signed pitch: "..state.angle)
            if sign==1 then self.ground_left=state.angle else self.ground_right=state.angle end
            self.ground_phase=sign==1 and "reset_left" or "reset_right"
            emit(self,"phase",{name="ground_release"})
            request_reset(self,"manual")
            self.ground_ticks=0
        end
    elseif self.ground_phase=="select_fast" and self.preset=="c" and self.last_reset_reason=="preset" then
        self.ground_phase,self.ground_ticks="fast",0
        emit(self,"phase",{name="preset_drive",key="c"})
    elseif self.ground_phase=="fast" then
        if self.last_command.throttle==1 then self.ground_ticks=self.ground_ticks+1 end
        if self.ground_ticks==180 then
            assert(state.vx>800 and math.abs(state.angle)<0.6,"Fast candidate did not exceed old maximum while upright: "..state.vx)
            assert(self.reset_count==3 and self.world_loads==1,"Fast candidate reset/reload mismatch")
            emit(self,"suite_end",{status="PASS",cases={ground_left=self.ground_left,ground_right=self.ground_right,reset_neutral=true,no_reload=true,expanded_controls=true,ground_disabled=true,fast_speed_mps=feel.metres(state.vx)}})
            self.testcase="done"
        end
    elseif self.ground_phase=="reset_left" or self.ground_phase=="reset_right" then
        self.ground_ticks=self.ground_ticks+1
        if self.ground_ticks==60 then
            assert(self.last_command.lean==0 and math.abs(state.angle)<0.01,"Ground lean survived reset")
            if self.ground_phase=="reset_left" then
                assert(#b2d.body.get_contact_data(self.vehicle.wheels[1])>0 and #b2d.body.get_contact_data(self.vehicle.wheels[2])>0,"Right lean did not start grounded")
                self.ground_phase,self.ground_ticks="right",0
                emit(self,"phase",{name="ground_right"})
            else
                assert(self.reset_count==2 and self.world_loads==1,"Ground probe reset/reload mismatch")
                self.ground_phase="select_fast"
                emit(self,"phase",{name="select_preset",key="c"})
            end
        end
    end
end
-- Real owner integration: settle, seed a physically consistent 5 m/s roll,
-- then observe normal neutral commands. Also cover a short real brake input.
function M.coast_tick(self,dt)
    local v=self.vehicle
    local state=vehicle.state(v)
    self.coast_ticks=(self.coast_ticks or 0)+1
    if not self.coast_phase and self.coast_ticks>=90 then
        for _,body in ipairs({v.chassis,v.wheels[1],v.wheels[2]}) do
            b2d.body.set_linear_velocity(body,vmath.vector3(500,0,0))
        end
        for _,wheel in ipairs(v.wheels) do b2d.body.set_angular_velocity(wheel,-500/22) end
        self.coast_phase,self.coast_ticks,self.coast_x,self.coast_last="roll",0,state.x,500
    elseif self.coast_phase=="roll" or self.coast_phase=="tap_roll" then
        assert(self.last_command.throttle==0 and self.last_command.brake_reverse==0,"Coast command not neutral")
        -- Solver contact jitter below 0.01 m/s is not renewed acceleration.
        assert(state.vx<=self.coast_last+1,"Coast accelerated: "..state.vx.." after "..self.coast_last)
        self.coast_last=state.vx
        if state.vx<10 then
            local distance=(state.x-self.coast_x)*0.01
            if self.coast_phase=="roll" then
                assert(distance>=6 and distance<=15,"Coast distance outside declared 6–15 m: "..distance)
                self.coast_distance=distance
                self.coast_phase,self.coast_ticks="tap_setup",0
            else
                self.coast_phase,self.coast_ticks="rest",0
            end
        end
        assert(self.coast_ticks<1200,"Never stopped coasting")
    elseif self.coast_phase=="tap_setup" then
        for _,body in ipairs({v.chassis,v.wheels[1],v.wheels[2]}) do b2d.body.set_linear_velocity(body,vmath.vector3(500,0,0)) end
        for _,wheel in ipairs(v.wheels) do b2d.body.set_angular_velocity(wheel,-500/22) end
        self.coast_phase,self.coast_ticks="tap",0
        emit(self,"phase",{name="coast_brake"})
    elseif self.coast_phase=="tap" and self.last_command.brake_reverse==1 then
        self.coast_braked=(self.coast_braked or 0)+1
        if self.coast_braked==6 then emit(self,"phase",{name="coast_release"}) end
    elseif self.coast_phase=="rest" then
        assert(math.abs(state.vx)<10,"Rolling resumed after brake tap")
        if self.coast_ticks>=120 then
            emit(self,"suite_end",{status="PASS",cases={coast_distance_m=self.coast_distance,brake_tap_stopped=true,rest_speed_mps=math.abs(state.vx)*0.01}})
            self.testcase="done"
        end
    end
    if self.coast_phase=="tap" and self.coast_braked and self.coast_braked>=6 and self.last_command.brake_reverse==0 then
        self.coast_phase,self.coast_ticks,self.coast_x,self.coast_last="tap_roll",0,state.x,state.vx
    end
end
function M.hud_tick(self,dt)
    self.hud_ticks=(self.hud_ticks or 0)+1
    if self.hud_ticks<60 then return end
    local cases={{55,0.3,0.9,0.6},{54,1,0.65,0.2},{30,1,0.65,0.2},{29,1,0.25,0.25}}
    self.hud_index=self.hud_index or 1
    local result=self.hud_probe_result
    if result then
        local c=cases[self.hud_index]
        assert(math.abs(result.fps-c[1])<0.001 and math.abs(result.r-c[2])<0.001 and math.abs(result.g-c[3])<0.001 and math.abs(result.b-c[4])<0.001,"FPS badge colour threshold wrong")
        self.hud_index=self.hud_index+1;self.hud_probe_result=nil;self.hud_waiting=false
    end
    if self.hud_index>#cases then
        emit(self,"suite_end",{status="PASS",cases={fps_green_55=true,fps_orange_54=true,fps_orange_30=true,fps_red_29=true}})
        self.testcase="done"
    elseif not self.hud_waiting then
        self.hud_waiting=true
        msg.post("main:/loader#ui","hud_probe",{frame_ms=1000/cases[self.hud_index][1]})
    end
end
-- A15a: visual rider reaction is bounded, readable and returns to rest;
-- the physics vehicle and head sensor are unchanged by it.
function M.reaction_tick(self,dt)
    local v,c=self.vehicle,require("main.gym.feel").rider
    local r=v.reaction
    self.rx_tick=(self.rx_tick or 0)+1
    local t=self.rx_tick
    assert(math.abs(r.angle)<=c.max_angle+1e-9 and math.abs(r.x)<=c.max_x+1e-9 and math.abs(r.y)<=c.max_y+1e-9,"Rider visual exceeded its limits")
    local function at_rest() return math.abs(r.angle)<0.005 and math.abs(r.x)<0.3 and math.abs(r.y)<0.3 end
    if t==60 then
        assert(at_rest(),"Rider not at rest before input")
        self.rx_mass,self.rx_shapes=b2d.body.get_mass(v.chassis),#b2d.body.get_shapes(v.chassis)
        emit(self,"phase",{name="throttle"})
    elseif t>60 and t<=150 then
        self.rx_back=math.max(self.rx_back or 0,r.angle)
        if t==90 then emit(self,"phase",{name="screenshot",file="rider-throttle.png"}) end
        if t==150 then emit(self,"phase",{name="brake"}) end
    elseif t>150 and t<=230 then
        self.rx_forward=math.min(self.rx_forward or 0,r.angle)
        if t==160 then emit(self,"phase",{name="screenshot",file="rider-brake.png"}) end
        if t==230 then emit(self,"phase",{name="release_drive"}) end
    elseif t==320 then
        -- Drop the resting buggy 1.5 m; body and GO poses move together.
        for i,body in ipairs({v.chassis,v.wheels[1],v.wheels[2]}) do
            local p=b2d.body.get_position(body)
            local id=i==1 and v.ids.chassis or v.ids[i-1]
            local pos=vmath.vector3(p.x,p.y+150,0)
            go.set_position(vmath.vector3(pos.x,pos.y,go.get_position(id).z),id)
            b2d.body.set_transform(body,pos,b2d.body.get_angle(body))
            b2d.body.set_linear_velocity(body,vmath.vector3())
            b2d.body.set_awake(body,true)
        end
    elseif t>320 and t<620 then
        self.rx_squash=math.min(self.rx_squash or 0,r.y)
        if r.y<-3 and not self.rx_shot then self.rx_shot=true;emit(self,"phase",{name="screenshot",file="rider-landing.png"}) end
    elseif t==620 then
        assert(at_rest(),"Rider did not return to rest: "..r.angle.." "..r.x.." "..r.y)
        assert(b2d.shape.is_valid(v.head) and b2d.shape.is_sensor(v.head),"Head sensor changed")
        assert(#b2d.body.get_shapes(v.chassis)==self.rx_shapes and math.abs(b2d.body.get_mass(v.chassis)-self.rx_mass)<1e-6,"Visual changed vehicle physics")
        assert(self.rx_back>=0.05,"No visible lean back on throttle: "..self.rx_back)
        assert(self.rx_forward<=-0.05,"No visible lean forward on brake: "..self.rx_forward)
        assert(self.rx_squash<=-2,"No visible landing squash: "..self.rx_squash)
        emit(self,"suite_end",{status="PASS",cases={lean_back=self.rx_back,lean_forward=self.rx_forward,landing_squash=self.rx_squash,
            bounded=true,rest=true,physics_unchanged=true}})
        self.testcase="done"
    end
end
function M.fixed(self,dt)
    if self.vehicle and self.vehicle.ready then
        if self.testcase=="a2" or self.testcase=="a3" or self.testcase=="a6" or self.testcase=="a10" then
            if self.feel_phase then M.feel_tick(self,dt) elseif self.reset_phase then M.reset(self) else M.drive(self) end
        elseif self.testcase=="a7" then M.crash_tick(self,dt)
        elseif self.testcase=="a8" then M.slider_tick(self,dt)
        elseif self.testcase=="a9" or self.testcase=="a9invalid" then M.preset_tick(self,dt)
        elseif self.testcase=="a11" then M.feedback_tick(self,dt)
        elseif self.testcase=="a12" then M.graph_tick(self,dt)
        elseif self.testcase=="hud" then M.hud_tick(self,dt)
        elseif self.testcase=="coast" then M.coast_tick(self,dt)
        elseif self.testcase=="a15a" then M.reaction_tick(self,dt)
        elseif self.testcase=="m2feedback" then M.feedback_feel_tick(self,dt) end
    end
    M.probe_tick(self,dt)
end
return M
