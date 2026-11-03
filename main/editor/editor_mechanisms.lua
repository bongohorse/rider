-- O2 (#281): crate, plate and gate authoring in the level editor. Pure: no engine or GUI calls, metres and
-- radians throughout. Editor/compiler 13 keeps every O1 mechanism as an ordinary source object in
-- editor.objects ({id,type='crate'|'plate'|'gate',position,...O1 settings}) and the typed plate.active ->
-- gate.open links in editor.mechanism_links, so selection, transforms, locks, hide, names, copy/paste,
-- Undo and storage are the existing object paths. name/hidden/locked are the editor-only metadata;
-- M.runtime strips them and builds exactly the O1 `mechanisms` data (main.game.mechanism_data), which
-- the compiler emits unchanged as station schema 5. Nothing here creates bodies or runs plate logic.
-- Based on Codex's local O2 branch (a10d648, main/gym/editor_mechanism.lua).
local data=require 'main.game.mechanism_data'
local M={kinds={crate='crates',plate='plates',gate='gates'},ORDER={'crate','plate','gate'}}
-- O1 settings per kind (mechanism_data's exact field list without id/position).
local FIELDS={crate={'angle','mass','friction','restitution'},plate={'width','actors','mode','pulse_seconds','initial_on'},gate={'travel','speed','initial_open','condition'}}
M.FIELDS=FIELDS
-- Defaults the runtime applies to an absent field; placement writes them explicitly.
local DEFAULTS={angle=0,mass=data.CRATE_MASS,friction=.5,restitution=0,width=3,mode='hold',pulse_seconds=4,initial_on=false,initial_open=false,condition='any'}
-- Placement puts the object's bottom (a plate's top: it lies flush in the ground) on the clicked point.
local LIFT={crate=data.CRATE_HALF,plate=-.05,gate=data.GATE_HEIGHT/2}
local function copy(v) if type(v)~='table' then return v end;local t={};for k,x in pairs(v) do t[k]=copy(x) end;return t end
function M.is(o) return type(o)=='table' and M.kinds[o.type]~=nil end
-- Source fields of a mechanism object: O1 settings plus the editor metadata. Anything else is an unknown
-- future field and stays protected (third result true, like an unknown mechanism field in O1).
function M.source_fields(o)
    local allowed={id=true,type=true,position=true,name=true,hidden=true,locked=true}
    for _,key in ipairs(FIELDS[o.type]) do allowed[key]=true end
    for key in pairs(o) do if not allowed[key] then return nil,'Unsupported '..o.type..' setting '..tostring(key)..': '..tostring(o.id),true end end
    return true
end
-- The O1 mechanism data of an editor block: a version-12 block still holds it in e.mechanisms (before
-- validate migrates it); version 13 builds it from the objects in document order. nil without any.
function M.runtime(e)
    if e.mechanisms~=nil then return copy(e.mechanisms) end
    local links=e.mechanism_links
    local d={version=1,crates={},plates={},gates={},links=links==nil and {} or copy(links)}
    local any=links~=nil and (type(links)~='table' or next(links)~=nil)
    for _,o in ipairs(e.objects or {}) do if M.is(o) then
        local v={id=o.id,position=copy(o.position)}
        for _,k in ipairs(FIELDS[o.type]) do v[k]=copy(o[k]) end
        local list=d[M.kinds[o.type]];list[#list+1]=v;any=true
    end end
    if any then return d end
end
-- Version 12 -> 13: the validated O1 data becomes objects with the same IDs and settings, and its links
-- become mechanism_links. Numeric oN IDs raise next_id, so new objects never reuse them.
function M.migrate(e)
    local d=e.mechanisms
    if d==nil then return end
    for _,kind in ipairs(M.ORDER) do for _,v in ipairs(d[M.kinds[kind]]) do
        local o=copy(v);o.type=kind;e.objects[#e.objects+1]=o
        local n=tonumber(o.id:match('^o(%d+)$'));if n and n>=e.next_id then e.next_id=n+1 end
    end end
    e.mechanism_links=copy(d.links);e.mechanisms=nil
end
function M.count(e,kind) local n=0;for _,o in ipairs(e.objects) do if o.type==kind then n=n+1 end end;return n end
-- A new object of kind at the clicked point p with every O1 setting explicit. A plate accepts the vehicle.
function M.defaults(kind,id,p)
    local o={id=id,type=kind,position={p[1],p[2]+LIFT[kind]}}
    for _,k in ipairs(FIELDS[kind]) do o[k]=copy(DEFAULTS[k]) end
    if kind=='plate' then o.actors={'vehicle'} end
    if kind=='gate' then o.travel,o.speed=4.5,1.8 end
    return o
end
-- Half extents of the body box (the O1 convex shapes) and the rotation; gates are drawn at their initial pose.
local function half(o)
    if o.type=='crate' then return data.CRATE_HALF,data.CRATE_HALF end
    if o.type=='plate' then return (o.width or DEFAULTS.width)/2,.05 end
    return data.GATE_HALF,data.GATE_HEIGHT/2
end
local function centre(o) return o.position[1],o.position[2]+(o.type=='gate' and o.initial_open and o.travel or 0) end
-- Closed counter-clockwise outline in metres.
function M.outline(o)
    local w,h=half(o);local a=o.type=='crate' and (o.angle or 0) or 0
    local c,s=math.cos(a),math.sin(a);local x,y=centre(o)
    local pts={}
    for i,q in ipairs({{-w,-h},{w,-h},{w,h},{-w,h}}) do pts[i]={x+q[1]*c-q[2]*s,y+q[1]*s+q[2]*c} end
    return pts
end
-- Distance from p to the drawn body box (0 inside): picking treats a mechanism like a small solid.
function M.distance(o,p)
    local w,h=half(o);local a=o.type=='crate' and (o.angle or 0) or 0
    local x,y=centre(o);local dx,dy=p[1]-x,p[2]-y
    local c,s=math.cos(a),math.sin(a)
    local u,v=math.abs(dx*c+dy*s)-w,math.abs(-dx*s+dy*c)-h
    return math.sqrt(math.max(0,u)^2+math.max(0,v)^2)
end
-- Link ends: a plate's top centre and a gate's top at its initial pose.
function M.port(o)
    local x,y=centre(o);local _,h=half(o)
    return {x,y+h}
end
-- A gate's full travel: its closed top to its open top, beside the gate.
function M.travel(o)
    local x=o.position[1]+data.GATE_HALF+.15;local y=o.position[2]+data.GATE_HEIGHT/2
    return {x,y},{x,y+o.travel}
end
-- Property rows (editor_props format): only O1-supported settings with their validator bounds.
local function number(key,label,min,max,unit) return {key=key,label=label,min=min,max=max,unit=unit or ''} end
local function crate_label(o) return o.name and o.name~='' and o.name..' ('..o.id..')' or 'crate '..o.id end
function M.rows(o,e)
    local list={number('x','Position X',-data.MAX_COORD,data.MAX_COORD,'m'),number('y','Position Y',-data.MAX_COORD,data.MAX_COORD,'m')}
    local function add(f) list[#list+1]=f end
    if o.type=='crate' then
        add(number('angle','Rotation',-180,180,'deg'));add(number('mass','Mass',1,40,'kg'));add(number('friction','Friction',0,1.5));add(number('restitution','Bounce',0,.5))
    elseif o.type=='plate' then
        add(number('width','Width',1,8,'m'));add({key='mode',label='Mode',choices={'hold','pulse','toggle'}})
        if o.mode=='pulse' then add(number('pulse_seconds','Button time',.1,30,'s')) end
        if o.mode=='toggle' then add({key='initial_on',label='Starts ON',choices={false,true}}) end
        add({key='actor:vehicle',label='Vehicle presses',choices={false,true}})
        for _,c in ipairs(e.objects) do if c.type=='crate' then add({key='actor:'..c.id,label=crate_label(c)..' presses',choices={false,true}}) end end
    else
        add(number('travel','Lift height',3.5,6,'m'));add(number('speed','Speed',.25,2,'m/s'));add({key='initial_open',label='Starts open',choices={false,true}});add({key='condition',label='Opens when',choices={'any','all'}})
    end
    return list
end
function M.row(o,e,key) for _,r in ipairs(M.rows(o,e)) do if r.key==key then return r end end end
function M.value(o,key)
    if key=='x' or key=='y' then return o.position[key=='x' and 1 or 2] end
    if key=='angle' then return (o.angle or 0)*180/math.pi end
    if key:sub(1,6)=='actor:' then for _,id in ipairs(o.actors) do if id==key:sub(7) then return true end end;return false end
    if o[key]~=nil then return o[key] end
    return DEFAULTS[key]
end
local NAMES={hold='Hold',pulse='Button',toggle='Switch',any='Any plate',all='All plates'}
function M.display(o,key)
    local v=M.value(o,key)
    if type(v)=='boolean' then return v and 'ON' or 'OFF' end
    if NAMES[v] then return NAMES[v] end
    if key=='angle' then return string.format('%.1f',v) end
    return type(v)=='number' and string.format('%.2f',v) or tostring(v)
end
local function bound(n) return (string.format('%.2f',n):gsub('0+$',''):gsub('%.$','')) end
-- One validated setting change. A choice row steps to its next value when value is nil; a number row
-- takes a number or its text. Returns true, or nil and an actionable reason (nothing changed).
function M.set(e,id,key,value)
    local o;for _,v in ipairs(e.objects) do if v.id==id then o=v end end
    if not M.is(o) then return nil,'Select a crate, plate or gate first' end
    local fd=M.row(o,e,key);if not fd then return nil,'This setting is not available for '..o.type..' '..id end
    if fd.choices then
        if value==nil then
            local old=M.value(o,key)
            for i,v in ipairs(fd.choices) do if v==old then value=fd.choices[i%#fd.choices+1] end end
            if value==nil then value=fd.choices[1] end
        end
        local known=false;for _,v in ipairs(fd.choices) do known=known or v==value end
        if not known then return nil,fd.label..': unsupported value '..tostring(value) end
    else
        value=tonumber(value)
        if not value or value~=value or value<fd.min or value>fd.max then
            return nil,fd.label..' must be '..bound(fd.min)..' to '..bound(fd.max)..(fd.unit~='' and ' '..fd.unit or '')
        end
    end
    if key=='x' or key=='y' then o.position[key=='x' and 1 or 2]=value
    elseif key=='angle' then o.angle=value*math.pi/180
    elseif key:sub(1,6)=='actor:' then
        local actor=key:sub(7);local list={}
        for _,a in ipairs(o.actors) do if a~=actor then list[#list+1]=a end end
        if value then list[#list+1]=actor end
        if #list==0 then return nil,'A plate needs at least one actor that presses it; turn another one on first' end
        o.actors=list
    else o[key]=value end
    return true
end
local function object(e,id) for _,o in ipairs(e.objects) do if o.id==id then return o end end end
-- Connect plate `from` to gate `to` (plate.active -> gate.open). Refuses wrong kinds and duplicates.
function M.link(e,from,to)
    local a,b=object(e,from),object(e,to)
    if not (a and a.type=='plate') then return nil,'Connect starts at a plate' end
    if not (b and b.type=='gate') then return nil,'Connect a plate to a gate: click a gate outline' end
    e.mechanism_links=e.mechanism_links or {}
    for _,l in ipairs(e.mechanism_links) do if l.from==from and l.to==to then return nil,'Plate '..from..' already opens gate '..to end end
    if #e.mechanism_links>=data.MAX_LINKS then return nil,'A course holds at most '..data.MAX_LINKS..' connections; remove one first' end
    e.mechanism_links[#e.mechanism_links+1]={from=from,event='active',to=to,action='open'}
    return true
end
function M.unlink(e,from,to)
    for i,l in ipairs(e.mechanism_links or {}) do
        if l.from==from and l.to==to then table.remove(e.mechanism_links,i);return true end
    end
    return nil,'No connection from plate '..tostring(from)..' to gate '..tostring(to)
end
-- Links touching id, in document order.
function M.links_of(e,id)
    local list={}
    for _,l in ipairs(e.mechanism_links or {}) do if l.from==id or l.to==id then list[#list+1]=l end end
    return list
end
-- Removing objects (set: id -> true) drops their links and their crates from plate actors. A plate left
-- without an actor accepts the vehicle again. Returns the number of links and actor entries dropped and
-- the plates reset to the vehicle, for the caller's message.
function M.remove(e,set)
    local links,actors,reset=0,0,0
    for i=#(e.mechanism_links or {}),1,-1 do
        local l=e.mechanism_links[i]
        if set[l.from] or set[l.to] then table.remove(e.mechanism_links,i);links=links+1 end
    end
    for _,o in ipairs(e.objects) do if o.type=='plate' and not set[o.id] then
        local list={}
        for _,a in ipairs(o.actors) do if set[a] then actors=actors+1 else list[#list+1]=a end end
        if #list==0 then list={'vehicle'};reset=reset+1 end
        o.actors=list
    end end
    return links,actors,reset
end
-- Copy (set: copied ids): links with both ends copied, and links with one end copied (external).
function M.copy(e,set)
    local internal,external={},{}
    for _,l in ipairs(e.mechanism_links or {}) do
        if set[l.from] and set[l.to] then internal[#internal+1]=copy(l)
        elseif set[l.from] or set[l.to] then external[#external+1]=copy(l) end
    end
    return internal,external
end
-- Paste: map is old id -> new id of the pasted objects (ids: new ids). Internal links and copied crate
-- actors are remapped. An external reference is kept while its other end still exists in this course
-- with the right kind (the copy shares that gate, plate or crate); otherwise it is dropped and counted,
-- never silently lost. Returns kept, dropped.
function M.paste(e,clip,map,ids)
    local kept,dropped=0,0
    local function kind(id) local o=object(e,id);return o and o.type end
    for _,id in ipairs(ids) do
        local o=object(e,id)
        if o and o.type=='plate' then
            local list={}
            for _,a in ipairs(o.actors) do
                if a=='vehicle' then list[#list+1]=a
                elseif map[a] then list[#list+1]=map[a]
                elseif kind(a)=='crate' then list[#list+1]=a;kept=kept+1
                else dropped=dropped+1 end
            end
            if #list==0 then list={'vehicle'} end
            o.actors=list
        end
    end
    e.mechanism_links=e.mechanism_links or {}
    for _,l in ipairs(clip.mechanism_links or {}) do
        e.mechanism_links[#e.mechanism_links+1]={from=map[l.from],event='active',to=map[l.to],action='open'}
    end
    for _,l in ipairs(clip.external_links or {}) do
        local from,to=map[l.from] or l.from,map[l.to] or l.to
        if kind(from)=='plate' and kind(to)=='gate' then
            e.mechanism_links[#e.mechanism_links+1]={from=from,event='active',to=to,action='open'};kept=kept+1
        else dropped=dropped+1 end
    end
    return kept,dropped
end
return M
