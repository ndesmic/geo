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

@group(2) @binding(0) var<storage, read> lights: array<Light>;
@group(2) @binding(1) var<uniform> light_count: LightCount;

//schlick
fn get_fresnel(f0: vec3<f32>, to_view: vec3<f32>, half_vector: vec3<f32>) -> vec3<f32> {
   return f0 + (vec3(1.0) - f0) * pow(1 - max(dot(to_view, half_vector), 0), 5.0);
}

//lambert
fn get_diffuse(surface_albedo: vec3<f32>, light_color: vec3<f32>, normal: vec3<f32>, to_light: vec3<f32>) -> vec3<f32> {
	return surface_albedo * max(dot(normal, to_light), 0.0) * light_color;
}

//GGX
fn get_normal_distribution(roughness: f32, normal: vec3<f32>, half_vector: vec3<f32>) -> f32 {
	var roughness_squared = pow(roughness, 2.0);
	var n_dot_h = max(dot(normal, half_vector), 0.0);
	var denominator = pow(n_dot_h * n_dot_h *  (roughness_squared - 1.0) + 1.0, 2.0);
	return roughness_squared / ((3.1415 * denominator) + 0.00001);
}

//GGX-schlick
fn get_geometry(to_view: vec3<f32>, to_light: vec3<f32>, normal: vec3<f32>, roughness: f32) -> f32 {
	var k = roughness / 2; //might be different in other renderers
	//var k = pow(roughness + 1, 2.0) / 8; 
	var n_dot_l = max(dot(normal, to_light), 0.0);
	var geometry_light = n_dot_l / ((n_dot_l * (1.0 - k) + k) + 0.00001);
	var n_dot_v = max(dot(normal, to_view), 0.0);
	var geometry_view = n_dot_v / ((n_dot_v * (1.0 - k) + k) + 0.00001);

	return geometry_light * geometry_view;
}

//cook-torrence
fn get_specular(fresnel: vec3<f32>, to_view: vec3<f32>, to_light: vec3<f32>, normal: vec3<f32>, half_vector: vec3<f32>, roughness: f32) -> vec3<f32> {
	var d = get_normal_distribution(roughness, normal, half_vector);
	var g = get_geometry(to_view, to_light, normal, roughness);
	var f = fresnel;
	var v_dot_n = max(dot(to_view, normal), 0.0);
	var l_dot_n = max(dot(to_light, normal), 0.0);
	return (d * g * f) / (4 * v_dot_n * l_dot_n);
}

fn get_bdrf(surface_albedo: vec3<f32>, f0: vec3<f32>, roughness: f32, metalness: f32, normal: vec3<f32>, light_color: vec3<f32>, to_light: vec3<f32>, camera_pos: vec3<f32>, frag_pos: vec3<f32>) -> vec3<f32>{
	var to_view = normalize(camera_pos - frag_pos);
	var half_vector = normalize(to_view + to_light);
	var fresnel = get_fresnel(f0, to_view, half_vector);
	var ks = fresnel;
	var kd = (vec3(1.0) - ks) * (1.0 - metalness);

	var diffuse = get_diffuse(surface_albedo, light_color, normal, to_light);
	var specular = get_specular(fresnel, to_view, to_light, normal, half_vector, roughness);

	return kd * diffuse + specular;
}

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
	var surface_albedo = textureSample(albedo_map, albedo_sampler, frag_data.uv).rgb;
	var roughness_from_map = textureSample(roughness_map, roughness_sampler, frag_data.uv).x;
	var roughness = max(mix(material.roughness, roughness_from_map, f32(material.use_specular_map)), 0.0001);
	var f0 = mix(vec3(0.04, 0.04, 0.04), material.base_reflectance, material.metalness);
	var total_color = vec3(0.0);
	var normal = normalize(frag_data.normal);

	for(var i: u32 = 0; i < light_count.count; i++){
		var light = lights[i];
		var light_distance = length(light.position - frag_data.world_position.xyz);
		var to_light = vec3(0.0);

		switch light.light_type {
			case 0: {
				to_light = normalize(light.position - frag_data.world_position.xyz);
			}
			case 1: {
				to_light = normalize(-light.direction);
			}
			default: {}
		}

		var attenuation = 1.0 / pow(light_distance, 2.0);
		var radiance = light.color.rgb * attenuation;


		total_color += get_bdrf(
			surface_albedo, 
			f0, 
			roughness, 
			material.metalness,
			normal, 
			radiance, 
			to_light,
			scene.camera_position, 
			frag_data.world_position.xyz
		);
	}

	var tone_mapped_color = total_color / (total_color + vec3(1.0));
	return vec4(pow(total_color, vec3(1.0/2.2)), 1.0);
}