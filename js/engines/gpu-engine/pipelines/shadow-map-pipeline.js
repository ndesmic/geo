//@ts-check
/**
 * @typedef {import("../../../entities/camera.js").Camera} Camera
 * @typedef {import("../../../entities/mesh.js").Mesh} Mesh
 * @typedef {import("../../../entities/light.js").Light} Light
 * @typedef {import("../../../entities/material.js").Material} Material
 * */
import { uploadShader } from "../../../utilities/wgpu-utils.js";
import { getLightProjectionMatrix, getLightViewMatrix } from "../../../utilities/light-utils.js";
import { getTranspose, getInverse, trimMatrix, multiplyMatrix } from "../../../utilities/vector.js";
import { pack } from "../../../utilities/buffer-utils.js";

export async function getShadowMapPipeline(device) {
	const vertexBufferDescriptor = [{
		attributes: [
			{
				shaderLocation: 0,
				offset: 0,
				format: "float32x3",
			},
			{
				shaderLocation: 1,
				offset: 12,
				format: "float32x2",
			},
			{
				shaderLocation: 2,
				offset: 20,
				format: "float32x3",
			},
		],
		arrayStride: 32,
		stepMode: "vertex",
	}];

	const shaderModule = await uploadShader(
		device,
		"../../../../shaders/shadow-map.wgsl",
	);

	const sceneBindGroupLayout = device.createBindGroupLayout({
		label: "shadow-scene-bind-group-layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
				},
			},
		],
	});

	const pipelineLayout = device.createPipelineLayout({
		label: "main-pipeline-layout",
		bindGroupLayouts: [
			sceneBindGroupLayout,
		],
	});

	const pipelineDescriptor = {
		label: "shadow-map-pipeline",
		layout: pipelineLayout,
		vertex: {
			module: shaderModule,
			entryPoint: "vertex_main",
			buffers: vertexBufferDescriptor,
		},
		primitive: {
			topology: "triangle-list",
			frontFace: "ccw",
			cullMode: "back",
		},
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: "less",
			depthBias: 1000000,
			depthBiasSlopeScale: 2.0,
			format: "depth32float",
		},
	};
	return device.createRenderPipeline(pipelineDescriptor);
}

/**
 * @typedef {{
 *  passEncoder: GPURenderPassEncoder
 *  bindGroupLayouts: Map<string, GPUBindGroupLayout>
 *  camera: Camera,
 *  mesh: Mesh,
 *  light: Light,
 *  shadowMap: GPUTexture
 * }} BindGroupInfo
 * @param {GPUDevice} device
 * @param {BindGroupInfo} info
 */

function setShadowMapBindGroups(device, info){
	const shadowMapAspectRatio = info.shadowMap.width / info.shadowMap.height;

	const viewMatrix = getLightViewMatrix(info.light.direction);
	const projectionMatrix = getLightProjectionMatrix(shadowMapAspectRatio);

	const scene = {
		viewMatrix,
		projectionMatrix,
		modelMatrix: getTranspose(info.mesh.modelMatrix, [4, 4]), //change to col major?
		worldMatrix: getTranspose(info.mesh.worldMatrix, [4, 4]),
		normalMatrix: getTranspose(
			getInverse(
				trimMatrix(
					multiplyMatrix(info.mesh.worldMatrix, [4, 4], info.mesh.modelMatrix, [4, 4]),
					[4, 4],
					[3, 3],
				),
				[3, 3],
			),
			[3, 3],
		),
	};

	const sceneData = pack(scene, [
		["viewMatrix", "mat4x4f32"],
		["projectionMatrix", "mat4x4f32"],
		["modelMatrix", "mat4x4f32"],
		["worldMatrix", "mat4x4f32"],
		["normalMatrix", "mat3x3f32"],
	]);

	const sceneBuffer = device.createBuffer({
		size: sceneData.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		label: "shadow-map-scene-buffer",
	});

	device.queue.writeBuffer(sceneBuffer, 0, sceneData);

	const sceneBindGroup = device.createBindGroup({
		label: "shadow-map-scene-bind-group",
		layout: /** @type {GPUBindGroupLayout} */(info.bindGroupLayouts.get("scene")),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: sceneBuffer,
					offset: 0,
					size: sceneData.byteLength,
				},
			},
		],
	});

	info.passEncoder.setBindGroup(0, sceneBindGroup);
}

export async function getShadowMapPipelineRegistration(device) {
    const pipeline = await getShadowMapPipeline(device);
    const bindGroupLayouts = new Map([
        ["scene", pipeline.getBindGroupLayout(0)]
    ]);
    
    return {
        pipeline,
        bindGroupLayouts,
        bindMethod: setShadowMapBindGroups
    };
}
