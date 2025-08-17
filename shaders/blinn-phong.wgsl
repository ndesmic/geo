
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
struct SpecularMaterial {
	use_specular_map: u32,
	gloss_color: vec4<f32>
}

@group(0) @binding(0) var<uniform> scene : Scene;

@group(1) @binding(0) var main_sampler: sampler;
@group(1) @binding(1) var texture: texture_2d<f32>;
@group(1) @binding(2) var<uniform> specular: SpecularMaterial;
@group(1) @binding(3) var specular_sampler: sampler;
@group(1) @binding(4) var specular_map: texture_2d<f32>;

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
	//assume it's a roughness map
	var gloss_from_map = vec4(1.0) - textureSample(specular_map, specular_sampler, frag_data.uv);
	var gloss = mix(specular.gloss_color.rgb, gloss_from_map.rgb, f32(specular.use_specular_map));

	var surface_color = textureSample(texture, main_sampler, frag_data.uv);
	var total_diffuse = vec4(0.0);
	var total_specular = vec4(0.0);

	var i = 0;
	for(var i: u32 = 0; i < light_count.count; i++){
		//diffuse
		var light = lights[i];
		var to_light = normalize(light.position - frag_data.world_position.xyz);
		var diffuse_intensity = max(dot(normalize(frag_data.normal), to_light), 0.0);
		total_diffuse += light.color * vec4(diffuse_intensity, diffuse_intensity, diffuse_intensity, 1);

		//specular
		var to_camera = normalize(scene.camera_position - frag_data.world_position.xyz);
        var half_vector = normalize(to_light + to_camera);
		var base_specular = vec3(clamp(dot(half_vector, frag_data.normal), 0.0, 1.0));
		var specular_intensity = pow(base_specular, gloss.rgb);
		specular_intensity *= vec3(f32(gloss.r > 0.0), f32(gloss.g > 0.0), f32(gloss.b > 0.0)); //disable if specular_value is 0
		total_specular += light.color * vec4(specular_intensity.r, specular_intensity.g, specular_intensity.b, 1); 
	}

	//return gloss_from_map;
	return surface_color * (total_diffuse + total_specular);
}