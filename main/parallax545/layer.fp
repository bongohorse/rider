#version 140
in highp vec2 uv;
out vec4 frag_color;
uniform sampler2D tex0;
void main() {
    vec4 texel = texture(tex0, uv);
    // PNGs are premultiplied; the default mesh pass blends with source alpha.
    frag_color = vec4(texel.rgb / max(texel.a, 0.0001), texel.a);
}
