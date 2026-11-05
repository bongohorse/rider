#version 140
// Level material preset: Surface, Band and Fill (docs/contracts/level-visuals.md). 128 px = 1 m.
// Textures are premultiplied. Image top is V = 1. Surface and Band clamp V, Fill repeats.
in lowp vec4 var_color;
in highp vec3 var_uv;
in highp vec4 var_side;
in lowp float var_flipped;
out vec4 frag_color;
uniform lowp sampler2D tex0; // Surface, 1 m across
uniform lowp sampler2D tex1; // Band, starts at the driving line, 1 m tall
uniform lowp sampler2D tex2; // Fill, 4 m x 4 m
const float SURFACE_FAR_EDGE=0.1875; // above image row 24 of 128 the art may fray
void main() {
    // A run end or Surface that turned away from the camera is hidden, never drawn over a face in front of it.
    if((var_uv.z<0.5||var_uv.z>2.5)&&gl_FrontFacing==(var_flipped>0.5)) discard;
    vec3 fill=texture(tex2,var_side.zw).rgb;
    vec3 rgb;
    float alpha=1.0;
    if(var_uv.z<0.5) {
        vec4 surface=texture(tex0,vec2(var_uv.x,1.0-clamp(var_uv.y,0.0,1.0)));
        if(var_uv.y<SURFACE_FAR_EDGE) {
            // The far edge frays: what lies behind shows through.
            rgb=surface.rgb/max(surface.a,0.004);
            alpha=surface.a;
        } else {
            // The contact side stays solid, also for art with holes.
            rgb=surface.rgb+fill*(1.0-surface.a);
        }
    } else {
        float band_v=1.0-var_side.x*var_side.y;
        // Below its art the Band is empty at every mip: clamped V would repeat a row that averages in the art.
        vec4 band=texture(tex1,vec2(var_uv.x,band_v))*step(0.0,band_v);
        rgb=band.rgb+fill*(1.0-band.a);
    }
    // Straight output: the default render script blends with source alpha. Vertex alpha hides a section.
    frag_color=vec4(rgb*var_color.rgb,alpha*var_color.a);
}
