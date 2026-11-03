-- #394: mechanism validation rejects crate, plate, gate, plate-actor and link lists that are not dense
-- arrays. Defold json.decode turns a JSON null member into a hole ([a,null,b] -> {a,nil,b}) and an object
-- into string keys ({"1":a} -> {["1"]=a}); ipairs stops at the first hole, so entries after it were never
-- validated, while `#t` still counted them for resource admission (M.cost). Each shape below is the table
-- Defold makes of the JSON in its comment; the ea2 Gym case imports the same JSON in the pinned engine.
local D=require 'main.game.mechanism_data'
local function clone(t) if type(t)~='table' then return t end;local r={};for k,v in pairs(t) do r[k]=clone(v) end;return r end
local function spec()
    return {version=1,
        crates={{id='crate-a',position={6,.65}},{id='crate-b',position={8,.65}}},
        plates={{id='plate-a',position={10,.05},actors={'crate-a','vehicle'}},{id='plate-b',position={20,.05},actors={'vehicle'}}},
        gates={{id='gate-a',position={16,1.5},travel=4.5,speed=1.8},{id='gate-b',position={25,1.5},travel=4.5,speed=1.8}},
        links={{from='plate-a',event='active',to='gate-a',action='open'},{from='plate-b',event='active',to='gate-b',action='open'}}}
end
local BOUNDS={-10,48,-10,20}
local function rejects(d,pattern,label)
    local ok,why,future=D.validate(d,BOUNDS)
    assert(not ok,label..': must be rejected')
    assert(type(why)=='string' and why:find(pattern,1,true),label..': unexpected reason "'..tostring(why)..'"')
    assert(not future,label..': malformed data is not future data')
end

