-- #516: transparency, private environments, explicit owner isolation and bounded observer samples.
local now,selected,debug_build=0,'on',true
package.loaded.socket={gettime=function()return now end}
sys={get_engine_info=function()return {is_debug=debug_build}end,
 get_config_string=function(key,default)if key=='rider.gym_test'then return 'pub516' end;return default end}
local function native_run(code)
 if code:find('URLSearchParams',1,true)then return selected end
 if code:find('riderPublication516Window',1,true)then return 'window-control' end
 now=now+.002;return 'native return'
end
local function native_encode()now=now+.001;return '{"x":1}'end
html5={run=native_run};json={encode=native_encode,decode=function(text)
 assert(text=='window-control');return {run_id='',begin_unix_ms=5000,end_unix_ms=25000}
end}
local P=require 'main.gym.publication_probe516'
local function target(self,a,b,c)
 self.fixed_ticks=self.fixed_ticks+1
 local text=json.encode({value=a});local result=html5.run('window.riderTest='..text)
 if self.fail then error('original callback failure')end
 return a,b,c,result
end
local env=getfenv(target)
debug_build=false;assert(P.wrap(target,'release')==target and getfenv(target)==env)
debug_build=true
local wrapped=P.wrap(target,'on')
assert(getfenv(target)~=env and html5.run==native_run and json.encode==native_encode,'no global API replacement')
local a={fixed_ticks=0,last_command={throttle=0,brake_reverse=0,lean=0}}
local function pack(...)return {n=select('#',...),...}end
wrapped(a,1,nil,3);local state=a.publication516.on;assert(not state.started and not next(state.buckets))
now=6;local result=pack(wrapped(a,1,nil,3))
assert(result.n==4 and result[1]==1 and result[2]==nil and result[3]==3 and result[4]=='native return')
assert(state.buckets['json.encode'].count==1 and state.buckets['json.encode'].bytes==7)
assert(state.buckets['html5.run:riderTest'].count==1 and state.buckets.callback.count==1)
assert(state.command_samples==1 and not state.nonzero_command)
local b={fixed_ticks=0};wrapped(b,2)
assert(b.publication516.on~=state and b.publication516.on.buckets.callback.count==1,'owners share the window but retain isolated samples')
a.fail=true;assert(not pcall(wrapped,a,1));a.fail=nil
local count=state.buckets['json.encode'].count
html5.run('window.unrelated=1');assert(state.buckets['json.encode'].count==count)
-- The inactive control keeps the callback's environment and omits per-publication observers.
selected='off'
local function plain(self)self.fixed_ticks=self.fixed_ticks+1;return json.encode({})end
local original_env=getfenv(plain);local off=P.wrap(plain,'off')
assert(getfenv(plain)==original_env)
local c={fixed_ticks=0};off(c);now=12;off(c)
assert(c.publication516.off.buckets.callback.count==2 and not c.publication516.off.buckets['json.encode'])
-- Bounded recording still counts every call and signals loss of samples; it never silently truncates a report.
selected='on';now=6.1
for _=1,P.CAP+2 do wrapped(a,1)end
assert(state.overflow and #state.buckets.callback.samples_ms==P.CAP and state.buckets.callback.count>P.CAP)
now=27;wrapped(a,1);assert(state.sent and state.tick_end>state.tick_begin)
print('PASS publication observer: original returns/errors, release identity, private APIs, isolated windows, off control and explicit overflow')
