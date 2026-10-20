-- A21 command recording and replay with a ghost (physics contract, "Command playback and ghosts").
-- State lives on the controller session instance (self.replay); this module holds no session state.
-- The controller stays the sole tick owner: a replay is one more command source ahead of live input, exactly one
-- recorded command per fixed tick through vehicle.apply. No second loop, no manual stepping.
-- Recording format version 1 (A22 stores regression traces in it, see M.install; documented in main/gym/README.md "Record and replay"):
-- station/section/start speed, preset key + modified flag + every preset value, source SHA, then per tick i
-- (1-based, tick 1 = the station start tick) throttle[i], brake[i] (0/1), reverse[i] (allow_reverse as 0/1),
-- lean[i] (-1..1) and pose[9(i-1)+1..9i] = chassis x, y, angle, rear wheel x, y, angle, front wheel x, y, angle
-- in metres and radians, read after the tick's reset/start and before its command is applied. trailing=true adds
-- pose ticks+1: the post-step pose of the last tick, read at the next fixed tick (missing if that tick never ran).
local feel=require "main.gym.feel"
local mobile=require "main.gym.mobile"
local M={VERSION=1,CAP=3600,POSE=9}
-- Declared before running (same preset, same build): chassis position and angle over every replayed tick.
M.TOLERANCE={position_m=0.05,angle_rad=0.05}
local GHOST_TINT=vmath.vector4(0.55,0.85,1,0.4)
-- Ghost z: behind the live vehicle (chassis 0, wheels 1), in front of the Straight checker decoration (-1).
local GHOST_Z=-0.5

function M.new() return {} end
-- The controller's request_reset (Retry path); bound once like scenarios.bind.
local request_reset
function M.bind(reset) request_reset=reset end
local function scale() return sys.get_config_number("physics.scale",0.01) end
local function section_id(self)
    local d=self.station
    return d.sections and d.sections[d.section_index].id or false
