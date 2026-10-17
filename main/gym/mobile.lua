-- Browser surface feeds normalized commands; never writes physics itself.
local M={}
function M.init()
    if html5 then
        html5.run(assert(sys.load_resource('/main/gym/tilt.js')))
        html5.run(assert(sys.load_resource('/main/gym/mobile.js')))
        html5.run('window.riderMobile.clear()')
        local stations=require "main.gym.stations"
        html5.run('window.riderMobile.stations='..json.encode(stations.ids))
    end
end
function M.poll(dt,physics)
    if not html5 then return {} end
    return json.decode(html5.run(string.format('window.riderMobile.poll(%f,%f)',dt,physics)))
end
function M.clear() if html5 then html5.run('window.riderMobile.clear()')
        local stations=require "main.gym.stations"
        html5.run('window.riderMobile.stations='..json.encode(stations.ids)) end end
function M.final()
    if html5 then html5.run('window.riderMobile.cancel(); window.riderTilt.disable()') end
end
function M.enabled() return html5 and html5.run("!!window.riderMobile?.enabled")=="true" end
function M.compact()
    return html5 and html5.run('window.riderMobile && window.riderMobile.enabled && !window.riderMobile.details')=='true'
end
return M
