-- #417: player settings, kept apart from level data, replays and records. One small save file
-- (sys.save/sys.load in the same 'rider' save directory as the other saves); the loader owns it.
-- A missing, unreadable or invalid value falls back to its default. A file written by a newer
-- version is read where it is valid but never overwritten (the setting then lasts for this session).
-- #444, version 2 adds the FPS counter's visibility and normalised position (fps_place.lua). A version 1 file
-- keeps its cap and gets the defaults (shown, top left); the next save writes version 2.
local fps_counter=require "main.game.fps_counter"
local fps_place=require "main.game.fps_place"
local M={APP="rider",FILE="player-settings",VERSION=2}
function M.defaults()
    return {fps_cap=fps_counter.DEFAULT_CAP,fps_visible=true,fps_x=fps_place.DEFAULT_X,fps_y=fps_place.DEFAULT_Y}
end
-- sys.load result -> settings, status ('default' | 'ok' | 'invalid' | 'newer').
function M.parse(t)
    local s=M.defaults()
    if type(t)~="table" then return s,"invalid" end
    if next(t)==nil then return s,"default" end -- sys.load returns an empty table for a missing file
    local version=t.version
    if type(version)~="number" or version~=version or version<1 or version%1~=0 then return s,"invalid" end
    local valid=fps_counter.valid_cap(t.fps_cap)
    if valid then s.fps_cap=t.fps_cap end
    if version>=2 then
        if type(t.fps_visible)=="boolean" then s.fps_visible=t.fps_visible else valid=false end
        -- The position is one value: both coordinates or neither.
        if fps_place.valid(t.fps_x) and fps_place.valid(t.fps_y) then s.fps_x,s.fps_y=t.fps_x,t.fps_y else valid=false end
    end
    if version>M.VERSION then return s,"newer" end
    return s,valid and "ok" or "invalid"
end
function M.valid(s)
    return type(s)=="table" and fps_counter.valid_cap(s.fps_cap) and type(s.fps_visible)=="boolean"
        and fps_place.valid(s.fps_x) and fps_place.valid(s.fps_y)
end
-- #444: one counter command from the Menu or a drag. Returns true when the settings changed.
-- data.command: 'on' | 'off' | 'reset' | a preset name; or data.x and data.y (a dragged, normalised position).
function M.apply(s,data)
    if type(data)~="table" then return false end
    local visible,x,y=s.fps_visible,s.fps_x,s.fps_y
    local command=data.command
    if command=="on" or command=="off" then visible=command=="on"
    elseif command=="reset" then x,y=fps_place.DEFAULT_X,fps_place.DEFAULT_Y
    elseif command~=nil then
        x,y=fps_place.preset(command)
        if x==nil then return false end
    elseif fps_place.valid(data.x) and fps_place.valid(data.y) then x,y=data.x,data.y
    else return false end
    if visible==s.fps_visible and x==s.fps_x and y==s.fps_y then return false end
    s.fps_visible,s.fps_x,s.fps_y=visible,x,y
    return true
end
function M.path() return sys.get_save_file(M.APP,M.FILE) end
function M.load()
    local ok,t=pcall(sys.load,M.path())
    local s,status=M.parse(ok and t or nil)
    s.status=status
    return s
end
-- Returns true when written; false, reason otherwise. Never replaces a newer file.
function M.save(s)
    if s.status=="newer" then return false,"newer settings file kept" end
    if not fps_counter.valid_cap(s.fps_cap) then return false,"invalid fps cap" end
    if not M.valid(s) then return false,"invalid fps counter setting" end
    local ok,result=pcall(sys.save,M.path(),{version=M.VERSION,fps_cap=s.fps_cap,fps_visible=s.fps_visible,fps_x=s.fps_x,fps_y=s.fps_y})
    if not ok or result==false then return false,tostring(result) end
    s.status="ok"
    return true
end
return M
