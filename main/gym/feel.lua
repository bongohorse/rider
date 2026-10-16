-- All gym driving/camera tuning. Geometry remains in the authored body resources.
local M = {}
M.values = {
    spawn_x=0,spawn_y=170,wheel_x={-46,46},wheel_y=-30,
    spring_hz=5,damping=0.8,motor_speed=-16,drive_torque=1800,brake_torque=3000,
    reverse_speed=8,reverse_threshold=8,reverse_delay=0.25,
    lean_torque=12,lean_rate_max=3,
    camera_height=250,camera_lift=70,camera_response=6,
    camera_look_seconds=0.22,camera_look_max=130,camera_zoom=1,camera_zoom_min=0.82,
    camera_zoom_speed=650
}
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
    {key="motor_speed",label="Wheel target",min=8,max=36,sign=-1,unit="rad/s"},
    {key="drive_torque",label="Motor cap",min=500,max=5000,unit="binding u"},
    {key="lean_torque",label="Air lean",min=0,max=40,unit="N m"},
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
