-- Editor-only numeric policy. 100% is user orthographic multiplier 1, before camera AUTO_FIT.
local M={MIN=.01,MAX=4,STEPS={.01,.02,.05,.1,.2,.25,.5,.75,1,1.5,2,3,4}}
function M.parse(text)
    local value=tostring(text):match('^%s*(.-)%s*$'):gsub('%%$',''):match('^%s*(.-)%s*$')
    if not (value:match('^%d+%.?%d*$') or value:match('^%.%d+$')) then return nil,'Enter a zoom from 1 to 400%.' end
    local n=tonumber(value)
    if not n or n~=n or n<1 or n>400 then return nil,'Enter a zoom from 1 to 400%.' end
    return n/100
end
function M.step(value,direction)
    if direction>0 then
        for _,z in ipairs(M.STEPS) do if z>value+1e-9 then return z end end
        return M.MAX
    end
    for i=#M.STEPS,1,-1 do if M.STEPS[i]<value-1e-9 then return M.STEPS[i] end end
    return M.MIN
end
function M.text(value)
    return string.format('%.2f',value*100):gsub('0+$',''):gsub('%.$','')
end
return M
