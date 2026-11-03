-- #438: one-shot effect triggers (main/game/sfx.lua) and their gating in main/game/audio.lua, with
-- Defold sound/go stubs. Proves one voice per event, no autoplay before input, mute and pause silence.
local played,stopped,gains={},{},{}
sound={play=function(url,props) played[#played+1]=url;gains[#gains+1]=props and props.gain end,
 stop=function(url) stopped[#stopped+1]=url end}
go={set=function() end}
local audio=require 'main.game.audio'
local sfx=require 'main.game.sfx'
local function take() local p=played;played={};return table.concat(p,',') end

local s={coins={count=0,gems=0},coin_attempt=1,fuel={collected=0},fuel_attempt=1,reset_count=0,
 race={id='1:1',state='ready'},finish_count=nil}
sfx.update(s);assert(take()=='','baseline frame plays nothing')

-- No autoplay: before the first gameplay input (engine voice not started) events are dropped, not queued.
s.coins.count=1;sfx.update(s);assert(take()=='','effect before audio start')
audio.start(s);played={};sfx.update(s);assert(take()=='','dropped event replayed after start')

-- Each pickup kind: one voice per event, none on an unchanged frame.
s.coins.count=2;sfx.update(s);assert(take()=='#sfx_coin')
sfx.update(s);assert(take()=='','repeat on unchanged frame')
s.coins.gems=1;sfx.update(s);assert(take()=='#sfx_gem')
s.fuel.collected=1;sfx.update(s);assert(take()=='#sfx_fuel')
s.coins.count,s.fuel.collected=3,2;sfx.update(s);assert(take()=='#sfx_coin,#sfx_fuel','two kinds in one frame')

-- Retry: a new attempt re-baselines (count drops to 0) without a cue; the next pickup sounds again.
s.coin_attempt,s.fuel_attempt,s.coins.count,s.coins.gems,s.fuel.collected=2,2,0,0,0;sfx.update(s);assert(take()=='')
s.coins.count=1;sfx.update(s);assert(take()=='#sfx_coin')

-- Attempt ended: one crash cue per failed attempt; the next attempt can crash again.
s.race.state='running';sfx.update(s);assert(take()=='')
s.race.state='failed';sfx.update(s);assert(take()=='#sfx_crash')
sfx.update(s);assert(take()=='','crash repeated while failed')
s.race={id='1:2',state='ready'};sfx.update(s);assert(take()=='')
s.race.state='failed';sfx.update(s);assert(take()=='#sfx_crash')
-- FINISH: once per crossing.
s.finish_count=1;sfx.update(s);assert(take()=='#sfx_finish')
sfx.update(s);assert(take()=='')

-- Hard landing: >= MIN_AIR airborne and the last airborne vertical speed >= HARD_MPS downward.
local function flight(seconds,vy,resets_mid)
 local steps=math.floor(seconds*60+0.5)
 for i=1,steps do
  if resets_mid and i==math.floor(steps/2) then s.reset_count=s.reset_count+1 end
  sfx.fixed(s,false,vy,1/60)
 end
 sfx.fixed(s,true,0,1/60)
end
s.race={id='1:2r',state='running'};sfx.update(s);assert(take()=='')
flight(0.5,-6);sfx.update(s);assert(take()=='#sfx_land')
sfx.update(s);assert(take()=='','landing cue repeated')
flight(0.1,-6);sfx.update(s);assert(take()=='','short hop sounded')
flight(0.5,-2);sfx.update(s);assert(take()=='','soft landing sounded')
flight(0.4,-6,true);sfx.update(s);assert(take()=='','Retry mid-flight counted the old flight') -- 0.2 s after the reset
for _=1,30 do sfx.fixed(s,true,0,1/60) end;sfx.update(s);assert(take()=='','ground contact sounded')
-- A crash on the same frame drops the landing cue.
s.race={id='1:3',state='running'};sfx.update(s)
flight(0.5,-6);s.race.state='failed';sfx.update(s);assert(take()=='#sfx_crash','landing on top of a crash')
sfx.update(s);assert(take()=='','dropped landing cue was queued')
-- After the attempt ended (failed or finished), the tumbling car's landings stay silent.
flight(0.5,-6);sfx.update(s);assert(take()=='','landing after a failed run')
s.race={id='1:4',state='running'};sfx.update(s);s.race.state='finished';flight(0.5,-6);sfx.update(s);assert(take()=='','landing after a finished run')
s.race={id='1:5',state='running'};sfx.update(s)

-- Worlds without a run (gym stations, custom levels): a head or bounds crash resets at once; that is the cue.
local g={coins=nil,fuel=nil,reset_count=0,audio_started=true}
sfx.update(g);assert(take()=='')
g.reset_count,g.last_reset_reason=1,'manual';sfx.update(g);assert(take()=='','manual Retry sounded as a crash')
g.reset_count,g.last_reset_reason=2,'head';sfx.update(g);assert(take()=='#sfx_crash')
sfx.update(g);assert(take()=='','reset crash repeated')
g.reset_count,g.last_reset_reason=3,'bounds';sfx.update(g);assert(take()=='#sfx_crash')
g.reset_count,g.last_reset_reason=4,'section';sfx.update(g);assert(take()=='')
-- Same frame as a hard landing: only the crash.
-- Controller order in one tick: sfx.fixed sees the touchdown, then reset() runs (reset_count, reason).
local function hard_landing(o) for _=1,30 do sfx.fixed(o,false,-6,1/60) end;sfx.fixed(o,true,0,1/60);assert(o.sfx_landed,'no landing to drop') end
hard_landing(g);g.reset_count,g.last_reset_reason=5,'head';sfx.update(g);assert(take()=='#sfx_crash','landing on top of a reset crash')
hard_landing(g);g.reset_count,g.last_reset_reason=6,'manual';sfx.update(g);assert(take()=='#sfx_land','control: a landing with a manual Retry')

-- Mute: no cue while muted, ringing voices are stopped, events while muted are not replayed on unmute.
stopped={};audio.mute(s);assert(#stopped==6,'mute did not stop every effect')
s.coins.count=2;flight(0.5,-6);sfx.update(s);assert(take()=='','effect while muted')
audio.mute(s);sfx.update(s);assert(take()=='','muted event replayed')
-- Pause (A20): a paused world is silent, including effects already playing; resume does not replay.
stopped={};audio.pause(s,true);assert(#stopped==6,'pause did not stop every effect')
s.coins.count=3;s.fuel.collected=1;sfx.update(s);assert(take()=='','effect while paused')
audio.pause(s,false);sfx.update(s);assert(take()=='','paused event replayed')
s.coins.count=4;sfx.update(s);assert(take()=='#sfx_coin','no cue after resume')
-- Session end stops the engine and every effect.
stopped={};audio.stop(s);assert(#stopped==7)
assert(s.audio_effects.coin==4 and s.audio_effects.crash==3 and s.audio_effects.land==1)
-- Audible over the engine loop (drive test 2026-11-03), but no clipping: each cue at least 5x the engine gain, at most 0.7.
assert(#gains>0)
for _,g2 in ipairs(gains) do assert(g2>=5*audio.gain and g2<=0.7,'per-voice gain out of range') end
for name,gain in pairs(audio.effects) do assert(gain>=5*audio.gain and gain<=0.7,'gain out of range: '..name) end
print('PASS one-shot cues per pickup/gem/fuel/crash (run and run-less reset)/finish/hard landing, silent landings after an ended run, retry re-baselines, no autoplay, mute/pause silence and drop without replay')
