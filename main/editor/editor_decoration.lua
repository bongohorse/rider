-- Decoration tool session: the DOM panel presents, Lua validates and owns source, Undo and storage.
local editor=require 'main.editor.editor'
local doc=require 'main.editor.editor_doc'
local source=require 'main.decorations.source'
local edit=require 'main.decorations.edit'
local catalog=require 'main.decorations.assets'
local M={asset='cone',placement='front',tilt=true,offset=0,selected=nil,drag=nil,message=''}
-- Every terrain piece's sampled parts, read once per call site.
local function parts_of(id)
    for _,o in ipairs(editor.doc.editor.objects) do if o.id==id and doc.terrain(o) then return doc.parts(o) end end
end
-- id -> resolved pose for the current source, with a live drag applied.
function M.resolved()
    local out={}
    local b=editor.doc and editor.doc.editor.decorations
    for _,o in ipairs(b and b.items or {}) do
        local distance,src=o.distance,o.source
        if M.drag and M.drag.id==o.id then distance,src=M.drag.distance,M.drag.source end
        local x,y,angle=source.resolve(parts_of(src),distance,o.offset,o.tilt)
        if x then out[o.id]={x=x,y=y,angle=angle} end
    end
    return out
end
-- One Undo step; a change the level cannot hold is refused whole, with the budget's limit and correction.
local function commit(fn)
    local ok,err=editor.commit(function(e)
        local b=doc.copy(edit.block(e))
        local why=fn(b)
        if why then return nil,why end
        local set,reason=doc.set_decorations(e,b)
        if not set then return nil,reason end
        local _,blocked=doc.compile({schema=1,units='metres',id=editor.doc.id,name=editor.doc.name,editor=e})
        if blocked and blocked:find('Resource budget:',1,true) then return nil,blocked end
    end,false)
    M.message=ok and '' or err or 'Edit refused'
    return ok
end
local function selected_item(e) return edit.find((e or editor.doc.editor).decorations,M.selected) end
function M.place(p)
    local near=edit.nearest(editor.doc.editor.objects,doc.parts,doc.terrain,p)
    if not near then M.message='No visible track within '..edit.SNAP..' m. Click closer to a run.';return end
    local new
    if commit(function(b)
        new=edit.add(b,{source=near.source,distance=near.distance,offset=M.offset,placement=M.placement,tilt=M.tilt,asset=M.asset})
    end) then M.selected=new.id end
end
-- Canvas press: grab the object under the cursor, otherwise place one.
function M.press(p)
    local b=editor.doc.editor.decorations
    local hit=b and edit.pick(b,M.resolved(),p,catalog.ASSETS)
    if hit then
        M.selected=hit.id
        if hit.locked then M.message='Locked: '..hit.id..'. Unlock it before moving it.';return end
        M.drag={id=hit.id,source=hit.source,distance=hit.distance,start=p,moved=false}
        return
    end
    M.place(p)
end
function M.move(p)
    local d=M.drag
    if not d then return end
    local near=edit.nearest(editor.doc.editor.objects,doc.parts,doc.terrain,p)
    if near and (d.moved or math.abs(p[1]-d.start[1])+math.abs(p[2]-d.start[2])>.05) then
        d.source,d.distance,d.moved=near.source,near.distance,true;editor.touch()
    end
end
function M.release()
    local d=M.drag;M.drag=nil
    if not (d and d.moved) then return end
    commit(function(b)
        local o=edit.find(b,d.id)
        if not o then return 'That decoration no longer exists.' end
        o.source,o.distance=d.source,d.distance
    end)
end
function M.cancel() if M.drag then M.drag=nil;editor.touch() end end
function M.delete()
    if not selected_item() then return end
    local id=M.selected
    if commit(function(b) local _,i=edit.find(b,id);table.remove(b.items,i) end) then M.selected=nil end
end
local function change(fields)
    if not selected_item() then return end
    local id=M.selected
    commit(function(b) local o=edit.find(b,id);for k,v in pairs(fields) do o[k]=v end end)
end
function M.copy()
    local o=selected_item()
    if not o then return end
    local new
    if commit(function(b)
        new=edit.add(b,{source=o.source,distance=o.distance+1,offset=o.offset,placement=o.placement,tilt=o.tilt,asset=o.asset})
    end) then M.selected=new.id end
end
function M.visible() return html5 and html5.run('!!window.riderDecorationPanel?.visible')=='true' end
function M.close()
    M.cancel();M.selected=nil
    if html5 then html5.run('window.riderDecorationPanel&&window.riderDecorationPanel.close()') end
end
function M.suspend(value)
    local blocked=value and true or false
    if M.suspended==blocked then return end
    M.suspended=blocked
    if blocked then M.cancel() end
    if html5 then html5.run('window.riderDecorationPanel&&window.riderDecorationPanel.suspend('..tostring(blocked)..')') end
end
local function state()
    local o=selected_item()
    return {asset=M.asset,placement=M.placement,tilt=M.tilt,offset=M.offset,message=M.message,
        selected=o and {id=o.id,asset=o.asset,placement=o.placement,tilt=o.tilt,offset=o.offset,hidden=o.hidden or false,locked=o.locked or false} or false}
end
local function palette()
    local track=require 'main.editor.editor_track'
    local list={}
    for _,id in ipairs(catalog.ORDER) do
        local png=sys.load_resource('/main/decorations/meadow/thumbs/'..id..'.png')
        list[#list+1]={id=id,name=catalog.ASSETS[id].name,thumb=png and 'data:image/png;base64,'..track.base64(png) or ''}
    end
    return list
end
function M.open()
    if not html5 or not editor.doc then return end
    M.instance=editor.opened;M.suspended=false;M.selected=nil;M.message='';M.shown=nil
    html5.run(assert(sys.load_resource('/main/game/decoration_panel.js'),'Missing Decoration panel'))
    html5.run('window.riderDecorationPanel.open('..json.encode(palette())..')')
end
function M.handle(m)
    if type(m)~='table' then return end
    if m.type=='asset' and catalog.ASSETS[m.value] then M.asset=m.value
    elseif m.type=='placement' and source.PLACEMENTS[m.value] then M.placement=m.value;if selected_item() then change({placement=m.value}) end
    elseif m.type=='tilt' then M.tilt=m.value==true;if selected_item() then change({tilt=M.tilt}) end
    elseif m.type=='offset' and type(m.value)=='number' and math.abs(m.value)<=source.MAX_OFFSET then M.offset=m.value;if selected_item() then change({offset=m.value}) end
    elseif m.type=='hidden' then change({hidden=m.value==true or nil})
    elseif m.type=='locked' then change({locked=m.value==true or nil})
    elseif m.type=='delete' then M.delete()
    elseif m.type=='copy' then M.copy()
    elseif m.type=='close' then M.on_close()
    end
end
function M.tick()
    if not (html5 and M.visible()) then return end
    if editor.mode~='edit' or M.instance~=editor.opened then M.on_close();return end
    if M.suspended then return end
    if M.selected and not selected_item() then M.selected=nil end
    local text=html5.run('window.riderDecorationPanel.take()')
    if text~='[]' then
        local ok,list=pcall(json.decode,text)
        if ok and type(list)=='table' then
            for _,message in ipairs(list) do M.handle(message);if not M.visible() then return end end
        end
    end
    local shown=json.encode(state())
    if shown~=M.shown then M.shown=shown;html5.run('window.riderDecorationPanel.show('..shown..')') end
end
-- The editor script replaces this: closing the panel also leaves the tool.
function M.on_close() M.close() end
return M
