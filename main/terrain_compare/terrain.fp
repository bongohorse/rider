#version 140
in lowp vec4 var_color;
in highp vec2 var_uv;
out vec4 frag_color;
void main() {
    // Subtle four-metre UV reference; continuous across chunk boundaries.
    float reference = 0.985 + 0.015 * cos(var_uv.x * 6.2831853);
    frag_color = vec4(var_color.rgb * reference, var_color.a);
}
