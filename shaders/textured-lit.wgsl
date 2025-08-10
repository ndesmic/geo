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
	camera_position: vec3<f32>
}
struct Light {
	light_type: u32,
	position: vec3<f32>,
	direction: vec3<f32>,
	color: vec4<f32>
}
struct LightCount {
	count: u32
}

@group(0) @binding(0) var<uniform> scene : Scene;
@group(1) @binding(0) var main_sampler: sampler;
@group(1) @binding(1) var texture: texture_2d<f32>;
@group(2) @binding(0) var<storage, read> lights: array<Light>;
@group(2) @binding(1) var<uniform> light_count: LightCount;

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
fn fragment_main(frag_data: VertexOut) -> @location(0) vec4<f32>
{	
	var surface_color = textureSample(texture, main_sampler, frag_data.uv);
	var diffuse = vec4(0.0);

	for(var i: u32 = 0; i < light_count.count; i++){
		var light = lights[i];
		var light_position = vec4(light.position.xyz, 1.0);
		var to_light = normalize(light_position - frag_data.world_position);
		var light_intensity = max(dot(normalize(frag_data.normal), to_light.xyz), 0.0);
		diffuse += light.color * vec4(light_intensity, light_intensity, light_intensity, 1);
	}

	return surface_color * diffuse;
}