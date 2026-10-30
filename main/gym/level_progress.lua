-- Loader-owned absolute completion set. Unlocks expose acknowledged state only.
local custom=require 'main.gym.custom'
local catalog=require 'main.gym.course_catalog'
local M={}
local names={'level-progress-a','level-progress-b'}
local function copy(t) local r={};for k,v in pairs(t) do r[k]=v end;return r end
function M.parse(text)
 local ok,d=pcall(json.decode,text)
 if not ok or type(d)~='table' then return nil,'Unreadable level progress' end
 if d.version~=1 then return nil,'Unsupported level progress version',true end
 for k in pairs(d) do if k~='version' and k~='completed' then return nil,'Unsupported level progress field',true end end
 if type(d.completed)~='table' then return nil,'Invalid completion set' end
 local n=0;for k,v in pairs(d.completed) do
  if type(k)~='string' or #k>64 or not k:match('^[a-z][a-z0-9%-]*$') or v~=true then return nil,'Invalid completion identity' end
  n=n+1;if n>128 then return nil,'Completion limit exceeded' end
 end
 return d
end
function M.new()
 local store=custom.slot_store(names,M.parse);local restored,err=store.restore();local latest=store.newest()
 local bad=err or latest and latest.unsupported or restored and restored.skipped or not restored and store.exists()
 local completed={}
 for i,name in ipairs(names) do
  local ok,exists=pcall(sys.exists,sys.get_save_file('rider',name));local slot=store.slot(i)
  local valid=slot and not slot.unsupported and slot.seq>=1 and slot.seq%1==0
  if not ok or exists and not valid then bad=true end
  if valid then for id in pairs(slot.doc.completed) do completed[id]=true end end
 end
 return {store=store,completed=completed,desired=copy(completed),blocked=bad or false,checking=custom.sync_state()~='saved',status=bad and 'Progress protected' or 'Checking progress storage'}
end
function M.offer(t,id,official)
 if not official or t.blocked or not catalog.unlocked(t.completed,id) or t.desired[id] then return false end
 t.desired[id]=true;return true
end
-- An acknowledged existing official record also proves a prior finish; preserve it on adoption.
function M.legacy(t,id,record)
 if not t.blocked and catalog.index(id) and record and not record.blocked and record.status=='saved' and record.best then t.desired[id]=true end
end
function M.poll(t)
 if t.blocked then return end
 local state=custom.sync_state()
 if t.checking then
  if state=='syncing' then return end
  t.checking=false
  if state~='saved' then t.blocked=true;t.status='Progress not saved';return end
 end
 if t.pending then
  if state=='syncing' then return end
  if state~='saved' then t.pending=nil;t.blocked=true;t.status='Progress not saved';return end
  t.completed=t.pending;t.pending=nil
 end
 local changed=false;for id in pairs(t.desired) do if not t.completed[id] then changed=true end end
 if changed then
  local next=copy(t.desired);local seq=t.store.save(json.encode({version=1,completed=next}))
  if not seq then t.blocked=true;t.status='Progress not saved';return end
  t.pending=next;t.status='Saving progress...'
 else t.status='saved' end
end
return M
