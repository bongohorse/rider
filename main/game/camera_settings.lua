-- #443: the player's camera choice (A or B) and its live, render-only feel settings. Pure logic (no Defold API).
-- The loader stores them in player settings (player_settings.lua); the controller (the single camera owner) reads
-- them in feel.camera. They never touch physics, the fixed tick, replays, records or level data.
-- Each value is a multiplier or offset on the existing feel.lua camera, chosen so that the defaults reproduce the
-- shipped camera exactly (x * 1 and y + 0 are exact): A with default settings is byte-for-byte the #352 camera A.
local M={}
M.MODES={"a","b"}
M.DEFAULT_MODE="a"
-- key: settings field; label/format: the live panel row; default/min/max: the value range; step: one +/- tap.
-- b: used only by camera B (the #352/#374 downhill lead); camera A ignores it.
M.SPECS={
    -- Follow speed: multiplies the preset's camera_response (position smoothing and its speed lead).
    {key="follow",label="Follow",default=1,min=0.5,max=2,step=0.1,format="%.1fx"},
    -- Look-ahead: multiplies feel.follow.look_scale (horizontal and vertical look-ahead length).
    {key="look",label="Look-ahead",default=1,min=0,max=2,step=0.1,format="%.1fx"},
    -- Zoom: multiplies the preset's speed-dependent orthographic zoom (above 1 is closer).
    {key="zoom",label="Zoom",default=1,min=0.7,max=1.4,step=0.05,format="%.2fx"},
    -- Height: engine units added to the camera target height (positive shows more above the buggy); the safe-edge
    -- clamp still keeps the chassis inside the view.
    {key="offset",label="Height",default=0,min=-150,max=150,step=10,format="%+.0f u"},
    -- B only (#374): extra downward pan rate while the downhill lead is active; 0 = no pan-rate surge at landing.
    {key="descent_response",label="B descent pan",default=0,min=0,max=12,step=1,format="%.0f /s",b=true},
    -- B only (#374): bound on how fast new downhill lead grows (u/s) after touchdown; release stays immediate.
    {key="descent_rise_limit",label="B descent rise",default=240,min=0,max=1200,step=40,format="%.0f u/s",b=true},
}
M.KEYS={}
M.BY_KEY={}
for i,spec in ipairs(M.SPECS) do M.KEYS[i]=spec.key;M.BY_KEY[spec.key]=spec end
local function finite(v) return type(v)=="number" and v==v and v>-math.huge and v<math.huge end
function M.valid_mode(m) return m=="a" or m=="b" end
-- A stored or requested value is valid when it is a finite number inside its range.
function M.valid(key,v)
    local spec=M.BY_KEY[key]
    return spec~=nil and finite(v) and v>=spec.min and v<=spec.max
end
-- Live input is clamped into the range and rounded to 4 decimals, so repeated steps land exactly on the
-- step grid and on the default again; nil for an unknown key or a non-finite value.
function M.clamp(key,v)
    local spec=M.BY_KEY[key]
    if not spec or not finite(v) then return nil end
    v=math.max(spec.min,math.min(spec.max,v))
    return tonumber(string.format("%.4f",v))
end
function M.defaults()
    local c={mode=M.DEFAULT_MODE}
    for _,spec in ipairs(M.SPECS) do c[spec.key]=spec.default end
    return c
end
-- Read-only defaults for callers that pass no settings (never modify).
M.DEFAULTS=M.defaults()
function M.copy(c)
    local r={mode=c.mode}
    for _,key in ipairs(M.KEYS) do r[key]=c[key] end
    return r
end
function M.is_default(c)
    if c.mode~=M.DEFAULT_MODE then return false end
    for _,spec in ipairs(M.SPECS) do if c[spec.key]~=spec.default then return false end end
    return true
end
-- Whole settings from an untrusted table (a message or a stored file): each invalid field falls back to its
-- default on its own. Returns the settings and whether every field was valid.
function M.sanitize(t)
    local c=M.defaults()
    if type(t)~="table" then return c,false end
    local valid=true
    if M.valid_mode(t.mode) then c.mode=t.mode else valid=false end
    for _,key in ipairs(M.KEYS) do
        if M.valid(key,t[key]) then c[key]=t[key] else valid=false end
    end
    return c,valid
end
function M.text(spec,v) return spec.label.." "..string.format(spec.format,v) end
-- One camera command from the HUD. Returns true when the settings changed.
-- data.command: 'toggle' (A <-> B), 'mode' (data.mode 'a'|'b'), 'reset' (camera A and every default),
-- 'step' (data.key, data.dir +1|-1: one step, clamped) or 'set' (data.key, data.value: clamped).
function M.apply(c,data)
    if type(c)~="table" or type(data)~="table" then return false end
    local command=data.command
    if command=="toggle" then
        c.mode=c.mode=="b" and "a" or "b"
        return true
    elseif command=="mode" then
        if not M.valid_mode(data.mode) or data.mode==c.mode then return false end
        c.mode=data.mode
        return true
    elseif command=="reset" then
        if M.is_default(c) then return false end
        local d=M.defaults()
        for k,v in pairs(d) do c[k]=v end
        return true
    elseif command=="step" or command=="set" then
        local spec=M.BY_KEY[data.key]
        if not spec then return false end
        local value
        if command=="step" then
            if data.dir~=1 and data.dir~=-1 then return false end
            value=M.clamp(spec.key,c[spec.key]+data.dir*spec.step)
        else value=M.clamp(spec.key,data.value) end
        if value==nil or value==c[spec.key] then return false end
        c[spec.key]=value
        return true
    end
    return false
end
return M
