local M={}
function M.report(data,preset,modified,tuning)
    if not data then return nil end
    return table.concat({"## Rider gym feedback",
        "- Commit: "..sys.get_config_string("rider.source_sha","development"),
        "- Preset: "..string.upper(preset or "a")..(modified and " (modified)" or ""),
        "- Station: flat-gym",
        string.format("- Speed: %.2f u/s; vx %+.2f u/s",data.speed,data.velocity_x),
        string.format("- Wheel contact: L %s / R %s",tostring(data.contact1),tostring(data.contact2)),
        string.format("- Suspension: L %+.3f / R %+.3f u",data.travel1,data.travel2),
        string.format("- FPS: %.2f; mean frame %.3f ms; physics step %.3f ms",data.fps,data.frame_ms,data.physics_ms),
        "- Crash reset: "..tostring(data.crash_enabled).."; head contact: "..tostring(data.head_contact),
        "- Tuning: "..json.encode(tuning or {}),"","## What I noticed",""},"\n")
end
function M.init()
    if html5 then
        local source=assert(sys.load_resource("/main/gym/feedback.js"),"Missing feedback helper")
        html5.run(source)
    end
end
function M.update(text)
    if html5 and text then html5.run("window.riderFeedback.text="..json.encode(text)) end
end
function M.copy() if html5 then html5.run("window.riderFeedback.copy()") end end
function M.state()
    if not html5 then return "Clipboard unavailable — report shown",false end
    return html5.run("window.riderFeedback.status"),html5.run("window.riderFeedback.visible") == "true"
end
return M
