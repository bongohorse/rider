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
-- A slider being dragged shows its value live; release commits it as one Undo step.
function M.live(o,field)
    -- Only for the selected object in the revision it started in: Undo, a commit or a new selection drops it.
    local p=M.preview
    if p and p.id==o.id and p.id==M.selected and p.field==field and p.revision==editor.doc.editor.revision then return p.value end
    if field=='scale' then return o.scale or 1 end
    if field=='rotation' then return o.rotation or 0 end
    return o[field]
end
-- id -> resolved pose for the current source, with a live drag applied.
function M.resolved()
    local out={}
    local b=M.block()
    for _,o in ipairs(b and b.items or {}) do
        if not o.to then
            local distance,src=o.distance,o.source
            if M.drag and M.drag.id==o.id then distance,src=M.drag.distance,M.drag.source end
            local x,y,angle=source.resolve(parts_of(src),distance,M.live(o,'offset'),o.tilt)
            if x then out[o.id]={x=x,y=y,angle=source.angle(angle,M.live(o,'rotation')),base=angle}
            elseif o.at then out[o.id]={x=o.at[1],y=o.at[2],angle=source.angle(o.at[3],o.rotation),stale=true} end
        end
    end
    return out
end
function M.ghost()
    local a,h=M.fence_arm,M.hover
    if type(a)~='table' or not h or h.source~=a.source or math.abs(h.distance-a.distance)<.1 then return nil end
    local points=fence.points(parts_of(a.source),math.min(a.distance,h.distance),math.max(a.distance,h.distance),M.offset)
    return points and {points=points,placement=M.placement,source=a.source,ghost=true} or nil
end
function M.live_key()
    local a,h,d=M.fence_arm,M.hover,M.drag
    return (type(a)=='table' and h and a.distance..':'..h.source..':'..h.distance or '')..(d and d.edge and d.edge..d.value or '')
