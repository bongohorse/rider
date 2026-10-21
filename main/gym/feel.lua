-- All gym driving/camera tuning. Geometry remains in the authored body resources.
local M = {}
M.values={spawn_x=0,spawn_y=170,wheel_x={-46,46},wheel_y=-30}
-- Preset registry (#199): the only list of selectable presets, in P-cycle and chip order.
-- A is the measurement baseline; B and C predate the rotation cap (#114); D, E and F are candidates.
M.order={"a","b","c","d","e","f"}
M.preset_keys={"spring_hz","damping","motor_speed","drive_torque","brake_torque","coast_torque","rolling_resistance","reverse_speed","reverse_threshold","reverse_delay","lean_torque","lean_rate_max","ground_lean_torque","ground_rate_max","camera_height","camera_lift","camera_response","camera_look_seconds","camera_look_max","camera_zoom","camera_zoom_min","camera_zoom_speed","air_pitch_damping"}
-- Optional preset keys and their defaults (#211): a file may omit them, so A/B/C stay byte-identical and
-- behave as before. Every other key in preset_keys is required.
M.optional={air_pitch_damping=0}
-- Explicit ranges for preset keys without a slider; slider keys use their slider range and sign.
-- Units: binding u (joint caps), engine units, engine units/s, s, rad/s, zoom factor, N m s.
M.ranges={
    brake_torque={min=500,max=6000},
    reverse_speed={min=1,max=20},
    reverse_threshold={min=1,max=50},
    reverse_delay={min=0,max=1},
    ground_rate_max={min=0.5,max=8},
    camera_height={min=0,max=1000},
    camera_lift={min=0,max=300},
    camera_look_max={min=0,max=400},
    camera_zoom={min=0.5,max=2},
    camera_zoom_min={min=0.5,max=2},
    camera_zoom_speed={min=100,max=2000},
    -- N m s: airborne chassis torque -k*omega while no lean is held (#211); 0 = off.
    air_pitch_damping={min=0,max=20}
}
function M.range(name)
    for _,spec in ipairs(M.sliders) do if spec.key==name then return spec end end
    return M.ranges[name]
end
function M.index(key)
    for i,k in ipairs(M.order) do if k==key then return i end end
end
function M.next(key) return M.order[(M.index(key) or 0)%#M.order+1] end
-- Returns nil for a valid preset, otherwise the reason it is refused.
function M.validate(data,key)
    if type(data)~="table" or data.schema~=1 or data.key~=key or type(data.values)~="table" then return "invalid schema" end
    local count=0
    for name,value in pairs(data.values) do
        local spec=M.range(name)
        if not spec then return "unknown key "..tostring(name) end
        if type(value)~="number" or value~=value or math.abs(value)==math.huge then return "non-finite "..name end
        local display=value*(spec.sign or 1)
        if display<spec.min or display>spec.max then return string.format("%s %.4g outside %s%g..%g",name,value,spec.sign and "-" or "",spec.min,spec.max) end
        count=count+1
    end
    local present=0
    for _,name in ipairs(M.preset_keys) do
        if data.values[name]~=nil then present=present+1
        elseif M.optional[name]==nil then return "missing "..name end
    end
    if count~=present then return "unexpected fields" end
    if data.values.camera_zoom_min>data.values.camera_zoom then return "camera_zoom_min above camera_zoom" end
end
-- Module field so the debug a9 probe can stub one refused file; nothing else replaces it.
function M.load(key)
    local resource=sys.load_resource("/main/gym/presets/"..key..".json")
    if not resource then return nil,"missing file" end
    local ok,data=pcall(json.decode,resource)
    if not ok then return nil,"invalid JSON" end
    local reason=M.validate(data,key)
    if reason then return nil,reason end
    return data
end
-- Unknown keys and refused files fall back to A; values are replaced only after full validation.
-- Returns the applied key, whether the request was honoured, and the refusal note (or nil).
function M.preset(requested)
    local valid=M.index(requested)~=nil
    local key=valid and requested or "a"
    local data,reason=M.load(key)
    if not data then
        -- The note travels in every measurement sample (2048-byte message cap): printable ASCII, at most 60 bytes.
        local refused=string.upper(key).." refused: "..string.sub((string.gsub(tostring(reason),"[^%w%p ]","?")),1,60)
        print("Preset "..refused)
        assert(key~="a","Preset "..refused)
        M.preset("a")
        return "a",false,refused
    end
    for _,name in ipairs(M.preset_keys) do
        local value=data.values[name]
        if value==nil then value=M.optional[name] end
        M.values[name]=value
    end
    return key,valid,nil
end
-- Visual-only rider reaction (A15a); not a preset key, never touches physics.
-- Offsets in engine units, angles in rad, gains per m/s of chassis velocity change.
M.rider={hz=3,damping=0.55,max_x=5,max_y=8,max_angle=0.25,
    gain_x=40,gain_y=30,gain_angle=12,gain_spin=0.15,air_lean_angle=0.12}
-- Body torque is raw Box2D N m; joint motor caps are scaled binding inputs.
-- Keep these distinct. Gameplay lengths/linear speed stay in engine units.
function M.motor_torque(binding_units) return binding_units end
function M.body_torque(newton_metres) return newton_metres end
function M.metres(engine_units) return engine_units*sys.get_config_number("physics.scale",0.01) end
function M.clamp(v,lo,hi) return math.max(lo,math.min(hi,v)) end
-- Render-only velocity look-ahead. Horizontal dual focus retains short-roll-back hysteresis;
-- the vertical ground window suppresses suspension motion, yielding to signed vertical speed.
-- Engine units throughout. Rotation never enters the follow calculation.
M.follow={
    rest=46,           -- chassis centre above flat ground at rest (wheel radius 22 + anchor 30 - sag)
    snap_window=40,    -- grounded height changes within this (springs, small bumps) keep the view still
    snap_done=3,       -- a realignment ends this close to the new framing
    focus_switch=60,   -- travel against the look-ahead side before it switches sides (0.6 m)
    look_scale=2,      -- the look-ahead is this times the preset's look time and maximum (0.44 s, 2.6 m on A)
    look_rate=3,       -- 1/s: a growing look-ahead and a side switch ease in at this rate (shrinking follows the speed)
    speed_rate=8,      -- 1/s: the horizontal speed for look-ahead and lag is smoothed at this rate
    margin_side=120,   -- the chassis centre never gets closer to the view's left or right edge
    vertical_deadband=20, -- ignore suspension/standstill speeds below 0.2 m/s
    vertical_full=200, -- at 2 m/s the ground framing fully yields to movement direction
    sink_rate=3,       -- 1/s: delay brief vertical impulses before they move the framing
    vertical_response_scale=0.6, -- vertical pans ease more slowly than horizontal follow
    settle_speed=20,   -- a realignment ends only below this vertical speed (u/s)
    margin_bottom=100,  -- the chassis centre never gets closer to the view's bottom edge (wheels stay in view)
    margin_top=100     -- nor to its top edge
}
-- Reserve the ground window inside the safe frame, so bumps cannot repeatedly hit an edge clamp.
local function camera_frame(half)
    local frame=M.values.camera_height-M.follow.rest
    if half then frame=math.min(frame,math.max(half-M.follow.margin_bottom-M.follow.snap_window,0)) end
    return frame
end
-- Look-ahead length (u) for a smoothed speed vx on side dir.
local function look_ahead(vx,dir)
    local c,f=M.values,M.follow
    return math.min(math.max(vx*dir,0)*c.camera_look_seconds*f.look_scale,c.camera_look_max*f.look_scale)
end
-- Follow state for a start at (x, y) above the ground surface ground_y (nil: the 0.9 m start clearance of the
-- stations) with start speed speed (u/s); returns the state and the camera position, so a start already shows
-- the view it settles on, looking ahead (inside the hard edges of a view of half height half, so a high drop
-- start does not jump a frame later).
function M.camera_start(x,y,ground_y,speed,half)
    local f=M.follow
    local dir=speed<0 and -1 or 1
    local s={dir=dir,against=0,ground=(ground_y or y-90)+f.rest,snapping=false,vy=0,vx=speed,look=dir*look_ahead(speed,dir)}
    local cy=s.ground+camera_frame(half)
    if half then cy=M.clamp(cy,y-math.max(half-f.margin_top,half*0.3),y+math.max(half-f.margin_bottom,half*0.3)) end
    return s,vmath.vector3(x+s.look,cy,500)
end
-- s: state from camera_start (updated in place); velocity: chassis velocity; grounded: a wheel or the chassis
-- touches something; half, half_x: the view's current half height and width (nil skips the edge limits).
function M.camera(s,target,velocity,grounded,position,zoom,half,dt,half_x)
    local c,f=M.values,M.follow
    -- Dual forward focus: the look-ahead keeps its side until the chassis has travelled focus_switch against
    -- it, so a short roll back does not swing the view. The smoothed speed sets how far it looks. The signed
    -- look-ahead eases in when it grows or changes side, so speeding up and turning round pan smoothly and
    -- never towards the old side; when it shrinks (braking) it follows the speed, so a stopped buggy is centred.
    if velocity.x*s.dir<0 then s.against=s.against-velocity.x*s.dir*dt else s.against=0 end
    if s.against>f.focus_switch then s.dir,s.against=-s.dir,0 end
    s.vx=s.vx+(velocity.x-s.vx)*(1-math.exp(-f.speed_rate*dt))
    local look=s.dir*look_ahead(s.vx,s.dir)
    local rate=(look*s.look>=0 and math.abs(look)<math.abs(s.look)) and f.speed_rate or f.look_rate
    s.look=s.look+(look-s.look)*(1-math.exp(-rate*dt))
    -- The smoothing lags a moving chassis by speed / camera_response; leading by that lag keeps the
    -- look-ahead in front of the chassis instead of eating it up at speed.
    local x=target.x+s.look+s.vx/c.camera_response
    -- Platform snapping: a grounded chassis further than snap_window from the snapped height starts a
    -- realignment that tracks the ground (long climbs and descents, a landing elsewhere) until it settles.
    if grounded and math.abs(target.y-s.ground)>f.snap_window then s.snapping=true end
    if grounded and s.snapping then s.ground=target.y end
    local frame=camera_frame(half)
    local vertical_response=c.camera_response*f.vertical_response_scale
    -- Keep the calm ground window at rest. Both climbing and falling override that framing
    -- progressively: a fixed upward lift must not cancel the downward look-ahead on a slope.
    s.vy=s.vy+(velocity.y-s.vy)*(1-math.exp(-f.sink_rate*dt))
    local speed=math.max(math.abs(s.vy)-f.vertical_deadband,0)
    local weight=M.clamp(speed/(f.vertical_full-f.vertical_deadband),0,1)
    weight=weight*weight*(3-2*weight)
    local look_y=(s.vy<0 and -1 or 1)*look_ahead(speed,1)
    local lift=math.min(c.camera_lift,frame-f.snap_window)
    local window=math.max(s.ground+frame,target.y+lift)
    if not grounded then window=math.min(window,target.y+frame+f.snap_window) end
    local y=window+(target.y-window)*weight+look_y+s.vy/vertical_response*weight
    -- Hard edges (a narrow view, the smoothing lag): the chassis never leaves the safe part of the view.
    local function inside(v)
        if not half then return v end
        return M.clamp(v,target.y-math.max(half-f.margin_top,half*0.3),target.y+math.max(half-f.margin_bottom,half*0.3))
    end
    local function inside_x(v)
        if not half_x then return v end
        local room=math.max(half_x-f.margin_side,half_x*0.3)
        return M.clamp(v,target.x-room,target.x+room)
    end
    local alpha=1-math.exp(-c.camera_response*dt)
    -- Clamp the final position on both axes: clamping the target would consume the lag compensation.
    local pos=position+(vmath.vector3(x,y,500)-position)*alpha
    pos.y=position.y+(y-position.y)*(1-math.exp(-vertical_response*dt))
    pos.x,pos.y=inside_x(pos.x),inside(pos.y)
    -- A realignment ends once the chassis has come to rest vertically and the view has settled on it.
    if s.snapping and grounded and math.abs(s.vy)<f.settle_speed and math.abs(pos.y-inside(s.ground+frame))<f.snap_done then s.snapping=false end
    local wanted=c.camera_zoom-(c.camera_zoom-c.camera_zoom_min)*M.clamp(math.abs(velocity.x)/c.camera_zoom_speed,0,1)
    return pos,zoom+(wanted-zoom)*alpha
end
M.sliders={
    {key="spring_hz",label="Spring",min=1,max=12,unit="Hz"},
    {key="damping",label="Damping",min=0.2,max=1.8,unit="ratio"},
    {key="motor_speed",label="Speed",min=8,max=140,sign=-1,unit="rad/s"},
    {key="drive_torque",label="Motor",min=500,max=5000,unit="binding u"},
    {key="lean_torque",label="Air lean",min=0,max=200,unit="N m"},
    {key="lean_rate_max",label="Air rate",min=1,max=16,unit="rad/s"},
    {key="ground_lean_torque",label="Ground",min=0,max=400,unit="N m"},
    {key="coast_torque",label="Coast",min=0,max=1500,unit="binding u"},
    {key="rolling_resistance",label="Rolling",min=0,max=0.5,unit="N m s"},
    {key="camera_response",label="Camera",min=2,max=12,unit="1/s"},
    {key="camera_look_seconds",label="Look",min=0,max=0.6,unit="s"}
}
M.preset("a")
function M.set(key,value)
    if type(value)~="number" or value~=value then return false end
    for _,spec in ipairs(M.sliders) do
        if spec.key==key then
            local display=value*(spec.sign or 1)
            if display<spec.min or display>spec.max then return false end
            M.values[key]=value
            return true
        end
    end
    return false
end
function M.snapshot()
    local result={}
    for _,spec in ipairs(M.sliders) do result[spec.key]=M.values[spec.key] end
    return result
end
return M
