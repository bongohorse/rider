-- #669: off-screen pickup indicators: nearest ahead per type, hidden once visible, taken or passed; placement on
-- the screen edge inside the safe area, never over the drive zones, the play bar/toolbar or each other at 1080x486.
local E=require 'main.game.pickup_edges'
local place=require 'main.game.fps_place'

-- Pickups along a course (metres). The vehicle is at x=0; the view is 20 m wide and 9 m high around it.
local items={
 {id='fuel-behind',position={-5,1},kind='fuel'},{id='fuel-near',position={30,2},kind='fuel'},{id='fuel-far',position={80,2},kind='fuel'},
 {id='coin-a',position={25,1}},{id='coin-b',position={26,1}},{id='coin-visible-later',position={60,1}},
 {id='gem-high',position={4,12},kind='gem'},{id='gem-far',position={120,0},kind='gem'}}
local view={x0=-6,y0=-3,x1=14,y1=6}
local t=E.targets(items,{},{0,0},view)
assert(#t==3 and t[1].kind=='fuel' and t[2].kind=='coin' and t[3].kind=='gem','one indicator per type, fuel/coin/gem order')
-- Fuel: the can behind the vehicle is passed; the nearest ahead is fuel-near, 30.07 m away.
assert(t[1].metres==30 and math.abs(t[1].u-36/20)<1e-9 and math.abs(t[1].v-5/9)<1e-9,'fuel target '..t[1].metres..' '..t[1].u)
assert(t[2].metres==25,'nearest coin ahead')
-- The gem above the view is nearer (12.6 m) than the far one: it points up (v > 1).
assert(t[3].metres==13 and t[3].v>1 and t[3].u>0 and t[3].u<1,'gem above the view')
-- Falling distance while driving towards the can; gone once it enters the view.
local last=math.huge
for x=0,30,2 do
 local v={x0=x-6,y0=-3,x1=x+14,y1=6}
 local f
 for _,e in ipairs(E.targets(items,{},{x,0},v)) do if e.kind=='fuel' then f=e end end
 if x+14<30 then assert(f and f.metres<last,'fuel distance must fall at x='..x);last=f.metres
 else assert(not f,'fuel-near in view must hide its indicator (x='..x..')') end
end
-- In view: no indicator for that type, even though a further one of the type is off-screen.
local seen=E.targets(items,{},{20,0},{x0=14,y0=-3,x1=34,y1=6})
for _,e in ipairs(seen) do assert(e.kind~='fuel' and e.kind~='coin','visible nearest pickup must hide the type: '..e.kind) end
-- Taken: the next one of the type takes over.
t=E.targets(items,{['fuel-near']=true,['coin-a']=true},{0,0},view)
assert(t[1].kind=='fuel' and t[1].metres==80 and t[2].kind=='coin' and t[2].metres==26,'taken pickups are skipped')
-- Passed: everything behind the vehicle; nothing ahead means no indicators.
assert(#E.targets(items,{},{200,0},{x0=194,y0=-3,x1=214,y1=6})==0,'passed pickups must not show')
assert(#E.targets({},{},{0,0},view)==0 and #E.targets(nil,{},{0,0},view)==0,'no pickups, no indicators')
assert(E.kind({})=='coin' and E.kind({kind='gem'})=='gem' and E.kind({kind='fuel'})=='fuel')
assert(E.text({kind='fuel',metres=42})=='Fuel 42 m' and E.text({kind='coin',metres=7})=='Coins 7 m')
print('PASS pickup edges: nearest ahead per type, falling distance, hidden when visible, taken or passed')

-- Placement at 1080x486 (CSS px = screen px). Play bar (#678) top right and its strip top centre, the level
-- card top left, the touch drive zones bottom left and right (mobile.js: 130x88 at 8 px), Levels above the right
-- zone; plus the older toolbar row from the fps_place layout.
local screen={x0=0,y0=0,x1=1080,y1=486}
local safe={x0=0,y0=0,x1=1080,y1=486}
local controls={
 {x0=812,y0=436,x1=870,y1=480,name='retry'},{x0=874,y0=436,x1=936,y1=480,name='pause'},{x0=940,y0=436,x1=1012,y1=480,name='tuning'},{x0=1016,y0=436,x1=1072,y1=480,name='more'},
 {x0=770,y0=420,x1=1072,y1=478,name='play bar'},{x0=330,y0=410,x1=750,y1=478,name='strip'},{x0=12,y0=330,x1=260,y1=434,name='level card'},
 {x0=8,y0=8,x1=138,y1=96,name='brake'},{x0=146,y0=8,x1=276,y1=96,name='throttle'},{x0=804,y0=8,x1=934,y1=96,name='lean back'},{x0=942,y0=8,x1=1072,y1=96,name='lean fwd'},
 {x0=960,y0=108,x1=1068,y1=152,name='levels'}}
local w,h,gap=104,30,4
local function check(area,targets,blocked,what)
 local placed=E.place(area,screen,targets,w,h,blocked,gap)
 assert(#placed==#targets,what..': one result per target')
 local rects={}
 for i,p in ipairs(placed) do
  if p.clear then
   assert(p.left>=area.x0+gap-1e-6 and p.left+w<=area.x1-gap+1e-6 and p.top<=area.y1-gap+1e-6 and p.top-h>=area.y0+gap-1e-6,
    string.format('%s: %s leaves the safe area at %.1f,%.1f',what,p.kind,p.left,p.top))
   local r=place.hit(p.left,p.top,w,h,blocked,gap);assert(not r,what..': '..p.kind..' covers '..(r and r.name or ''))
   for j,q in ipairs(rects) do assert(not place.hit(p.left,p.top,w,h,{q},gap),what..': indicators '..i..' and '..j..' overlap') end
   rects[#rects+1]=p.rect
  end
 end
 return placed
end
-- Every direction ahead (right half and straight up/down), each type alone and all three together.
local shown=0
for a=-90,90,5 do
 local rad=math.rad(a)
 local u,v=0.5+math.cos(rad)*1.5,0.5+math.sin(rad)*1.5
 local all={{kind='fuel',u=u,v=v,metres=10},{kind='coin',u=u,v=v,metres=11},{kind='gem',u=u,v=v,metres=12}}
 local placed=check(safe,all,controls,'angle '..a)
 for _,p in ipairs(placed) do if p.clear then shown=shown+1 end end
 check(safe,{all[1]},controls,'fuel alone, angle '..a)
end
assert(shown>=3*30,'indicators hidden too often at 1080x486: '..shown)
-- Straight ahead: the right edge at the pickup's height, clear of the play bar and zones; all three stack there.
local p=check(safe,{{kind='fuel',u=1.6,v=0.5,metres=40},{kind='coin',u=1.6,v=0.5,metres=41},{kind='gem',u=1.6,v=0.5,metres=42}},controls,'ahead')
for _,q in ipairs(p) do assert(q.clear and q.edge=='right' and math.abs(q.left+w-(1080-gap))<1e-6,'ahead must sit on the right edge: '..q.kind) end
assert(math.abs(p[1].top-h/2-243)<1e-6,'unblocked indicator keeps the pickup height')
-- Low on the right edge (towards the lean zone): slides up above Levels instead of covering it.
p=check(safe,{{kind='fuel',u=2,v=0,metres=40}},controls,'low right')
assert(p[1].clear and p[1].edge=='right' and p[1].top-h>=152+gap-1e-6,'low right must move above Levels')
-- High on the right edge (towards the play bar): slides down below it.
p=check(safe,{{kind='gem',u=1.2,v=1.1,metres=40}},controls,'high right')
assert(p[1].clear and p[1].edge=='right' and p[1].top<=420-gap+1e-6,'high right must move below the play bar')
-- Straight up: the top edge between the level card and the strip, or hidden; never on the strip.
p=check(safe,{{kind='gem',u=0.5,v=3,metres=40}},controls,'up')
assert(p[1].clear and p[1].edge=='top','up must find a free spot on the top edge')
-- Safe area (notch left and right, home bar bottom): indicators stay inside it.
check({x0=44,y0=21,x1=1036,y1=486},{{kind='fuel',u=1.5,v=0.5,metres=1},{kind='coin',u=1.5,v=-1,metres=2},{kind='gem',u=0.5,v=-2,metres=3}},controls,'safe area')
-- A fully covered edge hides the indicator instead of drawing it over a control.
p=E.place(safe,screen,{{kind='fuel',u=2,v=0.5,metres=5}},w,h,{{x0=900,y0=-10,x1=2000,y1=2000}},gap)
assert(p[1].clear==false and not p[1].rect,'covered edge must hide the indicator')
-- A safe area smaller than the indicator hides it too.
p=E.place({x0=0,y0=0,x1=60,y1=20},screen,{{kind='fuel',u=2,v=0.5,metres=5}},w,h,{},gap)
assert(p[1].clear==false,'tiny area must hide the indicator')
print('PASS pickup edges: on the screen edge inside the safe area, clear of drive zones, toolbar and each other at 1080x486')
