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
    -- This is an HTML5 debug bridge, not a msg.post payload (2048-byte cap).
    -- Bound browser memory; runners copy full observations before the next page navigation.
    html5.run("(function(s){var a=window.riderCamera352Trace||(window.riderCamera352Trace=[]);a.push(s);if(a.length>480)a.shift();})("..json.encode(s)..")")
end
return M
