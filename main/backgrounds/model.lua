-- Render-only resolved layer settings. Authored source/versioning belongs to #548.
local M={MIN_DEPTH=-0.25,MAX_DEPTH=1,AUTO={0.9,0.75,0.55,0.35,0.15,-0.1},HEIGHT=12}
local function finite(n) return type(n)=="number" and n==n and n~=math.huge and n~=-math.huge end
local function image_id(v) return v==nil or type(v)=="string" and #v<=512 end
function M.normalize(config)
    if config==nil then config={} end
    if type(config)~="table" or config.enabled~=nil and type(config.enabled)~="boolean" then return nil,"Invalid Background enabled state" end
    if config.layers~=nil and type(config.layers)~="table" then return nil,"Invalid background layers" end
    local out={enabled=config.enabled~=false,layers={}}
    for k in pairs(config.layers or {}) do if type(k)~="number" or k%1~=0 or k<1 or k>6 then return nil,"At most six layer slots" end end
    for i=1,6 do
        local l=(config.layers or {})[i] or {}
        if type(l)~="table" or l.visible~=nil and type(l.visible)~="boolean" or l.auto~=nil and type(l.auto)~="boolean" then return nil,"Invalid layer state" end
        local depth=l.depth==nil and M.AUTO[i] or l.depth
        if not finite(depth) or depth<M.MIN_DEPTH or depth>M.MAX_DEPTH then return nil,"Depth outside -0.25..1" end
        if not image_id(l.image) or not image_id(l.preset_image) then return nil,"Invalid layer image" end
        out.layers[i]={visible=l.visible~=false,auto=l.auto~=false,depth=depth,image=l.image,preset_image=l.preset_image}
    end
    return out
end
function M.depth(layer,index) return layer.auto and M.AUTO[index] or layer.depth end
function M.factor(layer,index) return 1-M.depth(layer,index) end
function M.active(config,index)
    local l=config.layers[index]
    return config.enabled and l.visible and ((l.image and l.image~="") or (l.preset_image and l.preset_image~="")) and true or false
end
-- Metres at the boundary. No body, collision or camera access in this module.
function M.layout(frame,_index)
    local cx,cy,w,h=frame.x,frame.y,frame.half_w,frame.half_h
    assert(finite(cx) and finite(cy) and finite(w) and finite(h) and w>0 and h>0,"Invalid render frame")
    return {x=cx,y=cy,half_w=w,half_h=h}
end
function M.uv(frame,rect,layer,index,width,height)
    local tile_h=index==6 and 2*frame.half_h or M.HEIGHT;local tile_w=tile_h*width/height
    local factor=M.factor(layer,index)
    if index==6 then
        return {rect.half_w/tile_w,0.5,frame.x*factor/tile_w+0.5,0.5}
    end
    return {rect.half_w/tile_w,rect.half_h/tile_h,
        frame.x*factor/tile_w+0.5,(rect.y-frame.y+frame.y*factor)/tile_h+0.5}
end
-- Normalized viewport coordinates; a visual GO read is supplied by the controller.
function M.cutout(frame)
    local v=frame.vehicle
    if not v then return {-10,-10,1,1} end
    return {0.5+(v.x-frame.x)/(2*frame.half_w),0.5+(v.y-frame.y)/(2*frame.half_h),
        1.9/(2*frame.half_w),1.6/(2*frame.half_h)}
end
return M
