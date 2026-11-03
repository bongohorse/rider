-- #479 (interp479): debug HTML5-only scripted drive and read-only presentation probe for render interpolation.
-- Drive: one command per fixed tick, chosen only from the tick count since the last reset (full throttle for
-- THROTTLE_TICKS, then brake without reverse), never from live input, so runs at different caps get the same command
-- on every tick. It is one more command source in the owner's fixed_update (a replay still goes first).
-- Probe: per fixed tick, the completed physics state of the three bodies (read before this tick's command, like the
-- #352 trace); per render frame, after the owner placed the visual vehicle and the camera, the physics and the
-- presented (visual) transforms and the camera. Never writes a body, a game object, a message or a save.
-- Browser-side buffers are bounded; the runner copies and clears them per measurement window.
local M={}
M.THROTTLE_TICKS=240
local BUFFER=4000
function M.new()
    local d={gen=false,tick=0,trace_gen=false,trace_tick=0,frames=0,on_frames=0,off_frames=0,off_exact=0,off_inexact=0}
    function d.command(self) return M.command(d,self) end
    function d.fixed(self,state) return M.fixed(d,self,state) end
    function d.frame(self,dt,on) return M.frame(d,self,dt,on) end
    return d
end
function M.command(d,self)
    if d.gen~=self.generation then d.gen,d.tick=self.generation,0 end
    d.tick=d.tick+1
    if d.tick<=M.THROTTLE_TICKS then return {throttle=1,brake_reverse=0,lean=0,allow_reverse=false} end
    return {throttle=0,brake_reverse=1,lean=0,allow_reverse=false}
end
function M.fixed(d,self,state)
    if d.trace_gen~=self.generation then d.trace_gen,d.trace_tick=self.generation,0 end
    d.trace_tick=d.trace_tick+1
    local v=self.vehicle
    local s={gen=self.generation,tick=d.trace_tick,engine_tick=self.fixed_ticks,x=state.x,y=state.y,a=state.angle,vx=state.vx,
        vy=b2d.body.get_linear_velocity(v.chassis).y,w=b2d.body.get_angular_velocity(v.chassis)}
    for i,key in ipairs({"r","f"}) do
        local p=b2d.body.get_position(v.wheels[i])
        s[key.."x"],s[key.."y"],s[key.."a"],s[key.."w"]=p.x,p.y,b2d.body.get_angle(v.wheels[i]),b2d.body.get_angular_velocity(v.wheels[i])
    end
    html5.run("(function(s){var a=window.riderInterp479Ticks||(window.riderInterp479Ticks=[]);a.push(s);if(a.length>"..BUFFER..")a.shift();})("..json.encode(s)..")")
end
local function same(a,b) return a.x==b.x and a.y==b.y and a.z==b.z end
local function same_quat(a,b) return a.x==b.x and a.y==b.y and a.z==b.z and a.w==b.w end
function M.frame(d,self,dt,on)
    local v=self.vehicle
    -- Exact (bit-for-bit float) identity of every presented transform with its physics game object.
    local exact=true
    local links={{v.ids.chassis,v.view.chassis},{v.ids[1],v.view[1]},{v.ids[2],v.view[2]}}
    for _,q in ipairs(links) do
        if not (same(go.get_position(q[1]),go.get_position(q[2])) and same_quat(go.get_rotation(q[1]),go.get_rotation(q[2]))
            and same(go.get_scale(q[1]),go.get_scale(q[2]))) then exact=false end
    end
    d.frames=d.frames+1
    if on then d.on_frames=d.on_frames+1 else
        d.off_frames=d.off_frames+1
        if exact then d.off_exact=d.off_exact+1 else d.off_inexact=d.off_inexact+1 end
    end
    local p,q,c=go.get_position(v.ids.chassis),go.get_position(v.view.chassis),go.get_position("/camera")
    -- The reset tick sampled its state before the reset: the first frame of a new generation has run no tick of it.
    local tick=d.trace_gen==self.generation and d.trace_tick or 0
    local s={gen=self.generation,tick=tick,engine_tick=self.fixed_ticks,dt=dt,u=self.present.u,on=on,exact=exact,
        px=p.x,py=p.y,qx=q.x,qy=q.y,cx=c.x,cy=c.y,
        gx=self.replay.ghost and go.get_position(self.replay.ghost[1]).x or false}
    html5.run("(function(s){var a=window.riderInterp479Frames||(window.riderInterp479Frames=[]);a.push(s);if(a.length>"..BUFFER..")a.shift();})("..json.encode(s)..")")
    html5.run("window.riderInterp479="..json.encode({cap=self.fps_cap or false,on=on,gen=self.generation,tick=tick,frames=d.frames,
        on_frames=d.on_frames,off_frames=d.off_frames,off_exact=d.off_exact,off_inexact=d.off_inexact,
        source_sha=sys.get_config_string("rider.source_sha","development")}))
end
return M
