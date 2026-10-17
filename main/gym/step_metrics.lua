-- Read-only completed-step observations; no tuning, limits or reset requests.
local feel=require "main.gym.feel"
local M={}
function M.restart(self)
    self.step_tuning={}
    for _,key in ipairs(feel.preset_keys) do self.step_tuning[key]=feel.values[key] end
    local selected=self.station.sections[self.station.section_index]
    local parts={self.station.id,tostring(self.station.start_speed),tostring(selected.stop_probe==true)}
    for _,key in ipairs(feel.preset_keys) do parts[#parts+1]=key.."="..tostring(feel.values[key]) end
    local identity=table.concat(parts,";")
    if identity~=self.step_identity then self.step_archive={} end
    self.step_identity=identity
    self.steps={records={}}
    for i,s in ipairs(self.station.sections) do
        self.steps.records[i]={id=s.id,mode=s.mode,height_m=s.height,status="NOT RUN",elapsed=0,
            compression_m=0,compression_left_m=0,compression_right_m=0,chassis_contact=false,underbody_contact=false,
            stop_probe=s.stop_probe==true,bottomed=false,
            start_speed=self.station.start_speed,independent=i==self.station.section_index}
    end
end
local function contacts(self)
    local chassis,underbody=false,false
    for _,c in ipairs(b2d.body.get_contact_data(self.vehicle.chassis)) do
        for _,p in ipairs(c.points) do
            if p.normal_impulse>0 or p.total_normal_impulse>0 then
                chassis=true
                -- Chassis box underside is -14 u; allow the rounded contact skin.
                local v=b2d.body.get_local_point(self.vehicle.chassis,p.point)
                if v.y<=-13 then underbody=true end
            end
        end
    end
    return chassis,underbody
end
function M.observe(self,state,dt,sample)
    for _,key in ipairs(feel.preset_keys) do
        if self.step_tuning[key]~=feel.values[key] then self.steps.tuning_changed=true;self.step_archive={} end
    end
    local x,y,vx=feel.metres(state.x),feel.metres(state.y),feel.metres(state.vx)
    local hit,bottom=contacts(self)
    for i,s in ipairs(self.station.sections) do
        local r=self.steps.records[i]
        if i>=self.station.section_index and (s.stop_probe==true)==(self.station.sections[self.station.section_index].stop_probe==true) and (x>=s.spawn[1]-.01 or r.entered) and (x<=s.end_x or r.entered) and not r.done then
            if not r.entered then
                r.entered=true;r.status="RUNNING";r.entry_speed_mps=vx;self.steps.active=r.id
                r.independent=r.independent and x<=s.spawn[1]+.5
            end
            r.elapsed=r.elapsed+dt
            local c=self.last_command
            r.throttle_min=math.min(r.throttle_min or 1,c.throttle)
            r.throttle_max=math.max(r.throttle_max or 0,c.throttle)
            r.brake_max=math.max(r.brake_max or 0,c.brake_reverse)
            r.lean_max=math.max(r.lean_max or 0,math.abs(c.lean))
            -- Exclude the initial authored spawn settling from obstacle peaks.
            if x>=s.step_x-.8 then
                if not r.obstacle_entry_mps then r.obstacle_entry_mps=vx end
                r.compression_left_m=math.max(r.compression_left_m,feel.metres(sample.travel1))
                r.compression_right_m=math.max(r.compression_right_m,feel.metres(sample.travel2))
                r.compression_m=math.max(r.compression_left_m,r.compression_right_m)
                r.bottomed=r.bottomed or (r.stop_probe and r.compression_m>=.175)
                r.chassis_contact=r.chassis_contact or hit
                r.underbody_contact=r.underbody_contact or bottom
            end
            local cleared=x>=s.step_x+.8 and y>=s.top_y+.25 and math.abs(state.angle)<.8 and (sample.contact1 or sample.contact2)
            r.settled=cleared and (r.settled or 0)+dt or 0
            if r.settled>=.25 then r.cleared=true end
            r.stalled=math.abs(vx)<.1 and x>=s.step_x-.8 and (r.stalled or 0)+dt or 0
            if x>=s.end_x or r.stalled>=1 or r.elapsed>=6 then
                r.status=r.cleared and (s.mode=="up" and "CLIMBED" or "LANDED") or "STUCK"
                r.done=true;self.step_archive[r.id]=r
            end
        end
    end
end
function M.report(self)
    local records,highest,compression={},0,0
    for i,s in ipairs(self.station.sections) do
        local current=self.steps.records[i]
        local r=current.entered and current or self.step_archive[s.id] or current
        records[#records+1]=r
        if r.status=="CLIMBED" and r.independent and not r.stop_probe and not self.steps.tuning_changed then highest=math.max(highest,r.height_m) end
        compression=math.max(compression,r.compression_m)
    end
    return {kind="steps",station=self.station.id,section=self.station.sections[self.station.section_index].id,
        source_sha=sys.get_config_string("rider.source_sha","development"),preset=self.preset,modified=self.modified or false,
        automated=self.testcase=="a17",tuning=feel.snapshot(),start_speed=self.station.start_speed,
        highest_climbed_m=highest,max_compression_m=compression,hard_suspension_stop=self.station.sections[self.station.section_index].stop_probe==true,records=records,
        comparable=not self.steps.tuning_changed,tuning_at_start=self.step_tuning,
        conditions="Independent authored starts; automated up throttle=1, down neutral, no lean. Positive local-axis compression from spring rest, obstacle window starts 0.8 m before edge. Underbody contact is a physical chassis strike, not a suspension stop. Cleared = rear wheel past edge, upright wheel contact for 0.25 s; 6 s observation or 1 s stall, never a practice timeout."}
end
function M.enrich(self,sample)
    local report=M.report(self)
    local active=self.steps.active or report.section
    local status="NOT RUN";local bottom=false
    for _,r in ipairs(report.records) do if r.id==active then status=r.status;bottom=r.underbody_contact end end
    sample.station_result=string.format("%s m %s | best %.2f m | comp %.2f m%s",active,status,report.highest_climbed_m,report.max_compression_m,bottom and " | underbody hit" or "")
    if report.hard_suspension_stop then sample.station_result="STOP PROBE +0.18 m | "..status.." | comp "..string.format("%.3f m",report.max_compression_m) end
    if self.steps.tuning_changed then sample.station_result="Tuning changed; Retry for comparable results" end
    if html5 then html5.run("window.riderStationReport="..json.encode(report)) end
end
return M
