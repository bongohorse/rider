-- Track textures panel session (#543): a draft previews until Apply, which is one editor commit. Discard restores.
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
    -- A material raises the stride: the level must still fit, as Terrain Look checks.
    local compiled,blocked=doc.compile({schema=1,units='metres',id=editor.doc.id,name=editor.doc.name,editor=e})
    if not compiled and blocked and blocked:find('Resource budget:',1,true) then return nil,(blocked:match('^[^%.]+%.') or blocked)..' Shorten or simplify terrain to use a material.' end
    return e,nil,clean
end
function M.draft(m)
    local e,err=M.candidate(m)
    if not e then M.message=err;return nil,err end
    M.message='';M.current=m;M.revision=editor.doc.editor.revision
    editor.look_preview=e;editor.look_epoch=(editor.look_epoch or 0)+1;editor.touch()
    return e
end
function M.discard()
    local owned=M.current~=nil
    M.current=nil;M.message=''
    if not owned then return end -- a retained Terrain Look preview stays
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
local close
-- Messages from the page, bounded by the page's queue. Returns true when the panel asks to refresh.
function M.handle(message)
    if type(message)~='table' then return end
    if message.type=='draft' then M.draft(message.material)
    elseif message.type=='apply' then M.apply()
    elseif message.type=='discard' then M.discard()
    elseif message.type=='close' then close() end
end
function M.visible() return html5 and html5.run('!!window.riderTrackPanel?.visible')=='true' end
local function presets()
    local list={}
    local names={meadow='Meadow',quarry='Quarry',volcano='Volcano',city='City street',inca='Inca stone',glacier='Glacier',scrapyard='Scrapyard'}
    for _,id in ipairs(material.PRESETS) do
        local png=sys.load_resource('/main/terrain_material/presets/'..id..'/thumb.png')
        list[#list+1]={id=id,name=names[id] or id,thumb=png and 'data:image/png;base64,'..M.base64(png) or ''}
    end
    return list
end
function M.open()
    if not html5 then return end
    local look=require('main.editor.editor_look').session
    if look and look.dirty then editor.message='Apply or reset Terrain Look first.';return end
    M.current=nil
    html5.run(assert(sys.load_resource('/main/game/track_panel.js'),'Missing track panel'))
    html5.run('window.riderTrackPanel.open('..json.encode(presets())..','..json.encode(editor.doc.editor.material or false)..')')
end
function M.close()
    M.discard()
    if html5 then html5.run('window.riderTrackPanel&&window.riderTrackPanel.close()') end
end
close=M.close
function M.tick()
    if not (html5 and M.visible()) then return end
    -- The editor stays usable: a draft follows edits made while it is open.
    if M.current and editor.doc and M.revision~=editor.doc.editor.revision then M.draft(M.current) end
    local text=html5.run('window.riderTrackPanel.take()')
    if text=='[]' then return end
    local ok,list=pcall(json.decode,text)
    if not ok or type(list)~='table' then return end
    for _,message in ipairs(list) do M.handle(message) end
    if not M.visible() then return end
    html5.run('window.riderTrackPanel.show('..json.encode(M.current or editor.doc.editor.material or false)..','..json.encode(M.message or '')..')')
end
return M
