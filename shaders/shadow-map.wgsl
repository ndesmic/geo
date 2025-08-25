struct VertexOut {
	@builtin(position) frag_position : vec4<f32>,
	@location(0) world_position: vec4<f32>,
	@location(1) uv : vec2<f32>,
	@location(2) normal : vec3<f32>
};
struct Scene {
	view_matrix: mat4x4<f32>,
	projection_matrix: mat4x4<f32>,
	model_matrix: mat4x4<f32>,
	normal_matrix: mat3x3<f32>,
}

@group(0) @binding(0) var<uniform> scene : Scene;

@vertex
fn vertex_main(@location(0) position: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) normal: vec3<f32>) -> VertexOut
{
	var output : VertexOut;
	output.frag_position =  scene.projection_matrix * scene.view_matrix * scene.model_matrix * vec4<f32>(position, 1.0);
	output.world_position = scene.model_matrix * vec4<f32>(position, 1.0);
	output.uv = uv;
	output.normal = scene.normal_matrix * normal;
	return output;
}
@fragment
fn fragment_main(){}