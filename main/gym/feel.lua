-- All gym driving/camera tuning. Geometry remains in the authored body resources.
local M = {}
M.values={spawn_x=0,spawn_y=170,wheel_x={-46,46},wheel_y=-30}
local allowed={a=true,b=true,c=true}
M.preset_keys={"spring_hz","damping","motor_speed","drive_torque","brake_torque","coast_torque","rolling_resistance","reverse_speed","reverse_threshold","reverse_delay","lean_torque","lean_rate_max","ground_lean_torque","ground_rate_max","camera_height","camera_lift","camera_response","camera_look_seconds","camera_look_max","camera_zoom","camera_zoom_min","camera_zoom_speed"}
function M.preset(requested)
    local valid=allowed[requested]==true
    local key=valid and requested or "a"
    local resource=assert(sys.load_resource("/main/gym/presets/"..key..".json"),"Missing preset")
    local data=json.decode(resource)
    assert(data.schema==1 and data.key==key and type(data.values)=="table","Invalid preset schema")
    local count=0
    for name,value in pairs(data.values) do
        assert(type(value)=="number" and value==value and math.abs(value)<100000,"Invalid preset number")
        count=count+1
    end
    assert(count==#M.preset_keys,"Unexpected preset fields")
    for _,name in ipairs(M.preset_keys) do
        assert(data.values[name]~=nil,"Missing preset tuning: "..name)
        M.values[name]=data.values[name]
    end
    return key,valid
end
M.preset("a")
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
    {key="motor_speed",label="Wheel target",min=8,max=140,sign=-1,unit="rad/s"},
    {key="drive_torque",label="Motor cap",min=500,max=5000,unit="binding u"},
    {key="lean_torque",label="Air lean",min=0,max=200,unit="N m"},
    {key="lean_rate_max",label="Air rate",min=1,max=16,unit="rad/s"},
    {key="ground_lean_torque",label="Ground lean",min=0,max=400,unit="N m"},
    {key="coast_torque",label="Coast cap",min=0,max=1500,unit="binding u"},
    {key="rolling_resistance",label="Rolling drag",min=0,max=0.5,unit="N m s"},
    {key="camera_response",label="Camera response",min=2,max=12,unit="1/s"},
    {key="camera_look_seconds",label="Look ahead",min=0,max=0.6,unit="s"}
}
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
