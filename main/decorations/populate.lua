-- Pure Populate generator: writes ordinary anchored decorations. Its random stream is local, so the
-- same inputs and seed give the same result and gameplay randomness is never touched.
local source=require 'main.decorations.source'
local M={EXCLUSION=5,DEFAULTS={density=4,spacing=1.5,size_min=.8,size_max=1.2,slope=35,seed=1}}
local function stream(seed)
    local state=(seed*2654435761+1)%4294967296
    return function()
        -- Park-Miller over doubles, exact in both Lua 5.1 numbers and LuaJIT.
        state=(state*48271)%2147483647
        if state==0 then state=1 end
        return state/2147483647
    end
end
local function in_stretch(x,stretch) return not stretch or (x>=stretch[1] and x<=stretch[2]) end
-- settings: assets (ids), placement, tilt, offset, density (per 10 m), spacing (m), size_min, size_max,
-- slope (degrees), seed. pieces: ordered {id, parts, hidden}; a hidden piece keeps its objects and gets no new ones. Returns a new item list, or nil and a refusal.
function M.run(block,pieces,settings,stretch,exclude)
    if #settings.assets==0 then return nil,'Choose at least one object for Populate.' end
    local random=stream(settings.seed)
    local kept={}
    for _,o in ipairs(block.items) do
        local parts,hidden
        for _,p in ipairs(pieces) do if p.id==o.source then parts,hidden=p.parts,p.hidden end end
        local x=parts and source.resolve(parts,o.distance,o.offset,false)
        -- An unresolved anchor is stale, not generated output of this run: it stays for the refit to report.
        -- Only unlocked generated objects in the stretch go; hand-placed and locked ones stay.
        if not (o.generated and not o.locked and not hidden and x and in_stretch(x,stretch)) then kept[#kept+1]=o end
    end
    local taken={}
    local function record(x) taken[#taken+1]=x end
    for _,o in ipairs(kept) do
        for _,p in ipairs(pieces) do
            if p.id==o.source then
                local x,y=source.resolve(p.parts,o.distance,o.offset,false)
                if x then record({x,y}) end
            end
        end
    end
    local function clear(x,y)
        for _,t in ipairs(taken) do
            if (t[1]-x)^2+(t[2]-y)^2<settings.spacing*settings.spacing then return false end
        end
        return true
    end
    local limit=math.tan(math.rad(settings.slope))
    local step=10/settings.density
    local next_id=block.next_id
    local out={}
    for _,o in ipairs(kept) do out[#out+1]=o end
    for _,piece in ipairs(pieces) do if not piece.hidden then
        local total=source.length(piece.parts)
        local at=step*random()
        while at<=total do
            local x,y,angle=source.resolve(piece.parts,at,settings.offset or 0,true)
            -- Every draw happens for every candidate, so a rule on one object cannot shift the next one.
            local pick,size=random(),random()
            if x and in_stretch(x,stretch) and math.abs(math.tan(angle))<=limit and clear(x,y) then
                local far=true
                for _,e in ipairs(exclude or {}) do if math.abs(x-e[1])<M.EXCLUSION then far=false end end
                if far then
                    local scale=settings.size_min+(settings.size_max-settings.size_min)*size
                    out[#out+1]={id='d'..next_id,source=piece.id,distance=at,offset=settings.offset or 0,placement=settings.placement,
                        tilt=settings.tilt~=false,asset=settings.assets[math.min(#settings.assets,math.floor(pick*#settings.assets)+1)],
                        scale=math.floor(scale*1000+.5)/1000,generated=true}
                    next_id=next_id+1
                    record({x,y})
                end
            end
            at=at+step*(.5+random())
        end
    end end
    if #out>source.MAX_ITEMS then
        return nil,string.format('Populate would make %d decorations; the limit is %d. Lower the density or populate a shorter stretch.',#out,source.MAX_ITEMS)
    end
    return {version=block.version,next_id=next_id,items=out}
end
return M
