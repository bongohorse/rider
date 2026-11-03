-- JSON text -> Lua table with the Defold 1.14 json.decode shapes, for host suites under Bob's LuaJIT
-- (no Defold json there). Objects keep string keys ({"1":x} -> t["1"]), arrays are 1..n and a null
-- member is a hole ([a,null,b] -> {a,nil,b}); {} and [] both become an empty table. Not a module of
-- the game: tests/gameplay/lib is not a suite directory (lua_tests.py runs tests/gameplay/*.lua only).
local M={}
local ESCAPES={['"']='"',['\\']='\\',['/']='/',b='\b',f='\f',n='\n',r='\r',t='\t'}
local function utf8(cp)
    if cp<0x80 then return string.char(cp) end
    if cp<0x800 then return string.char(0xC0+math.floor(cp/0x40),0x80+cp%0x40) end
    if cp<0x10000 then return string.char(0xE0+math.floor(cp/0x1000),0x80+math.floor(cp/0x40)%0x40,0x80+cp%0x40) end
    return string.char(0xF0+math.floor(cp/0x40000),0x80+math.floor(cp/0x1000)%0x40,0x80+math.floor(cp/0x40)%0x40,0x80+cp%0x40)
end
function M.decode(s)
    local i=1
    local function fail(what) error(('JSON: %s at byte %d'):format(what,i),0) end
    local function space() i=s:find('[^ \t\r\n]',i) or #s+1 end
    local function str()
        local out={};i=i+1
        while true do
            local j=s:find('["\\]',i) or fail('unterminated string')
            out[#out+1]=s:sub(i,j-1)
            if s:sub(j,j)=='"' then i=j+1;return table.concat(out) end
            local c=s:sub(j+1,j+1)
            if ESCAPES[c] then out[#out+1]=ESCAPES[c];i=j+2
            elseif c=='u' then
                local cp=tonumber(s:sub(j+2,j+5),16) or fail('bad \\u escape');i=j+6
                local low=s:sub(i,i+1)=='\\u' and tonumber(s:sub(i+2,i+5),16)
                if cp>=0xD800 and cp<0xDC00 and low and low>=0xDC00 and low<0xE000 then cp=0x10000+(cp-0xD800)*0x400+low-0xDC00;i=i+6 end
                out[#out+1]=utf8(cp)
            else fail('bad escape') end
        end
    end
    local value
    local function close(c,what) space();local got=s:sub(i,i);i=i+1;if got==c then return false end;if got~=',' then fail('expected '..what) end;return true end
    function value()
        space()
        local c=s:sub(i,i)
        if c=='{' then
            local t={};i=i+1;space()
            if s:sub(i,i)=='}' then i=i+1;return t end
            repeat
                space();if s:sub(i,i)~='"' then fail('expected a key') end
                local k=str();space();if s:sub(i,i)~=':' then fail("expected ':'") end;i=i+1
                t[k]=value()
            until not close('}',"',' or '}'")
            return t
        elseif c=='[' then
            local t,n={},0;i=i+1;space()
            if s:sub(i,i)==']' then i=i+1;return t end
            repeat n=n+1;t[n]=value() until not close(']',"',' or ']'")
            return t
        elseif c=='"' then return str()
        elseif s:sub(i,i+3)=='true' then i=i+4;return true
        elseif s:sub(i,i+4)=='false' then i=i+5;return false
        elseif s:sub(i,i+3)=='null' then i=i+4;return nil
        end
        local num=s:match('^-?%d+%.?%d*[eE]?[-+]?%d*',i)
        local n=num and tonumber(num)
        if not n then fail('unexpected '..(c=='' and 'end' or c)) end
        i=i+#num;return n
    end
    local v=value();space()
    if i<=#s then fail('trailing data') end
    return v
end
return M
