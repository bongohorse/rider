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
        emit(self,"phase",{name="release_throttle"})
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
        if self.testcase=="a3" then
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
return M
