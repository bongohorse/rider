#version 140
in highp vec2 uv;
in highp vec2 screen_uv;
out vec4 frag_color;
uniform sampler2D tex0;
uniform fs_uniforms { highp vec4 image_size; highp vec4 vehicle_cutout; };
// 4x4 Bayer threshold. Pixel phase is fixed to the framebuffer, never the moving
// art or vehicle, and has no time/noise input: stationary pixels never shimmer.
float bayer2(vec2 p) {
    return 2.0*p.x+3.0*p.y-4.0*p.x*p.y;
}
void main() {
    vec2 cell=mod(floor(gl_FragCoord.xy),4.0);
    float threshold=(4.0*bayer2(mod(cell,2.0))+bayer2(floor(cell/2.0))+0.5)/16.0;
    float radius=length((screen_uv-vehicle_cutout.xy)/vehicle_cutout.zw);
    // Broad feather, retaining a quarter of the foreground at the centre.
    float coverage=mix(0.25,1.0,smoothstep(0.35,1.0,radius));
    if (threshold>coverage) discard;
    vec2 sample_uv=vec2(uv.x,clamp(uv.y,0.5/image_size.y,1.0-0.5/image_size.y));
    frag_color=texture(tex0,sample_uv);
}
