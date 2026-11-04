-- #513: missing save-admission transitions through the real editor interfaces.
-- Storage and version acknowledgements are controlled boundaries, not a second save/session implementation.
-- Native engine keeps its real JSON codec; plain Bob LuaJIT uses the same opaque-text model as other persistence tests.
local D=require 'main.editor.editor_doc'
local custom=require 'main.game.custom'
local versions=require 'main.editor.editor_versions'
local now,control,H=0,{},nil
local ok,socket=pcall(require,'socket');if not ok then socket={};package.loaded.socket=socket end
socket.gettime=function()return now end
if not json then
 local encoded,n={},0
 json={encode=function(v)n=n+1;local key='json-'..n;encoded[key]=D.copy(v);return key end,
  decode=function(key)return D.copy(assert(encoded[key]))end}
end
custom.drafts=function()return {save=function(text,key)
 if control.fail_draft then return nil,'injected draft failure' end
 control.draft,control.draft_key=text,key;return 1
end}end
custom.library=function()return {save=function(key,text)
 if control.fail_index then return nil,'injected index failure' end
 control.levels[key]=text;return 1
end}end
custom.sync_state=function()return control.sync end
versions.create=function()
 H={busy=function()return H.done~=nil end,update=function()end,
  load=function()return D.copy(control.restore)end,
  add=function(_,_,_,_,done)if H.done then return nil,'busy' end;H.done=done;return true end}
 return H
end
local function fresh()
 now=0;control={sync='saved',levels={[1]='prior-good'},draft='prior-good'}
 package.loaded['main.editor.editor']=nil
 local E=require 'main.editor.editor'
 assert(E.open(D.blank('source-a','Source A'),false,{key=1,store=true,saved=true}))
 E.versioned[E.opened]=E.doc.editor.revision
 return E
end
local function finish()local done=assert(H.done);H.done=nil;done()end
local function change(E,name)assert(E.commit(function(_,d)d.name=name end,false))end

-- A failed switch has an inclusive ten-second repeat override; an expired attempt starts a fresh window.
local E=fresh();change(E,'Changed A');control.fail_draft=true
assert(not E.leave());assert(E.behind[E.opened] and E.message:find('Repeat within 10 s',1,true))
assert(control.draft=='prior-good' and control.levels[1]=='prior-good')
now=10;assert(E.leave(),'repeat exactly at ten seconds is intentional');assert(E.refused_at==nil)
now=20;assert(not E.leave());now=30.001;assert(not E.leave(),'expired repeat must be refused')
assert(E.refused_at==30.001 and control.draft=='prior-good')
control.fail_draft=false;assert(E.flush());assert(not E.behind[E.opened])
assert(control.draft==control.levels[1] and control.draft_key==1)
print('PASS save admission: failed draft keeps prior copies, exact ten-second override, expired repeat and recovery')

-- Pending restore captures both instance and revision; late completion cannot overwrite a newer document/action.
for _,transition in ipairs({'revision','instance','unchanged'})do
 E=fresh();control.restore=D.blank('restored','Restored source');local initial_instance=E.opened
 assert(E.restore_version(1));assert(H.busy())
 if transition=='revision' then change(E,'New revision')
 elseif transition=='instance' then assert(E.open(D.blank('source-b','Source B'),true,{key=2,store=true,saved=true}))end
 local current_instance,current_revision,current_name=E.opened,E.doc.editor.revision,E.doc.name
 finish()
 if transition=='unchanged' then
  assert(E.doc.id=='restored' and E.opened~=initial_instance and E.doc.editor.revision>current_revision)
  assert(#E.history.undo==1 and E.history.undo[1].instance==initial_instance)
 else
  assert(E.opened==current_instance and E.doc.editor.revision==current_revision and E.doc.name==current_name)
  assert(E.message=='Restore cancelled: the current level changed; try again.')
  if transition=='revision' then assert(E.versioned[initial_instance]<E.doc.editor.revision,'late acknowledgement must not stamp the new revision')end
 end
end
print('PASS delayed restore: unchanged positive control, revision/instance cancellation and stale revision acknowledgement')

-- Crossing document instances through Undo uses leave admission too; a refusal must not consume history.
E=fresh();local a=E.opened
assert(E.open(D.blank('source-b','Source B'),true,{key=2,store=true,saved=true}));local b=E.opened
E.versioned[b]=E.doc.editor.revision;change(E,'Unsaved B');control.fail_draft=true
assert(E.undo(true)) -- same-instance edit undo does not need a switch
local undo_count=#E.history.undo;local redo_count=#E.history.redo
local stepped,err=E.undo(true);assert(not stepped and err=='refused')
assert(E.opened==b and #E.history.undo==undo_count and #E.history.redo==redo_count)
now=10;assert(E.undo(true));assert(E.opened==a and E.key()==1 and E.behind[b])
assert(not E.undo(false),'Redo crossing must first refuse the failed outgoing save')
now=20;assert(E.undo(false));assert(E.opened==b and E.key()==2)
control.fail_draft=false;assert(E.flush());assert(not E.behind[b])
assert(E.instances==2 and E.keys[a]==1 and E.keys[b]==2,'Undo/Redo must not allocate instances or storage keys')
print('PASS cross-instance Undo/Redo: refusal preserves stacks, override retains unsaved ownership, keys stay bounded')