end
-- The drawn fences of the current source, with a live drag applied.
function M.fences()
    local list={}
    local b=M.block()
    for _,o in ipairs(b and b.items or {}) do
        if o.to then
            local from,to=o.distance,o.to
            local d=M.drag and M.drag.id==o.id and M.drag
            if d and d.edge then
                if d.edge=='from' then from=d.value else to=d.value end
                from,to=math.min(from,to),math.max(from,to)
            elseif d then from,to=d.distance,d.distance+o.to-o.distance end
            local points=fence.points(parts_of(o.source),from,to,M.live(o,'offset'))
            local stale=not points or not source.fits(parts_of(o.source),o.to)
            if stale and M.drag and M.drag.id==o.id and M.drag.source then
                points=fence.points(parts_of(M.drag.source),from,to,M.live(o,'offset'));stale=not points
            end
            if stale and o.at then points={{o.at[1],o.at[2]},{o.at[3],o.at[4]}} end
            if points then list[#list+1]={id=o.id,points=points,placement=o.placement,hidden=o.hidden,source=o.source,stale=stale} end
        end
    end
    -- The fence being drawn follows the cursor from its first click.
    local g=M.ghost()
    if g then list[#list+1]=g end
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
    M.preview=nil
    if M.arming=='range' then M.stretch={a=p[1],b=p[1]};M.arming='range_b';M.message='Move to size the range, click to end it.';M.shown=nil;editor.touch();return end
    if M.arming=='range_b' then M.stretch.b=p[1];M.arming=nil;M.message='Drag a range edge to adjust it.';M.shown=nil;editor.touch();return end
    -- With Populate open, a range edge drags.
    local a,b2=M.stretch.a,M.stretch.b
    if M.pop and a and b2 then
        local m=editor.screen;local tol=m and 10/math.max(1e-6,math.abs(m.ppm_x)) or .3
        for _,k in ipairs({'a','b'}) do
            if math.abs(p[1]-M.stretch[k])<=tol then M.drag={range=k,start=p,moved=false};return end
        end
    end
    -- The live result is not stored yet: objects are edited after Apply, so a click never edits an unseen one.
    if M.pop then M.selected=nil;M.message='Live Populate: Apply, or untick all objects, to edit single objects.';M.shown=nil;return end
    if M.fence_arm then
        local near=edit.nearest(editor.doc.editor.objects,doc.parts,doc.terrain,p)
        if not near then M.message='No visible track within '..edit.SNAP..' m. Click closer to a run.';M.shown=nil;return end
        if M.fence_arm=='start' then M.fence_arm=near;M.hover=near;M.message='Move to size the fence, click to end it.';M.shown=nil;editor.touch();return end
        local first=M.fence_arm
        if near.source~=first.source or math.abs(near.distance-first.distance)<.1 then M.message='A fence starts and ends on one terrain piece.';M.shown=nil;return end
        M.fence_arm=nil;M.hover=nil;M.message='Drag an end to change the length. Pick the fence again for another.'
        local new
        if commit(function(block)
            new=edit.add(block,{source=first.source,distance=math.min(first.distance,near.distance),offset=M.offset,placement=M.placement,tilt=true,asset=M.fence_asset or 'fence-wood'})
            new.to=math.max(first.distance,near.distance)
            local points=fence.points(parts_of(first.source),new.distance,new.to,M.offset)
            if not points then return 'That stretch of track is too short for a fence.' end
        end) then M.selected=new.id end
        editor.touch()
        return
    end
    local b=editor.doc.editor.decorations
    -- A selected fence's end: drag it to change the length.
    local sel=selected_item()
    if sel and sel.to and not sel.locked then
        for _,f in ipairs(M.fences()) do
            if f.id==sel.id and not f.stale then
                for _,e in ipairs({{'from',f.points[1],sel.distance},{'to',f.points[#f.points],sel.to}}) do
                    local q=e[2]
                    if math.abs(p[1]-q[1])<=.45 and p[2]>=q[2]-.3 and p[2]<=q[2]+fence.HEIGHT+.3 then
                        M.drag={id=sel.id,edge=e[1],value=e[3],start=p,moved=false};return
                    end
                end
            end
        end
    end
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
function M.hover_at(p)
    if M.arming=='range_b' and M.stretch.b~=p[1] then M.stretch.b=p[1];editor.touch() end
    if type(M.fence_arm)~='table' then return end
    local near=edit.nearest(editor.doc.editor.objects,doc.parts,doc.terrain,p)
    if near and near.source==M.fence_arm.source and not (M.hover and M.hover.distance==near.distance) then M.hover=near;editor.touch() end
end
function M.move(p)
    M.hover_at(p)
    local d=M.drag
    if not d then return end
    if d.range then M.stretch[d.range]=p[1];d.moved=true;editor.touch();return end
    local near=edit.nearest(editor.doc.editor.objects,doc.parts,doc.terrain,p)
    local item=edit.find(editor.doc.editor.decorations,d.id)
    if d.edge then
        if near and item and near.source==item.source and (d.moved or math.abs(p[1]-d.start[1])>.05) then d.value,d.moved=near.distance,true;editor.touch() end
        return
    end
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
    if not (d and d.moved) or d.range then return end
    commit(function(b)
        local o=edit.find(b,d.id)
        if not o then return 'That decoration no longer exists.' end
        if d.edge then
            local from,to=o.distance,o.to
            if d.edge=='from' then from=d.value else to=d.value end
            from,to=math.min(from,to),math.max(from,to)
            if to-from<.1 or not fence.points(parts_of(o.source),from,to,o.offset) then return 'A fence needs some length.' end
            o.distance,o.to=from,to;return
        end
        if o.to then o.to=d.distance+o.to-o.distance end
        o.source,o.distance=d.source,d.distance
    end)
end
function M.cancel()
    if M.arming then M.arming=nil;M.stretch=M.stretch_before or {};editor.touch() end
    if type(M.fence_arm)=='table' then M.fence_arm='start';M.hover=nil;editor.touch() end
    if M.preview then M.preview=nil;editor.touch() end
    if M.drag then M.drag=nil;editor.touch() end
end
function M.delete()
    if not selected_item() then return end
    local id=M.selected
    if commit(function(b) local _,i=edit.find(b,id);table.remove(b.items,i) end) then M.selected=nil end
end
local function change(fields)
    if not selected_item() then return end
    local id=M.selected
    -- false clears a flag: pairs never visits a nil value, so {locked=nil} would change nothing.
    commit(function(b) local o=edit.find(b,id);for k,v in pairs(fields) do if (v==false and (k=='hidden' or k=='locked')) or (k=='scale' and v==1) or (k=='rotation' and v==0) then v=nil end;o[k]=v end end)
end
function M.copy()
    local o=selected_item()
    if not o then return end
    if o.to then M.message='Pick the fence in the list to draw another.';M.shown=nil;return end
    if not parts_of(o.source) then M.message='Drag this object onto a run before copying it.';M.shown=nil;return end
    local new
    if commit(function(b)
        new=edit.add(b,{source=o.source,distance=math.min(o.distance+1,source.length(parts_of(o.source))),offset=o.offset,placement=o.placement,tilt=o.tilt,asset=o.asset,scale=o.scale})
        new.hidden,new.locked,new.rotation=o.hidden,o.locked,o.rotation
    end) then M.selected=new.id end
end
-- One Undo step. A result the level cannot hold places nothing.
local function compute(settings)
    local e=editor.doc.editor
    local pieces={}
    for _,o in ipairs(e.objects) do if doc.terrain(o) then pieces[#pieces+1]={id=o.id,parts=doc.parts(o),hidden=o.hidden} end end
    if #pieces==0 then return nil,'Draw some track before Populate.' end
    local a,b=M.stretch.a,M.stretch.b
    local stretch=a and b and math.abs(a-b)>.05 and {math.min(a,b),math.max(a,b)} or nil
    local exclude={e.start.position};if e.finish then exclude[2]=e.finish.position end
    return populate.run(edit.block(e),pieces,settings,stretch,exclude)
end
-- While Populate is open its result shows live, unsaved, until Apply (#636).
function M.block()
    local b=editor.doc and editor.doc.editor.decorations
    local s=M.pop
    if not s then return b end
    s.placement,s.tilt,s.offset=M.placement,M.tilt,M.offset
    local key=table.concat({editor.doc.editor.revision,tostring(editor.shape_version),json.encode(s),tostring(M.stretch.a),tostring(M.stretch.b)},':')
    if M.pop_cache and M.pop_cache.key==key then return M.pop_cache.block or b end
    local result,why=compute(s)
    M.pop_cache={key=key,block=result and {version=source.VERSION,next_id=result.next_id,items=result.items} or nil}
    -- A result the level cannot hold says so now, not only on Apply.
    M.pop_why=not result and why or nil
    return M.pop_cache.block or b
end
function M.pop_key() return M.pop and M.pop_cache and M.pop_cache.key or '' end
function M.run_populate(settings)
    local result,why=compute(settings)
    if not result then M.message=why;M.shown=nil;return end
    M.selected=nil
    -- Applied: the track shows what is stored, so Undo visibly takes it back; the next change goes live again.
    if commit(function(b2)
        b2.next_id,b2.items=result.next_id,result.items
    end) then M.pop,M.pop_cache,M.pop_why=nil,nil,nil;M.message='Applied. Change a setting to preview again.';M.shown=nil end
end
function M.visible() return html5 and html5.run('!!window.riderDecorationPanel?.visible')=='true' end
function M.close()
    M.cancel();M.selected=nil;M.pop=nil;M.pop_cache=nil;M.arming=nil
    if html5 then html5.run('window.riderDecorationPanel&&window.riderDecorationPanel.close()') end
end
function M.suspend(value)
    local blocked=value and true or false
    if M.suspended==blocked then return end
    M.suspended=blocked
    if blocked then M.cancel() end
    if html5 then html5.run('window.riderDecorationPanel&&window.riderDecorationPanel.suspend('..tostring(blocked)..')') end
end
-- Where the quick bar sits: the selected object's top centre, as fractions of the window from its bottom left.
local function anchor(o)
    local m=editor.screen
    if not (o and m) then return false end
    local x,y
    if o.to then
        for _,f in ipairs(M.fences()) do if f.id==o.id then local a,b=f.points[1],f.points[#f.points];x,y=(a[1]+b[1])/2,math.max(a[2],b[2])+1.2 end end
    else
        local d=M.drag and M.drag.id==o.id and M.drag
        local rx,ry,ra=source.resolve(parts_of(d and d.source or o.source),d and d.distance or o.distance,M.live(o,'offset'),o.tilt)
        local r=rx and {x=rx,y=ry,angle=source.angle(ra,M.live(o,'rotation'))}
        local a=catalog.ASSETS[o.asset]
        if r and a then local lift=a.height*M.live(o,'scale');x,y=r.x-math.sin(r.angle)*lift,r.y+math.cos(r.angle)*lift end
    end
    if not x then return false end
    local w,h=window.get_size()
    if w<=0 or h<=0 then return false end
    return {x=math.floor((m.ox+x*m.ppm_x)/w*1000+.5)/1000,y=math.floor((m.oy+y*m.ppm_y)/h*1000+.5)/1000}
end
-- The selected object's transform box for the handles, in window fractions from the bottom left.
local function box(o)
    local m=editor.screen
    if not (o and m) or o.to then return false end
    local d=M.drag and M.drag.id==o.id and M.drag
    local parts=parts_of(d and d.source or o.source)
    local x,y,base,track=source.resolve(parts,d and d.distance or o.distance,M.live(o,'offset'),o.tilt)
    local a=catalog.ASSETS[o.asset]
    if not (x and a) then return false end
    local w,h=window.get_size()
    if w<=0 or h<=0 then return false end
    local size=M.live(o,'scale')
    local r=function(v) return math.floor(v*10000+.5)/10000 end
    return {x=r((m.ox+x*m.ppm_x)/w),y=r((m.oy+y*m.ppm_y)/h),kx=r(m.ppm_x/w),ky=r(m.ppm_y/h),angle=r(source.angle(base,M.live(o,'rotation'))),normal=r(track),
        w=r(a.width*size),h=r(a.height*size),sink=r(a.sink*size),scale=size,offset=M.live(o,'offset'),rotation=M.live(o,'rotation'),locked=o.locked or false}
end
-- Grips at a selected fence's ends (or both ends of the one being drawn), in window fractions.
local function ends(o)
    local m=editor.screen
    local w,h=window.get_size()
    if not m or w<=0 or h<=0 or not ((o and o.to) or type(M.fence_arm)=='table') then return false end
    local f
    for _,x in ipairs(M.fences()) do if (o and o.to and x.id==o.id and not o.locked and not x.stale) or x.ghost then f=x end end
    if not f then return false end
    local r=function(p) return {x=math.floor((m.ox+p[1]*m.ppm_x)/w*1000+.5)/1000,y=math.floor((m.oy+(p[2]+fence.HEIGHT/2)*m.ppm_y)/h*1000+.5)/1000} end
    return {r(f.points[1]),r(f.points[#f.points])}
end
local function state()
    local o=selected_item()
    local m,range=editor.screen,false
    local w=window.get_size()
    if m and w>0 and M.stretch.a and M.stretch.b then
        local fx=function(x) return math.floor((m.ox+x*m.ppm_x)/w*1000+.5)/1000 end
        range={a=fx(math.min(M.stretch.a,M.stretch.b)),b=fx(math.max(M.stretch.a,M.stretch.b))}
    end
    return {ends=ends(o),box=box(o),range=range,live=M.pop~=nil,anchor=anchor(o),fence_asset=M.fence_arm and (M.fence_asset or 'fence-wood') or false,stretch={a=M.stretch.a or false,b=M.stretch.b or false},arming=M.arming or false,asset=M.asset,placement=M.placement,tilt=M.tilt,offset=M.offset,message=M.pop_why or M.message,
        selected=o and {fence=o.to~=nil,id=o.id,asset=o.asset,placement=o.placement,tilt=o.tilt,offset=o.offset,scale=o.scale or 1,rotation=o.rotation or 0,hidden=o.hidden or false,locked=o.locked or false} or false}
end
-- The presets with their thumbnails, world and category (#705: the editor library's Decor tab shows them).
local palette_cache
local function palette()
    if palette_cache then return palette_cache end
    local track=require 'main.editor.editor_track'
    local tags=require('main.decorations.library').TAGS
    local list={}
    local function add(id,name,fence)
        local png=sys.load_resource('/main/decorations/meadow/thumbs/'..id..'.png')
        local tag=tags[id] or {}
        list[#list+1]={id=id,name=name,fence=fence,world=tag.world or 'meadow',category=tag.category or (fence and 'fences' or 'props'),thumb=png and 'data:image/png;base64,'..track.base64(png) or ''}
    end
    for _,id in ipairs(catalog.ORDER) do add(id,catalog.ASSETS[id].name,false) end
    -- Fences are drawn, not dropped: click, move, click.
    for id,f in pairs(catalog.FENCES) do add(id,f.name,true) end
    palette_cache=list
    return list
end
M.palette=palette
-- The armed preset or fence, for the library's on-state.
function M.armed() return {asset=M.asset or false,fence=M.fence_arm and (M.fence_asset or 'fence-wood') or false} end
function M.open()
    if not html5 or not editor.doc then return end
    M.instance=editor.opened;M.suspended=false;M.selected=nil;M.message='';M.shown=nil;M.stretch={};M.arming=nil;M.fence_arm=nil;M.pop=nil;M.pop_cache=nil
    html5.run(assert(sys.load_resource('/main/game/decoration_panel.js'),'Missing Decoration panel'))
    html5.run('window.riderDecorationPanel.open('..json.encode(palette())..')')
end
local function valid(s)
    local function range(v,lo,hi) return type(v)=='number' and v==v and v>=lo and v<=hi end
    local known=type(s.assets)=='table'
    for _,id in ipairs(known and s.assets or {}) do known=known and catalog.ASSETS[id]~=nil end
    return known and range(s.density,.1,40) and range(s.spacing,.25,50) and range(s.size_min,source.MIN_SCALE,source.MAX_SCALE) and range(s.size_max,s.size_min,source.MAX_SCALE) and range(s.slope,0,90) and range(s.seed,0,2147483646) and s.seed%1==0
end
function M.handle(m)
    if type(m)~='table' then return end
    if m.type=='asset' and catalog.FENCES[m.value] then M.fence_asset=m.value;M.fence_arm='start';M.hover=nil;M.selected=nil;M.message='Click where the fence starts.';M.shown=nil;editor.touch()
    elseif m.type=='asset' and catalog.ASSETS[m.value] then M.asset=m.value;M.fence_arm=nil;M.hover=nil;M.selected=nil;M.preview=nil;M.shown=nil;editor.touch()
    elseif m.type=='placement' and source.PLACEMENTS[m.value] then M.placement=m.value;if selected_item() then change({placement=m.value}) end
    elseif m.type=='tilt' then M.tilt=m.value==true;if selected_item() then change({tilt=M.tilt}) end
    elseif m.type=='offset' and type(m.value)=='number' and math.abs(m.value)<=source.MAX_OFFSET then M.offset=m.value;M.preview=nil;if selected_item() then change({offset=m.value}) end
    elseif m.type=='scale' and type(m.value)=='number' and m.value>=source.MIN_SCALE and m.value<=source.MAX_SCALE then M.preview=nil;change({scale=m.value})
    elseif m.type=='rotation' and type(m.value)=='number' and math.abs(m.value)<=source.MAX_ROTATION then M.preview=nil;change({rotation=m.value})
    elseif m.type=='preview' and (m.field=='scale' or m.field=='offset' or m.field=='rotation') and type(m.value)=='number' then
        local o=selected_item()
        local LIMITS={scale={source.MIN_SCALE,source.MAX_SCALE},offset={-source.MAX_OFFSET,source.MAX_OFFSET},rotation={-source.MAX_ROTATION,source.MAX_ROTATION}}
        local lo,hi=LIMITS[m.field][1],LIMITS[m.field][2]
        if m.field=='offset' and not o then M.offset=math.max(lo,math.min(hi,m.value))
        elseif o and not o.locked then M.preview={id=o.id,field=m.field,revision=editor.doc.editor.revision,value=math.max(lo,math.min(hi,m.value))};editor.touch() end
    elseif m.type=='hidden' then change({hidden=m.value==true})
    elseif m.type=='locked' then change({locked=m.value==true})
    elseif m.type=='arm' and m.value=='range' then M.arming='range';M.stretch_before=M.stretch;M.stretch={};M.selected=nil;M.message='Click where the range starts.';M.shown=nil;editor.touch()
    elseif m.type=='clear_stretch' then M.stretch={};M.arming=nil;editor.touch()
    elseif m.type=='populate' and type(m.settings)=='table' then
        local s=m.settings
        if valid(s) then
            s.placement,s.tilt,s.offset=M.placement,M.tilt,M.offset
            M.run_populate(s)
        else M.message='Invalid Populate settings.';M.shown=nil end
    elseif m.type=='populate_live' then
        -- Live only with something to place; otherwise the track shows what is stored.
        local s=type(m.settings)=='table' and m.settings
        M.pop=s and valid(s) and #s.assets>0 and s or nil;M.pop_why=nil;if M.pop then M.selected=nil end;editor.touch()
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
