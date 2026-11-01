-- #352: debug HTML5-only readout of the actual render camera and completed fixed-owner body state.
-- Never writes physics bodies, messages, tuning, game save data or production telemetry.
local M={}
local contacts=require "main.gym.seam_metrics"
function M.sample(self,target,velocity,position,projection,dt)
    assert(sys.get_engine_info().is_debug and html5,"camera352 requires debug HTML5")
    assert(projection and projection.m00>0 and projection.m11>0,"camera352: missing live orthographic projection")
    local scale=sys.get_config_number("physics.scale",0.01)
    assert(math.abs(scale-0.01)<1e-7,"camera352: unexpected physics scale")
    local section=self.station.sections and self.station.sections[self.station.section_index]
    local follow=self.camera_follow
    local s={
        source_sha=sys.get_config_string("rider.source_sha","development"),
        mode=self.camera352_mode,station=self.station.id,section=section and section.id or "",
        frame=(self.camera352_frames or 0)+1,tick=self.fixed_ticks,sim_time=self.world_time,
        generation=self.generation,resets=self.reset_count,dt=dt,
        x=target.x,y=target.y,vx=velocity.x,vy=velocity.y,
        cx=position.x,cy=position.y,zoom=self.camera_zoom,
        m00=projection.m00,m11=projection.m11,scale=scale,
        ground=follow.ground,filtered_vy=follow.vy,descent=follow.descent or 0,
        snapping=follow.snapping,dir=follow.dir,
        rear=contacts.supported(self.vehicle.wheels[1]),
        front=contacts.supported(self.vehicle.wheels[2])
    }
    self.camera352_frames=s.frame
    -- #352 CI failure triage: the straight B control has a strict 5-u descent
    -- guard, but its failed artifact only contains final state. Preserve the
    -- FIRST offending frame and its preceding render history in the already
    -- captured riderReady failure-state object. Diagnostic only; no camera,
    -- physics, telemetry, or test threshold changes.
    if self.station.id=="straight" and self.camera352_mode=="b" then
        local history=self.camera352_flat_history or {}
        history[#history+1]={
            frame=s.frame,tick=s.tick,x=s.x,y=s.y,vx=s.vx,vy=s.vy,
            rear=s.rear,front=s.front,ground=s.ground,
            filtered_vy=s.filtered_vy,descent=s.descent,
            snapping=s.snapping,dir=s.dir
        }
        if #history>12 then table.remove(history,1) end
        self.camera352_flat_history=history
        if s.descent>=5 and not self.camera352_flat_reported then
            self.camera352_flat_reported=true
            local report={source_sha=s.source_sha,mode=s.mode,station=s.station,
                first_crossing_frame=s.frame,first_crossing_tick=s.tick,
                threshold_u=5,history=history}
            -- The existing a16 catch captures riderReady verbatim on failure.
            html5.run("(function(v){if(window.riderReady)window.riderReady.camera352_flat_peak=v;})("..json.encode(report)..")")
            print("CAMERA352_FLAT_PEAK "..json.encode(report))
        end
    end
    -- This is an HTML5 debug bridge, not a msg.post payload (2048-byte cap).
    -- Bound browser memory; runners copy full observations before the next page navigation.
    html5.run("(function(s){var a=window.riderCamera352Trace||(window.riderCamera352Trace=[]);a.push(s);if(a.length>480)a.shift();})("..json.encode(s)..")")
end
-- Read-only completed-state observation once per Defold-owned fixed_update. Render
-- frames may skip fixed ticks; physics identity must not depend on render cadence.
function M.fixed(self,state,dt)
    assert(sys.get_engine_info().is_debug and html5,"camera352 fixed trace requires debug HTML5")
    local velocity=b2d.body.get_linear_velocity(self.vehicle.chassis)
    local section=self.station.sections and self.station.sections[self.station.section_index]
    local sample={
        source_sha=sys.get_config_string("rider.source_sha","development"),
        mode=self.camera352_mode,station=self.station.id,section=section and section.id or "",
        tick=self.fixed_ticks,resets=self.reset_count,generation=self.generation,dt=dt,
        x=state.x,y=state.y,vx=velocity.x,vy=velocity.y,
        rear=contacts.supported(self.vehicle.wheels[1]),
        front=contacts.supported(self.vehicle.wheels[2])
    }
    html5.run("(function(s){var a=window.riderCamera352PhysicsTrace||(window.riderCamera352PhysicsTrace=[]);a.push(s);if(a.length>480)a.shift();})("..json.encode(sample)..")")
end
return M
