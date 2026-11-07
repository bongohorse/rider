-- Decoration tool session: the DOM panel presents, Lua validates and owns source, Undo and storage.
local editor=require 'main.editor.editor'
local doc=require 'main.editor.editor_doc'
local source=require 'main.decorations.source'
local edit=require 'main.decorations.edit'
local catalog=require 'main.decorations.assets'
local populate=require 'main.decorations.populate'
local fence=require 'main.decorations.fence'
local M={populate=doc.copy(populate.DEFAULTS),arming=nil,stretch={},asset='cone',placement='front',tilt=true,offset=0,selected=nil,drag=nil,message=''}
-- Every terrain piece's sampled parts, read once per call site.
local function parts_of(id)
    for _,o in ipairs(editor.doc.editor.objects) do if o.id==id and doc.terrain(o) then return doc.parts(o) end end
end
-- id -> resolved pose for the current source, with a live drag applied.
function M.resolved()
    local out={}
    local b=editor.doc and editor.doc.editor.decorations
    for _,o in ipairs(b and b.items or {}) do
        if not o.to then
            local distance,src=o.distance,o.source
            if M.drag and M.drag.id==o.id then distance,src=M.drag.distance,M.drag.source end
            local x,y,angle=source.resolve(parts_of(src),distance,o.offset,o.tilt)
            if x then out[o.id]={x=x,y=y,angle=angle}
            elseif o.at then out[o.id]={x=o.at[1],y=o.at[2],angle=o.at[3],stale=true} end
        end
    end
    return out
