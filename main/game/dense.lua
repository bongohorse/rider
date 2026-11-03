-- Dense-array check for decoded JSON (#382; shared with #386, #387, #388, #394).
-- Defold json.decode turns an object into string keys ({"1":x} -> t["1"]) and a null array member into a
-- hole ([a,null,b] -> {a,nil,b}). `#t` and ipairs see neither: an object reads as empty, and ipairs stops
-- at the first hole while `#t` may still count past it. Check the shape before trusting either.
-- An empty object and an empty array decode to the same empty table, so an empty table is a valid list.
local M={}
-- n when t is a table whose keys are exactly the integers 1..n (n may be 0) and n<=max (max optional);
-- else nil and why, phrased to follow the field name ("levels "..why). Never uses `#t`.
function M.length(t,max)
    if type(t)~="table" then return nil,"is not a list" end
    local n=0
    for k in pairs(t) do
        if type(k)~="number" or k<1 or k%1~=0 then
            -- A string key is quoted, so "1" is told apart from the number 1.
            return nil,"is not a list (key "..(type(k)=="string" and string.format("%q",k) or tostring(k))..")"
        end
        n=n+1
        if max and n>max then return nil,"has more than "..max.." entries" end
    end
    -- n distinct positive integer keys fill 1..n exactly when none of 1..n is missing.
    for i=1,n do if t[i]==nil then return nil,"has a gap at entry "..i end end
    return n
end
return M
