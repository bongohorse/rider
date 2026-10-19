local data=require "main.gym.station_data"
local feel=require "main.gym.feel"
local ramps=require "main.gym.ramp_metrics"
local gaps=require "main.gym.gap_metrics"
local seams=require "main.gym.seam_metrics"
local steps=require "main.gym.step_metrics"
local custom=require "main.gym.custom"
local M={ids={"straight","ramps","ramps-long","steps","steps-down","seams-chain","seams-hull","gaps","gaps-landing"}}
if sys.get_config_string("rider.gym_test","")=="a15" and sys.get_engine_info().is_debug then
    M.ids={"straight","straight-test","invalid-test"}
end
-- Custom levels come from a loader-owned snapshot, never from a resource id lookup.
local function load_custom(snapshot,speed)
    local d=snapshot and custom.read(snapshot)
    if not d then return nil,"No custom level loaded. Import a level file [I]." end
    local valid,err=data.validate(d)
    if not valid then return nil,err end
    d.custom,d.snapshot=true,snapshot
    local message
    d.start_speed,message=data.speed(speed,d.start_speed)
    return d,message or ""
end
function M.load(id,speed,section,snapshot)
    if id=="custom" then return load_custom(snapshot,speed) end
    local found=false
    for _,key in ipairs(M.ids) do if id==key then found=true end end
    local note=not found and "Unknown station; using Straight" or ""
    id=found and id or "straight"
    local ok,d=pcall(function() return json.decode(assert(sys.load_resource("/main/gym/stations/"..id..".json"))) end)
    local valid,err
    if ok then valid,err=data.validate(d) else err="Unreadable station file" end
    if not valid or d.id~=id then return nil,err or "Station id mismatch" end
    local message
    if d.sections then
        local index=1
        if section and section~="" then
            index=nil
            for i,s in ipairs(d.sections) do if s.id==tostring(section) then index=i end end
            if not index then index=1;note=note.." Unknown section; using first" end
        end
        d.speed_override=speed and speed~="" and speed or nil
        M.select(d,index)
    end
    d.start_speed,message=data.speed(speed,d.start_speed)
    return d,message and (note~="" and note.."; "..message or message) or note
end
function M.select(d,index)
    local s=d.sections and d.sections[index]
    if not s then return false end
    d.section_index=index;d.spawn={s.spawn[1],s.spawn[2]}
    d.start_speed=data.speed(d.speed_override,s.start_speed)
    return true
end
function M.query()
    local id=sys.get_config_string("rider.station","straight")
    local speed=sys.get_config_string("rider.start_speed","")
    if html5 then
        id=html5.run("new URLSearchParams(location.search).get('station') || 'straight'")
        speed=html5.run("new URLSearchParams(location.search).get('speed') || ''")
    end
    local section=html5 and html5.run("new URLSearchParams(location.search).get('section') || ''") or sys.get_config_string("rider.section","")
    return id,speed,section
end
function M.initial()
    local id,speed,section=M.query()
    -- The loader restores the saved custom level and hands its snapshot over via configure_station.
    if id=="custom" then return nil,"Loading custom level..." end
    return M.load(id,speed,section)
end
-- Load-path check right before the vehicle is placed, independent of the validator (decisions after LE1b).
M.place_limit=data.START_LIMIT
function M.placeable(d)
    if not data.start_allowed(d.spawn,M.place_limit) then
        return nil,string.format("Start %.2f, %.2f m is outside the %g m start limit",d.spawn[1],d.spawn[2],M.place_limit)
    end
    return true
end
function M.configure(d)
    local scale=sys.get_config_number("physics.scale",0.01)
    feel.values.spawn_x,feel.values.spawn_y=d.spawn[1]/scale,d.spawn[2]/scale
