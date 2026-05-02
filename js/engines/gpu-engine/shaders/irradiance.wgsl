const PI = 3.14159265359;
const TWO_PI = 2 * PI;
const HALF_PI = PI / 2;
const U32_MAX: u32 = 4294967295u;

struct VertexOut {
	@builtin(position) frag_position : vec4<f32>,
	@location(0) clip_position: vec4<f32>,
	@location(1) uv: vec2<f32>
};
struct IrradianceParams {
    face_index: u32,
    screen_width: u32,
    sample_count: u32
};

fn seed_per_thread(id: u32) -> u32 {
    return id * 1099087573u;
}
fn taus_step(z: u32, s1: u32, s2: u32, s3: u32, m: u32) -> u32 {
    let b = ((z << s1) ^ z) >> s2;
    return ((z & m) << s3) ^ b;
}
fn lcg_step(z: u32, a: u32, c: u32) -> u32 {
    return a * z + c;
}
fn hybrid_taus(z1: u32, z2: u32, z3: u32, z4: u32) -> f32 {
    let r = taus_step(z1, 13u, 19u, 12u, 4294967294u) ^
            taus_step(z2, 2u, 25u, 4u, 4294967288u) ^
            taus_step(z3, 3u, 11u, 17u, 4294967280u) ^
            lcg_step(z4, 1664525u, 1013904223u);
    return f32(r) * 2.3283064365387e-10;
}

fn rand_uint(last_r: u32) -> u32 {
    let z1 = taus_step(last_r, 13u, 19u, 12u, 429496729u);
    let z2 = taus_step(last_r, 2u, 25u, 4u, 4294967288u);
    let z3 = taus_step(last_r, 3u, 11u, 17u, 429496280u);
    let z4 = lcg_step(1664525u, last_r, 1013904223u);
    return (z1 ^ z2 ^ z3 ^ z4);
}

fn uint_to_normalized_float(value: u32) -> f32 {
    return f32(value) / (f32(U32_MAX) + 1.0);
}

@group(0) @binding(0) var environment_sampler: sampler;
@group(0) @binding(1) var environment_map: texture_cube<f32>;
@group(0) @binding(2) var<uniform> params: IrradianceParams;

@vertex
fn vertex_main(@location(0) position: vec2<f32>) -> VertexOut
{
	var output : VertexOut;
	output.frag_position = vec4(position, 0.0, 1.0);
	output.clip_position = vec4(position, 0.0, 1.0);
	output.uv = vec2(position.x * 0.5 + 0.5, 1.0 - (position.y * 0.5 + 0.5));
	return output;
}

fn get_direction_from_uv_and_index(i: u32, uv: vec2<f32>) -> vec3<f32>
{
    let xy = uv * 2.0 - 1.0;

    switch i {
        case 0: {
            return vec3(1.0, -xy.y, -xy.x);
        }
        case 1: {
            return vec3(-1.0, -xy.y, xy.x);
        }
        case 2: {
            return vec3(xy.x, 1.0, xy.y);
        }
        case 3: {
            return vec3(xy.x, -1.0, -xy.y);
        }
        case 4: {
            return vec3(xy.x, -xy.y, 1.0);
        }
        case 5: {
            return vec3(-xy.x, -xy.y, -1.0);
        }
        default {
            //shouldn't pass this
            return vec3(0.0, 0.0, 0.0);
        }
    }
}

@fragment
fn fragment_main(frag_data: VertexOut) -> @location(0) vec4<f32> {
    let id = u32(frag_data.frag_position.x) + (u32(frag_data.frag_position.y) * params.screen_width);
    let seed = seed_per_thread(id);
    let normal = normalize(get_direction_from_uv_and_index(params.face_index, frag_data.uv));

    var irradiance = vec3(0.0);
    var rand_int_a = rand_uint(seed); //seed value
    var rand_int_b = rand_uint(rand_int_a); //seed value

    for(var i: u32; i < params.sample_count; i = i + 1u){
        rand_int_a = rand_uint(rand_int_b);
        rand_int_b = rand_uint(rand_int_a);
        let theta = uint_to_normalized_float(rand_int_a) * TWO_PI;
        let r_square = uint_to_normalized_float(rand_int_b);
        let radius = sqrt(r_square);

        let local_tangent = radius * cos(theta);
        let local_bitangent = radius * sin(theta);
        let local_normal = sqrt(1 - r_square);
        let local_dir = vec3(local_tangent, local_bitangent, local_normal);

        let up = normal;
        let tangent = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(normal.y) > 0.99);
        let right = normalize(cross(tangent, up));
        let forward = cross(up, right);
        let world_direction = normalize(local_dir.x * right + local_dir.y * forward + local_dir.z * up);
        irradiance += textureSample(environment_map, environment_sampler, world_direction).rgb;
    }

    irradiance /= f32(params.sample_count);
    irradiance *= PI;
    return vec4(irradiance, 1.0);
}