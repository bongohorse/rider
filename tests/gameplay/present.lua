-- #479: render interpolation (main/game/present.lua). The fixed-step remainder is estimated from the owner's own
-- tick count against the update dt, fed here by a model of pinned Defold's collection fixed step
-- (gameobject.cpp: n = floor((remainder + dt) / step), remainder -= n * step). Checks: the estimate converges to
-- the true remainder, the presented time never goes backwards and stays inside the last step, irregular stepping
-- (0/1/2 steps per frame) becomes an even presentation, pause holds, a step-length change recovers; show() copies
-- the physics transform exactly when off, interpolates when on, and shows teleports and snaps at once.
local present=require 'main.game.present'
local H=1/60

-- Deterministic jitter (no math.random: the same sequence on every run).
local seed=12345
local function rnd() seed=(seed*1103515245+12345)%2147483648;return seed/2147483648 end

-- Engine model: returns the number of fixed steps of one frame and the true remainder after it.
local function engine(remainder) return {e=remainder} end
local function step(m,dt,h)
    local t=m.e+dt
    local n=math.floor(t/h)
    m.e=t-n*h
    return n
end
local function run(p,m,dt,h)
    local n=step(m,dt,h)
    for _=1,n do present.tick(p,h) end
    return n,present.frame(p,dt)
end

-- 1. Exactly one step per frame (cap 60 cadence): the estimate stays put, u is constant, time advances one tick.
do
    local p,m=present.new(),engine(0.3*H)
    local last
    for i=1,200 do
        local n,u=run(p,m,H,H)
        assert(n==1 and u>=0 and u<=1)
        if i>1 then assert(math.abs((p.ticks-1+u)-last-1)<1e-9,'one tick per frame') end
        last=p.ticks-1+u
    end
end

-- 2. 120 Hz frames (0/1 steps alternating): the presentation advances half a tick every frame.
do
    local p,m=present.new(),engine(0.1*H)
    local last
    for i=1,400 do
        local _,u=run(p,m,H/2,H)
        local t=p.ticks-1+u
        if i>4 then assert(math.abs(t-last-0.5)<1e-6,'uneven 120 Hz presentation at frame '..i..': '..(t-last)) end
        last=t
    end
end

