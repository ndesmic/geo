import { uploadShader } from "../../../utilities/wgpu-utils.js";

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

	const shaderModule = await uploadShader(device, import.meta.resolve("../../../../shaders/background.wgsl"));

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