-- Compact run/result surface, sharing the Gym's layout and existing input/reset owners.
local layout=require 'main.gym.layout'
local medals=require 'main.gym.medals'
local M={}
local function text(x,y,value,scale,anchor)
 local n=layout.text(vmath.vector3(x,y,0),value,anchor);gui.set_font(n,'default');gui.set_scale(n,vmath.vector3(scale,scale,1));return n
end
function M.new()
 local t={}
 t.entry=layout.box(vmath.vector3(270,356,0),vmath.vector3(110,26,0),'left_top')
 gui.set_color(t.entry,vmath.vector4(.12,.3,.3,1));t.entry_label=text(270,356,'First run',.6,'left_top')
 t.clock=text(480,510,'',.9,'top');t.best=text(480,484,'',.6,'top')
 t.card=layout.box(vmath.vector3(480,300,0),vmath.vector3(440,220,0),'centre');gui.set_color(t.card,vmath.vector4(.04,.12,.16,.96))
 t.result=text(480,374,'',1,'centre');t.detail=text(480,338,'',.6,'centre')
 t.medal=text(480,302,'',.8,'centre');t.next=text(480,272,'',.6,'centre')
 t.coinhud=text(480,415,'',.6,'top');t.coins=text(480,248,'',.6,'centre')
 gui.set_visible(t.coinhud,false);gui.set_visible(t.coins,false)
 t.retry=layout.box(vmath.vector3(480,222,0),vmath.vector3(190,32,0),'centre');gui.set_color(t.retry,vmath.vector4(.12,.4,.36,1))
 t.retry_label=text(480,222,'Retry [R]',.75,'centre')
 M.show(t,nil);return t
end
function M.show(t,r,touch)
 t.data=r;local active=r~=nil;local done=active and (r.state=='finished' or r.state=='failed')
 for _,n in ipairs({t.clock,t.best}) do gui.set_visible(n,active and not touch) end
 for _,n in ipairs({t.card,t.result,t.detail,t.medal,t.next,t.retry,t.retry_label}) do gui.set_visible(n,done or false) end
 gui.set_visible(t.entry,not active);gui.set_visible(t.entry_label,not active)
 gui.set_text(t.retry_label,touch and "Retry" or "Retry [R]")
 if not r then return end
 local state=r.state=='ready' and 'Drive to start' or r.state=='paused' and 'Paused - Resume to drive' or r.state=='failed' and 'Attempt ended' or r.state=='finished' and 'Finished' or 'First run'
 gui.set_text(t.clock,string.format('%s  %.2f s',state,r.time))
 local saved=r.save=='saved';local suffix=not saved and (' | '..r.save) or ''
 gui.set_text(t.best,(r.best>0 and string.format('Best %.2f s',r.best) or 'Best --')..(r.has_medals and (' | '..medals.names[(r.highest_medal or 0)+1]) or '')..(r.official and ' | Official' or ' | Practice')..suffix)
 gui.set_text(t.result,r.state=='failed' and (r.reason=='head' and 'Head contact' or 'Outside the course') or string.format('Finished!  %.2f s',r.time))
 gui.set_text(t.medal,r.state=='finished' and r.has_medals and (not r.official and 'Practice - no medal awarded' or r.medal>0 and medals.names[r.medal+1]..' medal' or 'Completed - no medal') or '')
 local next_text=r.next_time and r.next_time>0 and string.format('Next: %s <= %.2f s  (%.2f s faster)',r.next_medal,r.next_time,math.max(.01,math.ceil((r.time-r.next_time)*100)/100)) or 'All target times beaten'
 gui.set_text(t.next,r.state=='finished' and r.has_medals and r.official and next_text or '')
 gui.set_text(t.detail,not r.official and 'Practice - official best unchanged' or r.new_best and (saved and 'New personal best - saved' or r.save) or (r.best>0 and string.format('Personal best %.2f s',r.best) or r.save))
end
function M.show_coins(t,c,b,touch,flash)
 local enabled=c and c.total>0
 gui.set_visible(t.coinhud,enabled and not touch and not (t.data and (t.data.state=='finished' or t.data.state=='failed')) or false)
 local r=t.data;local finished=r and (r.state=='finished' or r.state=='failed')
 gui.set_visible(t.coins,enabled and finished or false)
 if not enabled then return end
 local total=b and b.total or 0;local status=b and b.status or 'Checking storage'
 local suffix=status=='saved' and '' or ' | '..status
 gui.set_text(t.coinhud,string.format('Coins %d/%d%s | Bank %d%s%s',c.count,c.total,flash and ('  +'..flash) or '',total,c.practice and ' | Practice' or '',suffix))
 gui.set_text(t.coins,r and r.state=='failed' and string.format('Coins %d/%d - lost (no finish)',c.count,c.total) or c.practice and string.format('Coins %d/%d - practice, not banked',c.count,c.total) or string.format('Coins %d/%d | Bank %d - %s',c.count,c.total,total,status))
end
function M.geometry(t)
 local function point(n) local p=gui.get_screen_position(n);return {x=p.x,y=p.y} end
 return {retry=point(t.retry),entry=point(t.entry),heading=gui.get_text(t.clock),best=gui.get_text(t.best),result=gui.get_text(t.result),detail=gui.get_text(t.detail),medal=gui.get_text(t.medal),next=gui.get_text(t.next),coins=gui.get_text(t.coins),coin_hud=gui.get_text(t.coinhud)}
end
function M.input(t,id,action,owner)
 if id~=hash('ui_pointer') or not action.pressed then return false end
 if not t.data and gui.pick_node(t.entry,action.x,action.y) then msg.post('main:/loader#script','select_station',{id='first-run',preset='a'});return true end
 local r=t.data
 if r and (r.state=='finished' or r.state=='failed') and gui.pick_node(t.retry,action.x,action.y) then msg.post(owner,'run_retry',{id=r.id});return true end
 if r and (r.state=='finished' or r.state=='failed') and gui.pick_node(t.card,action.x,action.y) then return true end
 return false
end
return M
