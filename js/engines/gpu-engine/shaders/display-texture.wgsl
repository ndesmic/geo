struct VertexOut {
	@builtin(position) frag_position : vec4<f32>,
	@location(0) clip_position: vec4<f32>,
	@location(2) uv: vec2<f32>
};
@group(0) @binding(0) var my_sampler: sampler;
@group(0) @binding(1) var my_texture: texture_2d<f32>;

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
	let value = textureSample(my_texture, my_sampler, frag_data.uv);
	return value;
}