local R=require 'main.gym.fuel_runtime';local F=require 'main.gym.fuel';local s={station={fuel=F.defaults()},race={state='ready'}}
R.reset(s);local c={throttle=0,brake_reverse=0,lean=0};R.command(s,c,1);R.observe(s);assert(s.fuel.amount==100)
s.race.state='running';R.command(s,c,1);R.observe(s);assert(s.fuel.amount==99)
s.fuel.power=1;R.command(s,c,.5);R.observe(s);assert(s.fuel.amount==98)
for _,state in ipairs({'paused','failed','finished','ready'}) do s.race.state=state;R.command(s,c,1);R.observe(s);assert(s.fuel.amount==98) end
s.fuel.amount=0;s.race.state='running';R.command(s,c,.1);assert(c.fuel_empty);F.refill(s.fuel);R.observe(s);R.command(s,c,.1);assert(not c.fuel_empty)
R.reset(s);assert(s.fuel.amount==100 and not s.fuel_step and s.fuel.collected==0)
s.race=nil;R.command(s,c,1);R.observe(s);assert(s.fuel.amount==100);c.throttle=1;R.command(s,c,1);R.observe(s);assert(s.fuel.amount==99);s.finish_done=true;R.command(s,c,1);R.observe(s);assert(s.fuel.amount==99)
s.station.start_speed=3;R.reset(s);assert(s.fuel.started);c.throttle=0;s.finish_done=false;R.command(s,c,1);R.observe(s);assert(s.fuel.amount==99)
print('PASS actual runtime ready/pause/terminal/reset/custom-start ownership, exact prior-step consumption and empty/refill command gating')