end
-- The drawn fences of the current source, with a live drag applied.
function M.fences()
    local list={}
    local b=editor.doc and editor.doc.editor.decorations
    for _,o in ipairs(b and b.items or {}) do
        if o.to then
            local from,to=o.distance,o.to
            if M.drag and M.drag.id==o.id then from,to=M.drag.distance,M.drag.distance+o.to-o.distance end
            local points=fence.points(parts_of(o.source),from,to,o.offset)
            local stale=not points or not source.fits(parts_of(o.source),o.to)
            if stale and M.drag and M.drag.id==o.id and M.drag.source then
                points=fence.points(parts_of(M.drag.source),from,to,o.offset);stale=not points
            end
            if stale and o.at then points={{o.at[1],o.at[2]},{o.at[3],o.at[4]}} end
            if points then list[#list+1]={id=o.id,points=points,placement=o.placement,hidden=o.hidden,source=o.source,stale=stale} end
        end
    end
    return list
end
-- One Undo step; a change the level cannot hold is refused whole, with the budget's limit and correction.
local function commit(fn)
    local ok,err=editor.commit(function(e)
        local count=#edit.block(e).items
        local b=doc.copy(edit.block(e))
        local why=fn(b)
        if why then return nil,why end
        local set,reason=doc.set_decorations(e,b)
        if not set then return nil,reason end
        local _,blocked=doc.compile({schema=1,units='metres',id=editor.doc.id,name=editor.doc.name,editor=e})
        -- Only growth is refused: an over-budget level must stay correctable by moving or removing objects.
        if #b.items>count and blocked and blocked:find('Resource budget:',1,true) then return nil,blocked end
    end,false)
    M.message=ok and '' or err or 'Edit refused'
    if not ok then M.shown=nil end -- the panel returns to the stored values
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
    if M.arming then
        M.stretch[M.arming]=p[1];M.arming=nil;M.shown=nil
        return
    end
    if M.fence_arm then
        local near=edit.nearest(editor.doc.editor.objects,doc.parts,doc.terrain,p)
        if not near then M.message='No visible track within '..edit.SNAP..' m. Click closer to a run.';M.shown=nil;return end
        if M.fence_arm=='start' then M.fence_arm=near;M.message='Click where the fence ends, on the same terrain piece.';M.shown=nil;return end
        local first=M.fence_arm;M.fence_arm=nil
        if near.source~=first.source or math.abs(near.distance-first.distance)<.1 then M.message='A fence starts and ends on one terrain piece.';M.shown=nil;return end
        local new
        if commit(function(block)
            new=edit.add(block,{source=first.source,distance=math.min(first.distance,near.distance),offset=M.offset,placement=M.placement,tilt=true,asset='fence-wood'})
            new.to=math.max(first.distance,near.distance)
            local points=fence.points(parts_of(first.source),new.distance,new.to,M.offset)
            if not points then return 'That stretch of track is too short for a fence.' end
        end) then M.selected=new.id end
        return
    end
    local b=editor.doc.editor.decorations
    local hit=b and edit.pick(b,M.resolved(),p,catalog.ASSETS)
    if not hit then
        for _,f in ipairs(M.fences()) do
            if fence.hit(f.points,p) then hit=edit.find(b,f.id) end
        end
    end
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
    local item=edit.find(editor.doc.editor.decorations,d.id)
    if near and item and item.to then
        if not d.moved and math.abs(p[1]-d.start[1])+math.abs(p[2]-d.start[2])<=.05 then return end
        -- A fence slides along its own piece and keeps its length; a stale one moves onto any run.
        local parts=parts_of(item.source)
        if not parts or not source.fits(parts,item.to) then
            d.source,d.distance,d.moved=near.source,math.max(0,math.min(source.length(parts_of(near.source))-(item.to-item.distance),near.distance)),true;editor.touch()
        elseif near.source==item.source then
            local span=item.to-item.distance
            local start=d.anchor or near.distance;d.anchor=start
            d.distance=math.max(0,math.min(source.length(parts_of(item.source))-span,item.distance+near.distance-start))
            d.moved=true;editor.touch()
        end
    elseif near and (d.moved or math.abs(p[1]-d.start[1])+math.abs(p[2]-d.start[2])>.05) then
        d.source,d.distance,d.moved=near.source,near.distance,true;editor.touch()
    end
end
function M.release()
    local d=M.drag;M.drag=nil
    if not (d and d.moved) then return end
    commit(function(b)
        local o=edit.find(b,d.id)
        if not o then return 'That decoration no longer exists.' end
        if o.to then o.to=d.distance+o.to-o.distance end
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
    -- false clears a flag: pairs never visits a nil value, so {locked=nil} would change nothing.
    commit(function(b) local o=edit.find(b,id);for k,v in pairs(fields) do if v==false and (k=='hidden' or k=='locked') then v=nil end;o[k]=v end end)
end
function M.copy()
    local o=selected_item()
    if not o then return end
    if o.to then M.message='Draw another fence with Fence.';M.shown=nil;return end
    if not parts_of(o.source) then M.message='Drag this object onto a run before copying it.';M.shown=nil;return end
    local new
    if commit(function(b)
        new=edit.add(b,{source=o.source,distance=math.min(o.distance+1,source.length(parts_of(o.source))),offset=o.offset,placement=o.placement,tilt=o.tilt,asset=o.asset,scale=o.scale})
        new.hidden,new.locked=o.hidden,o.locked
    end) then M.selected=new.id end
end
-- One Undo step. A result the level cannot hold places nothing.
function M.run_populate(settings)
    local e=editor.doc.editor
    local pieces={}
    for _,o in ipairs(e.objects) do if doc.terrain(o) then pieces[#pieces+1]={id=o.id,parts=doc.parts(o),hidden=o.hidden} end end
    if #pieces==0 then M.message='Draw some track before Populate.';return end
    local a,b=M.stretch.a,M.stretch.b
    local stretch=a and b and {math.min(a,b),math.max(a,b)} or nil
    local exclude={e.start.position};if e.finish then exclude[2]=e.finish.position end
    local result,why=populate.run(edit.block(e),pieces,settings,stretch,exclude)
    if not result then M.message=why;M.shown=nil;return end
    M.selected=nil
    commit(function(b2)
        b2.next_id,b2.items=result.next_id,result.items
    end)
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
    return {stretch={a=M.stretch.a or false,b=M.stretch.b or false},arming=M.arming or false,asset=M.asset,placement=M.placement,tilt=M.tilt,offset=M.offset,message=M.message,
        selected=o and {fence=o.to~=nil,id=o.id,asset=o.asset,placement=o.placement,tilt=o.tilt,offset=o.offset,hidden=o.hidden or false,locked=o.locked or false} or false}
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
    M.instance=editor.opened;M.suspended=false;M.selected=nil;M.message='';M.shown=nil;M.stretch={};M.arming=nil;M.fence_arm=nil
    html5.run(assert(sys.load_resource('/main/game/decoration_panel.js'),'Missing Decoration panel'))
    html5.run('window.riderDecorationPanel.open('..json.encode(palette())..')')
end
function M.handle(m)
    if type(m)~='table' then return end
    if m.type=='asset' and catalog.ASSETS[m.value] then M.asset=m.value
    elseif m.type=='placement' and source.PLACEMENTS[m.value] then M.placement=m.value;if selected_item() then change({placement=m.value}) end
    elseif m.type=='tilt' then M.tilt=m.value==true;if selected_item() then change({tilt=M.tilt}) end
    elseif m.type=='offset' and type(m.value)=='number' and math.abs(m.value)<=source.MAX_OFFSET then M.offset=m.value;if selected_item() then change({offset=m.value}) end
    elseif m.type=='hidden' then change({hidden=m.value==true})
    elseif m.type=='locked' then change({locked=m.value==true})
    elseif m.type=='fence' then M.fence_arm='start';M.selected=nil;M.message='Click where the fence starts.';M.shown=nil
    elseif m.type=='arm' and (m.value=='a' or m.value=='b') then M.arming=m.value
    elseif m.type=='clear_stretch' then M.stretch={};M.arming=nil
    elseif m.type=='populate' and type(m.settings)=='table' then
        local s=m.settings
        local function range(v,lo,hi) return type(v)=='number' and v==v and v>=lo and v<=hi end
        local known=type(s.assets)=='table'
        for _,id in ipairs(known and s.assets or {}) do known=known and catalog.ASSETS[id]~=nil end
        if known and range(s.density,.1,40) and range(s.spacing,.25,50) and range(s.size_min,source.MIN_SCALE,source.MAX_SCALE) and range(s.size_max,s.size_min,source.MAX_SCALE) and range(s.slope,0,90) and range(s.seed,0,2147483646) and s.seed%1==0 then
            s.placement,s.tilt,s.offset=M.placement,M.tilt,M.offset
            M.run_populate(s)
        else M.message='Invalid Populate settings.';M.shown=nil end
    elseif m.type=='release' then M.release()
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
