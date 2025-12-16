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
	world_matrix: mat4x4<f32>,
	normal_matrix: mat3x3<f32>,
	camera_position: vec3<f32>
}

struct Material {
	use_specular_map: u32,
	roughness: f32,
	metalness: f32,
	base_reflectance: vec3<f32>
}
					
@group(0) @binding(0) var<uniform> scene : Scene;

@group(1) @binding(0) var albedo_sampler: sampler;
@group(1) @binding(1) var albedo_map: texture_2d<f32>;
@group(1) @binding(2) var<uniform> material: Material;
@group(1) @binding(3) var roughness_sampler: sampler;
@group(1) @binding(4) var roughness_map: texture_2d<f32>;

@vertex
fn vertex_main(@location(0) position: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) normal: vec3<f32>) -> VertexOut
{
	var output : VertexOut;
	output.frag_position =  scene.projection_matrix * scene.view_matrix * scene.world_matrix * scene.model_matrix * vec4<f32>(position, 1.0);
	output.world_position = scene.world_matrix * scene.model_matrix * vec4<f32>(position, 1.0);
	output.uv = uv;
	output.normal = scene.normal_matrix * normal;
	
	return output;
}
@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
	return vec4(1.0, 0.0, 0.0, 1.0);
}