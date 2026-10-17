-- Read-only fixed-tick observer. It never changes vehicle commands or physics.
local feel=require "main.gym.feel"
local M={}
function M.restart(self)
    local parts={}
    for _,key in ipairs(feel.preset_keys) do parts[#parts+1]=key.."="..tostring(feel.values[key]) end
    parts[#parts+1]="start_speed="..self.station.start_speed
    local identity=table.concat(parts,";")
    if identity~=self.ramp_identity then self.ramp_archive={} end
    self.ramp_identity=identity
    self.ramp={records={},revision=0,printed=-1}
    for i,s in ipairs(self.station.sections) do
        self.ramp.records[i]={id=s.id,mode=s.mode,angle=s.angle,length=s.length,status="NOT RUN",elapsed=0,
            peak_launch_m=0,ground_ticks=0,ticks=0,climbed=false,start_speed=self.station.start_speed}
    end
end
function M.observe(self,state,dt,sample)
    local x,y=feel.metres(state.x),feel.metres(state.y)
    local vx=feel.metres(state.vx)
    local ground=sample.contact1 or sample.contact2
    for i,s in ipairs(self.station.sections) do
        local r=self.ramp.records[i]
        -- Later downhill probes are independent starts, not additional lanes
        -- silently counted while driving the up-ramp ladder.
        local selected=self.station.sections[self.station.section_index]
        local eligible=i>=self.station.section_index and s.mode==selected.mode
        if eligible and (x>=s.spawn[1] or r.entered) and (x<=s.end_x or r.entered) and not r.done then
            if not r.entered then r.entered=true;r.status="RUNNING";r.entry_speed_mps=vx;self.ramp.active=r.id end
            r.elapsed=r.elapsed+dt;r.ticks=r.ticks+1
            local c=self.last_command
            r.throttle_min=math.min(r.throttle_min or 1,c.throttle)
            r.throttle_max=math.max(r.throttle_max or 0,c.throttle)
            r.brake_max=math.max(r.brake_max or 0,c.brake_reverse)
            r.lean_max=math.max(r.lean_max or 0,math.abs(c.lean))
            if ground then r.ground_ticks=r.ground_ticks+1;r.had_contact=true end
            if s.mode=="up" then
                if not ground and r.had_contact and x>=s.ramp_start-.3 then
                    if not r.air_y then r.air_y=y end
                    r.peak_launch_m=math.max(r.peak_launch_m,y-r.air_y)
                elseif ground then r.air_y=nil end
                if x>=s.top_x+.46 and y>=s.top_y+.3 then r.climbed=true end
                r.stalled=math.abs(vx)<.1 and x>=s.ramp_start-.8 and (r.stalled or 0)+dt or 0
                if x>=s.end_x or r.stalled>=1 or r.elapsed>=6 then
                    r.status=r.climbed and "CLIMBED" or "FAILED";r.done=true
                end
            else
                if ground and x>=s.ramp_start-.2 and not r.slope_entry_mps then r.slope_entry_mps=vx end
                if x>=s.top_x or r.elapsed>=6 then
                    r.exit_speed_mps=vx
                    r.speed_gain_mps=vx-(r.slope_entry_mps or r.entry_speed_mps)
                    r.status=r.speed_gain_mps>.2 and "ACCELERATED" or "HELD/SLOWED";r.done=true
                end
            end
            if r.done then
                r.ground_share=r.ground_ticks/math.max(1,r.ticks)
                self.ramp_archive[r.id]=r;self.ramp.revision=self.ramp.revision+1
            end
        end
    end
end
function M.report(self)
    local records={};local highest,peak=0,0
    for i,s in ipairs(self.station.sections) do
        local current=self.ramp.records[i]
        local r=current.entered and current or self.ramp_archive[s.id] or current
        records[#records+1]=r
        if r.climbed then highest=math.max(highest,r.angle) end
        peak=math.max(peak,r.peak_launch_m)
    end
    return {kind="ramps",station=self.station.id,section=self.station.sections[self.station.section_index].id,
        source_sha=sys.get_config_string("rider.source_sha","development"),preset=self.preset,modified=self.modified or false,
        automated=self.testcase=="a16",tuning=feel.snapshot(),start_speed=self.station.start_speed,highest_climbed_degrees=highest,max_launch_height_m=peak,
        conditions="Up: authored start, held throttle, no lean for the automated comparison. Down: neutral input. 6 s observation per section; failure is a measurement, never an automatic gym timeout. Continuous runs have measured entry speeds; independent section starts are the comparable limit protocol.",records=records}
end
function M.enrich(self,sample)
    local report=M.report(self)
    local active=self.station.sections[self.station.section_index].id
    active=self.ramp.active or active
    local status="NOT RUN"
    for _,r in ipairs(report.records) do if r.id==active then status=r.status end end
    sample.station_result=string.format("%s %s | best %g deg | h %.2f m",active,status,report.highest_climbed_degrees,report.max_launch_height_m)
    if html5 then html5.run("window.riderStationReport="..json.encode(report)) end
    if self.ramp.printed~=self.ramp.revision then
        self.ramp.printed=self.ramp.revision
        print("RIDER_RAMPS "..json.encode(report))
    end
end
return M
