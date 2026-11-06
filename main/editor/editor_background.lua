-- Background panel session: a choice commits at once as one Undo step; a slider drag previews until release.
local editor=require 'main.editor.editor'
local doc=require 'main.editor.editor_doc'
local source=require 'main.backgrounds.source'
local M={}
local function equal(a,b)
    if type(a)~=type(b) then return false end
    if type(a)~='table' then return a==b end
    for k,v in pairs(a) do if not equal(v,b[k]) then return false end end
    for k in pairs(b) do if a[k]==nil then return false end end
    return true
end
function M.candidate(b)
    local ok,err=source.validate(b)
    if not b or not ok then return nil,err or 'Choose a background preset first.' end
    local e=doc.copy(editor.doc.editor)
    local set,why=doc.set_backgrounds(e,b)
    if not set then return nil,why end
    return e
end
function M.discard()
    local owned=M.current~=nil or editor.background_preview~=nil
    M.current=nil;M.message='';editor.background_preview=nil;if owned then editor.touch() end
end
function M.draft(b)
    local e,err=M.candidate(b)
    if not e then M.discard();M.message=err;return nil,err end
    M.current=doc.copy(e.backgrounds);M.instance=editor.opened;M.revision=editor.doc.editor.revision
    local _,warning=source.resolve(M.current);M.message=warning or ''
    editor.background_preview=e;editor.touch();return e
end
function M.apply()
    if not M.current then
        if editor.doc and editor.doc.editor.backgrounds then M.message='';return true end
        M.message='Choose a background preset first.';return nil,M.message
    end
    if M.instance~=editor.opened then M.discard();M.message='The level changed. Reopen Background.';return nil,M.message end
    local e,err=M.candidate(M.current)
    if not e then M.message=err;return nil,err end
    if equal(e.backgrounds,editor.doc.editor.backgrounds) then M.discard();return true end
    local b=e.backgrounds
    local ok,why=editor.commit(function(target) return doc.set_backgrounds(target,b) end,false)
    if not ok then M.message=why or 'Apply refused';return nil,M.message end
    M.discard();return true
end
function M.commit(b)
    if not M.draft(b) then return nil end
    local ok,why=M.apply()
    if not ok then local message=M.message;M.discard();M.message=message;return nil,why end
    return true
end
function M.visible() return html5 and html5.run('!!window.riderBackgroundPanel?.visible')=='true' end
function M.close()
    M.discard();M.instance=nil;M.revision=nil;M.suspended=false
    if html5 then html5.run('window.riderBackgroundPanel&&window.riderBackgroundPanel.close()') end
end
local show
-- Yield to canvas dialogs. A slider drag ends without storing; the panel returns to the stored value.
function M.suspend(value)
    local blocked=value and true or false
    if M.suspended==blocked then return end
    M.suspended=blocked
    -- A dialog ends a slider drag: the stored value stays and the panel shows it again.
    if blocked then M.discard() end
    if html5 then
        html5.run('window.riderBackgroundPanel&&window.riderBackgroundPanel.suspend('..tostring(blocked)..')')
        if blocked and M.visible() then show() end
    end
end
local function presets()
    local list={};local track=require 'main.editor.editor_track'
    local names={meadow='Meadow',quarry='Quarry',city='City',volcano='Volcano'}
    for _,id in ipairs(source.PRESETS) do
        local png=sys.load_resource('/main/background_presets/'..id..'/thumb.png')
        list[#list+1]={id=id,name=names[id],thumb=png and 'data:image/png;base64,'..track.base64(png) or ''}
    end
    return list
end
function M.open()
    if not html5 or not editor.doc then return end
    local look=require 'main.editor.editor_look'
    local track=require 'main.editor.editor_track'
    track.close();look.close();M.discard();M.suspended=false;M.instance=editor.opened;M.revision=editor.doc.editor.revision
    html5.run(assert(sys.load_resource('/main/game/background_panel.js'),'Missing Background panel'))
    html5.run('window.riderBackgroundPanel.open('..json.encode(presets())..','..json.encode(editor.doc.editor.backgrounds or false)..')')
end
function M.handle(message)
    if type(message)~='table' then return end
    if message.type=='draft' then M.draft(message.backgrounds)
    elseif message.type=='commit' then M.commit(message.backgrounds)
    elseif message.type=='close' then M.close()
    elseif message.type=='track' then
        M.close();require('main.editor.editor_track').open()
    end
end
function show()
    local b=M.current or editor.doc.editor.backgrounds
    local _,warning=source.resolve(b)
    html5.run('window.riderBackgroundPanel.show('..json.encode(b or false)..','..json.encode(M.message~='' and M.message or warning or '')..')')
end
function M.tick()
    if not (html5 and M.visible()) then return end
    if editor.mode~='edit' or M.instance~=editor.opened then M.close();return end
    if M.suspended then return end
    local changed=M.revision~=editor.doc.editor.revision
    if changed then
        M.revision=editor.doc.editor.revision
        if M.current then M.draft(M.current) end
    end
    local text=html5.run('window.riderBackgroundPanel.take()')
    if text=='[]' then if changed then show() end;return end
    local ok,list=pcall(json.decode,text)
    if not ok or type(list)~='table' then return end
    for _,message in ipairs(list) do M.handle(message);if not M.visible() then break end end
    if M.visible() then show() end
end
return M
