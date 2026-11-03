-- #479: render-only interpolation of the vehicle between its last two fixed-tick poses.
-- Defold owns the bodies and steps them in its fixed update (60 Hz). The physics game objects carry only the
-- collision objects; every sprite of the vehicle lives on a separate visual game object (chassis_view and
-- wheel*_view, with the rider and the struts as children of the visual chassis). This module writes ONLY those
-- visual game objects, in the owner's update(); it never writes a body, a physics game object (dynamic transforms
-- would copy that pose into the body before the next step), the fixed tick or a replay.
-- Pinned Defold 1.14.0 keeps the fixed-step remainder private (collection m_FixedAccumTime) and passes Lua only dt,
-- so the remainder is estimated here from this owner's own fixed-tick count against the update dt: the collection
-- runs floor((remainder + dt) / step) fixed steps, so every frame bounds the remainder; the estimate is the middle
-- of the bounds that every frame so far allows.
-- Interpolation runs only when the owner asks for it (player caps other than 60). Otherwise the visual game objects
-- get exactly the physics game objects' position and rotation every frame, so the drawn vehicle is unchanged.
-- Units: engine units and the step dt in (scaled) seconds; u is a fraction of one fixed step.
local M={}
-- A pose jump above this many engine units in one tick (3 m, 180 m/s) is a teleport (Retry, debug placements):
-- shown at once, never swept across the course.
M.SNAP=300
-- Float32 engine arithmetic against Lua doubles: bounds closer than this still count as consistent.
M.EPS=1e-6
function M.new()
    return {pending=0,step=false,h=false,lo=0,hi=0,ticks=0,shown=0,u=1,tracks={}}
end
-- Owner's fixed_update, first thing: one Defold fixed step of length dt runs in this frame.
function M.tick(p,dt)
    p.pending,p.ticks,p.step=p.pending+1,p.ticks+1,dt
end
-- Owner's update(dt), first thing: the fraction u (0..1) of the last fixed step to present.
-- The presented time ticks-1+u never goes backwards and stays inside the last step.
function M.frame(p,dt)
    local n=p.pending
    p.pending=0
    if p.step and p.step~=p.h then p.h,p.lo,p.hi=p.step,0,p.step end -- new step length (slow motion): phase unknown
    local h=p.h
    if not h or h<=0 then p.u=1;return 1 end
    local a,b=n*h,(n+1)*h
    local lo,hi=math.max(p.lo+dt,a),math.min(p.hi+dt,b)
    if lo>hi then
        if lo-hi<=M.EPS then lo=(lo+hi)/2;hi=lo else lo,hi=a,b end -- contradiction: keep only this frame's bound
    end
    p.lo,p.hi=math.max(0,lo-a),math.min(h,hi-a)
    local t=math.min(p.ticks,math.max(p.ticks-1+(p.lo+p.hi)/(2*h),p.shown,p.ticks-1))
    p.shown=t
    p.u=t-(p.ticks-1)
    return p.u
end
-- Pairs of (physics game object, visual game object); both root objects with scale 1.
function M.track(p,src,dst) p.tracks[#p.tracks+1]={src=src,dst=dst} end
-- Owner's fixed_update, last thing: the pose this tick's Defold step starts from (after any reset or teleport).
function M.capture(p)
    for _,t in ipairs(p.tracks) do t.p0,t.r0=go.get_position(t.src),go.get_rotation(t.src) end
end
-- A teleport outside the fixed tick (first attach): show the new pose at once.
function M.snap(p)
    for _,t in ipairs(p.tracks) do t.p0,t.r0=nil,nil end
end
-- Owner's update, before the camera, rider and struts read the visual chassis.
function M.show(p,on)
    local u=p.u
    for _,t in ipairs(p.tracks) do
        local pos,rot=go.get_position(t.src),go.get_rotation(t.src)
        if on and u<1 and t.p0 and vmath.length(pos-t.p0)<=M.SNAP then
            pos,rot=vmath.lerp(u,t.p0,pos),vmath.slerp(u,t.r0,rot)
        end
        go.set_position(pos,t.dst)
        go.set_rotation(rot,t.dst)
    end
end
return M
