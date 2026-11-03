-- #417: player settings, kept apart from level data, replays and records. One small save file
-- (sys.save/sys.load in the same 'rider' save directory as the other saves); the loader owns it.
-- A missing, unreadable or invalid value falls back to its default. A file written by a newer
-- version is read where it is valid but never overwritten (the setting then lasts for this session).
local fps_counter=require "main.game.fps_counter"
local M={APP="rider",FILE="player-settings",VERSION=1}
function M.defaults() return {fps_cap=fps_counter.DEFAULT_CAP} end
-- sys.load result -> settings, status ('default' | 'ok' | 'invalid' | 'newer').
function M.parse(t)
    local s=M.defaults()
    if type(t)~="table" then return s,"invalid" end
    if next(t)==nil then return s,"default" end -- sys.load returns an empty table for a missing file
    local version=t.version
    if type(version)~="number" or version~=version or version<1 or version%1~=0 then return s,"invalid" end
    local valid=fps_counter.valid_cap(t.fps_cap)
    if valid then s.fps_cap=t.fps_cap end
    if version>M.VERSION then return s,"newer" end
    return s,valid and "ok" or "invalid"
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
    local ok,result=pcall(sys.save,M.path(),{version=M.VERSION,fps_cap=s.fps_cap})
    if not ok or result==false then return false,tostring(result) end
    s.status="ok"
    return true
end
return M
