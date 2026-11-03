-- Runs in the loader collection; world teardown cannot discard in-flight progress acknowledgement.
local catalog=require 'main.gym.course_catalog'
local progress=require 'main.gym.level_progress'
local best=require 'main.gym.run_best'
local medals=require 'main.gym.medals'
local stations=require 'main.gym.stations'
local custom=require 'main.gym.custom'
local M={view={open=false,courses={}}}
function M.new()
 local t={progress=progress.new(),levels={},records={},refresh=true}
 for _,id in ipairs(catalog.ids) do t.levels[id]=assert(stations.resource(id));t.records[id]=best.new(medals.key(t.levels[id])) end
 t.legacy=best.new(best.KEY)
 return t
end
function M.poll(t,self,dt)
 for _,record in pairs(t.records) do best.poll(record) end;best.poll(t.legacy)
 if custom.sync_state()=='saved' then
  if t.refresh then
   for _,id in ipairs(catalog.ids) do t.records[id]=best.new(medals.key(t.levels[id])) end
   t.refresh=false
  end
  for id,record in pairs(t.records) do progress.legacy(t.progress,id,record) end
  progress.legacy(t.progress,'first-run',t.legacy)
 end
 progress.poll(t.progress)
 t.clock=(t.clock or 0)+dt;if t.clock<.1 then return end;t.clock=0
 local courses={}
 for i,id in ipairs(catalog.ids) do
  local d,r=t.levels[id],t.records[id];local gems,total=0,0
  for _,p in ipairs(d.coins and d.coins.items or {}) do if p.kind=='gem' then total=total+1;if self.coin_bank.claims[id..'/'..p.id] then gems=gems+1 end end end
  local chain=d.chains[1];local preview={}
  for n=0,19 do local p=chain[1+math.floor(n*(#chain-1)/19)];preview[#preview+1]={p[1],p[2]} end
  courses[i]={id=id,name=d.name,unlocked=catalog.unlocked(t.progress.completed,id) and not t.progress.checking,completed=t.progress.completed[id]==true,best=r.best or 0,medal=r.medal,gems=gems,total_gems=total,record_status=r.status,preview=preview}
 end
 local next=catalog.next(self.station)
 M.view={open=self.levels_open or false,courses=courses,status=t.progress.status,station=self.station,loading=self.loading,
  next_id=next or '',next_enabled=not self.loading and self.level_finished==true and next~=nil and catalog.unlocked(t.progress.completed,next) and not t.progress.checking or false}
 local encoded=json.encode(M.view)
 if html5 and encoded~=t.published then t.published=encoded;html5.run('window.riderLevels='..encoded..';window.riderLevelMenu?.render(window.riderLevels)') end
end
function M.allowed(t,id) return not t.progress.checking and catalog.unlocked(t.progress.completed,id) end
function M.finish(t,id,official) t.refresh=true;return progress.offer(t.progress,id,official) end
return M
