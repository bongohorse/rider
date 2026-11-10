-- Coin path tool (#672): click the start, move (the coins follow the cursor), click the end. The path then
-- has a middle point; drag points to bend it (an arc over a jump), click the curve to add a point, Alt+click
-- a point to delete it, type - or + to change the spacing, Delete removes the path and its coins.
-- Each finished action is one Undo step; Esc cancels the current one.
local editor=require 'main.editor.editor'
local doc=require 'main.editor.editor_doc'
local P=require 'main.editor.editor_coin_path'
local M={STEP=.25}
local MAX=require('main.game.coin_data').MAX
local function new_id() return editor.new_id() end
local function dist(a,b) return math.sqrt((a[1]-b[1])^2+(a[2]-b[2])^2) end
local function coins(e) local n=0;for _,o in ipairs(e.objects) do if o.type=='coin' then n=n+1 end end;return n end
local function commit(fn)
    local ok,err=editor.commit(function(e)
        local before=coins(e)
        local _,why=fn(e)
        if why then return nil,why end
        doc.refresh_version(e)
        -- Only growth is refused: an over-budget level must stay correctable.
        local _,blocked=doc.compile({schema=1,units='metres',id=editor.doc.id,name=editor.doc.name,editor=e})
        if coins(e)>before and blocked and blocked:find('Resource budget:',1,true) then return nil,blocked end
    end,true)
    if not ok then editor.message=err or 'Edit refused' end
    return ok
end
function M.path() return M.active and P.find(editor.doc.editor,M.active) end
-- The points of the path as shown (with a running drag or the path being drawn).
function M.shown()
    if M.arm and M.hover then return {M.arm,{(M.arm[1]+M.hover[1])/2,(M.arm[2]+M.hover[2])/2},M.hover},true end
    local p=M.path()
    if not p then return nil end
    return M.drag and M.drag.points or p.points,M.drag~=nil
end
local function nearest_point(points,p,tol)
    local best,bi
    for i,q in ipairs(points) do local d=dist(p,q);if d<=tol and (not best or d<best) then best,bi=d,i end end
    return bi
end
-- The control segment whose curve passes nearest p, within tol.
local function nearest_segment(points,p,tol)
    local c=P.curve(points);local best,bi
    for k=2,#c do
        local a,b=c[k-1],c[k];local dx,dy=b[1]-a[1],b[2]-a[2];local l=dx*dx+dy*dy
        local t=l>0 and math.max(0,math.min(1,((p[1]-a[1])*dx+(p[2]-a[2])*dy)/l)) or 0
        local d=dist(p,{a[1]+dx*t,a[2]+dy*t})
        if d<=tol and (not best or d<best) then best,bi=d,math.floor((k-2)/P.STEPS)+1 end
    end
    return bi
end
function M.press(p,tol,alt)
    local e=editor.doc.editor
    if M.arm then
        local a=M.arm;M.arm=nil
        if dist(a,p)<.5 then editor.message='A coin path needs its end at least 0.5 m from its start.';return end
        local made
        if commit(function(x) local path,err=P.add(x,{a,{(a[1]+p[1])/2,(a[2]+p[2])/2},p},P.SPACING,new_id,doc.pickup_id,MAX);made=path;return path,err end) then
            M.active=made.id;editor.message='Drag the middle point up for an arc; - / + change the spacing.'
        end
        return
    end
    local path=M.path()
    if path then
        local i=nearest_point(path.points,p,tol)
        if i and alt then
            if #path.points<=P.MIN_POINTS then editor.message='A coin path keeps at least two points; Delete removes it.';return end
            local pts={};for k,q in ipairs(path.points) do if k~=i then pts[#pts+1]=q end end
            commit(function(x) return P.set(x,path.id,pts,nil,new_id,doc.pickup_id,MAX) end)
            return
        end
        if i then M.drag={index=i,points=doc.copy(path.points),moved=false};return end
        local s=nearest_segment(path.points,p,tol)
        if s and #path.points<P.MAX_POINTS then
            local pts=doc.copy(path.points);table.insert(pts,s+1,{p[1],p[2]})
            M.drag={index=s+1,points=pts,moved=true};return
        end
    end
    for _,other in ipairs(e.coin_paths and e.coin_paths.items or {}) do
        if nearest_point(other.points,p,tol) or nearest_segment(other.points,p,tol) then M.active=other.id;editor.message='';editor.touch();return end
    end
    M.active=nil;M.arm={p[1],p[2]};M.hover={p[1],p[2]}
    editor.message='Move to lay the coins, click to set the end coin. Esc cancels.';editor.touch()
end
function M.move(p)
    M.hover={p[1],p[2]}
    if M.drag then M.drag.points[M.drag.index]={p[1],p[2]};M.drag.moved=true end
    editor.touch()
end
function M.release()
    local d=M.drag;M.drag=nil
    if d and d.moved and M.active then commit(function(x) return P.set(x,M.active,d.points,nil,new_id,doc.pickup_id,MAX) end) end
    editor.touch()
end
function M.busy() return M.drag~=nil or M.arm~=nil end
function M.cancel() M.drag,M.arm=nil,nil;editor.message='';editor.touch() end
function M.delete()
    local path=M.path()
    if not path then editor.message='Click a coin path first; Delete removes it with its coins.';return end
    if commit(function(x) return P.remove(x,path.id) end) then M.active=nil end
end
-- Typed - and + change the spacing of the active path (any keyboard layout).
function M.text(t)
    local path=M.path()
    if not path or (t~='-' and t~='+') then return false end
    local s=math.max(P.MIN_SPACING,math.min(P.MAX_SPACING,path.spacing+(t=='+' and M.STEP or -M.STEP)))
    if s~=path.spacing then commit(function(x) return P.set(x,path.id,nil,s,new_id,doc.pickup_id,MAX) end) end
    return true
end
-- Tool switch or document change: forget the gesture; keep the active path only while it exists.
function M.reset() M.drag,M.arm=nil,nil;if not M.path() then M.active=nil end end
-- Overlay: every path's curve, the active path's points and the coins it would lay.
function M.draw(line,handle,colors)
    local e=editor.doc.editor
    for _,p in ipairs(e.coin_paths and e.coin_paths.items or {}) do
        if p.id~=M.active or not M.drag then
            local c=P.curve(p.points)
            for k=2,#c,2 do line(c[k-2] or c[k-1],c[k],p.id==M.active and colors.active or colors.path,p.id==M.active and 2 or 1) end
        end
    end
    local pts,live=M.shown()
    if not pts then return end
    local c=P.curve(pts)
    for k=2,#c,2 do line(c[k-2] or c[k-1],c[k],colors.active,2) end
    if live then
        local spacing=M.path() and M.path().spacing or P.SPACING
        for _,q in ipairs(P.positions({points=pts,spacing=spacing})) do handle(q,colors.preview,7,true) end
    end
    if not M.arm then for _,q in ipairs(pts) do handle(q,colors.point) end end
end
function M.describe()
    local path=M.path()
    local lines={'Coin path','Click the start, move, click the end coin.','Drag points to bend it; click the curve','to add a point, Alt+click deletes one.','- / + change the spacing; Del removes it.'}
    if path then
        lines[#lines+1]=string.format('Path %s: %d points, %.1f m, %d coins',path.id,#path.points,P.length(path.points),P.members(editor.doc.editor,path.id))
        lines[#lines+1]=string.format('Spacing %.2f m',path.spacing)
    end
    return lines
end
return M
