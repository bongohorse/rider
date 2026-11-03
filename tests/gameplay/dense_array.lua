-- #382: the shared dense-array check (main.game.dense) for decoded JSON lists.
local dense=require 'main.game.dense'
local function rejects(t,max,pattern,label)
    local n,why=dense.length(t,max)
    assert(n==nil and type(why)=='string',label..': must be rejected, got '..tostring(n))
    assert(why:match(pattern),label..': unexpected reason "'..why..'"')
end

-- Valid lists: empty (an empty JSON object decodes the same), dense, exactly at the bound, no bound.
assert(dense.length({})==0 and dense.length({},0)==0 and dense.length({},64)==0)
assert(dense.length({'a'})==1 and dense.length({'a','b','c'},3)==3)
local many={};for i=1,64 do many[i]={key=i} end
assert(dense.length(many,64)==64 and dense.length(many)==64)
-- false is a value, not a hole.
assert(dense.length({false,false})==2)
print('PASS dense lists, the empty list and a list at the bound are accepted with their length')

-- Not a table.
for _,v in ipairs({'levels',1,true}) do rejects(v,64,'is not a list',type(v)) end
rejects(nil,64,'is not a list','nil')
-- Object-shaped: string keys, including numeric strings that `#t` and ipairs do not see.
rejects({['1']='a'},64,'is not a list','string key "1"')
rejects({a='a'},64,'is not a list','string key "a"')
-- Extra keys next to a dense part.
rejects({'a','b',x='c'},64,'is not a list','dense part plus string key')
rejects({'a',['2']='b'},64,'is not a list','integer plus numeric string key')
-- Non-integer, zero, negative and infinite keys.
rejects({'a',[1.5]='b'},64,'is not a list','key 1.5')
rejects({[0]='z','a'},64,'is not a list','key 0')
rejects({'a',[-1]='b'},64,'is not a list','key -1')
rejects({'a',[math.huge]='b'},64,'is not a list','key inf')
rejects({[true]='b'},64,'is not a list','boolean key')
print('PASS non-tables, object-shaped tables and non-index keys are rejected')

-- Holes: a JSON null member, a missing first entry, a far key past the end.
local holed={'a','b'};holed[4]='d'
rejects(holed,64,'has a gap at entry 3','hole at 3')
rejects({[2]='b'},64,'has a gap at entry 1','missing entry 1')
rejects({'a',[100]='z'},64,'has a gap at entry 2','sparse far key')
-- Holes are found even when `#t` happens to report the full length.
local full={1,2,3,4};full[2]=nil
rejects(full,64,'has a gap','array part with a nil')
print('PASS sparse lists and holes are rejected')

-- Over the bound: one more than max, whatever `#t` says.
local over={};for i=1,65 do over[i]=i end
rejects(over,64,'more than 64 entries','65 entries')
rejects({'a'},0,'more than 0 entries','max 0')
print('PASS lists over the bound are rejected')
