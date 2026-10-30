-- Percentage-point gameplay resource. No engine calls or second simulation owner.
local M={DEFAULT={version=1,enabled=true,start=100,time=1,drive=1,warning=20,refill=35}}
M.fields={start={0,100,1},time={0,100,.1},drive={0,100,.1},warning={0,100,1},refill={0,100,5}}
function M.value(key,v)
    local n=tonumber(v);local r=M.fields[key]
    if not r or not n or n~=n or n<r[1] or n>r[2] then return nil,'Fuel '..tostring(key)..' must be '..(r and r[1] or '?')..' to '..(r and r[2] or '?') end
    return n
end
function M.defaults() local t={};for k,v in pairs(M.DEFAULT) do t[k]=v end;return t end
function M.validate(c)
    if c==nil then return true end
    if type(c)~='table' or c.version~=1 then return nil,'Unsupported fuel version',true end
    for k in pairs(c) do if k~='version' and k~='enabled' and not M.fields[k] then return nil,'Unsupported fuel field '..tostring(k),true end end
    if type(c.enabled)~='boolean' then return nil,'Fuel enabled must be boolean' end
    for _,k in ipairs({'start','time','drive','warning','refill'}) do local n,err=M.value(k,c[k]);if not n or type(c[k])~='number' then return nil,err or 'Invalid fuel number' end end
    return true
end
function M.new(c) return c and c.enabled and {config=c,amount=c.start,collected=0,feedback=0,started=false,power=0} or nil end
function M.consume(t,dt,power) if t then t.amount=math.max(0,t.amount-dt*(t.config.time+t.config.drive*math.max(0,math.min(1,power or 0)))) end end
function M.refill(t)
    if not t then return end
    local before=t.amount;t.amount=math.min(100,t.amount+t.config.refill);t.collected=t.collected+1;t.feedback=t.amount-before
end
function M.label(t)
    if not t then return '' end
    local state=t.amount<=0 and 'EMPTY - coast / brake; refill or Retry' or t.amount<=t.config.warning and 'LOW FUEL' or 'Fuel'
    return string.format('%s %.1f%%',state,t.amount)
end
return M
