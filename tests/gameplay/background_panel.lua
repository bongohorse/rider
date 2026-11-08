-- #549: background draft/Apply boundaries with real document history.
local J=require 'tests.gameplay.lib.json'
local function enc(v) if type(v)~='table' then return tostring(v) end;local k={};for x in pairs(v) do k[#k+1]=tostring(x) end;table.sort(k);local o={};for i,x in ipairs(k) do o[i]=x..'='..enc(v[x] or v[tonumber(x)]) end;return '{'..table.concat(o,',')..'}' end
json={decode=J.decode,encode=enc}
sys=sys or {get_config_number=function(_,d) return d end,get_engine_info=function() return {is_debug=false} end,get_config_int=function(_,d) return d end,get_config_string=function(_,d) return d end}
html5=nil
local D=require 'main.editor.editor_doc'
local commits=0
local E={touch=function() end,mode='edit',opened=1,look_epoch=0}
package.loaded['main.editor.editor']=E
local B=require 'main.editor.editor_background'
local S=require 'main.backgrounds.source'
local function fresh()
    local d=D.blank('bg','Background');d.editor.objects[1]={id='o1',type='line',points={{0,0},{20,0}}};d.editor.next_id=2;return d
end
E.doc=fresh();E.history=D.history()
function E.commit(fn)
    if E.refuse then return nil,'Commit refused' end
    local before=D.copy(E.doc);local _,err=fn(E.doc.editor,E.doc)
    if not err then local ok,why=D.validate(E.doc);if not ok then err=why end end
    if err then E.doc=before;return nil,err end
    D.record(E.history,before,E.opened);E.doc.editor.revision=before.editor.revision+1;commits=commits+1;return true
end
local input=S.defaults('city');input.enabled=false;input.layers[2].visible=false;input.layers[3].depth=.31
assert(B.draft(input));input.layers[3].depth=.88
assert(E.background_preview.backgrounds.layers[3].depth==.31 and E.doc.editor.backgrounds==nil)
assert(B.current.enabled==false and B.current.layers[2].visible==false and commits==0)
-- #604: a dialog ends a Depth drag; the stored source stays and nothing keeps previewing.
B.suspend(true);assert(B.current==nil and E.background_preview==nil and commits==0);B.suspend(false);assert(B.draft(input))
E.look_preview={unrelated=true};B.discard();assert(E.background_preview==nil and E.look_preview.unrelated)
assert(not B.apply());assert(not B.draft('bad') and E.doc.editor.backgrounds==nil)
input.layers[3].depth=.31;assert(B.draft(input));E.refuse=true
assert(not B.apply() and B.current and E.doc.editor.backgrounds==nil);E.refuse=nil
assert(B.apply() and commits==1 and E.doc.editor.editor_version==15 and E.background_preview==nil)
assert(B.apply() and commits==1,'Apply without a pending draft is a no-op')
local b=E.doc.editor.backgrounds;assert(not b.enabled and not b.layers[2].visible and b.layers[3].auto and b.layers[3].depth==.31)
-- An unchanged Apply creates no extra Undo entry, even from copied/reordered source tables.
assert(B.draft(D.copy(b)));assert(B.apply() and commits==1)
local undone=assert(D.step(E.history,E.doc,true,1));assert(undone.editor.backgrounds==nil)
local redone=assert(D.step(E.history,undone,false,1));assert(redone.editor.backgrounds.layers[3].depth==.31 and not redone.editor.backgrounds.enabled)
E.doc=redone
-- Master and Auto toggles never erase the retained individual/manual values.
local next_b=D.copy(b);next_b.enabled=true;next_b.layers[3].auto=false
assert(B.draft(next_b));assert(B.apply());assert(E.doc.editor.backgrounds.layers[3].depth==.31 and not E.doc.editor.backgrounds.layers[2].visible)
local bad=D.copy(next_b);bad.layers[1].depth=2
assert(not B.draft(bad) and E.background_preview==nil and E.doc.editor.backgrounds.layers[1].depth==.9)
-- An old draft can never apply to another document, including one with the same ID and revision.
assert(B.draft(next_b));E.opened=2;E.doc=fresh();assert(not B.apply() and E.doc.editor.backgrounds==nil and E.background_preview==nil)
B.handle('bad');B.handle({type='unknown'});B.close()
-- #706 Background tab operations on the stored (or previewed) source.
E.opened=3;E.doc=fresh();E.history=D.history();commits=0
B.op('x');B.op(nil);B.op({op='enabled'});B.op({op='visible',layer=1});assert(commits==0 and E.doc.editor.backgrounds==nil,'nothing to toggle yet')
assert(B.op({op='preset',id='quarry'}) and commits==1);local s=E.doc.editor.backgrounds
assert(s.preset=='quarry' and s.enabled and #s.layers==6 and s.layers[3].auto and s.layers[3].depth==.55)
assert(B.op({op='preset',id='city'}) and commits==2 and E.doc.editor.backgrounds.preset=='city')
assert(B.op({op='visible',layer=2}) and not E.doc.editor.backgrounds.layers[2].visible and commits==3)
assert(B.op({op='auto',layer=3}) and not E.doc.editor.backgrounds.layers[3].auto and commits==4)
for _,bad in ipairs({0,7,1.5,'1'}) do B.op({op='visible',layer=bad}) end;B.op({op='depth',layer=3,value='x'});B.op({op='nope'});assert(commits==4)
-- A Depth drag previews, then its release is one commit; an unknown preset is refused with a message.
assert(B.op({op='depth',layer=3,value=.4}));assert(commits==4 and E.background_preview and E.doc.editor.backgrounds.layers[3].depth==.55)
assert(B.op({op='depth',layer=3,value=.42,commit=true}));assert(commits==5 and E.background_preview==nil and E.doc.editor.backgrounds.layers[3].depth==.42)
assert(not B.op({op='preset',id='moon'}) and commits==5 and B.message~='')
assert(B.op({op='enabled'}) and E.doc.editor.backgrounds.enabled==false and E.doc.editor.backgrounds.layers[3].depth==.42 and commits==6)
-- A drag preview that is never released is dropped by a document change (e.g. Undo), so the next choice
-- starts from the stored source and cannot revert that change.
assert(B.op({op='depth',layer=4,value=.3}));E.doc.editor.revision=E.doc.editor.revision+1;E.doc.editor.backgrounds.preset='volcano'
B.tick();assert(B.current==nil and E.background_preview==nil)
assert(B.op({op='visible',layer=1}) and E.doc.editor.backgrounds.preset=='volcano' and E.doc.editor.backgrounds.layers[4].depth==.35 and commits==7)
print('PASS #549/#706 Background session and tab operations: preview copy, Apply once, refusal, Undo/Redo, preserved master/Auto choices, Discard and document isolation')
