-- #417: tap-to-switch FPS counter. Pure logic (no Defold API): cap cycle, colour level, smoothing.
-- The counter reports the MEASURED update cadence (engine frames per wall second), never the requested cap.
-- The loader is the only caller of sys.set_update_frequency; physics stays at the fixed 60 Hz tick.
local M={}
M.CAPS={30,60,90,120,144,0} -- tap order; 0 = Unlimited (variable update rate)
M.DEFAULT_CAP=60
M.UNLIMITED_REFERENCE=60 -- Unlimited is coloured against 60
M.BUCKET_S=0.25 -- one smoothing bucket
M.BUCKETS=4 -- sliding window of about 1 s, so the colour does not flicker
M.GAP_S=0.5 -- a longer frame gap (stall, background tab) restarts the window with that frame alone
M.LABEL_S=1 -- "cap N" stays visible this long after a tap
-- Same three colours as the previous FPS badge (no restyle).
M.COLORS={green={0.3,0.9,0.6},orange={1,0.65,0.2},red={1,0.25,0.25}}
function M.valid_cap(cap)
    for _,c in ipairs(M.CAPS) do if cap==c then return true end end
    return false
end
-- Next cap in the tap cycle; an unknown cap restarts from the default.
function M.next_cap(cap)
    for i,c in ipairs(M.CAPS) do if c==cap then return M.CAPS[i%#M.CAPS+1] end end
    return M.DEFAULT_CAP
end
function M.reference(cap) return cap==0 and M.UNLIMITED_REFERENCE or cap end
-- The whole number the counter shows; the colour uses the same value, so "54 fps" at cap 60 is green.
function M.rounded(fps) return math.floor(fps+0.5) end
-- Green >= 90 %, orange >= 70 %, red below, relative to the cap (integer arithmetic on the shown value).
function M.level(fps,cap)
    if type(fps)~="number" or fps~=fps or fps==math.huge then return nil end
    fps=M.rounded(fps)
    local ref=M.reference(cap)
    if fps*100>=90*ref then return "green" end
    if fps*100>=70*ref then return "orange" end
    return "red"
end
function M.label(cap) return cap==0 and "cap unlimited" or "cap "..tostring(cap) end
function M.text(fps) return fps and string.format("%d fps",M.rounded(fps)) or "-- fps" end
function M.new() return {buckets={},frames=0,elapsed=0,last=false,fps=false} end
-- Drop the window (cap change, gap): the next reading measures only the new cadence.
function M.restart(c)
    c.buckets,c.frames,c.elapsed,c.last,c.fps={},0,0,false,false
end
-- One engine frame at wall time `now` (seconds). Returns true when the smoothed reading changed.
function M.frame(c,now)
    if not c.last then c.last=now;return false end
    local dt=now-c.last
    c.last=now
    if dt<0 then -- the wall clock went backwards: no interval to measure
        c.buckets,c.frames,c.elapsed={},0,0
        return false
    end
    if dt>M.GAP_S then
        -- A stall is real: show its rate at once (a sustained stall stays low and red, never a stale reading);
        -- the following buckets push it out of the window again within about 1 s.
        c.buckets,c.frames,c.elapsed={{1,dt}},0,0
        c.fps=1/dt
        return true
    end
    c.frames,c.elapsed=c.frames+1,c.elapsed+dt
    if c.elapsed<M.BUCKET_S then return false end
    c.buckets[#c.buckets+1]={c.frames,c.elapsed}
    if #c.buckets>M.BUCKETS then table.remove(c.buckets,1) end
    c.frames,c.elapsed=0,0
    local frames,elapsed=0,0
    for _,b in ipairs(c.buckets) do frames,elapsed=frames+b[1],elapsed+b[2] end
    c.fps=frames/elapsed
    return true
end
return M
