-- #506: execute the production loader callbacks, substituting only engine/I/O dependencies.
-- The real-proxy delayed-completion check lives in the le1a browser case.
local function loader()
    local posted,saves,retained,taken={},{},{},0
    local editor={mode='play',key=function() return 1 end}
    local modules={
        ['main.game.stations']={resource=function() return {} end},
        ['main.game.custom']={
            take=function() taken=taken+1 end,
            peek=function() return {id='new-level'} end,
            text=function() return 'new-level' end,
            retain=function(v) retained[#retained+1]=v end,
            save=function(text) saves[#saves+1]=text;return true end,
            notify=function() end,
        },
        ['main.game.station_data']={},['socket']={gettime=function() return 1 end},
        ['main.editor.editor']=editor,['main.editor.editor_doc']={},
        ['main.game.time_scale']={apply=function() end,state=function() return {} end},
        ['main.game.course_catalog']={index=function() end},
        ['main.game.levels_runtime']={poll=function() end},
        ['main.game.player_settings']={},['main.game.fps_counter']={},
        ['main.game.camera_settings']={copy=function() return {} end},
        ['main.game.coin_bank']={poll=function() end},
    }
    local env=setmetatable({hash=function(s) return s end,html5=false,
        go={property=function() end},resource={material=function(p) return p end},
        sys={get_config_int=function(_,default) return default end},
        msg={url=function(s) return s end,post=function(to,id,data) posted[#posted+1]={to=to,id=id,data=data} end},
        require=function(name) return assert(modules[name],'Unexpected loader dependency '..name) end}, {__index=_G})
    assert(setfenv(assert(loadfile('main/game/boot.script')),env))()
    local self={generation=7,loading=true,deadline=0,station='custom',snapshot='new',level_snapshot='previous',
        level_id='previous',world_loads=1,world_alive=true,time={},settings={camera={}},
        coin_bank={total=0,gems=0,status='saved'},import=42}
    local function count(id)
        local n=0;for _,p in ipairs(posted) do if p.id==id then n=n+1 end end;return n
    end
    local function update(dt) env.update(self,dt) end
    local function message(id,data) env.on_message(self,id,data or {},'gym:/owner#script') end
    return self,update,message,count,saves,retained,function() return taken end
end

local failures={}
local function check(name,run)
    local ok,err=pcall(run)
    if not ok then failures[#failures+1]=name..': '..tostring(err) end
end
check('deadline boundary and terminal update',function()
    local s,update,_,count,_,_,taken=loader()
    update(15);assert(not s.failed and count('station_error')==0,'timeout before the deadline')
    update(.001);assert(s.failed and s.loading and count('station_error')==1 and count('disable')==1)
    assert(not s.world_alive,'timed-out world still marked alive')
    local before=taken();update(1)
    assert(taken()==before,'terminal update still consumes pending imports')
    assert(count('station_error')==1,'duplicate timeout error')
end)
check('late and duplicate proxy completion',function()
    local s,update,message,count,saves,retained=loader()
    update(16)
    for _=1,2 do message('proxy_loaded');message('gym_ready',{generation=7,ok=true}) end
    assert(count('enable')==0 and count('init')==0,'late proxy completion enabled the world')
    assert(s.loading and s.failed,'late ready cleared terminal loading state')
    assert(#saves==0 and #retained==0,'late completion published a save or released in-flight snapshots')
    assert(s.level_snapshot=='previous' and s.level_id=='previous','late completion replaced prior level identity')
end)
check('late played-level readiness',function()
    local s,update,message,_,saves=loader()
    s.import=nil;s.play=true;s.play_text='new-played-level'
    update(16);message('gym_ready',{generation=7,ok=true})
    assert(#saves==0 and s.play and s.level_snapshot=='previous','late Play readiness published the new level')
end)
check('superseded readiness before and after timeout',function()
    local s,update,message,count,saves=loader()
    message('gym_ready',{generation=6,ok=true})
    assert(s.loading and #saves==0 and count('world_load_count')==0,'superseded generation admitted')
    update(16);message('gym_ready',{generation=6,ok=true})
    assert(s.loading and #saves==0 and count('world_load_count')==0,'late superseded generation admitted')
end)
check('normal proxy and imported-level readiness',function()
    local s,_,message,count,saves,retained=loader()
    message('proxy_loaded');message('gym_ready',{generation=7,ok=true})
    assert(count('enable')==1 and count('init')==1,'normal proxy completion refused')
    assert(not s.loading and not s.failed and s.syncing and #saves==1 and saves[1]=='new-level')
    assert(s.level_snapshot=='new' and #retained==1,'normal snapshot handover changed')
end)
assert(#failures==0,table.concat(failures,'\n'))
print('PASS loader timeout: terminal deadline, late/duplicate/stale messages, Play/import saves and normal handover')
