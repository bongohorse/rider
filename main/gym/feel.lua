-- All gym driving/camera tuning. Geometry remains in the authored body resources.
local M = {}
M.values={spawn_x=0,spawn_y=170,wheel_x={-46,46},wheel_y=-30}
-- Preset registry (#199): the only list of selectable presets, in P-cycle and chip order.
-- A is the measurement baseline; B and C predate the rotation cap (#114); D and E are candidates.
M.order={"a","b","c","d","e"}
M.preset_keys={"spring_hz","damping","motor_speed","drive_torque","brake_torque","coast_torque","rolling_resistance","reverse_speed","reverse_threshold","reverse_delay","lean_torque","lean_rate_max","ground_lean_torque","ground_rate_max","camera_height","camera_lift","camera_response","camera_look_seconds","camera_look_max","camera_zoom","camera_zoom_min","camera_zoom_speed"}
-- Explicit ranges for preset keys without a slider; slider keys use their slider range and sign.
-- Units: binding u (joint caps), engine units, engine units/s, s, rad/s, zoom factor.
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
    camera_zoom_speed={min=100,max=2000}
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
    for _,name in ipairs(M.preset_keys) do
        if data.values[name]==nil then return "missing "..name end
    end
    if count~=#M.preset_keys then return "unexpected fields" end
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
        local refused=string.upper(key).." refused: "..reason
        print("Preset "..refused)
        assert(key~="a","Preset "..refused)
        M.preset("a")
        return "a",false,refused
    end
    for _,name in ipairs(M.preset_keys) do M.values[name]=data.values[name] end
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
function M.camera(target,velocity,position,zoom,dt)
    local c=M.values
    local look=M.clamp(velocity*c.camera_look_seconds,-c.camera_look_max,c.camera_look_max)
    local desired=vmath.vector3(target.x+look,math.max(c.camera_height,target.y+c.camera_lift),500)
    local alpha=1-math.exp(-c.camera_response*dt)
    local wanted=c.camera_zoom-(c.camera_zoom-c.camera_zoom_min)*M.clamp(math.abs(velocity)/c.camera_zoom_speed,0,1)
    return position+(desired-position)*alpha,zoom+(wanted-zoom)*alpha
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
