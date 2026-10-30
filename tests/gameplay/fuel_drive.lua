-- Actual vehicle.apply against a recording engine boundary; verifies braking is retained at empty.
package.loaded['main.gym.rider']={}
local config={spring_hz=2,damping=.5,reverse_threshold=.2,reverse_delay=.2,motor_speed=30,reverse_speed=-10,brake_torque=20,drive_torque=10,coast_torque=1,rolling_resistance=0,air_pitch_damping=0,lean_torque=5,ground_lean_torque=5,lean_rate_max=10,ground_rate_max=10}
package.loaded['main.gym.feel']={values=config,motor_torque=function(n)return n end,body_torque=function(n)return n end}
local motors={};local speed=0;local torques=0
b2d={body={get_linear_velocity=function()return {x=speed}end,get_contact_data=function()return {true}end,get_angular_velocity=function()return 0 end,is_awake=function()return true end,apply_torque=function()torques=torques+1 end},joint={set_spring_hertz=function()end,set_spring_damping_ratio=function()end,wake_bodies=function()end,enable_motor=function(j,v)motors[j].enabled=v end,set_motor_speed=function(j,v)motors[j].speed=v end,set_max_motor_torque=function(j,v)motors[j].torque=v end}}
local V=require 'main.gym.vehicle';local v={chassis=0,wheels={1,2},joints={1,2}};motors[1]={};motors[2]={}
local c={throttle=1,brake_reverse=0,allow_reverse=false,lean=0};V.apply(v,c,.1);assert(motors[1].speed==30 and motors[1].torque==10 and v.powered_input==1)
c.fuel_empty=true;V.apply(v,c,.1);assert(motors[1].speed==0 and motors[1].torque==1 and v.powered_input==0)
c={throttle=0,brake_reverse=1,allow_reverse=true,lean=0,fuel_empty=true};V.apply(v,c,1);assert(motors[1].speed==0 and motors[1].torque==20 and not v.reversing and v.powered_input==0)
c.fuel_empty=false;V.apply(v,c,.1);assert(motors[1].torque==20 and v.powered_input==0);V.apply(v,c,.1);assert(motors[1].speed==-10 and motors[1].torque==10 and v.powered_input==1)
c.fuel_empty=true;c.lean=1;V.apply(v,c,.1);assert(motors[1].speed==0 and motors[1].torque==20 and torques>0)
print('PASS actual forward/reverse motor cutoff, reverse delay after recovery, braking/coast torque and lean retention; powered input excludes braking')
