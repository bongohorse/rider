-- #409: the production slot store (main.game.custom) never writes over its only restorable slot, and a
-- newer-version slot stays unchanged. Only sys.load/sys.save and json are stubbed; a file table here
-- stands for the bytes on disk and every write stores a fresh table, so an untouched file keeps its identity.
local files,writes,fail={},{},false
local function copy(v)
    if type(v)~='table' then return v end
    local t={};for k,x in pairs(v) do t[k]=copy(x) end;return t
end
json={encode=function() error('json is not used by this suite') end,decode=function() error('json is not used by this suite') end}
sys={get_save_file=function(app,name) return app..'/'..name end,get_engine_info=function() return {is_debug=true} end,
    load=function(path) return copy(files[path]) or {} end,
    save=function(path,t)
        writes[#writes+1]=path
        -- HTML5 sys.save truncates/unlinks its target on a write error.
        if fail then files[path]=nil;error('injected write failure '..path) end
        files[path]=copy(t);return true
    end}
html5=nil
local custom=require 'main.game.custom'
local function parse(text)
    if text:sub(1,6)=='future' then return nil,'Unsupported version 99',true end
    return {text=text}
end
custom.parse=parse -- the custom level store parses through custom.parse
local function put(path,seq,text) files[path]={format=1,seq=seq,text=text,time=1};return files[path] end
local function reset(failing) files,writes,fail={},{},failing or false end
local A,B='rider/t-a','rider/t-b'
local function store() return custom.slot_store({'t-a','t-b'},parse) end

-- Positive control: two valid slots alternate, and a failed write only ever loses the older one.
reset()
put(A,10,'A');put(B,11,'B')
local s=store()
assert(s.save('C')==12 and files[A].text=='C' and s.save('D')==13 and files[B].text=='D')
reset(true);put(A,10,'A');put(B,11,'B')
assert(not store().save('C'));assert(writes[1]==A and not files[A] and store().restore().text=='B')
print('PASS valid slots alternate; a failed write keeps the newest valid slot')

-- The custom level: one valid slot (A) and a newer-version slot. A save must not write over A, or a failed
-- write leaves only the newer-version slot and nothing this build can restore.
local LA,LB='rider/custom-level-a','rider/custom-level-b'
for _,future_seq in ipairs({11,9}) do -- newer-version slot newest, then older than the valid one
    reset(true)
    local valid,future=put(LA,10,'A'),put(LB,future_seq,'future B')
    local seq,err=custom.save('N')
    assert(not seq and err==custom.NEWER_VERSION,'a save over the only valid slot must be refused with its cause: '..tostring(err))
    assert(err:match('newer Rider version') and err:match('will not overwrite') and err:match('Open the newer version'))
    assert(#writes==0,'the only valid slot must not be written (wrote '..tostring(writes[1])..')')
    assert(files[LA]==valid and files[LB]==future,'both slots must stay byte-for-byte unchanged')
    assert(custom.restore().text=='A','the valid level must stay restorable')
    fail=false;seq,err=custom.save('N')
    assert(not seq and err==custom.NEWER_VERSION and #writes==0,'the refusal must not depend on the write failing')
end
print('PASS a custom level save never writes over its only valid slot; the newer-version slot stays unchanged')

-- Every other store (here a generic pair) refuses the same way.
reset(true)
local valid,future=put(A,10,'A'),put(B,11,'future B')
local refused,why=store().save('N')
assert(not refused and why==custom.NEWER_VERSION and #writes==0 and files[A]==valid and files[B]==future)
assert(select(2,store().writable())==custom.NEWER_VERSION and #writes==0,'writable() reports the refusal without writing')
assert(store().restore().text=='A')
print('PASS a slot store save never writes over its only valid slot')

-- Unchanged: a newer-version slot next to an empty one is saved around; two newer-version slots refuse.
reset()
future=put(A,11,'future A')
assert(store().save('N')==12 and writes[1]==B and files[B].text=='N' and files[A]==future)
reset()
local fa,fb=put(A,10,'future A'),put(B,11,'future B')
assert(not store().save('N') and #writes==0 and files[A]==fa and files[B]==fb)
print('PASS an empty slot next to a newer-version slot is used; two newer-version slots refuse')

-- Drafts (LE2) keep saving around an unsupported newest draft: the newer-version slot stays unchanged.
reset()
local DA,DB='rider/custom-draft-a','rider/custom-draft-b'
put(DA,10,'draft');future=put(DB,11,'future draft')
local drafts=custom.drafts(parse)
assert(drafts.save('edit 1')==12 and files[DA].text=='edit 1' and files[DB]==future)
assert(drafts.save('edit 2')==13 and files[DA].text=='edit 2' and files[DB]==future)
print('PASS drafts save around an unsupported draft slot, which stays unchanged')
