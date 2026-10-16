-- Bounded read-only history of completed fixed-step observations.
local M={seconds=5,buckets=50}
M.capacity=math.ceil(M.seconds*sys.get_config_number("engine.fixed_update_frequency",60))+1
function M.new(generation) return {time=0,head=0,size=0,items={},generation=generation or 1} end
function M.push(h,s,dt)
    h.time=h.time+dt;h.head=h.head%M.capacity+1
    h.items[h.head]={time=h.time,speed=s.speed,travel1=s.travel1,travel2=s.travel2}
    h.size=math.min(h.size+1,M.capacity)
end
local function quantize(v) return math.floor(v*10+0.5)/10 end
function M.series(h)
    local result={}
    for i,key in ipairs({"speed","travel1","travel2"}) do
        local values={};for j=1,M.buckets*2 do values[j]=false end
        local peak,positive,count,oldest=0,0,0,0
        for n=0,h.size-1 do
            local sample=h.items[(h.head-h.size+n)%M.capacity+1]
            local age=h.time-sample.time
            if age<=M.seconds+0.000001 then
                local bucket=math.min(M.buckets-1,math.floor(math.max(0,M.seconds-age)/M.seconds*M.buckets))
                local index=2*bucket+1
                local value=quantize(sample[key])
                if values[index]==false then values[index],values[index+1]=value,value
                else values[index],values[index+1]=math.min(values[index],value),math.max(values[index+1],value) end
                peak=math.max(peak,math.abs(value));positive=math.max(positive,value);count=count+1;oldest=math.max(oldest,age)
            end
        end
        local step=i==1 and 100 or 10
        result[i]={values=values,peak=peak,positive_peak=positive,scale=math.max(step,math.ceil(peak/step)*step),count=count,oldest_age=oldest}
    end
    local travel_scale=math.max(result[2].scale,result[3].scale)
    result[2].scale,result[3].scale=travel_scale,travel_scale
    return result
end
return M
