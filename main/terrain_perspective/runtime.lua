-- Shared production/comparison projection. No physics/source/camera writes or world handles.
local projection=require 'main.terrain_perspective.projection'
local M={params=projection.validate(projection.DEFAULT),revision=0}
function M.comparison() return sys and sys.get_config_int and sys.get_config_int('rider.terrain_perspective',0)==1 or false end
function M.enabled(d) return M.comparison() or require('main.terrain_perspective.profile').enabled(d) end
function M.init()
    if not M.comparison() then return false end
    require('main.gym.terrain_budget').COMPARISON=true
    if html5 then html5.run([[window.riderRoadLook={current:null,pending:null,status:'Starting',token:0,set(p){this.pending={token:++this.token,params:p};return this.token;}};]]) end
    return true
end
function M.poll()
    if not (M.comparison() and html5) then return end
    local text=html5.run("(()=>{const a=window.riderRoadLook;if(!a?.pending)return '';const p=a.pending;a.pending=null;return JSON.stringify(p)})()")
    if text and text~='' then
        local ok,r=false,nil
        if #text<=2048 then ok,r=pcall(json.decode,text) end
        local p,err
        if ok and type(r)=='table' then p,err=projection.validate(r.params) end
        if p then M.params=p;M.revision=M.revision+1 end
        html5.run("Object.assign(window.riderRoadLook,"..json.encode({status=p and 'Applied' or err or 'Invalid look request',ack=ok and r and r.token or 0,current=M.params})..")")
    elseif not M.published then
        M.published=true;html5.run('window.riderRoadLook.current='..json.encode(M.params)..";window.riderRoadLook.status='Applied'")
    end
end
function M.prepare(state,camera)
    state.look_camera=camera
    local p=M.comparison() and M.params or state.params or projection.DEFAULT
    state.current_params=p
    state.param_key=table.concat({p.mode,p.width,p.perspective,p.angle,p.side,p.shading},"|")
    for _,e in ipairs(state.entries) do
        e.base_bounds=e.base_bounds or e.bounds
        local width=state.baked and 2 or p.width -- also covers wider dirty/cached sections before materialization
        e.bounds=projection.bounds(e.base_bounds,camera,p,width)
    end
end
function M.apply(state,set_bounds)
    local p,c=state.current_params,state.look_camera
    local a=p.mode=='perspective' and p.perspective/projection.FOCAL or 0
    local scale=sys.get_config_number('physics.scale',.01)
    for _,e in ipairs(state.entries) do if e.resource then
        local g=e.geometry;local url=msg.url(nil,e.object,'mesh')
        local lower=e.plan and e.plan.lower or g.lower
        local phase=e.plan and e.plan.phase or g.u0
        local fresh=e.look_object~=e.object
        if fresh or e.look_x~=g.origin[1] or e.look_y~=g.origin[2] or e.look_lower~=lower then
            go.set(url,'look_origin',vmath.vector4(g.origin[1],g.origin[2],lower-g.origin[2],scale))
            e.look_x,e.look_y,e.look_lower=g.origin[1],g.origin[2],lower
            state.uniform_writes=(state.uniform_writes or 0)+1
        end
        if fresh or e.look_revision~=state.param_key then
            go.set(url,'look_shape',vmath.vector4(g.baked and .9 or p.width,a,p.side,g.baked and 1 or p.shading))
            state.uniform_writes=(state.uniform_writes or 0)+1
        end
        if fresh or e.look_revision~=state.param_key or e.look_cx~=c[1] or e.look_cy~=c[2] then
            go.set(url,'look_camera',vmath.vector4(c[1],c[2],.18,math.tan(p.angle*math.pi/180)))
            e.look_cx,e.look_cy=c[1],c[2]
            state.uniform_writes=(state.uniform_writes or 0)+1
        end
        if fresh or e.look_phase~=phase then
            go.set(url,'editor_params',vmath.vector4(phase,0,0,0));e.look_phase=phase
            state.uniform_writes=(state.uniform_writes or 0)+1
        end
        e.look_object,e.look_revision=e.object,state.param_key
        local b=e.bounds
        if fresh or e.look_b1~=b[1] or e.look_b2~=b[2] or e.look_b3~=b[3] or e.look_b4~=b[4] then
            g.bounds={b[1]-g.origin[1],b[2]-g.origin[2],0,b[3]-g.origin[1],b[4]-g.origin[2],0}
            -- Metadata does not increment the pinned buffer content version.
            set_bounds(resource.get_buffer(e.resource),g)
            e.look_b1,e.look_b2,e.look_b3,e.look_b4=b[1],b[2],b[3],b[4]
            state.aabb_writes=(state.aabb_writes or 0)+1
        end
    end end
    if html5 and sys.get_engine_info().is_debug then
        local entries={}
        for _,e in ipairs(state.entries) do entries[#entries+1]={key=e.key,bounds=e.bounds,allocated=e.resource~=nil,enabled=e.enabled==true,bytes=e.geometry and e.geometry.bytes or 0} end
        html5.run('window.riderRoadProjection='..json.encode({revision=M.revision,params=p,baked=state.baked==true,mode=p.mode,camera=c,stride=projection.STRIDE,sections=#state.entries,counts=state.last,view=state.view,entries=entries,uploads=state.uploads or 0,uniform_writes=state.uniform_writes or 0,aabb_writes=state.aabb_writes or 0}))
    end
end
return M
