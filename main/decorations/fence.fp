#version 140
in highp vec2 uv;
out vec4 out_color;
uniform fs_uniforms { lowp vec4 tint; };
uniform lowp sampler2D tex0;
void main() {
    out_color=texture(tex0,uv)*tint;
}
