struct VertexOut {
	@builtin(position) frag_position : vec4<f32>,
	@location(0) clip_position: vec4<f32>,
	@location(2) uv: vec2<f32>
};
@group(0) @binding(0) var my_sampler: sampler;
@group(0) @binding(1) var my_texture: texture_2d_array<f32>;

@vertex
fn vertex_main(@location(0) position: vec2<f32>) -> VertexOut
{
	var output : VertexOut;
	output.frag_position =  vec4(position, 1.0, 1.0);
	output.clip_position = vec4(position, 1.0, 1.0);
	output.uv = vec2(position.x * 0.5 + 0.5, 1.0 - (position.y * 0.5 + 0.5));
	return output;
}

@fragment
fn fragment_main(frag_data: VertexOut) -> @location(0) vec4<f32> {
    let tile_width = 0.25;
    let tile_height = 0.33;
    var layer: i32 = -1;
    var origin: vec2<f32> = vec2(0.0, 0.0);

    //top
    if(frag_data.clip_position.x > 0.0 && frag_data.clip_position.x < 0.5 && frag_data.clip_position.y <= 1.0 && frag_data.clip_position.y > 0.33) {
	    layer = 2;
        origin = vec2(tile_width * 2, 0.0);
    //back
    } else if(frag_data.clip_position.x >= -1.0 && frag_data.clip_position.x < -0.5 && frag_data.clip_position.y <= 0.33 && frag_data.clip_position.y > -0.33) {
	    layer = 5;
        origin = vec2(0.0, tile_height);
    //left
    } else if(frag_data.clip_position.x >= -0.5 && frag_data.clip_position.x < 0.0 && frag_data.clip_position.y <= 0.33 && frag_data.clip_position.y > -0.33) {
	    layer = 1;
        origin = vec2(tile_width, tile_height);
    //front
    } else if(frag_data.clip_position.x >= 0.0 && frag_data.clip_position.x < 0.5 && frag_data.clip_position.y <= 0.33 && frag_data.clip_position.y > -0.33) {
	    layer = 4;
        origin = vec2(tile_width * 2, tile_height);
    //right
    } else if(frag_data.clip_position.x >= 0.5 && frag_data.clip_position.y <= 0.33 && frag_data.clip_position.y > -0.33) {
	    layer = 0;
        origin = vec2(tile_width * 3, tile_height);
    //bottom
    } else if(frag_data.clip_position.x > 0.0 && frag_data.clip_position.x < 0.5 && frag_data.clip_position.y <= -0.33) {
	    layer = 3;
        origin = vec2(tile_width * 2, tile_height * 2);
    }

    let dims = textureDimensions(my_texture, 0);
    let cubemap_px = vec2<f32>(dims.xy);
    let tile_px = vec2<f32>(tile_width * cubemap_px.x, tile_height * cubemap_px.y); //get tile in terms of texture pixels
    let half_texel = vec2<f32>(0.5) / tile_px;       

    let local_uv = clamp((frag_data.uv - origin) / vec2(tile_width, tile_height), vec2(half_texel), vec2(1.0 - half_texel));

    let sample = textureSample(my_texture, my_sampler, local_uv, layer);

    if(layer == -1){
        return vec4(0.0, 0.0, 0.0, 1.0);
    }
    return sample;
}