end
function M.build(body,d)
    local scale=sys.get_config_number("physics.scale",0.01)
    local origin=b2d.body.get_position(body)
    local function p(v) return vmath.vector3(v[1]/scale-origin.x,v[2]/scale-origin.y,0) end
    b2d.body.destroy_shape(body,1) -- remove the known resource seed before creating shapes
    local chains,segments={},{}
    for _,line in ipairs(d.chains) do
        local vertices={}
        for _,v in ipairs(line) do vertices[#vertices+1]=p(v) end
        local first,last=vertices[1],vertices[#vertices]
        local chain,shapes=b2d.body.create_chain(body,{vertices=vertices,
            prev_vertex=first+(first-vertices[2]),next_vertex=last+(last-vertices[#vertices-1]),
            friction=0.8,restitution=0,enable_sensor_events=true,filter={category_bits=1,mask_bits=1,group_index=0}})
        chains[#chains+1]=chain
        for _,s in ipairs(shapes) do segments[#segments+1]=s end
    end
    for _,h in ipairs(d.hulls or {}) do
        local vertices={};for _,v in ipairs(h.vertices) do vertices[#vertices+1]=p(v) end
        local shape=b2d.body.create_shape(body,{type=b2d.shape.SHAPE_TYPE_POLYGON,vertices=vertices,friction=0.8,restitution=0,
            filter={category_bits=1,mask_bits=1,group_index=0}})
        b2d.shape.enable_sensor_events(shape.shape_id,true)
    end
    return chains,segments
end
function M.start(v,d)
    local section=d.sections and d.sections[d.section_index]
    local probe=section and section.stop_probe==true or false
    for _,joint in ipairs(v.joints) do
        if probe then b2d.joint.set_limits(joint,-20,18) end
        b2d.joint.enable_limit(joint,probe)
        assert(b2d.joint.is_limit_enabled(joint)==probe,"Station stop probe leaked")
    end
    local speed=d.start_speed/sys.get_config_number("physics.scale",0.01)
    b2d.body.set_linear_velocity(v.chassis,vmath.vector3(speed,0,0))
    for _,wheel in ipairs(v.wheels) do
        b2d.body.set_linear_velocity(wheel,vmath.vector3(speed,0,0))
        -- The authored wheel radius is 22 engine units (same geometry as wheel art).
        b2d.body.set_angular_velocity(wheel,-speed/22)
    end
end
function M.outside(d,s)
    local b=d.bounds;local scale=sys.get_config_number("physics.scale",0.01)
    return s.x*scale<b[1] or s.x*scale>b[2] or s.y*scale<b[3] or s.y*scale>b[4]
end
-- Normal sprites/labels render in release too; debug draw_line does not.
-- Returns the sprite and label objects this world created.
function M.decorate(d)
    local scale=sys.get_config_number("physics.scale",0.01)
    local sprites,labels=0,0
    local function stroke(a,b,width)
        sprites=sprites+1
        local dx,dy=(b[1]-a[1])/scale,(b[2]-a[2])/scale
        local id=factory.create("#line",vmath.vector3((a[1]+b[1])/2/scale,(a[2]+b[2])/2/scale,0),
            vmath.quat_rotation_z(math.atan2(dy,dx)),nil,vmath.vector3(math.sqrt(dx*dx+dy*dy)/4,width/4,1))
        go.set(msg.url(nil,id,"sprite"),"tint",vmath.vector4(0.45,0.85,0.75,1))
    end
    if d.id:match("^straight") and not d.custom then for x=-4096+128,8192-128,256 do factory.create("#checker",vmath.vector3(x,16,-1));sprites=sprites+1 end end
    for _,spec in ipairs(d.labels or {}) do
        labels=labels+1
        local id=factory.create("#marker",vmath.vector3(spec.position[1]/scale,spec.position[2]/scale,0))
        label.set_text(msg.url(nil,id,"label"),spec.text)
    end
    for _,chain in ipairs(d.chains) do
        for i=2,#chain do stroke(chain[i-1],chain[i],2) end
    end
    for _,h in ipairs(d.hulls or {}) do
        for i,p in ipairs(h.vertices) do stroke(p,h.vertices[i%#h.vertices+1],2) end
    end
    if d.markers then
        local m=d.markers
        for x=m.from_m,m.to_m,m.minor_m do
            local major=math.abs(x/m.major_m-math.floor(x/m.major_m+0.5))<0.001
            stroke({x,0.8},{x,major and 0.6 or 0.7},major and 2 or 1)
            if major then
                labels=labels+1
                local id=factory.create("#marker",vmath.vector3(x/scale,40,0))
                label.set_text(msg.url(nil,id,"label"),string.format("%g m",x))
            end
        end
    end
    return sprites,labels
end
function M.restart(self)
    if self.station.kind=="ramps" then ramps.restart(self)
    elseif self.station.kind=="steps" then steps.restart(self)
    elseif self.station.kind=="seams" then seams.restart(self)
    elseif self.station.kind=="gaps" then gaps.restart(self) end
    M.start(self.vehicle,self.station)
    self.start_probe=2
    self.station_top_speed,self.station_brake_distance=0,0
    self.station_brake_x,self.station_brake_stopped=nil,false
end
function M.observe(self,state,dt,sample)
    if self.station.kind=="ramps" then ramps.observe(self,state,dt,sample)
    elseif self.station.kind=="steps" then steps.observe(self,state,dt,sample)
    elseif self.station.kind=="seams" then seams.observe(self,state,dt,sample)
    elseif self.station.kind=="gaps" then gaps.observe(self,state,dt,sample) end
    if self.start_probe then
        self.start_probe=self.start_probe-1
        if self.start_probe==0 then
            self.first_tick_speed=feel.metres(state.vx)
            self.first_tick_omega=b2d.body.get_angular_velocity(self.vehicle.wheels[1])
            self.start_probe=nil
        end
    end
    self.station_top_speed=math.max(self.station_top_speed or 0,math.abs(feel.metres(state.vx)))
    if self.last_command and self.last_command.brake_reverse>0 then
        if not self.station_brake_x then
            self.station_brake_x,self.station_brake_stopped=state.x,false
            self.station_brake_distance=0
        end
        if not self.station_brake_stopped then
            self.station_brake_distance=math.abs(feel.metres(state.x-self.station_brake_x))
            self.station_brake_stopped=math.abs(feel.metres(state.vx))<0.1
        end
    else self.station_brake_x=nil end
end
function M.enrich(self,sample)
    sample.section_count=self.station.sections and #self.station.sections or 0
    sample.section_index=self.station.section_index or 0
    if self.station.kind=="ramps" then ramps.enrich(self,sample)
    elseif self.station.kind=="steps" then steps.enrich(self,sample)
    elseif self.station.kind=="seams" then seams.enrich(self,sample)
    elseif self.station.kind=="gaps" then gaps.enrich(self,sample)
    elseif html5 then html5.run("window.riderStationReport=null") end
    sample.station=self.station.id
    sample.custom=self.station.custom or false
    sample.snapshot=self.station.snapshot or ""
    sample.decor_sprites,sample.decor_labels=self.decor_sprites or 0,self.decor_labels or 0
    sample.custom_snapshots=custom.count()
    sample.station_name=(self.station.custom and "Custom: " or "")..self.station.name..(self.station.sections and " ["..self.station.sections[self.station.section_index].id.."]" or "")
    sample.station_note=self.station_note or ""
    sample.start_speed=self.station.start_speed
    sample.first_tick_speed=self.first_tick_speed or 0
    sample.first_tick_omega=self.first_tick_omega or 0
    sample.world_loads=self.world_loads or 1
    sample.session_generation=self.session_generation
    sample.terrain_shapes=#b2d.body.get_shapes(self.terrain)
    sample.station_top_speed=self.station_top_speed or 0
    sample.station_distance=feel.metres(b2d.body.get_position(self.vehicle.chassis).x)-self.station.spawn[1]
    sample.station_brake_distance=self.station_brake_distance or 0
    sample.station_brake_stopped=self.station_brake_stopped or false
end
return M
