struct VertexOut {
	@builtin(position) frag_position : vec4<f32>,
	@location(0) clip_position: vec4<f32>
};
@group(0) @binding(0) var<uniform> inverse_view_matrix: mat4x4<f32>;
@group(1) @binding(0) var main_sampler: sampler;
@group(1) @binding(1) var space_texture: texture_cube<f32>;
@vertex
fn vertex_main(@location(0) position: vec2<f32>) -> VertexOut
{
	var output : VertexOut;
	output.frag_position =  vec4(position, 1.0, 1.0);
	output.clip_position = vec4(position, 1.0, 1.0);
	return output;
}
@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
	var pos = inverse_view_matrix * fragData.clip_position;
	return textureSample(space_texture, main_sampler, pos.xyz);
}