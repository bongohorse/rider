-- #666: comic callout queue (main/game/callouts.lua), fed with the run/reset messages the GUI receives.
-- Proves CRASH! once per head crash (only reachable with the crash rule on), nothing for the other endings,
-- New best! on a new best, at most two at once, the live switch, and placement clear of the touch drive
-- zones at 1080x486.
local callouts=require 'main.game.callouts'
local area={w=1080,h=486}
local function texts(q) local t={};for i,it in ipairs(q.items) do t[i]=it.text end;return table.concat(t,',') end

-- Crash rule on, level run: the run fails on the head; the run_state message repeats every frame.
local q=callouts.new()
local run={id='1:1',state='running',reason='',new_best=false}
callouts.observe_run(q,run,area);assert(texts(q)=='','running shows nothing')
run.state,run.reason='failed','head'
for _=1,30 do callouts.observe_run(q,run,area) end
assert(texts(q)=='CRASH!','head crash: CRASH! once, got '..texts(q))
-- Crash rule off: head contact neither fails the run nor resets, so the messages never say head.
local off=callouts.new()
for _,r in ipairs({{id='2:1',state='running',reason=''},{id='2:1',state='finished',reason='',new_best=false},
    {id='2:2',state='failed',reason='bounds'}}) do callouts.observe_run(off,r,area) end
callouts.observe_reset(off,'manual',area);callouts.observe_reset(off,'bounds',area);callouts.observe_reset(off,'preset',area)
assert(texts(off)=='','crash rule off / other endings: no callout, got '..texts(off))
-- Worlds without a run: a head crash resets at once (retry_done reason head), one callout per reset.
local gym=callouts.new()
callouts.observe_reset(gym,'head',area);assert(texts(gym)=='CRASH!')

-- New best on a finished run, once; a finished run without a new best stays quiet.
local b=callouts.new()
callouts.observe_run(b,{id='3:1',state='finished',reason='',new_best=false},area);assert(texts(b)=='')
for _=1,10 do callouts.observe_run(b,{id='3:2',state='finished',reason='',new_best=true},area) end
assert(texts(b)=='New best!','new best: once, got '..texts(b))

-- At most two at once: a third replaces the oldest; the two shown never overlap.
local m=callouts.new()
callouts.observe_run(m,{id='4:1',state='failed',reason='head'},area)
callouts.observe_run(m,{id='4:2',state='finished',reason='',new_best=true},area)
assert(#m.items==2)
local a1,a2=m.items[1].rect,m.items[2].rect
assert(not (a1.x0<a2.x1 and a2.x0<a1.x1 and a1.y0<a2.y1 and a2.y0<a1.y1),'two callouts overlap')
callouts.observe_reset(m,'head',area)
assert(#m.items==2 and texts(m)=='New best!,CRASH!','max 2 at once, oldest dropped, got '..texts(m))

-- Pop, fade and expiry.
local p=callouts.new();local it=callouts.show(p,'crash',area)
local s0=callouts.pose(it);callouts.update(p,callouts.POP/2);local s1=callouts.pose(it)
assert(s0<1 and math.abs(s1-callouts.OVERSHOOT)<1e-6,'pop grows to the overshoot')
callouts.update(p,callouts.POP/2);assert(math.abs(callouts.pose(it)-1)<1e-6,'pop settles')
local _,alpha=callouts.pose(it);assert(alpha==1)
callouts.update(p,callouts.DURATION-callouts.POP-callouts.FADE/2);_,alpha=callouts.pose(it);assert(alpha>0 and alpha<1,'fading')
callouts.update(p,callouts.FADE);assert(#p.items==0,'expired callout kept')

-- Live switch: off drops the shown ones and shows nothing new; on shows again.
local sw=callouts.new();callouts.show(sw,'best',area)
callouts.set_enabled(sw,false);assert(#sw.items==0)
callouts.observe_run(sw,{id='5:1',state='failed',reason='head'},area);callouts.observe_reset(sw,'head',area);assert(texts(sw)=='')
callouts.set_enabled(sw,true);callouts.observe_reset(sw,'head',area);assert(texts(sw)=='CRASH!')

-- Touch drive zones at 1080x486 (main/game/mobile.js .zones: bottom max(8px,safe area), buttons
-- clamp(64px,18vh,100px) high, across the full width). Proven for any device pixel ratio: rectangles in canvas
-- pixels scale with it, and so does the callout placement.
local function intersects(r,z) return r.x0<z.x1 and z.x0<r.x1 and r.y0<z.y1 and z.y0<r.y1 end
for _,dpr in ipairs({1,2,3}) do
    local scr={w=1080*dpr,h=486*dpr}
    local zone_h=math.max(64,math.min(.18*486,100))
    local zones={x0=0,y0=0,x1=scr.w,y1=(8+zone_h)*dpr}
    local z=callouts.new()
    callouts.observe_run(z,{id='6:1',state='failed',reason='head'},scr,{zones})
    callouts.observe_run(z,{id='6:2',state='finished',reason='',new_best=true},scr,{zones})
    assert(#z.items==2)
    for _,c in ipairs(z.items) do
        assert(not intersects(c.rect,zones),'callout covers the drive zones at dpr '..dpr)
        assert(c.rect.x0>=0 and c.rect.x1<=scr.w and c.rect.y0>=0 and c.rect.y1<=scr.h,'callout off screen')
    end
    -- Every candidate row (even the last fallback) is clear of the zones, for every style.
    for _,style in pairs(callouts.STYLES) do
        for _,f in ipairs(callouts.ROWS) do assert(not intersects(callouts.rect(style,scr.w/2,scr.h*f,scr),zones),'row '..f..' covers the zones') end
    end
end
-- A blocked row (e.g. a DOM readout) moves the callout to the next free row.
local blk=callouts.new()
local top=callouts.rect(callouts.STYLES.crash,540,486*callouts.ROWS[1],area)
local c=callouts.show(blk,'crash',area,{top});assert(c.y==486*callouts.ROWS[2],'blocked row not skipped')
print('PASS comic callouts: CRASH! once per head crash, none for other endings or with the rule off, New best! once, max 2 at once, pop/fade/expiry, live switch, clear of the 1080x486 drive zones')
