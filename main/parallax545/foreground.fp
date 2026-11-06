#version 140
in highp vec2 uv;
out vec4 frag_color;
uniform sampler2D tex0;
void main() {
    // The bounded fixture draws foreground after vehicle sprites, whose pass sets ONE.
    // Background meshes precede sprites and use the default SRC_ALPHA state instead.
    frag_color = texture(tex0, uv);
}
