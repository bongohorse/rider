-- Terrain render residency only. Never owns collision, simulation, source or camera state.
local M={MARGIN=8,HYSTERESIS=4,CACHE=2,PREPARE=2}
function M.intersects(a,b,margin)
    margin=margin or 0
    return a[1]<=b[3]+margin and a[3]>=b[1]-margin and a[2]<=b[4]+margin and a[4]>=b[2]-margin
end
-- Bypass last-frame camera matrices: the pinned camera computes projection in late_update.
-- Match the existing, unrotated AUTO_FIT camera using current window size and zoom.
function M.viewport(editor_camera)
    local w,h=window.get_size()
    local width,height=sys.get_config_number("display.width",960),sys.get_config_number("display.height",540)
    local zoom=editor_camera and editor_camera.zoom or go.get("/camera#camera","orthographic_zoom")
    local fit=math.min(w/width,h/height)*zoom
    local scale=sys.get_config_number("physics.scale",.01)
    local p=go.get_position("/camera")
    local x,y=editor_camera and editor_camera.x or p.x*scale,editor_camera and editor_camera.y or p.y*scale
    local hx,hy=w/fit*scale/2,h/fit*scale/2
    return {x-hx,y-hy,x+hx,y+hy}
end
function M.update(state,entries,view,activate,drop)
    state.clock=(state.clock or 0)+1
    local want,visible,near,cold={},{},{},{}
    local padding=M.MARGIN
    if view and state.view then
        -- Symmetric displacement prediction handles reverse and falls; visible uploads stay synchronous.
        padding=padding+math.min(32,math.max(math.abs(view[1]-state.view[1]),math.abs(view[2]-state.view[2]))*2)
    end
    for _,e in ipairs(entries) do
        if not view or M.intersects(e.bounds,view,.005) then visible[#visible+1]=e;want[e]=true
        elseif M.intersects(e.bounds,view,padding) then
            if e.resource then want[e]=true else near[#near+1]=e end
        elseif e.resource and M.intersects(e.bounds,view,padding+M.HYSTERESIS) then want[e]=true
        elseif e.resource then cold[#cold+1]=e end
    end
    local function distance(e)
        local b=e.bounds;local x,y=(view[1]+view[3])/2,(view[2]+view[4])/2
        return math.max(b[1]-x,0,x-b[3])^2+math.max(b[2]-y,0,y-b[4])^2
    end
    table.sort(near,function(a,b) return distance(a)<distance(b) end)
    for i=1,math.min(M.PREPARE,#near) do want[near[i]]=true end
    table.sort(cold,function(a,b) return (a.used or 0)>(b.used or 0) end)
    local victims={}
    for i,e in ipairs(cold) do if i<=M.CACHE then want[e]=false else victims[#victims+1]=e end end
    local result={visible=#visible,allocated=0,cached=0,enabled=0,bytes=0,uploaded=0,reassigned=0,released=0,queued=math.max(0,#near-M.PREPARE)}
    local order={};for _,e in ipairs(visible) do order[#order+1]=e end
    for _,e in ipairs(entries) do if want[e] and not (not view or M.intersects(e.bounds,view,.005)) then order[#order+1]=e end end
    for _,e in ipairs(order) do
        if not e.resource and #victims>0 then
            local old=table.remove(victims)
            for _,k in ipairs({"resource","object","path","geometry","enabled"}) do e[k],old[k]=old[k],nil end
            old.dirty=true;e.dirty=true;result.reassigned=result.reassigned+1
        end
        if e.dirty or e.refresh or not e.resource then
            local upload=e.dirty or not e.resource
            activate(e);if upload then result.uploaded=result.uploaded+1 end
            e.dirty,e.refresh=nil,nil
        end
        e.used=state.clock
    end
    for _,e in ipairs(victims) do drop(e);e.geometry=nil;e.dirty=true;result.released=result.released+1 end
    for _,e in ipairs(entries) do
        if e.resource then
            local enabled=want[e]==true
            if e.enabled~=enabled then msg.post(msg.url(nil,e.object,"mesh"),enabled and "enable" or "disable");e.enabled=enabled end
            result.allocated=result.allocated+1;result.bytes=result.bytes+e.geometry.bytes
            if enabled then result.enabled=result.enabled+1 else result.cached=result.cached+1 end
        end
    end
    assert(result.cached<=M.CACHE,"Terrain cache exceeded policy")
    state.view=view;state.last=result
    state.high_water=math.max(state.high_water or 0,result.allocated)
    return result
end
return M
