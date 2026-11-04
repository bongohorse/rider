-- Exercise the production picking interface: ordering is the hover/click/Tab contract, not input dispatch.
local P=require 'main.editor.editor_picking'
local D=require 'main.editor.editor_doc'
local mechanisms=require 'main.editor.editor_mechanisms'
local function source(objects)
 local e=D.blank('picking','Picking').editor;e.objects=objects;e.start.position={100,100};return e
end
local function keys(list)local t={};for _,v in ipairs(list)do t[#t+1]=v.key end;return table.concat(t,',')end
local function query(e,p,selected,tol,zoom)return P.candidates(e,selected or {},p,tol or .1,zoom or 1)end
local function same(a,b)
 assert(type(a)==type(b));if type(a)~='table' then assert(a==b);return end
 for k,v in pairs(a)do same(v,b[k])end;for k in pairs(b)do assert(a[k]~=nil)end
end
local line={id='line',type='line',points={{-2,0},{0,0},{2,0}}}
local e=source({line,{id='label',type='label',text='A',position={0,0}},
 {id='coin',type='coin',position={0,0}},mechanisms.defaults('plate','plate',{0,0})})
e.start.position={0,0};e.finish={position={0,0},direction=1}
local selected={line=true};local before=D.copy(e);local selected_before=D.copy(selected)
local result=query(e,{0,0},selected)
assert(keys(result)=='v:line:2,finish,start,o:label,o:plate,o:coin,o:line',keys(result))
assert(result[1].kind=='vertex' and result[1].index==2 and result[1].rank==1 and result[1].d==0)
assert(result[#result].segment==1 and result[#result].type=='line')
same(e,before);same(selected,selected_before)
-- Stable key tie-break survives source order; a closer object still wins within its rank.
e.objects={e.objects[4],e.objects[3],e.objects[2],e.objects[1]}
assert(keys(query(e,{0,0},selected))==keys(result))
e.objects[3].position={.12,0};assert(keys(query(e,{0,0},selected)):find('o:plate,o:label',1,true))
-- Unselected line interiors are objects; tolerance remains the explicit zoom-derived world distance.
e=source({D.copy(line)});assert(keys(query(e,{0,.15}))=='')
assert(keys(query(e,{0,.15},{},.2))=='o:line')
assert(keys(query(e,{0,0}))=='o:line')
-- A shared joint belongs once to the upstream end; a hidden upstream piece relinquishes the hit.
e=source({{id='a',type='line',points={{-2,0},{0,0}}},{id='b',type='line',points={{0,0},{2,0}}}})
e.connections={{from='a',to='b'}}
assert(keys(query(e,{0,0}))=='v:a:2,o:a,o:b')
e.objects[1].hidden=true;assert(keys(query(e,{0,0}))=='v:b:1,o:b')
e.objects[1].hidden=nil;e.objects[1].locked=true
assert(keys(query(e,{0,0}))=='v:a:2,o:a,o:b','locked objects retain the existing inspect/select behavior')
-- Selected curves expose anchor metadata; connected starts have no second anchor handle.
local function anchor(x,mode)return {p={x,0},mode=mode,['in']={-.5,0},out={.5,0}}end
local curve={id='curve',type='curve',anchors={anchor(0,'smooth'),anchor(2,'smooth'),anchor(4,'corner')}}
e=source({curve});local handles=P.handles(e,curve)
assert(#handles==6 and handles[1].name=='a1' and handles[1].index==1 and handles[2].name=='o1')
result=query(e,{0,0},{curve=true});assert(result[1].key=='h:curve:a1' and result[1].anchor==1 and result[1].label=='anchor 1')
curve.locked=true;assert(query(e,{0,0},{curve=true})[1].kind=='vertex')
curve.hidden=true;assert(#query(e,{0,0},{curve=true})==0)
curve.hidden=nil;curve.locked=nil
e.objects[2]={id='upstream',type='line',points={{-2,0},{0,0}}};e.connections={{from='upstream',to='curve'}}
for _,h in ipairs(P.handles(e,curve))do assert(h.name~='a1')end
-- Prefab exit handle retains Connect/Disconnect endpoint metadata.
local prefab={id='flat',type='prefab',kind='flat',at={0,0},params={length=10}}
e=source({prefab});local exit=false
for _,h in ipairs(P.prefab_handles(prefab))do if h.index then exit=true;assert(h.index==#D.path(prefab))end end
assert(exit);assert(query(e,{10,0},{flat=true})[1].kind=='handle')
-- Labels count UTF-8 characters; label and pickup boxes retain their inverse-zoom scaling.
e=source({{id='label',type='label',text='éé',position={0,0}}})
assert(#query(e,{.12,0},{},.01,1)==0);assert(#query(e,{.12,0},{},.01,.25)==1)
e=source({{id='coin',type='coin',position={0,0}}})
assert(#query(e,{.4,0},{},.01,1)==0);assert(#query(e,{.4,0},{},.01,.25)==1)
-- Mechanism body hits and closed-hull closing edges use existing document helpers.
e=source({mechanisms.defaults('crate','crate',{0,0}),mechanisms.defaults('gate','gate',{0,0}),
 {id='hull',type='hull',vertices={{-1,0},{-1,2},{1,2}}}})
assert(keys(query(e,{0,.5})):find('o:crate',1,true));assert(keys(query(e,{0,1})):find('o:gate',1,true))
assert(keys(query(e,{0,1})):find('o:hull',1,true),'closing hull edge must remain pickable')
print('PASS deterministic picking: ordered overlap, handles/joints, hidden/locked, label/pickup zoom, mechanisms/hulls and read-only inputs')
