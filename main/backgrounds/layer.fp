#version 140
in highp vec2 uv;
out vec4 frag_color;
uniform sampler2D tex0;
uniform fs_uniforms { highp vec4 image_size; };
void main() {
    // Repeat X, extend the actual outer image rows in Y, including their alpha.
    vec2 sample_uv=vec2(uv.x,clamp(uv.y,0.5/image_size.y,1.0-0.5/image_size.y));
    frag_color=texture(tex0,sample_uv); // premultiplied, explicit ONE blend pass
}
