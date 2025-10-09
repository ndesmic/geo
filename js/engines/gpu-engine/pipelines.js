import { uploadShader } from "../../utilities/wgpu-utils.js";

export async function getMainPipeline(device) {
	const vertexBufferDescriptor = [{
		attributes: [
			{
				shaderLocation: 0,
				offset: 0,
				format: "float32x3"
			},
			{
				shaderLocation: 1,
				offset: 12,
				format: "float32x2"
			},
			{
				shaderLocation: 2,
				offset: 20,
				format: "float32x3"
			}
		],
		arrayStride: 32,
		stepMode: "vertex"
	}];

	const relativeShaderUrl = import.meta.resolve("../../../shaders/pbr.wgsl");
	const shaderModule = await uploadShader(device, relativeShaderUrl);

	const sceneBindGroupLayout = device.createBindGroupLayout({
		label: "main-scene-bind-group-layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform"
				}
			}
		]
	});

	const materialBindGroupLayout = device.createBindGroupLayout({
		label: "main-material-bind-group-layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "filtering"
				}
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: 'float',
					viewDimension: '2d',
					multisampled: false
				}
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform"
				}
			},
			{
				binding: 3,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "filtering"
				}
			},
			{
				binding: 4,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: 'float',
					viewDimension: '2d',
					multisampled: false
				}
			}
		]
	});

	const lightBindGroupLayout = device.createBindGroupLayout({
		label: "main-light-bind-group-layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "read-only-storage"
				}
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform"
				}
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "comparison"
				}
			},
			{
				binding: 3,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: 'depth',
					viewDimension: '2d',
					multisampled: false
				}
			},
			{
				binding: 4,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: 'depth',
					viewDimension: '2d',
					multisampled: false
				}
			},
			{
				binding: 5,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: 'depth',
					viewDimension: '2d',
					multisampled: false
				}
			},
			{
				binding: 6,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: 'depth',
					viewDimension: '2d',
					multisampled: false
				}
			},
			{
				binding: 7,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {
					type: "non-filtering"
				}
			}
		]
	});

	const pipelineLayout = device.createPipelineLayout({
		label: "main-pipeline-layout",
		bindGroupLayouts: [
			sceneBindGroupLayout,
			materialBindGroupLayout,
			lightBindGroupLayout
		]
	});


	const pipelineDescriptor = {
		label: "main-pipeline",
		layout: pipelineLayout,
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
			topology: "triangle-list",
			frontFace: "ccw",
			cullMode: "back"
		},
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: "less-equal",
			format: "depth32float"
		}
	};
	return device.createRenderPipeline(pipelineDescriptor);
}

export async function getShadowMapPipeline(device) {
	const vertexBufferDescriptor = [{
		attributes: [
			{
				shaderLocation: 0,
				offset: 0,
				format: "float32x3"
			},
			{
				shaderLocation: 1,
				offset: 12,
				format: "float32x2"
			},
			{
				shaderLocation: 2,
				offset: 20,
				format: "float32x3"
			}
		],
		arrayStride: 32,
		stepMode: "vertex"
	}];

	const shaderModule = await uploadShader(device, "../../../shaders/shadow-map.wgsl");

	const sceneBindGroupLayout = device.createBindGroupLayout({
		label: "main-scene-bind-group-layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform"
				}
			}
		]
	});

	const pipelineLayout = device.createPipelineLayout({
		label: "main-pipeline-layout",
		bindGroupLayouts: [
			sceneBindGroupLayout
		]
	});

	const pipelineDescriptor = {
		label: "shadow-map-pipeline",
		layout: pipelineLayout,
		vertex: {
			module: shaderModule,
			entryPoint: "vertex_main",
			buffers: vertexBufferDescriptor
		},
		primitive: {
			topology: "triangle-list",
			frontFace: "ccw",
			cullMode: "back"
		},
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: "less",
			depthBias: 1000000,
			depthBiasSlopeScale: 2.0,
			format: "depth32float"
		},
	};
	return device.createRenderPipeline(pipelineDescriptor);
}

export async function getBackgroundPipeline(device) {
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

	const shaderModule = await uploadShader(device, import.meta.resolve("../../../shaders/background.wgsl"));

	const pipelineDescriptor = {
		label: "background-pipeline",
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
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: "less-equal",
			format: "depth32float"
		},
		layout: "auto"
	};

	return device.createRenderPipeline(pipelineDescriptor);
}