-- 3. 60 Hz frames with jitter around a remainder near the step boundary: raw stepping is 0/1/2 ticks per frame,
-- the presented time follows the true time (ticks - 1 + remainder/step) and is far more even than the raw ticks.
do
    local p,m=present.new(),engine(0.02*H)
    local raw,shown,ideal,last_raw,last_shown,irregular,worst={},{},{},nil,nil,0,0
    for i=1,3000 do
        local dt=H+(rnd()-0.5)*0.004 -- +-2 ms
        local n,u=run(p,m,dt,H)
        if n~=1 then irregular=irregular+1 end
        local t=p.ticks-1+u
        assert(u>=0 and u<=1,'u outside the last step')
        if last_shown then assert(t>=last_shown,'presented time went backwards at frame '..i) end
        if i>600 then
            worst=math.max(worst,math.abs(t-(p.ticks-1+m.e/H)))
            raw[#raw+1]=p.ticks-last_raw;shown[#shown+1]=t-last_shown;ideal[#ideal+1]=dt/H
        end
        last_raw,last_shown=p.ticks,t
    end
    local function variance(a) local s,q=0,0;for _,x in ipairs(a) do s=s+x;q=q+x*x end;local mean=s/#a;return q/#a-mean*mean end
    assert(irregular>100,'the jitter model must produce irregular stepping: '..irregular)
    assert(worst<0.02,'estimate does not follow the true remainder: '..worst)
    -- The presented step follows the frame's own dt (its jitter is all that is left), the raw step is 0/1/2 ticks.
    assert(variance(shown)<=variance(ideal)*1.2+1e-6,'presentation less even than dt: '..variance(shown)..' vs '..variance(ideal))
    assert(variance(shown)<variance(raw)/5,'presentation not smoother: '..variance(shown)..' vs '..variance(raw))
    print(string.format('jitter: %d irregular frames, step variance (ticks^2) raw %.4f, presented %.5f, dt/step %.5f, worst phase error %.4f ticks',
        irregular,variance(raw),variance(shown),variance(ideal),worst))
end

-- 4. Pause (dt 0, no steps) holds the presentation; 30 Hz frames (two steps) advance two ticks.
do
    local p,m=present.new(),engine(0.5*H)
    for _=1,50 do run(p,m,2*H,H) end
    local u0,t0=p.u,p.ticks
    for _=1,10 do assert(select(2,run(p,m,0,H))==u0) end
    assert(p.ticks==t0)
    local _,u=run(p,m,2*H,H)
    assert(math.abs(p.ticks-1+u-(t0-1+u0)-2)<1e-9,'30 Hz frame did not advance two ticks')
end

-- 5. A step-length change (slow motion 0.5) restarts the estimate and stays consistent (no error, u in range).
do
    local p,m=present.new(),engine(0.4*H)
    for _=1,100 do run(p,m,H*(1+(rnd()-0.5)*0.1),H) end
    local last=p.ticks-1+p.u
    for _=1,200 do
        local _,u=run(p,m,H/2*(1+(rnd()-0.5)*0.1),H/2)
        assert(u>=0 and u<=1)
        assert(p.ticks-1+u>=last);last=p.ticks-1+u
    end
end

-- 6. No fixed tick yet: show the current pose.
assert(present.frame(present.new(),H)==1)

-- show(): a minimal go/vmath model (positions and rotations as plain tables, 2D angles as quaternions about z).
local objects={}
local V={};V.__index=V
local function v3(x,y,z) return setmetatable({x=x,y=y,z=z},V) end
V.__sub=function(a,b) return v3(a.x-b.x,a.y-b.y,a.z-b.z) end
local function quat(a) return {x=0,y=0,z=math.sin(a/2),w=math.cos(a/2)} end
vmath={length=function(v) return math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z) end,
    lerp=function(t,a,b) return v3(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t) end,
    slerp=function(t,a,b) local x=2*math.atan2(a.z,a.w);local y=2*math.atan2(b.z,b.w);return quat(x+(y-x)*t) end}
go={get_position=function(id) return objects[id].p end,get_rotation=function(id) return objects[id].r end,
    set_position=function(p,id) objects[id].p=p end,set_rotation=function(r,id) objects[id].r=r end}
objects.body={p=v3(100,50,1),r=quat(0.2)};objects.view={p=v3(0,0,0),r=quat(0)}
local p=present.new()
present.track(p,'body','view')
present.tick(p,H);present.capture(p) -- start pose of the step
objects.body.p,objects.body.r=v3(110,52,1),quat(0.3) -- Defold's step moved the physics game object
p.u=0.25
present.show(p,false)
assert(objects.view.p==objects.body.p and objects.view.r==objects.body.r,'off: not exactly the physics transform')
present.show(p,true)
assert(math.abs(objects.view.p.x-102.5)<1e-9 and math.abs(objects.view.p.y-50.5)<1e-9 and objects.view.p.z==1,'on: not interpolated')
assert(math.abs(2*math.atan2(objects.view.r.z,objects.view.r.w)-0.225)<1e-9,'on: rotation not interpolated')
p.u=1;present.show(p,true)
assert(objects.view.p==objects.body.p,'u=1: not exactly the physics transform')
p.u=0.5;objects.body.p=v3(110+present.SNAP+1,52,1);present.show(p,true)
assert(objects.view.p==objects.body.p,'teleport swept across the course')
objects.body.p=v3(111,52,1);present.snap(p);present.show(p,true)
assert(objects.view.p==objects.body.p,'snap did not show the new pose')
print('PASS present: remainder estimate, monotonic even presentation (60/120/jittered/30 Hz, pause, slow motion), exact off copy, interpolation, teleport and snap')
