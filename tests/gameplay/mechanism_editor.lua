-- O2 (#281): crate/plate/gate authoring source logic (editor_mechanisms, editor_doc 13, editor_edit).
-- Pure Lua; the ea2 Gym case drives the same paths through real editor input.
local E=require 'main.editor.editor_doc';local A=require 'main.editor.editor_mechanisms';local X=require 'main.editor.editor_edit'
local function course()
    local d=E.blank('author-objects','Author objects');local e=d.editor
    e.objects={{id='o1',type='line',points={{-5,0},{60,0}}}};e.next_id=2;e.start.position={0,1.7}
    return d,e
end
local d,e=course()
local function add(kind,p) local id='o'..e.next_id;e.next_id=e.next_id+1;e.objects[#e.objects+1]=A.defaults(kind,id,p);return id end
local function same(a,b)
    if type(a)~='table' or type(b)~='table' then return a==b end
    for k,v in pairs(a) do if not same(v,b[k]) then return false end end
    for k in pairs(b) do if a[k]==nil then return false end end
    return true
end

-- Placement: every O1 setting explicit; the bottom (a plate's top) on the clicked point.
local c=add('crate',{5,0});local p=add('plate',{10,0});local q=add('plate',{20,0})
local g=add('gate',{25,0});local h=add('gate',{30,0});local j=add('gate',{35,0})
assert(same(X.find(e,c),{id=c,type='crate',position={5,.6},angle=0,mass=8,friction=.5,restitution=0}))
assert(same(X.find(e,p),{id=p,type='plate',position={10,-.05},width=3,actors={'vehicle'},mode='hold',pulse_seconds=4,initial_on=false}))
assert(same(X.find(e,g),{id=g,type='gate',position={25,1.5},travel=4.5,speed=1.8,initial_open=false,condition='any'}))
assert(E.validate(d) and e.editor_version==13)
local plain=course();assert(A.runtime(plain.editor)==nil and E.compile(plain).schema==1,'no mechanisms: no schema 5')
print('PASS placement defaults, version 13 and unchanged schema without mechanisms')

-- The 2-plate / 3-gate example: five directed links; wrong kinds, duplicates and the 33rd link refused.
for _,to in ipairs({g,h,j}) do assert(A.link(e,p,to)) end
for _,to in ipairs({h,j}) do assert(A.link(e,q,to)) end
assert(not A.link(e,p,g),'duplicate pair');assert(not A.link(e,g,p),'gate cannot drive a plate');assert(not A.link(e,p,c),'crate is no gate');assert(not A.link(e,p,'missing'))
assert(#e.mechanism_links==5 and #A.links_of(e,h)==2 and #A.links_of(e,p)==3)
local full=E.copy(d);full.editor.mechanism_links={};for i=1,32 do full.editor.mechanism_links[i]={from='x',to='y'} end
local ok,err=A.link(full.editor,p,g);assert(not ok and err:find('32',1,true))
assert(A.unlink(e,q,j) and #e.mechanism_links==4 and not A.unlink(e,q,j));assert(A.link(e,q,j))
assert(E.validate(d))
local level=assert(E.compile(d));assert(level.schema==5 and #level.mechanisms.links==5 and #level.mechanisms.gates==3 and #level.hulls==0)
assert(level.mechanisms.links[1].from==p and level.mechanisms.links[1].to==g and level.mechanisms.links[5].from==q and level.mechanisms.links[5].to==j)
assert(not E.compare(d,level));local reopened=assert(E.open_level(level));assert(same(reopened.editor.mechanism_links,e.mechanism_links) and same(X.find(reopened.editor,p),X.find(e,p)))
print('PASS 2 plates / 3 gates with five typed links, refusals, compile, R1 compare and reopen with stable IDs')

-- Properties: only applicable rows; degrees shown, radians stored; bounded numbers fail closed.
local function keys(o) local t={};for i,r in ipairs(A.rows(o,e)) do t[i]=r.key end;return table.concat(t,',') end
assert(keys(X.find(e,c))=='x,y,angle,mass,friction,restitution')
assert(keys(X.find(e,p))=='x,y,width,mode,actor:vehicle,actor:'..c)
assert(keys(X.find(e,g))=='x,y,travel,speed,initial_open,condition')
assert(A.set(e,c,'angle','45') and math.abs(X.find(e,c).angle-math.pi/4)<1e-12 and A.display(X.find(e,c),'angle')=='45.0')
assert(A.set(e,c,'mass','25') and X.find(e,c).mass==25)
for _,bad in ipairs({'41','0.5','nan','abc','','1e999','-inf'}) do local okv,why=A.set(e,c,'mass',bad);assert(not okv and why=='Mass must be 1 to 40 kg',bad) end
assert(X.find(e,c).mass==25)
ok,err=A.set(e,c,'angle','181');assert(not ok and err=='Rotation must be -180 to 180 deg')
ok,err=A.set(e,g,'travel','3');assert(not ok and err=='Lift height must be 3.5 to 6 m');ok,err=A.set(e,g,'speed','0.2');assert(not ok and err=='Speed must be 0.25 to 2 m/s')
ok,err=A.set(e,c,'width','2');assert(not ok and err:find('not available',1,true))
assert(A.set(e,p,'mode') and X.find(e,p).mode=='pulse' and keys(X.find(e,p))=='x,y,width,mode,pulse_seconds,actor:vehicle,actor:'..c)
assert(A.set(e,p,'pulse_seconds','0.1'));ok=A.set(e,p,'pulse_seconds','31');assert(not ok)
assert(A.set(e,p,'mode') and X.find(e,p).mode=='toggle' and keys(X.find(e,p))=='x,y,width,mode,initial_on,actor:vehicle,actor:'..c)
assert(A.set(e,p,'initial_on') and X.find(e,p).initial_on==true and A.display(X.find(e,p),'initial_on')=='ON' and A.display(X.find(e,p),'mode')=='Switch')
assert(A.set(e,p,'mode') and X.find(e,p).mode=='hold')
assert(A.set(e,g,'condition') and X.find(e,g).condition=='all' and A.display(X.find(e,g),'condition')=='All plates')
assert(A.set(e,g,'initial_open') and X.find(e,g).initial_open==true);assert(A.set(e,g,'initial_open'))
assert(A.set(e,p,'actor:'..c) and same(X.find(e,p).actors,{'vehicle',c}))
assert(A.set(e,p,'actor:vehicle') and same(X.find(e,p).actors,{c}))
ok,err=A.set(e,p,'actor:'..c);assert(not ok and err:find('at least one',1,true) and same(X.find(e,p).actors,{c}))
ok=A.set(e,'o1','x','3');assert(not ok,'a line has no mechanism rows')
assert(E.validate(d))
-- Values outside the O1 ranges written by any path are refused by the source validator.
local broken=E.copy(d);X.find(broken.editor,c).mass=41;assert(not E.validate(broken))
broken=E.copy(d);X.find(broken.editor,p).actors={'nobody'};assert(not E.validate(broken))
broken=E.copy(d);X.find(broken.editor,g).future=true;local _,why,future=E.validate(broken);assert(future and why:find('future',1,true))
broken=E.copy(d);X.find(broken.editor,g).hidden='yes';assert(not E.validate(broken))
broken=E.copy(d);broken.editor.mechanism_links[1].to=c;assert(not E.validate(broken))
print('PASS applicable rows, degree/radian, bounded values, three plate modes, actors and fail-closed validation')

-- Metadata is editor-only: names, hidden and locked never reach the compiled data; hidden still plays.
X.find(e,g).name='Exit door';X.find(e,g).hidden=true;X.find(e,c).locked=true
assert(E.validate(d));level=assert(E.compile(d));assert(level.mechanisms.gates[1].id==g and level.mechanisms.gates[1].name==nil and level.mechanisms.gates[1].hidden==nil and level.mechanisms.crates[1].locked==nil)
assert(E.label(X.find(e,g))=='Exit door ('..g..')' and E.label(X.find(e,h))=='Gate '..h)
X.find(e,g).hidden=nil;X.find(e,c).locked=nil
print('PASS name/hidden/locked stay editor metadata; compiled O1 data unchanged')

-- Locks protect settings, position and incident links; hide/unlock stay allowed.
local function conflict(fn) local before=E.copy(d);local after=E.copy(d);X.find(before.editor,g).locked=true;X.find(after.editor,g).locked=true;fn(after.editor);return E.lock_conflict(before.editor,after.editor) end
assert(conflict(function(x) A.unlink(x,p,g) end),'unlink')
assert(conflict(function(x) x.mechanism_links[#x.mechanism_links+1]={from=q,event='active',to=g,action='open'} end),'rewire into a locked gate')
assert(conflict(function(x) A.set(x,g,'speed','1') end),'setting')
assert(conflict(function(x) X.translate(x,{g},{1,0}) end),'move')
assert(conflict(function(x) X.remove(x,{g}) end),'delete')
assert(conflict(function(x) X.remove(x,{p}) end),'deleting a linked plate changes the locked gate inputs')
assert(not conflict(function(x) X.find(x,g).hidden=true end),'hide stays allowed')
assert(not conflict(function(x) X.find(x,g).locked=nil end),'unlock stays allowed')
assert(not conflict(function(x) A.set(x,c,'mass','9') end),'unrelated objects stay editable')
print('PASS locked mechanisms refuse move, settings, delete and rewire; hide and unlock remain')

-- Move keeps IDs and links; mirror negates a crate rotation and remaps copied links.
local base=E.copy(d);X.translate(e,{c,p},{1,2});assert(X.find(e,c).position[1]==6 and math.abs(X.find(e,p).position[2]-1.95)<1e-12 and #e.mechanism_links==5)
d=E.copy(base);e=d.editor
local n0=#e.objects;local new=X.mirror(e,{p,g},1);assert(#new==2 and #e.objects==n0+2)
local mp,mg=X.find(e,new[1]),X.find(e,new[2]);assert(mp.type=='plate' and mg.type=='gate' and mp.position[1]>X.find(e,g).position[1])
local internal=0;for _,l in ipairs(e.mechanism_links) do if l.from==new[1] and l.to==new[2] then internal=internal+1 end end;assert(internal==1)
assert(E.validate(d))
d=E.copy(base);e=d.editor
local cr=E.copy(d);X.find(cr.editor,c).angle=.5;local m=X.mirror(cr.editor,{c},1);assert(math.abs(X.find(cr.editor,m[1]).angle+.5)<1e-12)
print('PASS move keeps IDs/links; mirror remaps links and negates crate rotation')

-- Copy/paste: links between copied objects and copied crate actors are remapped; an external reference
-- is kept while its other end exists in the course, dropped and counted otherwise.
local clip=X.copy(e,{c,p,q,g,h,j});assert(#clip.mechanism_links==5 and #clip.external_links==0)
local n1=#e.mechanism_links;local ids,kept,dropped=X.paste(e,clip,{0,10});assert(#ids==6 and kept==0 and dropped==0 and #e.mechanism_links==n1+5)
local seen={};for _,id in ipairs(ids) do assert(not seen[id]);seen[id]=true end
local cp=X.find(e,ids[2]);assert(cp.type=='plate' and same(cp.actors,{ids[1]}),'pasted plate presses with the pasted crate')
for i=n1+1,#e.mechanism_links do local l=e.mechanism_links[i];assert(seen[l.from] and seen[l.to]) end
assert(E.validate(d))
d=E.copy(base);e=d.editor
local only=X.copy(e,{p});assert(#only.mechanism_links==0 and #only.external_links==3)
local o1,k1,dr1=X.paste(e,only,{0,5});local np=X.find(e,o1[1]);assert(k1==4 and dr1==0 and same(np.actors,{c}),'kept: three gate links and the existing crate actor')
assert(#A.links_of(e,np.id)==3 and E.validate(d))
local other=course();local o2,k2,dr2=X.paste(other.editor,only,{0,0});assert(k2==0 and dr2==4 and same(X.find(other.editor,o2[1]).actors,{'vehicle'}) and #(other.editor.mechanism_links or {})==0)
assert(E.validate(other))
print('PASS copy/paste remaps internal links and actors, keeps or counts every external reference')

-- Delete: links and actor entries go with the object; a plate left without an actor accepts the vehicle.
d=E.copy(base);e=d.editor
local links,actors,reset=X.remove(e,{c,g});assert(links==1 and actors==1 and reset==1)
assert(not X.find(e,c) and not X.find(e,g) and same(X.find(e,p).actors,{'vehicle'}))
for _,l in ipairs(e.mechanism_links) do assert(l.to~=g) end
assert(E.validate(d))
print('PASS delete removes incident links and crate actors, resetting an empty plate to the vehicle')

-- Version 12 -> 13 migration keeps IDs/settings; numeric IDs raise next_id (one allocator for all objects).
local v12=E.blank('legacy-objects','Legacy');v12.editor.editor_version,v12.editor.compiler_version=12,12
v12.editor.objects={{id='o1',type='line',points={{-5,0},{40,0}}}};v12.editor.next_id=2;v12.editor.start.position={0,1.7}
v12.editor.mechanisms={version=1,crates={{id='o9',position={5,.65},mass=12}},plates={{id='plate-a',position={10,-.05},actors={'o9'}}},gates={{id='gate-a',position={16,1.5},travel=4.5,speed=1.8}},links={{from='plate-a',event='active',to='gate-a',action='open'}}}
local legacy_level=assert(E.compile(E.copy(v12)))
assert(E.validate(v12));local ve=v12.editor
assert(ve.editor_version==13 and ve.mechanisms==nil and ve.next_id==10 and X.find(ve,'o9').mass==12 and X.find(ve,'plate-a').type=='plate' and #ve.mechanism_links==1)
assert(same(A.runtime(ve),legacy_level.mechanisms),'migrated source compiles to the same O1 data')
local fresh=X.paste(ve,X.copy(ve,{'o9'}),{1,0});assert(fresh[1]=='o10')
local bad13=E.copy(v12);bad13.editor.mechanisms=A.runtime(ve);_,_,future=E.validate(bad13);assert(future,'version 13 refuses an editor.mechanisms block')
local bad12=E.copy(v12);bad12.editor.editor_version,bad12.editor.compiler_version=12,12;_,_,future=E.validate(bad12);assert(future,'mechanism objects need 13')
local station=E.open_level(legacy_level);assert(X.find(station.editor,'gate-a') and E.validate(station))
print('PASS version 12 migration, stable IDs, single ID allocator and version protection')

-- Picking and drawing shapes: rotated crate box, plate surface, gate at its initial pose, links and travel.
local box={id='b',type='crate',position={0,0},angle=math.pi/4}
assert(A.distance(box,{0,0})==0 and A.distance(box,{.8,0})==0 and A.distance(box,{1.2,0})>.3)
local plate={id='p',type='plate',position={0,-.05},width=4}
assert(A.distance(plate,{1.9,0})==0 and math.abs(A.distance(plate,{0,.5})-.5)<1e-9 and same(A.port(plate),{0,0}))
local gate={id='g',type='gate',position={0,1.5},travel=4,initial_open=true}
local out=A.outline(gate);assert(math.abs(out[1][2]-4)<1e-9 and math.abs(out[3][2]-7)<1e-9 and same(A.port(gate),{0,7}))
local a1,a2=A.travel(gate);assert(a1[2]==3 and a2[2]==7)
assert(#E.path(gate)==4 and E.outline(gate)==nil and #E.drawn_outline(gate)==4,'no hull semantics for mechanisms')
print('PASS picking distance, outlines, link ports and gate travel shapes')
