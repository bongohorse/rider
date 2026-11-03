-- Authored target times; comparisons always use the unrounded simulation result.
local M={order={'gold','silver','bronze'},names={'None','Bronze','Silver','Gold'}}
function M.validate(t)
    if t==nil then return true end -- legacy levels have no targets
    if type(t)~='table' then return nil,'Invalid medal targets' end
    if t.version~=1 then return nil,'Unsupported medal target version',true end
    for k in pairs(t) do if k~='version' and k~='gold' and k~='silver' and k~='bronze' then return nil,'Unsupported medal target field '..tostring(k),true end end
    for _,k in ipairs(M.order) do
        local n=t[k]
        if type(n)~='number' or n~=n or n<=0 or n>=86400 then return nil,'Medal times must be positive and below 86400 s' end
    end
    if not (t.gold<t.silver and t.silver<t.bronze) then return nil,'Medal times must be Gold < Silver < Bronze' end
    return true
end
function M.defaults() return {version=1,gold=26,silver=30,bronze=40} end
function M.set(current,key,text)
    local supported,why=M.validate(current);if not supported then return nil,why end
    local t=current and {version=current.version,gold=current.gold,silver=current.silver,bronze=current.bronze} or M.defaults()
    if key~='gold' and key~='silver' and key~='bronze' then return nil,'Invalid target field' end
    t[key]=tonumber(text)
    local ok,err=M.validate(t)
    if not ok then return nil,err..'. Previous targets kept.' end
    return t
end
function M.award(targets,time)
    if not targets or not M.validate(targets) or type(time)~='number' or time~=time or time<=0 then return 0 end
    for i,k in ipairs(M.order) do if time<=targets[k] then return 4-i end end
    return 0
end
function M.next(targets,rank)
    if not targets or not M.validate(targets) or rank>=3 then return '',0 end
    local k=M.order[3-rank];return k:sub(1,1):upper()..k:sub(2),targets[k]
end
-- Only shipped resources declare an official competition. Authored/imported copies stay practice.
-- Bump race_revision for changed geometry/start/finish or rule implementations; targets/look do not bump it.
function M.key(station)
    if not station or station.custom or not station.finish then return nil end
    local rev=station.race_revision or 1
    local key=station.id..'-course'..rev..'-rules1-buggy-a-crash'
    if station.fuel and station.fuel.enabled then local f=station.fuel;key=key..string.format('-fuel-%.17g-%.17g-%.17g-%.17g',f.start,f.time,f.drive,f.refill) end
    return key
end
return M
