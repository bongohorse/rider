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
local preview=E.background_preview;B.suspend(true);assert(B.current and E.background_preview==preview);B.suspend(false);assert(E.background_preview==preview)
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
print('PASS #549 Background session: preview copy, Apply once, refusal, Undo/Redo, preserved master/Auto choices, Discard and document isolation')
