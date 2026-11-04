-- #506: le1a-only fault injection at the real loader callback seam. No release/debug service.
local M={}
function M.new()
    assert(html5 and sys.get_engine_info().is_debug and sys.get_config_string('rider.gym_test','')=='le1a',
        'Loader fault injection requires the debug HTML5 le1a case')
    return {token=0,replayed=0}
end
function M.hold(p,id,data,sender)
    if p.message and not p.replaying and id==hash(p.message) then
        if not p.held then p.held={id=id,data=data,sender=sender} end
        return true
    end
    return false
end
function M.poll(p,owner,dispatch)
    local ok,r=pcall(json.decode,html5.run('(()=>{const r=window.riderLoaderRequest;window.riderLoaderRequest=null;return JSON.stringify(r||null)})()'))
    if ok and type(r)=='table' then
        if r.action=='hold' and (r.message=='proxy_loaded' or r.message=='gym_ready') then
            p.message,p.held=r.message,nil
        elseif r.action=='expire' then
            assert(owner.loading and p.held,'Only a held in-flight load can expire')
            -- Cross the unchanged production 15-second deadline without making the test wait 15 seconds.
            owner.deadline=15.001
        elseif r.action=='release' or r.action=='stale' then
            local held=assert(p.held,'No captured loader completion')
            local data={};for k,v in pairs(held.data) do data[k]=v end
            if r.action=='stale' then
                assert(p.message=='gym_ready','Only readiness carries a generation')
                data.generation=owner.generation-1
            end
            p.replaying=true;dispatch(owner,held.id,data,held.sender);p.replaying=false
            p.replayed=p.replayed+1
        end
        p.token=r.token
    end
    html5.run('window.riderLoaderProbe='..json.encode({token=p.token,message=p.message or false,held=p.held~=nil,replayed=p.replayed,
        failed=owner.failed==true,loading=owner.loading==true,alive=owner.world_alive==true,generation=owner.generation,loads=owner.world_loads}))
end
return M
