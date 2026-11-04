-- #516 debug experiment only. Owners retain bounded samples on their existing instance/state.
-- Private function environments observe existing calls; global html5/json tables are never replaced.
local socket=require 'socket'
local M={WARMUP=5,SECONDS=20,CAP=4096}
local function pack(...)return {n=select('#',...),...}end
local function mode()
 if not (sys and sys.get_engine_info and sys.get_config_string and sys.get_engine_info().is_debug and html5
  and sys.get_config_string('rider.gym_test','')=='pub516') then return nil end
 local value=html5.run("new URLSearchParams(location.search).get('pub516') || ''")
 assert(value=='on' or value=='off','pub516 requires explicit on/off observer mode')
 return value
end
local function resolution()
 local previous,best=socket.gettime(),nil
 for _=1,10000 do local now=socket.gettime();local d=now-previous;if d>0 and (not best or d<best)then best=d end;previous=now end
 return best and best*1000 or false
end
local function add(state,name,elapsed,bytes)
 if not state.active then return end
 local b=state.buckets[name]
 if not b then b={count=0,bytes=0,sum_ms=0,max_ms=0,samples_ms={}};state.buckets[name]=b end
 b.count=b.count+1;b.bytes=b.bytes+(bytes or 0);local ms=elapsed*1000
 b.sum_ms=b.sum_ms+ms;b.max_ms=math.max(b.max_ms,ms)
 if #b.samples_ms<M.CAP then b.samples_ms[#b.samples_ms+1]=ms else state.overflow=true end
end
function M.wrap(fn,label,helpers)
 local selected=mode();if not selected then return fn end
 local env=getfenv(fn);local real_html5,real_json=env.html5,env.json
 local active
 if selected=='on' then
  local function observed(kind,f,...)
   local start=socket.gettime();local result=pack(f(...));local elapsed=socket.gettime()-start
   if active then
    local value=(kind=='json.encode') and result[1] or (...)
    local name=kind
    if kind=='html5.run' then name=name..':'..(type(value)=='string' and value:match('window%.([%w_]+)') or 'expression')end
    add(active,name,elapsed,type(value)=='string' and #value or 0)
   end
   return unpack(result,1,result.n)
  end
  local private=setmetatable({
   html5=setmetatable({run=function(...)return observed('html5.run',real_html5.run,...)end},{__index=real_html5}),
   json=setmetatable({encode=function(...)return observed('json.encode',real_json.encode,...)end},{__index=real_json}),
  },{__index=env,__newindex=env})
  setfenv(fn,private)
  for _,helper in ipairs(helpers or {})do setfenv(helper,private)end
 end
 return function(self,...)
  local now=socket.gettime()
  self.publication516=self.publication516 or {}
  local p=self.publication516[label]
  if not p then
   p={buckets={},resolution_ms=resolution()}
   self.publication516[label]=p
  end
  -- Latch one common window after the runner confirms the target world is ready.
  -- Bootstrap-only polling ends before warm-up; no control reads enter the sample window.
  if not p.begin then
   local text=real_html5.run("JSON.stringify(window.riderPublication516Window||null)")
   local window=real_json.decode(text)
   if window then
    assert(window.run_id==sys.get_config_string('rider.run_id',''),'foreign publication window')
    assert(window.end_unix_ms-window.begin_unix_ms==M.SECONDS*1000,'invalid publication window')
    p.begin,p.finish=window.begin_unix_ms/1000,window.end_unix_ms/1000
   end
  end
  p.active=p.begin and now>=p.begin and now<p.finish or false
  if p.active and not p.started then p.started=true;p.tick_begin=self.fixed_ticks;p.heap_begin_kb=collectgarbage('count')end
  local previous=active;active=p
  local start=socket.gettime();local result=pack(pcall(fn,self,...));local elapsed=socket.gettime()-start
  active=previous
  add(p,'callback',elapsed)
  if p.active then
   p.tick_end=self.fixed_ticks
   local c=self.last_command
   if c then
    p.command_samples=(p.command_samples or 0)+1
    if (c.throttle or 0)~=0 or (c.brake_reverse or 0)~=0 or (c.lean or 0)~=0 then p.nonzero_command=true end
   end
  end
  if p.finish and now>=p.finish and not p.sent then
   p.sent=true
   local report={schema=1,owner=label,mode=selected,run_id=sys.get_config_string('rider.run_id',''),
    begin_unix_ms=p.begin*1000,end_unix_ms=p.finish*1000,warmup_s=M.WARMUP,sample_s=M.SECONDS,
    buckets=p.buckets,overflow=p.overflow or false,resolution_ms=p.resolution_ms,
    fixed_tick_begin=p.tick_begin,fixed_tick_end=p.tick_end,command_samples=p.command_samples or 0,nonzero_command=p.nonzero_command or false,
    heap_begin_kb=p.heap_begin_kb,heap_end_kb=collectgarbage('count')}
   real_html5.run('window.riderPublication516=window.riderPublication516||{};window.riderPublication516['..real_json.encode(label)..']='..real_json.encode(report))
  end
  if not result[1] then error(result[2],0)end
  return unpack(result,2,result.n)
 end
end
return M
