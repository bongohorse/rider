#version 140
in highp vec2 uv;
out vec4 frag_color;
uniform sampler2D tex0;
void main() { frag_color = texture(tex0, uv); }
