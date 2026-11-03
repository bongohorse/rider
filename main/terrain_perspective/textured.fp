#version 140
// #392 Stage A: Kenney 1.1 terrain atlas, six family rows x four face columns (main/terrain_material/manifest.json).
in lowp vec4 var_color;
in highp vec3 var_tile;
out vec4 frag_color;
uniform lowp sampler2D tex0;
const float ATLAS=512.0;
const float CELL=80.0;
const float PAD=8.0;
const float TILE=64.0;
void main() {
    float id=floor(var_tile.z+0.5);
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
