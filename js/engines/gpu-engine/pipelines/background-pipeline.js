//@ts-check

/**
 * @typedef {import("../../../entities/camera.js").Camera} Camera
 * @typedef {import("../../../entities/background.d.ts").IBackground} IBackground
 */
import { uploadShader } from "../../../utilities/wgpu-utils.js";
import { getInverse } from "../../../utilities/vector.js";

export async function getBackgroundPipeline(device) {
	const vertexBufferDescriptor = [{
		attributes: [
			{
				shaderLocation: 0,
				offset: 0,
				format: "float32x2",
			},
		],
		arrayStride: 8,
		stepMode: "vertex",
	}];

	const shaderModule = await uploadShader(
		device,
		import.meta.resolve("../../../../shaders/background.wgsl"),
	);

	const pipelineDescriptor = {
		label: "background-pipeline",
		vertex: {
			module: shaderModule,
			entryPoint: "vertex_main",
			buffers: vertexBufferDescriptor,
		},
		fragment: {
			module: shaderModule,
			entryPoint: "fragment_main",
			targets: [
				{ format: "rgba8unorm" },
			],
		},
		primitive: {
			topology: "triangle-list",
		},
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: "less-equal",
			format: "depth32float",
		},
		layout: "auto",
	};

	return device.createRenderPipeline(pipelineDescriptor);
}

/**
 * @typedef {{
 *  passEncoder: GPURenderPassEncoder
 *  bindGroupLayouts: Map<string, GPUBindGroupLayout>,
 *  samplers: Map<string, GPUSampler>,
 *  textures: Map<string, GPUTexture>,
 *  camera: Camera,
 *  background: IBackground
 * }} BackgroundBindGroupInfo
 * @param {GPUDevice} device
 * @param {BackgroundBindGroupInfo} info
 */

function setBackgroundBindGroups(device, info) {
	setBackgroundSceneBindGroup(device, info);
	setBackgroundTextureBindGroup(device, info);
}

/**
 * 
 * @param {GPUDevice} device 
 * @param {BackgroundBindGroupInfo} info
 */
function setBackgroundSceneBindGroup(device, info) {
	const viewRotationOnly = info.camera.viewMatrix.slice();
	viewRotationOnly[12] = 0;
	viewRotationOnly[13] = 0;
	viewRotationOnly[14] = 0;

	const inverseViewMatrix = getInverse(viewRotationOnly, [4, 4]);
	const sceneBuffer = device.createBuffer({
		size: inverseViewMatrix.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		label: "background-scene-buffer",
	});
	device.queue.writeBuffer(sceneBuffer, 0, inverseViewMatrix);

	const sceneBindGroup = device.createBindGroup({
		label: "background-scene-bind-group",
		layout: /** @type {GPUBindGroupLayout} */(info.bindGroupLayouts.get("scene")),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: sceneBuffer,
					offset: 0,
					size: inverseViewMatrix.byteLength,
				},
			},
		],
	});

	info.passEncoder.setBindGroup(0, sceneBindGroup);
}

/**
 * 
 * @param {GPUDevice} device 
 * @param {BackgroundBindGroupInfo} info
 */
function setBackgroundTextureBindGroup(device, info) {
	if (!info.background) {
		throw new Error("Tried to set a background when none defined.");
	}
	const sampler = info.samplers.get(info.background.sampler);
	if(!sampler){
		throw new Error(`Sampler ${info.background.sampler} was not found.`);
	}
	const texuture = info.textures.get(info.background.environmentMap);
	if(!texuture){
		throw new Error(`Texture ${info.background.environmentMap} was not found.`)
	}

	const textureBindGroup = device.createBindGroup({
		layout: /** @type {GPUBindGroupLayout} */(info.bindGroupLayouts.get("materials")),
		entries: [
			{ binding: 0, resource: sampler },
			{
				binding: 1,
				resource: texuture.createView({ dimension: "cube", label: "background-cube-view" }),
			},
		],
	});
	info.passEncoder.setBindGroup(1, textureBindGroup);
}

export async function getBackgroundPipelineRegistration(device) {
	const pipeline = await getBackgroundPipeline(device);
	const bindGroupLayouts = new Map([
		["scene", pipeline.getBindGroupLayout(0)],
		["materials", pipeline.getBindGroupLayout(1)],
	]);

	return {
		pipeline,
		bindGroupLayouts,
		bindMethod: setBackgroundBindGroups,
	};
}
