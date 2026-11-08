-- Track texture session (#543): a choice commits at once as one Undo step; a refused choice keeps the stored material and a message.
local editor=require 'main.editor.editor'
local doc=require 'main.editor.editor_doc'
local material=require 'main.terrain_perspective.material'
local M={}
local B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function M.base64(data)
    local out={}
    for i=1,#data,3 do
        local a,b,c=data:byte(i,i+2)
        local n=a*65536+(b or 0)*256+(c or 0)
        local function ch(k) local v=math.floor(n/64^k)%64;return B64:sub(v+1,v+1) end
        out[#out+1]=ch(3)..ch(2)..(b and ch(1) or '=')..(c and ch(0) or '=')
    end
    return table.concat(out)
end
-- Only known fields reach the document; the validator refuses unknown IDs.
function M.clean(m)
    if type(m)~='table' then return nil,'Choose a material first.' end
    local out={version=material.MATERIAL_VERSION,preset=m.preset}
    for _,k in ipairs(material.OVERRIDES) do
        if type(m[k])=='string' and m[k]~='' and m[k]~=m.preset then out[k]=m[k] end
    end
    local ok,err=material.validate(out)
    if not ok then return nil,err end
    return out
end
local function locked(e)
    for _,o in ipairs(e.objects) do
        if doc.terrain(o) and o.locked then return 'Locked terrain: unlock it first. A level material changes every section.' end
    end
end
function M.candidate(m)
    local clean,err=M.clean(m)
    if not clean then return nil,err end
    local e=doc.copy(editor.doc.editor)
    local set,why=doc.set_material(e,clean)
    if not set then return nil,why end
    -- A material raises the stride: the level must still fit, as 3D look checks.
    local compiled,blocked=doc.compile({schema=1,units='metres',id=editor.doc.id,name=editor.doc.name,editor=e})
    if not compiled and blocked and blocked:find('Resource budget:',1,true) then return nil,(blocked:match('^[^%.]+%.') or blocked)..' Shorten or simplify terrain to use a material.' end
    return e,nil,clean
end
function M.draft(m)
    local e,err=M.candidate(m)
    if not e then
        -- Never keep drawing an older copy of the level.
        M.message=err;M.revision=editor.doc.editor.revision
        if M.current then M.discard();M.message=err end
        return nil,err
    end
    M.message='';M.current=m;M.revision=editor.doc.editor.revision
    editor.look_preview=e;editor.look_epoch=(editor.look_epoch or 0)+1;editor.touch()
    return e
end
function M.discard()
    local owned=M.current~=nil
    M.current=nil;M.message=''
    if not owned then return end -- a retained 3D look preview stays
    editor.look_preview=nil;editor.look_epoch=(editor.look_epoch or 0)+1;editor.touch()
end
function M.apply()
    if not M.current then M.message='Choose a material first.';return nil,M.message end
    local _,err,clean=M.candidate(M.current)
    if err then M.message=err;return nil,err end
    local blocked=locked(editor.doc.editor)
    if blocked then M.message=blocked;return nil,blocked end
    if json.encode(editor.doc.editor.material or false)==json.encode(clean) then M.discard();return true end
    local ok,why=editor.commit(function(target)
        local set,err2=doc.set_material(target,clean)
        if not set then return nil,err2 end
    end,false)
    if not ok then M.message=why or 'Apply refused';return nil,M.message end
    M.discard()
    return true
end
function M.commit(m)
    if not M.draft(m) then return nil end
    local ok,why=M.apply()
    if not ok then local message=M.message;M.discard();M.message=message;return nil,why end
    return true
end
-- #706: the library's Texture tab (main/editor/web/chrome.js) replaced the DOM panel; it commits through M.commit.
function M.visible() return false end
-- A choice from the library's Texture tab: a preset (overrides kept) or one override ('' inherits).
function M.op(o)
    if not editor.doc then return end
    local m=editor.doc.editor.material
    if type(o.preset)=='string' then
        m=doc.copy(m or {});m.version=material.MATERIAL_VERSION;m.preset=o.preset
    elseif m and (o.key=='surface' or o.key=='band' or o.key=='fill') then
        m=doc.copy(m);m[o.key]=type(o.value)=='string' and o.value~='' and o.value or nil
    else return end
    return M.commit(m)
end
function M.presets()
    local list={}
    local names={meadow='Meadow',quarry='Quarry',volcano='Volcano',city='City street',inca='Inca stone',glacier='Glacier',scrapyard='Scrapyard'}
    for _,id in ipairs(material.PRESETS) do
        local png=sys.load_resource('/main/terrain_material/presets/'..id..'/thumb.png')
        list[#list+1]={id=id,name=names[id] or id,thumb=png and 'data:image/png;base64,'..M.base64(png) or ''}
    end
    return list
end
-- A refused choice keeps its message until the next choice; closing only drops a draft.
function M.close() M.discard() end
-- The draft follows edits made meanwhile (a commit normally leaves none).
function M.tick()
    if M.current and editor.doc and M.revision~=editor.doc.editor.revision then M.draft(M.current) end
end
return M
