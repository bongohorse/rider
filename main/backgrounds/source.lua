-- Versioned authored backgrounds. Persist IDs/hash references, resolve resource paths only at render boundary.
local dense=require 'main.game.dense'
local model=require 'main.backgrounds.model'
local M={VERSION=1,PRESETS={'meadow','quarry','city','volcano'}}
local known={};for _,id in ipairs(M.PRESETS) do known[id]=true end
local function fields(value,allowed)
    for k in pairs(value) do if not allowed[k] then return nil,'Unknown background field '..tostring(k):sub(1,40),true end end
    return true
end
local function finite(n) return type(n)=='number' and n==n and n>=model.MIN_DEPTH and n<=model.MAX_DEPTH end
function M.validate(b)
    if b==nil then return true end
    if type(b)~='table' or b.version~=M.VERSION then return nil,'Unsupported backgrounds version; keep the original file.',true end
    local ok,err,unknown=fields(b,{version=true,preset=true,enabled=true,layers=true})
    if not ok then return nil,err,unknown end
    if not known[b.preset] then return nil,'Unknown background preset '..tostring(b.preset),true end
    if type(b.enabled)~='boolean' then return nil,'Background enabled must be boolean' end
    if dense.length(b.layers,6)~=6 then return nil,'Backgrounds need six dense layer slots' end
    for _,layer in ipairs(b.layers) do
        if type(layer)~='table' then return nil,'Invalid background layer' end
        ok,err,unknown=fields(layer,{visible=true,auto=true,depth=true,image=true})
        if not ok then return nil,err,unknown end
        if type(layer.visible)~='boolean' or type(layer.auto)~='boolean' or not finite(layer.depth) then return nil,'Invalid layer visibility, Auto or Depth (-0.25..1)' end
        local image=layer.image
        if image~=nil then
            if type(image)~='table' then return nil,'Invalid background image reference' end
            ok,err,unknown=fields(image,{preset=true,hash=true})
            if not ok then return nil,err,unknown end
            if not known[image.preset] then return nil,'Unknown background image preset '..tostring(image.preset),true end
            if image.hash~=nil and (type(image.hash)~='string' or #image.hash~=64 or image.hash:find('[^0-9a-f]')) then return nil,'Invalid background image hash' end
        end
    end
    return true
end
function M.defaults(preset)
    local b={version=M.VERSION,preset=preset or 'meadow',enabled=true,layers={}}
    for i=1,6 do b.layers[i]={visible=true,auto=true,depth=model.AUTO[i]} end
    return b
end
local function path(id,index)
    return '/main/background_presets/'..id..'/'..(index==6 and 'foreground' or 'layer'..index)..'.png'
end
-- Local image bytes are a later import/store boundary. A missing hash retains its authored reference,
-- resolves to its named preset and returns an actionable warning rather than altering the saved source.
function M.resolve(b)
    local ok,err=M.validate(b)
    if not ok then return nil,err end
    if b==nil then return nil end
    local out={enabled=b.enabled,layers={}}
    local missing=false
    for i,l in ipairs(b.layers) do
        local id=l.image and l.image.preset or b.preset
        out.layers[i]={visible=l.visible,auto=l.auto,depth=l.depth,image=path(id,i),preset_image=path(id,i)}
        if l.image and l.image.hash then missing=true end
    end
    return out,missing and 'Local background image missing; using its preset. Import it again on this browser.' or nil
end
return M