-- Valid data is unchanged: dense lists, empty lists ({} is also what an empty JSON object decodes to) and
-- lists at their 8/8/8/9/32 limits pass, and resource admission counts exactly the admitted objects.
local d=spec();assert(D.validate(d,BOUNDS))
local c=D.cost(d);assert(c.bodies==6 and c.shapes==10 and c.joints==2 and c.sprites==14 and c.vertices==40)
assert(#D.extents(d)==6)
assert(D.validate({version=1,crates={},plates={},gates={},links={}},BOUNDS))
assert(D.cost({version=1,crates={},plates={},gates={},links={}}).bodies==0)
local full={version=1,crates={},plates={},gates={},links={}}
for i=1,8 do
    full.crates[i]={id='crate-'..i,position={i,.65}}
    full.gates[i]={id='gate-'..i,position={i*4,1.5},travel=4.5,speed=1.8}
end
for i=1,8 do
    local actors={'vehicle'};for j=1,8 do actors[j+1]='crate-'..j end
    full.plates[i]={id='plate-'..i,position={i*4,.05},actors=actors}
    for j=1,4 do full.links[#full.links+1]={from='plate-'..i,event='active',to='gate-'..((i+j)%8+1),action='open'} end
end
assert(#full.links==32 and #full.plates[1].actors==9)
assert(D.validate(full,BOUNDS));assert(D.cost(full).bodies==24)
print('PASS dense, empty and at-limit crate/plate/gate/actor/link lists validate and cost counts the admitted objects')

-- crates [A,B,null,invalid] (the #394 repro: {[1]=A,[2]=B,[4]=invalid}); the invalid crate after the hole
-- was never validated and M.cost counted 4 bodies.
local invalid_crate={id='Bad ID',position={0}}
d=spec();d.crates={d.crates[1],d.crates[2],nil,invalid_crate};rejects(d,'Mechanism crates has a gap at entry 3','crates [A,B,null,invalid]')
d=spec();d.crates={[1]=d.crates[1],[2]=d.crates[2],[4]=invalid_crate};rejects(d,'Mechanism crates has a gap at entry 3','crates {1,2,4}')
d=spec();d.crates={d.crates[1],nil,invalid_crate};rejects(d,'Mechanism crates has a gap at entry 2','crates [A,null,invalid]')
d=spec();d.crates={nil,d.crates[1]};rejects(d,'Mechanism crates has a gap at entry 1','crates [null,A]')
-- crates {"1":A} and an extra name key next to a dense part.
d=spec();d.crates={['1']=d.crates[1]};rejects(d,'Mechanism crates is not a list (key "1")','crates {"1":A}')
d=spec();d.crates.extra=invalid_crate;rejects(d,'Mechanism crates is not a list (key "extra")','crates with a name key')
-- Over the limit, and not a table at all.
d=spec();for i=1,9 do d.crates[i]={id='crate-'..i,position={i,.65}} end;rejects(d,'Mechanism crates has more than 8 entries','9 crates')
d=spec();d.crates='bad';rejects(d,'Mechanism crates is not a list','crates "bad"')
d=spec();d.crates=nil;rejects(d,'Mechanism crates is not a list','crates missing')
-- The same check covers plates and gates.
d=spec();d.plates={d.plates[1],nil,{id='plate-c'}};rejects(d,'Mechanism plates has a gap at entry 2','plates [A,null,invalid]')
d=spec();d.gates={d.gates[1],nil,{id='gate-c'}};rejects(d,'Mechanism gates has a gap at entry 2','gates [A,null,invalid]')
d=spec();d.gates={['1']=d.gates[1]};rejects(d,'Mechanism gates is not a list (key "1")','gates {"1":A}')
print('PASS sparse, object-shaped, over-limit and missing crate/plate/gate lists are rejected with the cause')

-- plate actors ["vehicle","crate-a",null,"unknown"]: the unknown actor after the hole was never checked.
d=spec();d.plates[1].actors={'vehicle','crate-a',nil,'unknown'};rejects(d,'Plate plate-a actors has a gap at entry 3','actors [vehicle,crate-a,null,unknown]')
d=spec();d.plates[1].actors={'vehicle',nil,'vehicle'};rejects(d,'Plate plate-a actors has a gap at entry 2','actors [vehicle,null,vehicle] (duplicate after the hole)')
d=spec();d.plates[1].actors={['1']='vehicle'};rejects(d,'Plate plate-a actors is not a list (key "1")','actors {"1":"vehicle"}')
d=spec();d.plates[1].actors={'vehicle',who='crate-a'};rejects(d,'Plate plate-a actors is not a list (key "who")','actors with a name key')
d=spec();d.plates[1].actors={'vehicle'};for i=1,9 do d.plates[1].actors[i+1]='crate-a' end;rejects(d,'Plate plate-a actors has more than 9 entries','10 actors')
-- An empty actor list stays its own error: a plate needs at least one explicit actor.
d=spec();d.plates[1].actors={};rejects(d,'Plate needs explicit accepted actor IDs','actors []')
d=spec();d.plates[1].actors=nil;rejects(d,'Plate plate-a actors is not a list','actors missing')
print('PASS sparse, object-shaped and over-limit plate actor lists are rejected with the cause')

-- links [L1,L2,null,invalid]: the invalid link after the hole was never checked.
local invalid_link={from='gate-a',event='active',to='plate-a',action='open'}
d=spec();d.links={d.links[1],d.links[2],nil,invalid_link};rejects(d,'Mechanism links has a gap at entry 3','links [L1,L2,null,invalid]')
d=spec();d.links={d.links[1],nil,clone(d.links[1])};rejects(d,'Mechanism links has a gap at entry 2','links [L1,null,L1] (duplicate after the hole)')
d=spec();d.links={['1']=d.links[1]};rejects(d,'Mechanism links is not a list (key "1")','links {"1":L1}')
d=spec();for i=1,33 do d.links[i]=clone(d.links[1]) end;rejects(d,'Mechanism links has more than 32 entries','33 links')
d=spec();d.links=nil;rejects(d,'Mechanism links is not a list','links missing')
print('PASS sparse, object-shaped and over-limit gate-link lists are rejected with the cause')

-- The editor source path refuses the same shapes (editor_doc.validate runs mechanism validation before
-- the 256-object source cap reads M.cost).
local E=require 'main.editor.editor_doc'
local doc=E.blank('mechanism-arrays','Mechanism arrays');doc.editor.objects={{id='o1',type='line',points={{-6,0},{40,0}}}};doc.editor.next_id=2;doc.editor.start.position={2,1.7}
-- A version-12 block holds the O1 data in editor.mechanisms (validate migrates a valid one to objects,
-- so each check validates a copy).
doc.editor.editor_version,doc.editor.compiler_version=12,12
doc.editor.mechanisms=spec();assert(E.validate(E.copy(doc)))
doc.editor.mechanisms.crates={doc.editor.mechanisms.crates[1],nil,invalid_crate}
local ok,why=E.validate(doc);assert(not ok and why=='Mechanism crates has a gap at entry 2','editor source: '..tostring(why))
-- Version 13 (O2) keeps the links in editor.mechanism_links: the same dense-list rule applies there.
local v13=E.copy(doc);v13.editor.mechanisms=spec();assert(E.validate(v13) and v13.editor.editor_version==13 and #v13.editor.mechanism_links==2)
local holed=E.copy(v13);holed.editor.mechanism_links={holed.editor.mechanism_links[1],nil,holed.editor.mechanism_links[2]}
ok,why=E.validate(holed);assert(not ok and why=='Mechanism links has a gap at entry 2','editor source links: '..tostring(why))
local keyed=E.copy(v13);keyed.editor.mechanism_links={['1']=keyed.editor.mechanism_links[1]}
ok,why=E.validate(keyed);assert(not ok and why:find('Mechanism links is not a list',1,true),'object-shaped links: '..tostring(why))
print('PASS editor source validation refuses a sparse mechanism list (version 12) and sparse or object-shaped mechanism_links (version 13) with the same cause')
