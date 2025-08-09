struct VertexOut {
	@builtin(position) position : vec4<f32>,
	@location(0) uv : vec2<f32>
};
struct Uniforms {
	view_matrix: mat4x4<f32>,
	projection_matrix: mat4x4<f32>,
	model_matrix: mat4x4<f32>,
	normal_matrix: mat3x3<f32>,
	camera_position: vec3<f32>
}
					
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var main_sampler: sampler;
@group(1) @binding(1) var texture: texture_2d<f32>;
@vertex
fn vertex_main(@location(0) position: vec3<f32>, @location(1) uv: vec2<f32>) -> VertexOut
{
	var output : VertexOut;
	output.position =  uniforms.projection_matrix * uniforms.view_matrix * uniforms.model_matrix * vec4<f32>(position, 1.0);
	output.uv = uv;
	return output;
}
@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
	return textureSample(texture, main_sampler, fragData.uv);
}