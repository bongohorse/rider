-- Debug-only named camera poses and renderer requests for the bg546 Gym fixture.
local backgrounds=require "main.backgrounds.renderer"
local M={}
local poses={origin={x=0,y=0},sky={x=0,y=3},sky_east={x=6,y=3},sky_rise={x=0,y=9},high={x=0,y=120},low={x=0,y=-120},steep_top={x=350,y=140},steep_bottom={x=-80,y=-140}}
function M.init(self)
    self.bg546={ack=0,sequence=0,pose=poses.origin}
    html5.run("window.riderBackgroundRequest=null") -- never replay an old world's request
end
function M.before(self)
    local state=self.bg546
    local request=json.decode(html5.run("JSON.stringify(window.riderBackgroundRequest || null)"))
    if request and type(request.seq)=="number" and request.seq>state.ack then
        local ok,err=true,nil
        if request.action=="set" then ok,err=backgrounds.set(self.backgrounds,request.config)
        elseif request.action=="enabled" then ok=backgrounds.enabled(self.backgrounds,request.enabled)
        elseif request.action=="visible" then ok=backgrounds.visible(self.backgrounds,request.index,request.visible)
        elseif request.action=="pose" and poses[request.pose] then state.pose=poses[request.pose]
        else ok,err=false,"Invalid background fixture request" end
        state.ack,state.error=request.seq,not ok and (err or "Invalid request") or false
    end
    -- The existing controller remains the sole writer of the camera GO.
    return state.pose
end
function M.fixed(self,dt)
    local s=self.bg546
    s.fixed_min=math.min(s.fixed_min or dt,dt);s.fixed_max=math.max(s.fixed_max or dt,dt);s.fixed_ticks=(s.fixed_ticks or 0)+1
end
function M.after(self)
    local state=self.bg546;state.sequence=state.sequence+1
    local r=backgrounds.report(self.backgrounds)
    r.ack,r.sequence,r.error,r.pose,r.frame=state.ack,state.sequence,state.error or false,state.pose,self.background_frame
    r.source_sha=sys.get_config_string("rider.source_sha","");r.run_id=self.run_id
    r.fixed_min,r.fixed_max,r.fixed_ticks=state.fixed_min,state.fixed_max,state.fixed_ticks or 0
    html5.run("window.riderBackgroundReport="..json.encode(r))
end
return M
