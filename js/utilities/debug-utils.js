/**
 * 
 * @param {GPUDevice} device 
 * @param {*} context 
 * @param {{ shouldGammaScale?: boolean }} options 
 * @returns 
 */
export function setupExtractDepthBuffer(device, context, options = {}) {
	const vertices = new Float32Array([
		-1.0, -1.0,
		3.0, -1.0,
		-1.0, 3.0
	]);

	const vertexBuffer = device.createBuffer({
		label: "depth-buffer-export-tri",
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(vertexBuffer, 0, vertices);

	const vertexBufferDescriptor = [{
		attributes: [
			{
				shaderLocation: 0,
				offset: 0,
				format: "float32x2"
			}
		],
		arrayStride: 8,
		stepMode: "vertex"
	}];

	const shaderModule = device.createShaderModule({
		label: "depth-buffer-export-shader",
		code: `
			struct VertexOut {
				@builtin(position) frag_position : vec4<f32>,
				@location(0) clip_position: vec4<f32>,
				@location(2) uv: vec2<f32>
			};

			@group(0) @binding(0) var depthSampler: sampler;
			@group(0) @binding(1) var depthTex: texture_depth_2d;

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
			fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32> {
				let depth = textureSample(depthTex, depthSampler, fragData.uv);
				
				${options.shouldGammaScale
					? `
					let gamma_depth = pow(depth, 10.0);
					return vec4<f32>(gamma_depth, gamma_depth, gamma_depth, 1.0);
					`
					: `
					return vec4<f32>(depth, depth, depth, 1.0);
					`
				}
			}
		`
	});

	const sampler = device.createSampler({
		compare: undefined
	});

	const bindGroupLayout = device.createBindGroupLayout({
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "non-filtering"
				}
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "depth",
					viewDimension: "2d"
				}
			}
		]
	});

	const pipelineLayout = device.createPipelineLayout({
		label: "depth-buffer-export-pipeline-layout",
		bindGroupLayouts: [
			bindGroupLayout
		]
	});

	const pipelineDescriptor = {
		label: "depth-buffer-export-pipeline",
		vertex: {
			module: shaderModule,
			entryPoint: "vertex_main",
			buffers: vertexBufferDescriptor
		},
		fragment: {
			module: shaderModule,
			entryPoint: "fragment_main",
			targets: [
				{ format: "rgba8unorm" }
			]
		},
		primitive: {
			topology: "triangle-list"
		},
		layout: pipelineLayout
	};

	const pipeline = device.createRenderPipeline(pipelineDescriptor);

	return (depthBufferView) => {
		const commandEncoder = device.createCommandEncoder({
			label: "depth-buffer-export-command-encoder"
		});

		const passEncoder = commandEncoder.beginRenderPass({
			label: `depth-buffer-export-render-pass`,
			clearValue: { r: 0, g: 0, b: 0, a: 1 },
			colorAttachments: [
				{
					storeOp: "store",
					loadOp: "clear",
					view: context.getCurrentTexture().createView()
				}
			]
		});

		const textureBindGroup = device.createBindGroup({
			label: "depth-buffer-export-bind-group",
			layout: bindGroupLayout,
			entries: [
				{ binding: 0, resource: sampler },
				{ binding: 1, resource: depthBufferView },
			]
		});

		passEncoder.setPipeline(pipeline);
		passEncoder.setBindGroup(0, textureBindGroup);
		passEncoder.setVertexBuffer(0, vertexBuffer);
		passEncoder.draw(3);
		passEncoder.end();

		device.queue.submit([commandEncoder.finish()]);
	}
}