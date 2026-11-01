-- #356 Stage A: debug-only, read-only world callback/fixed-step observer.
-- This is NOT display FPS. Browser performance.now() at publish is a monotonic callback timestamp.
-- No sys.set_update_frequency here: the loader is the sole future rate-setting owner.
local socket=require "socket"
local M={}
local STEP=1/60
function M.new()
    return {updates=0,fixed=0,bad_fixed_dt=0,min_fixed_dt=math.huge,max_fixed_dt=0,
        min_update_dt=math.huge,max_update_dt=0,published=0,last_publish=0}
end
function M.fixed(p,dt)
    p.fixed=p.fixed+1
    p.min_fixed_dt=math.min(p.min_fixed_dt,dt)
    p.max_fixed_dt=math.max(p.max_fixed_dt,dt)
    if math.abs(dt-STEP)>1e-4 then p.bad_fixed_dt=p.bad_fixed_dt+1 end
end
function M.update(p,self,dt)
    p.updates=p.updates+1
    p.min_update_dt=math.min(p.min_update_dt,dt)
    p.max_update_dt=math.max(p.max_update_dt,dt)
    local now=socket.gettime() -- scheduling only; elapsed measurement uses browser performance.now()
    if now-p.last_publish<0.25 then return end
    p.last_publish=now
    p.published=p.published+1
    local s={kind="world_update_callback_proxy",presented_frames="UNKNOWN",
        source_sha=sys.get_config_string("rider.source_sha","development"),
        run_id=self.run_id,sequence=p.published,
        updates=p.updates,fixed=p.fixed,fixed_ticks=self.fixed_ticks,
        fixed_dt_min=p.fixed>0 and p.min_fixed_dt or false,
        fixed_dt_max=p.fixed>0 and p.max_fixed_dt or false,
        bad_fixed_dt=p.bad_fixed_dt,
        update_dt_min=p.min_update_dt,update_dt_max=p.max_update_dt,
        world_s=self.world_time,paused=self.paused,time_factor=self.time_factor,
        scaled_ticks=self.time_scaled_ticks,reset_count=self.reset_count,
        generation=self.session_generation,station=self.station and self.station.id or false,
        vehicle_ready=self.vehicle and self.vehicle.ready or false}
    -- performance.now() is monotonic browser time. This is a callback timestamp, NOT a presented frame.
    html5.run("window.riderFps356World="..json.encode(s)..";window.riderFps356World.monotonic_ms=performance.now()")
end
return M
