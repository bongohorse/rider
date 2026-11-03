-- O2 (#281): crate, plate and gate controls of the level editor GUI. Called only from editor.gui_script
-- (same GUI context). Every source change is one editor.commit, so one action is one Undo step and the
-- source validator, lock check and autosave apply as for any object. State kept on the GUI instance:
-- self.wire (plate id while Connect waits for a gate), self.selected_link ({from,to} picked on the
-- canvas) and self.drawn_links (the links drawn this frame; only drawn links can be picked).
-- No GUI nodes are created here: links and gate travel use the existing overlay handle pool.
-- Based on Codex's local O2 branch (a10d648, editor.gui_script mechanism additions).
local editor=require 'main.editor.editor'
local mech=require 'main.editor.editor_mechanisms'
local geometry=require 'main.editor.editor_geometry'
local overlay=require 'main.editor.editor_overlay'
local C=require('main.editor.editor_ui').c
local M={is=mech.is,KINDS={crate=true,plate=true,gate=true}}
local NAMES={crate='crates',plate='plates',gate='gates'}
local function find(id) for _,o in ipairs(editor.doc.editor.objects) do if o.id==id then return o end end end
local function number_text(v) return (string.format('%.4f',v):gsub('0+$',''):gsub('%.$','')) end
local function kept(err) return (err:match('%.$') and err or err..'.')..' The previous value is kept.' end
local function remember(self,key,message)
    self.ui_error={key=key,message=message,revision=editor.doc.editor.revision,opened=editor.opened}
    editor.message=message
end
function M.rows(o) return mech.rows(o,editor.doc.editor) end
-- Place tool: one new object with explicit O1 settings, its bottom on the snapped point q.
function M.place(kind,q)
    local e=editor.doc.editor
    if mech.count(e,kind)>=8 then editor.message='A course holds at most 8 '..NAMES[kind]..'; delete one first.';return nil end
    local id
    if not editor.commit(function(x) id=editor.new_id();x.objects[#x.objects+1]=mech.defaults(kind,id,q) end,true) then return nil end
    editor.select(id)
    editor.message=kind=='plate' and 'Plate '..id..' placed. Connect to a gate in Properties; Mode sets Hold, Button or Switch.'
        or kind=='gate' and 'Gate '..id..' placed. Select a plate and use Connect to a gate.'
        or 'Crate '..id..' placed. A plate can accept it in Properties.'
    return id
end
-- A Properties row click: a choice steps to its next value (one commit); a number opens the field.
function M.click(self,o,i)
    local fd=M.rows(o)[i]
    if not fd then return end
    if fd.choices then
        if editor.commit(function(e) return mech.set(e,o.id,fd.key) end,true) then self.ui_error=nil end
        return
    end
    local t=number_text(mech.value(o,fd.key))
    self.field={text=t,initial=t,all=true,param=fd.key,id=o.id,label=fd.label,unit=fd.unit}
    self.ui.reveal='param_'..i
    editor.message=string.format('Type %s (%s to %s%s); Enter applies, Esc cancels.',fd.label:lower(),number_text(fd.min),number_text(fd.max),fd.unit~='' and ' '..fd.unit or '')
end
-- Enter (or a click elsewhere: closing) applies a number field; invalid input keeps the source unchanged.
function M.confirm(self,closing)
    local f=self.field
    if not find(f.id) or f.text==f.initial then self.field=nil;editor.message='';return end
    local ok,err=editor.commit(function(e) return mech.set(e,f.id,f.param,f.text) end,true)
    if ok then self.field,self.ui_error=nil,nil;editor.message='';return end
    f.error=kept(err)
    remember(self,f.param,(closing and 'Not applied: ' or '')..f.error)
    if closing then self.field=nil end
end
-- Properties content of one selected mechanism: rows, disabled steps and the link actions.
function M.fields(self,sel,fields,actions)
    local f=self.field
    for i,fd in ipairs(M.rows(sel)) do
        local name='param_'..i
        local value=mech.display(sel,fd.key)
        local focused=f and f.param==fd.key and f.id==sel.id
        if focused then value=f.all and '['..f.text..']' or f.text..'_' end
        -- Number rows carry their unit in the label and have no -/+ pair: one pooled box per row keeps the
        -- largest plate (9 actor rows, 8 links) inside the fixed 128-box pool. Typing and Tab still apply.
        fields[#fields+1]={name=name,label=fd.label..(not fd.choices and fd.unit~='' and ' ('..fd.unit..')' or ''),unit=not fd.choices and '' or nil,value=value,choices=fd.choices~=nil,
            error=focused and f.error or self.ui_error and self.ui_error.key==fd.key and self.ui_error.message or nil}
    end
    if sel.type=='plate' then actions[#actions+1]={name='wire',label=self.wire==sel.id and 'Click a gate... [Esc]' or 'Connect to a gate',tip='Then click a gate: one directed plate -> gate connection. Esc cancels.'} end
    for _,l in ipairs(mech.links_of(editor.doc.editor,sel.id)) do
        local picked=self.selected_link and self.selected_link.from==l.from and self.selected_link.to==l.to
        actions[#actions+1]={name='unlink_'..l.from..'_'..l.to,label=(picked and '> ' or '')..'Disconnect '..l.from..' -> '..l.to,tip='Removes only this connection; both objects stay. Undo restores it.'}
    end
end
-- Connect, Disconnect. True when the button was a mechanism button.
function M.button(self,name)
    if name=='wire' then
        local o=find(editor.selection)
        if o and o.type=='plate' then
            self.wire,self.selected_link=o.id,nil
            editor.message='Connect plate '..o.id..': click a gate. Esc cancels.'
        end
        return true
    end
    local a,b=name:match('^unlink_([%w%-]+)_([%w%-]+)$')
    if not a then return false end
    if editor.commit(function(e) return mech.unlink(e,a,b) end) then
        self.selected_link=nil
        editor.message='Disconnected plate '..a..' from gate '..b..'; both objects stay. Undo restores it.'
    end
    return true
end
-- Select-tool press before the ordinary selection: Connect's gate click, or a drawn link when no
-- object is under the cursor. True when consumed.
function M.press(self,p,list,c,tol)
    if self.wire then
        local from=self.wire
        if not find(from) then self.wire=nil;return false end
        local target
        for _,x in ipairs(list) do local o=x.kind=='object' and find(x.id);if o and o.type=='gate' then target=o.id;break end end
        if not target then editor.message='Click a gate outline to connect plate '..from..'; Esc cancels.';return true end
        if editor.commit(function(e) return mech.link(e,from,target) end) then
            self.wire=nil;editor.select(from)
            editor.message='Connected plate '..from..' -> gate '..target..'. Its ON output opens the gate.'
        end
        return true
    end
    self.selected_link=nil
    if c then return false end
    for _,l in ipairs(self.drawn_links or {}) do
        if geometry.seg_dist(p,l.a,l.b)<=tol then
            editor.select(l.from);self.selected_link={from=l.from,to=l.to}
            editor.message='Connection plate '..l.from..' -> gate '..l.to..' selected. Delete removes it; both objects stay.'
            return true
        end
    end
    return false
end
-- Delete key with a picked link: removes only that link. True when handled.
function M.delete(self)
    local l=self.selected_link
    if not (l and editor.selection==l.from) then self.selected_link=nil;return false end
    M.button(self,'unlink_'..l.from..'_'..l.to)
    return true
end
function M.removed(links,actors,reset)
    if not links or links+actors==0 then return nil end
    return 'Removed with '..links..' connection'..(links==1 and '' or 's')..(actors>0 and ' and '..actors..' plate actor entr'..(actors==1 and 'y' or 'ies') or '')
        ..(reset>0 and '; '..reset..' plate'..(reset==1 and '' or 's')..' left without an actor now accept the vehicle' or '')..'. Undo restores them.'
end
function M.pasted(kept,dropped)
    if (kept or 0)+(dropped or 0)==0 then return '' end
    return ' Mechanism references outside the copy: '..kept..' kept'..(dropped>0 and ', '..dropped..' dropped (not in this level)' or '')..'.'
end
local LABEL={hold='Hold: ON while pressed',pulse='Button: ON for its time after a press',toggle='Switch: each press flips ON/OFF'}
function M.describe(o)
    local e=editor.doc.editor
    local lines={require('main.editor.editor_doc').label(o),string.format('At x %.2f m  y %.2f m',o.position[1],o.position[2])}
    local out,inp={},{}
    for _,l in ipairs(mech.links_of(e,o.id)) do if l.from==o.id then out[#out+1]=l.to else inp[#inp+1]=l.from end end
    if o.type=='plate' then
        lines[#lines+1]=LABEL[o.mode or 'hold']..(o.mode=='toggle' and (o.initial_on and ' (starts ON)' or ' (starts OFF)') or '')
        lines[#lines+1]='Pressed by: '..table.concat(o.actors,', ')
        lines[#lines+1]=#out>0 and 'Opens gates: '..table.concat(out,', ') or 'Not connected: Connect to a gate'
    elseif o.type=='gate' then
        lines[#lines+1]=string.format('Lifts %.2f m at %.2f m/s, starts %s',o.travel,o.speed,o.initial_open and 'open' or 'closed')
        lines[#lines+1]=#inp>0 and ((o.condition=='all' and 'Opens when ALL of: ' or 'Opens when ANY of: ')..table.concat(inp,', ')) or 'No plate connected'
    else
        local by={}
        for _,p in ipairs(e.objects) do if p.type=='plate' then for _,a in ipairs(p.actors) do if a==o.id then by[#by+1]=p.id end end end end
        lines[#lines+1]=string.format('%.0f kg, rotation %.1f deg',o.mass or 8,(o.angle or 0)*180/math.pi)
        lines[#lines+1]=#by>0 and 'Presses plates: '..table.concat(by,', ') or 'No plate accepts it yet'
    end
    lines[#lines+1]='Edit shows outlines only: no physics until Play.'
    return lines
end
-- Overlay: each gate's full travel, every visible link as a directed arrow (selected: highlighted; a
-- Switch that starts ON: active colour), and Connect's rubber band. Returns links not drawn.
function M.draw(self,o,s)
    local e=editor.doc.editor
    if self.wire and (editor.tool~='select' or not find(self.wire)) then self.wire=nil end
    local function shown(x) return editor.preview_objects and editor.preview_objects[x.id] or x end
    local to_px=geometry.to_px
    for _,g in ipairs(e.objects) do
        if g.type=='gate' and not g.hidden then local a,b=mech.travel(shown(g));overlay.line(o,to_px(a,s),to_px(b,s),C.hover,1,'handles') end
    end
    local drawn,missing={},0
    for _,l in ipairs(e.mechanism_links or {}) do
        local a,b=find(l.from),find(l.to)
        if a and b and not a.hidden and not b.hidden then
            local pa,pb=mech.port(shown(a)),mech.port(shown(b))
            local from,to=to_px(pa,s),to_px(pb,s)
            local picked=self.selected_link and self.selected_link.from==l.from and self.selected_link.to==l.to
            local colour=picked and C.selected or (a.mode=='toggle' and a.initial_on) and C.active or C.connected
            local n=overlay.line(o,from,to,colour,picked and 4 or 2,'handles')
            local dx,dy=to[1]-from[1],to[2]-from[2];local d=math.sqrt(dx*dx+dy*dy)
            if n and d>1 then
                local k=12*o.s;local x,y=to[1]-dx/d*k,to[2]-dy/d*k
                overlay.line(o,to,{x-dy/d*k*.45,y+dx/d*k*.45},colour,2,'handles');overlay.line(o,to,{x+dy/d*k*.45,y-dx/d*k*.45},colour,2,'handles')
                drawn[#drawn+1]={from=l.from,to=l.to,a=pa,b=pb}
            elseif not n then missing=missing+1 end
        end
    end
    self.drawn_links=drawn
    local plate=self.wire and find(self.wire)
    if plate and self.cursor then overlay.line(o,to_px(mech.port(plate),s),to_px(self.cursor,s),C.selected,2,'handles') end
    return missing
end
return M