end
-- An optional preset key (#211) at its default is left out of tuning and identity, so recordings made
-- without it (preset A, the stored A22 traces) keep format v1 unchanged; a set value (F) is included.
local function tuning()
    local t={}
    for _,key in ipairs(feel.preset_keys) do
        local value=feel.values[key]
        if feel.optional[key]==nil or value~=feel.optional[key] then t[key]=value end
    end
    return t
end
local function identity(t)
    local parts={}
    for _,key in ipairs(feel.preset_keys) do
        if t[key]~=nil or feel.optional[key]==nil then parts[#parts+1]=key.."="..tostring(t[key]) end
    end
    return table.concat(parts,";")
end
-- Read-only: the identity the replay verdict compares (same identity = MATCH rules, else COMPARED).
function M.identity() return identity(tuning()) end
local function preset_label(key,modified) return string.upper(key or "?")..(modified and "*" or "") end
local function pose(self)
    local v=self.vehicle
    local p={}
    for _,b in ipairs({v.chassis,v.wheels[1],v.wheels[2]}) do
        local q=b2d.body.get_position(b)
        p[#p+1]=feel.metres(q.x);p[#p+1]=feel.metres(q.y);p[#p+1]=b2d.body.get_angle(b)
    end
    return p
end
local function note(self,text) self.replay.note,self.replay.note_time=text,3 end
local function debug_spec(self)
    if not (self.replay_debug and html5) then return {} end
    local ok,d=pcall(json.decode,html5.run("JSON.stringify(window.riderReplayDebug||{})"))
    return ok and type(d)=="table" and d or {}
end
local function slow(dt) return math.abs(dt*60-1)>1e-4 end
-- Live drive input never carries into or out of a replay: held keys and touch pointers need a new press
-- (opt-in tilt keeps its calibration, as on pause).
local function clear_input(self) self.held={};self.mobile={};mobile.clear(true) end

-- Ghost: sprite-only game objects (no collision object, no body); 4 sprites while a replay exists.
local function ghost_delete(r)
    if r.ghost then for _,id in ipairs(r.ghost) do go.delete(id) end end
    r.ghost=nil
end
local function ghost_place(r,rec,index)
    if not r.ghost then return end
    local s=scale()
    local base=M.POSE*(index-1)
    for k,id in ipairs(r.ghost) do
        local o=base+3*(k-1)
        go.set_position(vmath.vector3(rec.pose[o+1]/s,rec.pose[o+2]/s,GHOST_Z+(k>1 and 0.1 or 0)),id)
        go.set_rotation(vmath.quat_rotation_z(rec.pose[o+3]),id)
    end
end
local function ghost_create(r,rec)
    ghost_delete(r)
    r.ghost={factory.create("#ghost_chassis"),factory.create("#ghost_wheel"),factory.create("#ghost_wheel")}
    for k,id in ipairs(r.ghost) do
        go.set(msg.url(nil,id,"sprite"),"tint",GHOST_TINT)
        if k==1 then go.set(msg.url(nil,id,"rider"),"tint",GHOST_TINT) end
    end
    r.ghost_sprites=4
    ghost_place(r,rec,1)
end

local function store_pose(rec,k,q)
    local base=M.POSE*(k-1)
    for j=1,M.POSE do rec.pose[base+j]=q[j] end
end
-- Trailing pose: the post-step pose of the last recorded tick, read at the next fixed tick (before its reset or
-- command), so the final comparison and the ghost's last pose include the last recorded command.
local function capture_trailing(self)
    local rec=self.replay.rec
    if rec and not rec.trailing and not rec.error and rec.ticks>0 and self.fixed_ticks==rec.first+rec.ticks then
        store_pose(rec,rec.ticks+1,pose(self));rec.trailing=true
    end
end
local function poses(rec) return rec.ticks+(rec.trailing and 1 or 0) end
-- Live chassis pose against the recorded pose k, both read at the same point of their tick.
local function compare(self,p,k)
    local rec=p.rec
    local live=pose(self);local base=M.POSE*(k-1)
    local dx,dy=live[1]-rec.pose[base+1],live[2]-rec.pose[base+2]
    local da=live[3]-rec.pose[base+3]
    -- Angles are body angles in (-pi, pi]: compare the wrapped difference.
    local dpos,dangle=math.sqrt(dx*dx+dy*dy),math.abs(math.atan2(math.sin(da),math.cos(da)))
    p.max_position_m,p.max_angle_rad=math.max(p.max_position_m,dpos),math.max(p.max_angle_rad,dangle)
    p.final_dx_m,p.final_position_m,p.compared=dx,dpos,k
end
local CRASH={bounds=true,head=true}
local function verdict(p)
    if p.rec.scaled_ticks>0 or p.scaled_ticks>0 then return "NOT COMPARABLE" end
    if p.rec.tuning_changed or p.tuning_changed then return "NOT COMPARABLE" end
    if p.same then
        -- The same preset ending in a crash before the recording's last command took another path.
        if CRASH[p.ended] and not p.complete then return "DIVERGED" end
        return (p.max_position_m<=M.TOLERANCE.position_m and p.max_angle_rad<=M.TOLERANCE.angle_rad) and "MATCH" or "DIVERGED"
    end
    return "COMPARED"
end
local function finish_play(self,reason)
    local r=self.replay;local p=r.play
    if not p or p.ended then return end
    p.ended,p.complete=reason,p.index>=p.rec.ticks
    p.verdict=verdict(p)
    clear_input(self)
    if reason~="done" then ghost_delete(r) end
end
local function finish_record(self,reason)
    local rec=self.replay.rec
    if rec and rec.active then rec.active=false;rec.ended=reason end
end

-- Whether the stored recording can replay here: same station, section and start speed, no tick gap.
local function playable(self)
    local rec=self.replay.rec
    if not rec then return nil,"No recording: press B to record a run" end
    if rec.error then return nil,"Recording refused ("..rec.error.."); press B to record again" end
    if rec.ticks==0 then return nil,"Recording is empty; press B to record a run" end
    if rec.station~=self.station.id or rec.section~=section_id(self) or rec.start_speed~=self.station.start_speed then
        return nil,"Recorded on another start; press B to record here"
    end
    return true
end

-- B: start a recording from the station start (a Retry), or stop the running one.
function M.toggle_record(self)
    local r=self.replay
    if r.rec and r.rec.active then finish_record(self,"stopped");note(self,"Recording stopped");return end
    if not (self.vehicle and self.vehicle.ready) or self.pending_reset then return end
    request_reset(self,"record")
end
-- G: replay the recording from the station start (a Retry) on the current preset, or stop the running replay.
function M.toggle_play(self)
    local r=self.replay
    if r.play and not r.play.ended then finish_play(self,"stopped");note(self,"Replay stopped");return end
    if not (self.vehicle and self.vehicle.ready) or self.pending_reset then return end
    if r.rec and r.rec.active then finish_record(self,"stopped") end
    local ok,err=playable(self)
    if not ok then note(self,err);return end
    request_reset(self,"replay")
end

-- Called by the controller's reset() before the vehicle is reset: the pose there is the post-step pose of the
-- previous tick (trailing pose of a recording, last comparison of a replay that applied all its commands).
function M.before_reset(self)
    local r=self.replay
    capture_trailing(self)
    local p=r.play
    if p and not p.ended and p.index>=p.rec.ticks and p.rec.trailing and self.fixed_ticks-p.first==p.index then compare(self,p,p.rec.ticks+1) end
end
-- Called by the controller's reset() after the station start (stations.restart), inside the fixed tick that
-- becomes tick 1 of a new recording or replay. Every other reset ends a running recording or replay; a replay
-- ended by it keeps its result (shown for bounds/head ends), an earlier finished replay and its ghost are cleared.
function M.on_reset(self,reason)
    local r=self.replay
    local running=r.play~=nil and not r.play.ended
    finish_record(self,reason)
    finish_play(self,reason)
    if reason~="record" and reason~="replay" and not running then ghost_delete(r);r.play=nil end
    if reason=="record" then
        local t=tuning()
        r.rec={version=M.VERSION,station=self.station.id,section=section_id(self),start_speed=self.station.start_speed,
            preset=self.preset,modified=self.modified or false,tuning=t,identity=identity(t),
            source_sha=sys.get_config_string("rider.source_sha","development"),first=self.fixed_ticks,ticks=0,
            throttle={},brake={},reverse={},lean={},pose={},scaled_ticks=0,active=true,cap=debug_spec(self).cap or M.CAP}
        ghost_delete(r);r.play=nil
        note(self,"Recording from the start")
    elseif reason=="replay" then
        local ok,err=playable(self)
        if not ok then note(self,err);return end
        local rec=r.rec
        local t=tuning()
        r.play={rec=rec,first=self.fixed_ticks,index=0,preset=self.preset,modified=self.modified or false,same=identity(t)==rec.identity,
            max_position_m=0,max_angle_rad=0,final_dx_m=0,final_position_m=0,mismatches=0,scaled_ticks=0,fault=debug_spec(self).fault}
        ghost_create(r,rec)
        clear_input(self)
    end
end

-- Before the tick's command: the recorded command while a replay runs (live input is not read), else nil.
function M.command(self,dt)
    local r=self.replay
    if r.rec and not r.rec.active then capture_trailing(self) end
    local p=r.play
    if not p or p.ended then return nil end
    local i=self.fixed_ticks-p.first
    if i~=p.index then finish_play(self,"tick gap");note(self,"Replay stopped: tick gap");return nil end
    local rec=p.rec
    if i>=rec.ticks then
        if rec.trailing then compare(self,p,rec.ticks+1) end
        finish_play(self,"done");return nil
    end
    p.index=i+1
    if slow(dt) then p.scaled_ticks=p.scaled_ticks+1 end
    local k=i+1
    -- Compare the live pose with the recorded pose of the same tick, read at the same point.
    compare(self,p,k)
    -- Debug fault (a21 only): the player skips its tick counter once, as a missing tick would.
    if p.fault=="gap" and k==30 then p.index=p.index+1 end
    local c={throttle=rec.throttle[k],brake_reverse=rec.brake[k],allow_reverse=rec.reverse[k]==1,lean=rec.lean[k]}
    -- Debug fault (a21 only): a deliberately bad trace, full lean against the recorded lean on ticks 30-89.
    if p.fault=="perturb" and k>=30 and k<90 then c.lean=c.lean>=0 and -1 or 1 end
    return c
end
-- After the command is chosen: append it to a running recording and move the ghost to the post-step pose.
function M.after_command(self,command,dt)
    local r=self.replay
    local p=r.play
    if p and not p.ended then
        -- The command actually applied this tick against the recorded one (exactly one per tick).
        local k,rec=p.index,p.rec
        if command.throttle~=rec.throttle[k] or command.brake_reverse~=rec.brake[k] or (command.allow_reverse and 1 or 0)~=rec.reverse[k] or command.lean~=rec.lean[k] then
            p.mismatches=p.mismatches+1
        end
        p.applied=k
        ghost_place(r,rec,math.min(k+1,poses(rec)))
    end
    local rec=r.rec
    if not (rec and rec.active) then return end
    local n=rec.ticks+1
    -- One entry per fixed tick: a missing or repeated tick invalidates the recording (replay refused).
    if self.fixed_ticks~=rec.first+n-1 then rec.error="tick gap at tick "..n;finish_record(self,"tick gap");note(self,"Recording refused: tick gap");return end
    local fault=debug_spec(self).fault
    if fault=="skip" and n==30 and not rec.fault_done then rec.fault_done=true;return end
    local times=fault=="duplicate" and n==30 and not rec.fault_done and 2 or 1
    rec.fault_done=rec.fault_done or times==2
    for _=1,times do
        local m=rec.ticks+1
        rec.throttle[m],rec.brake[m],rec.reverse[m],rec.lean[m]=command.throttle,command.brake_reverse,command.allow_reverse and 1 or 0,command.lean
        store_pose(rec,m,pose(self))
        rec.ticks=m
    end
    if slow(dt) then rec.scaled_ticks=rec.scaled_ticks+1 end
    if rec.ticks>=rec.cap then finish_record(self,"full");note(self,string.format("Recording full (%.0f s)",rec.cap/60)) end
end
-- A22: install a stored format-version-1 recording (regression trace, debug case a22) as the recording to replay.
-- The whole trace is validated before it replaces anything: one command per tick for exactly `ticks` ticks, poses
-- for every tick plus the trailing pose, finite values in range, recorded at 1.0. Returns true, or nil and a reason.
local function finite(v) return type(v)=="number" and v==v and v>-math.huge and v<math.huge end
function M.install(self,d)
    if type(d)~="table" then return nil,"no trace" end
    if d.version~=M.VERSION then return nil,"unsupported version" end
    local n=d.ticks
    if not finite(n) or n~=math.floor(n) or n<1 or n>M.CAP then return nil,"bad tick count" end
    for _,key in ipairs({"throttle","brake","reverse","lean"}) do
        if type(d[key])~="table" or #d[key]~=n then return nil,key.." length is not one entry per tick" end
    end
    if d.trailing~=true or type(d.pose)~="table" or #d.pose~=M.POSE*(n+1) then return nil,"pose length is not one pose per tick plus the trailing pose" end
    if d.scaled_ticks~=0 or d.error or d.tuning_changed then return nil,"trace is not comparable" end
    if type(d.station)~="string" or not finite(d.start_speed) or not (d.section==false or type(d.section)=="string") then return nil,"bad start" end
    if type(d.preset)~="string" or type(d.identity)~="string" or type(d.tuning)~="table" then return nil,"bad preset identity" end
    for k=1,n do
        local t,b,r,l=d.throttle[k],d.brake[k],d.reverse[k],d.lean[k]
        if not ((t==0 or t==1) and (b==0 or b==1) and (r==0 or r==1) and finite(l) and l>=-1 and l<=1) then return nil,"bad command at tick "..k end
    end
    for i=1,#d.pose do if not finite(d.pose[i]) then return nil,"bad pose value" end end
    local r=self.replay
    if (r.rec and r.rec.active) or (r.play and not r.play.ended) then return nil,"a recording or replay is running" end
    r.rec={version=d.version,station=d.station,section=d.section,start_speed=d.start_speed,preset=d.preset,modified=d.modified==true,
        tuning=d.tuning,identity=d.identity,source_sha=tostring(d.source_sha),first=0,ticks=n,throttle=d.throttle,brake=d.brake,
        reverse=d.reverse,lean=d.lean,pose=d.pose,trailing=true,scaled_ticks=0,active=false,ended="installed",cap=M.CAP}
    return true
end
-- A22: the stored fields of a finished recording (format version 1), for the debug trace export.
function M.export(rec)
    return {version=rec.version,station=rec.station,section=rec.section,start_speed=rec.start_speed,preset=rec.preset,modified=rec.modified,
        tuning=rec.tuning,identity=rec.identity,source_sha=rec.source_sha,ticks=rec.ticks,throttle=rec.throttle,brake=rec.brake,
        reverse=rec.reverse,lean=rec.lean,pose=rec.pose,trailing=rec.trailing or false,scaled_ticks=rec.scaled_ticks,ended=rec.ended or false,
        error=rec.error or false,tuning_changed=rec.tuning_changed or false}
end
-- Live tuning during a recording or replay makes it not comparable.
function M.tuned(self)
    local r=self.replay
    if r.rec and r.rec.active then r.rec.tuning_changed=true end
    if r.play and not r.play.ended then r.play.tuning_changed=true end
end
function M.replaying(self) local p=self.replay.play;return p~=nil and not p.ended end

-- Short HUD line (well under msg.post's 2 KiB cap).
function M.status(self,dt)
    local r=self.replay
    r.note_time=math.max(0,(r.note_time or 0)-(dt or 0))
    local rec,p=r.rec,r.play
    local text=""
    if rec and rec.active then
        text=string.format("REC %.1f s on %s [B] stops",rec.ticks/60,preset_label(rec.preset,rec.modified))..(rec.scaled_ticks>0 and " (slow motion: not comparable)" or "")
    elseif p then
        local a,b=preset_label(p.rec.preset,p.rec.modified),preset_label(p.preset,p.modified)
        if not p.ended then
            text=string.format("Replay: ghost %s, live %s  %.1f / %.1f s  dx %+.2f m [G] stops",a,b,p.index/60,p.rec.ticks/60,p.final_dx_m)
            if p.scaled_ticks>0 or p.rec.scaled_ticks>0 then text=text.." (slow motion: not comparable)" end
        elseif p.ended=="done" then
            text=string.format("Replay ghost %s vs live %s: end dx %+.2f m, max %.2f m / %.3f rad - %s",a,b,p.final_dx_m,p.max_position_m,p.max_angle_rad,p.verdict)
        elseif CRASH[p.ended] then
            text=string.format("Replay ghost %s vs live %s ended by %s at tick %d/%d: dx %+.2f m, max %.2f m / %.3f rad - %s",a,b,
                p.ended=="head" and "head contact" or "bounds",p.index,p.rec.ticks,p.final_dx_m,p.max_position_m,p.max_angle_rad,p.verdict)
        end
    elseif rec and not rec.error then
        text=string.format("Recorded %.1f s on %s - Replay [G], preset [P]",rec.ticks/60,preset_label(rec.preset,rec.modified))
    end
    if r.note_time>0 and r.note then text=r.note..(text~="" and " | "..text or "") end
    return text
end

-- Debug report (a21, a22): summaries, never the full trace.
function M.report(self,extra)
    local r=self.replay
    local rec,p=r.rec,r.play
    local out={version=M.VERSION,tolerance=M.TOLERANCE,ticks=self.fixed_ticks,generation=self.session_generation,
        recording=rec and {active=rec.active,ticks=rec.ticks,error=rec.error or false,ended=rec.ended or false,preset=rec.preset,modified=rec.modified,
            station=rec.station,section=rec.section,start_speed=rec.start_speed,scaled_ticks=rec.scaled_ticks,cap=rec.cap,version=rec.version,
            source_sha=rec.source_sha,tuning_changed=rec.tuning_changed or false,trailing=rec.trailing or false,poses=#rec.pose/M.POSE} or false,
        play=p and {active=not p.ended,index=p.index,ticks=p.rec.ticks,preset=p.preset,modified=p.modified,same=p.same,max_position_m=p.max_position_m,
            max_angle_rad=p.max_angle_rad,final_dx_m=p.final_dx_m,final_position_m=p.final_position_m,compared=p.compared or 0,applied=p.applied or 0,mismatches=p.mismatches,
            scaled_ticks=p.scaled_ticks,ended=p.ended or false,verdict=p.verdict or false,complete=p.complete or false,tuning_changed=p.tuning_changed or false} or false,
        ghost={count=r.ghost and #r.ghost or 0,sprites=r.ghost and r.ghost_sprites or 0},status=M.status(self,0)}
    if r.ghost then
        local q=go.get_position(r.ghost[1])
        out.ghost.x,out.ghost.y=feel.metres(q.x),feel.metres(q.y)
    end
    if rec then
        local c={throttle=0,brake=0,lean=0}
        for k=1,rec.ticks do
            if rec.throttle[k]>0 then c.throttle=c.throttle+1 end
            if rec.brake[k]>0 then c.brake=c.brake+1 end
            if rec.lean[k]~=0 then c.lean=c.lean+1 end
        end
        out.recording.commands=c
    end
    for k,v in pairs(extra or {}) do out[k]=v end
    return out
end
return M
