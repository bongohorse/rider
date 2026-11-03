-- Pins the property presentation and field helpers moved out of editor.gui_script (#331 E2). Every
-- expected value was computed by running the original editor.gui_script functions (main 3e41188), with
-- editor.anchor and self.held standing in for the explicit `anchor` and `held` arguments.
local P=require 'main.editor.editor_props'
local prefab=require 'main.editor.editor_prefab'
local function same(a,b)
    if type(a)~='table' or type(b)~='table' then return a==b end
    for k,v in pairs(a) do if not same(v,b[k]) then return false end end
    for k in pairs(b) do if a[k]==nil then return false end end
    return true
end
local function copy(v)
    if type(v)~='table' then return v end
    local c={} for k,x in pairs(v) do c[k]=copy(x) end
    return c
end
local function keys(rows) local t={} for i,r in ipairs(rows) do t[i]=r.key end return table.concat(t,',') end
-- stepped_params returns exactly two values on refusal and one on success; it only reads its arguments.
local function step(held,o,index,sign,params,anchor)
    local before={copy(held),copy(o),copy(params),copy(anchor)}
    local n=select('#',P.stepped_params(held,o,index,sign,params,anchor))
    local r,err=P.stepped_params(held,o,index,sign,params,anchor)
    assert(same({held,o,params,anchor},before),'stepped_params only reads its arguments')
    assert(r and n==1 or not r and n==2,'one value on success, nil and a reason otherwise')
    assert(r==nil or r~=o.params and r~=params,'a stepped result is a new parameter table')
    return r,err
end

-- number_text: four decimals, trailing zeros and a bare point removed (integer zeros stay).
assert(P.number_text(1.5)=='1.5' and P.number_text(2)=='2' and P.number_text(100)=='100' and P.number_text(-60)=='-60')
assert(P.number_text(0)=='0' and P.number_text(-0)=='-0' and P.number_text(-1e-5)=='-0' and P.number_text(1e-5)=='0')
assert(P.number_text(0.1+0.2)=='0.3' and P.number_text(4.99995)=='5' and P.number_text(5e-5)=='0.0001' and P.number_text(4.999e-5)=='0')
assert(P.number_text(1/3)=='0.3333' and P.number_text(2/3)=='0.6667' and P.number_text(0.12345)=='0.1235')
assert(P.number_text(123456.789)=='123456.789' and P.number_text(1e15)=='1000000000000000' and P.number_text(-2.5)=='-2.5')
assert(select('#',P.number_text(1.5))==1,'number_text returns only the string, not the gsub count')

-- drop_char: Backspace removes one whole UTF-8 character; a lone lead or invalid byte counts as one.
assert(P.drop_char('')=='' and P.drop_char('a')=='' and P.drop_char('abc')=='ab')
assert(P.drop_char('abé')=='ab' and P.drop_char('€')=='' and P.drop_char('a😀')=='a')
assert(P.drop_char('\128\128')=='' and P.drop_char('a\255')=='a' and P.drop_char('\192')=='' and P.drop_char('a\192')=='a' and P.drop_char('x\226\130')=='x')

-- param_rows: a label has one Text row; a curve has a Tangents choice only for an inner, non-corner
-- anchor of that curve; a prefab lists its shown fields (the prefab tables themselves).
local label={id='l1',type='label',text='Hi'}
assert(same(P.param_rows(label),{{key='text',label='Text'}}) and P.param_rows(label)~=P.param_rows(label))
local function anchor(p,mode) return {p=p,out={1,0},['in']={-1,0},mode=mode} end
local curve={id='c1',type='curve',anchors={anchor({0,0},'smooth'),anchor({2,1},'smooth'),anchor({4,0},'corner'),anchor({6,1},'free')}}
local TANGENTS={{key='mode',label='Tangents',choices={'free','smooth','symmetric'}}}
assert(same(P.param_rows(curve,{id='c1',i=2}),TANGENTS))
assert(same(P.param_rows(curve,nil),{}) and same(P.param_rows(curve,{id='c2',i=2}),{}))
assert(same(P.param_rows(curve,{id='c1',i=1}),{}) and same(P.param_rows(curve,{id='c1',i=4}),{}),'end anchors have no tangent mode')
assert(same(P.param_rows(curve,{id='c1',i=3}),{}),'a corner anchor has no tangent mode')
assert(same(P.param_rows(label,{id='l1',i=2}),{{key='text',label='Text'}}),'the anchor only matters for curves')
local ramp={id='r1',type='prefab',kind='ramp',params={mode='angle',length=4,angle=15}}
local rows=P.param_rows(ramp,{id='r1',i=2})
assert(keys(rows)=='mode,length,angle' and rows[1]==prefab.KINDS.ramp.fields[1])
assert(keys(P.param_rows({type='prefab',kind='ramp',params={mode='height',length=4,height=1}}))=='mode,length,height')
local kicker={type='prefab',kind='kicker',params=prefab.defaults('kicker')}
assert(keys(P.param_rows(kicker))=='facing,angle,lip,gap,landing,landing_length','a flat landing hides its angle')
kicker.params.landing='down'
assert(keys(P.param_rows(kicker))=='facing,angle,lip,gap,landing,landing_length,landing_angle')
kicker.params.landing='flat'

-- stepped_params: whole numbers and degrees step by 1, metres by 0.1; Shift x10 wins over Alt x0.1,
-- which whole numbers ignore. The result is validated by prefab.set, never applied.
local flat={type='prefab',kind='flat',params={length=10}}
assert(same(step({},flat,1,1),{length=10.1}) and same(step({shift=true},flat,1,1),{length=11}))
assert(same(step({alt=true},flat,1,1),{length=10.01}) and same(step({shift=true,alt=true},flat,1,-1),{length=9}))
assert(same(step({},{type='prefab',kind='flat',params={length=0.5}},1,1),{length=0.6}),'the step goes through number_text, so 0.5+0.1 is 0.6')
assert(same(step({},flat,1,-1,{length=5}),{length=4.9}),'pending params replace the object params')
local r,err=step({},{type='prefab',kind='flat',params={length=200}},1,1)
assert(r==nil and err=='Length must be from 0.5 to 200 m (got 200.1).')
r,err=step({},{type='prefab',kind='flat',params={length=0.5}},1,-1)
assert(r==nil and err=='Length must be from 0.5 to 200 m (got 0.4).')
r,err=P.stepped_params({},flat,1,1,{length=0/0}) -- NaN never equals itself, so not through step()
assert(r==nil and err=='Length: enter a number in m, e.g. 10.')
local wave={type='prefab',kind='wave',params={height=1,wavelength=8,count=1}}
assert(same(step({shift=true},wave,3,1),{height=1,wavelength=8,count=2}),'an integer field ignores Shift')
r,err=step({},wave,3,-1);assert(r==nil and err=='Count must be from 1 to 50  (got 0).')
assert(same(step({alt=true},wave,1,-1),{height=0.99,wavelength=8,count=1}))
local k=prefab.defaults('kicker')
local function kick(t) local p=copy(k) for key,v in pairs(t) do p[key]=v end return p end
assert(same(step({},kicker,2,1),kick{angle=16}) and same(step({shift=true},kicker,2,1),kick{angle=25}))
assert(same(step({alt=true},kicker,2,-1),kick{angle=14.9}),'degrees still take Alt')
assert(same(step({},kicker,6,1),kick{landing_length=6.1}))
r,err=step({},{type='prefab',kind='ramp',params={mode='angle',length=4,angle=60}},3,1)
assert(r==nil and err=='Angle must be from -60 to 60 deg (got 61).')
assert(same(step({},{type='prefab',kind='step',params={riser='start',height=0.05,length=4}},2,-1),{riser='start',height=-0.05,length=4}))
r,err=step({},{type='prefab',kind='step',params={riser='start',height=0.5,length=0.5}},3,-1)
assert(r==nil and err=='Tread must be 0 or from 0.5 to 50 m (got 0.4).')
-- Choice rows, rows the panel hides and missing rows cannot be stepped.
for _,i in ipairs({1,5,7,0}) do
    r,err=step({},kicker,i,1);assert(r==nil and err=='This field cannot be stepped.')
end
r,err=step({},curve,1,1,nil,{id='c1',i=2});assert(r==nil and err=='This field cannot be stepped.','a Tangents row is a choice')
r,err=step({},curve,1,1,nil,nil);assert(r==nil and err=='This field cannot be stepped.')

print('PASS editor property rows, number text, stepped parameters and UTF-8 Backspace pinned to the original editor.gui_script behaviour')
