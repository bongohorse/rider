#version 140
// #392 Stage A: Kenney 1.1 terrain atlas, six family rows x four face columns (main/terrain_material/manifest.json).
in lowp vec4 var_color;
in highp vec3 var_tile;
in highp vec4 var_line;
out vec4 frag_color;
uniform lowp sampler2D tex0;
uniform lowp sampler2D tex1; // #536 surface
uniform lowp sampler2D tex2; // #536 band (premultiplied alpha)
uniform lowp sampler2D tex3; // #536 fill
const float ATLAS=512.0;
const float CELL=80.0;
const float PAD=8.0;
const float TILE=64.0;
void main() {
    float id=floor(var_tile.z+0.5);
    if(id>23.5) {
        // #536: one image is 4 m x 4 m (128 px/m). Texture V grows upward: the image top is V=1. Surface and Band clamp V.
        float face=id-4.0*floor(id*0.25+0.01);
        // A run end whose back edge crossed its front edge faces away: drawing it would cover the front face.
        if(face>2.5&&gl_FrontFacing==(var_line.y>0.0)) discard;
        vec3 rgb;
        if(face<0.5) rgb=texture(tex1,vec2(var_tile.x,1.0-clamp(var_tile.y,0.0,1.0)*0.25)).rgb;
        else {
            vec3 fill=texture(tex3,vec2(var_line.z,-var_line.w)).rgb;
            float band_v=var_line.x*abs(var_line.y)*0.25;
            vec4 band=texture(tex2,vec2(var_tile.x,1.0-band_v));
            rgb=band.rgb+fill*(1.0-band.a);
        }
        vec3 shade=var_color.rgb;
        // protolit: the slope light fades within a few metres below the line, the body darkens further down.
        if(id>31.5&&face>0.5&&face<2.5) shade=mix(vec3(1.0),shade,exp(-var_line.x/2.5))*mix(0.7,1.0,exp(-var_line.x/5.0));
        frag_color=vec4(rgb*shade,var_color.a);
        return;
    }
    float row=floor(id*0.25+0.01);
    float col=id-4.0*row;
    // Surface/rim keep one cross-section (clamped V); side/end repeat. End U spans the cap once.
    float u=col>2.5?clamp(var_tile.x,0.0,1.0):fract(var_tile.x);
    float v=col<1.5?clamp(var_tile.y,0.0,1.0):fract(var_tile.y);
    vec2 px=vec2(col,row)*CELL+PAD+vec2(u,v)*TILE;
    // Manifest rectangles use a top-left pixel origin; texture V starts at the bottom row: flip once.
    vec4 texel=texture(tex0,vec2(px.x/ATLAS,1.0-px.y/ATLAS));
    frag_color=vec4(texel.rgb*var_color.rgb,var_color.a);
}
