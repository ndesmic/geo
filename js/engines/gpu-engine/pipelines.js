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

	const shaderModule = await uploadShader(device, "./shaders/cook-torrence-pbr.wgsl");

	const pipelineDescriptor = {
		label: "main-pipeline",
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
		},
		layout: "auto"
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

	const shaderModule = await uploadShader(device, "./shaders/shadow-map.wgsl");

	const pipelineDescriptor = {
		label: "shadow-map-pipeline",
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
			depthCompare: "less-equal",
			format: "depth32float"
		},
		layout: "auto"
	};
	return device.createRenderPipeline(pipelineDescriptor);
}