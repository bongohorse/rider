local Z=require 'main.gym.editor_zoom'
assert(Z.parse('100')==1 and Z.parse(' 100 % ')==1)
assert(Z.parse('1')==Z.MIN and Z.parse('400')==Z.MAX and Z.parse('12.5%')==.125)
for _,bad in ipairs({'','abc','0','0.99','401','-5','nan','inf','1e2','100%%','0x64','100% extra'}) do assert(not Z.parse(bad),bad) end
assert(Z.step(.8,1)==1 and Z.step(1,-1)==.75 and Z.step(1,1)==1.5)
assert(Z.step(1.3,1)==1.5 and Z.step(1.3,-1)==1)
assert(Z.step(Z.MIN,-1)==Z.MIN and Z.step(Z.MAX,1)==Z.MAX)
local last=0
for _,z in ipairs(Z.STEPS) do assert(z>last and z>=Z.MIN and z<=Z.MAX);last=z end
assert(Z.text(1)=='100' and Z.text(.125)=='12.5' and Z.text(.012345)=='1.23')
print('PASS editor zoom input bounds, exact 100%, directional steps, Fit intermediates and display precision')
