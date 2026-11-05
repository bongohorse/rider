#version 140
// Level material preset: Surface, Band and Fill (docs/contracts/level-visuals.md). 128 px = 1 m.
// Textures are premultiplied. Image top is V = 1. Surface and Band clamp V, Fill repeats.
in lowp vec4 var_color;
in highp vec3 var_uv;
in highp vec4 var_side;
out vec4 frag_color;
uniform lowp sampler2D tex0; // Surface, 1 m across
uniform lowp sampler2D tex1; // Band, starts at the driving line, 1 m tall
uniform lowp sampler2D tex2; // Fill, 4 m x 4 m
void main() {
    vec3 rgb;
    if(var_uv.z<0.5) {
        vec4 surface=texture(tex0,vec2(var_uv.x,1.0-clamp(var_uv.y,0.0,1.0)));
        // The far edge's blend belongs to #540; until then its open pixels are cut.
        if(surface.a<0.5) discard;
        rgb=surface.rgb/surface.a;
    } else {
        vec3 fill=texture(tex2,var_side.zw).rgb;
        vec4 band=texture(tex1,vec2(var_uv.x,1.0-var_side.x*var_side.y));
        rgb=band.rgb+fill*(1.0-band.a);
    }
    frag_color=vec4(rgb*var_color.rgb,var_color.a);
}
