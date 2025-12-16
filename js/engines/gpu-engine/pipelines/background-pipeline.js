//@ts-check

/**
 * @typedef {import("../../../entities/camera.js").Camera} Camera
 * @typedef {import("../../../entities/material.js").Material} Material
 * @typedef {import("../../../entities/probe.js").Probe} Probe
 * @typedef {import("../../../entities/mesh.js").Mesh} Mesh
 * @typedef {import("../../../entities/light.js").Light} Light
 * @typedef {import("../../../entities/group.js").Group} Group
 * @typedef {import("../../../entities/background.d.ts").IBackground} IBackground
 * @typedef {import("../../../entities/pipeline.d.ts").IPipeline} IPipeline
 * @typedef {import("../../../entities/pipeline.d.ts").MeshContainer} MeshContainer
 * @typedef {import("../../../entities/pipeline.d.ts").AttachmentViews} AttachmentViews
 */
import { uploadShader } from "../../../utilities/wgpu-utils.js";
import { getInverse } from "../../../utilities/vector.js";
import { DEFAULT_CAMERA } from "../constants.js";

/**
 * @implements {IPipeline}
 */
export class BackgroundPipeline {
	#pipeline;

	async createPipeline(device) {
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

		this.#pipeline = device.createRenderPipeline(pipelineDescriptor);
	}

	/**
	 * @typedef {{
	 *  passEncoder: GPURenderPassEncoder
	 *  samplers: Map<string | symbol, GPUSampler>,
	 *  textures: Map<string | symbol, GPUTexture>,
	 *  camera: Camera,
	 *  background: IBackground
	 * }} BackgroundBindGroupInfo
	 * @param {GPUDevice} device
	 * @param {BackgroundBindGroupInfo} info
	 */

	setBackgroundBindGroups(device, info) {
		this.setBackgroundSceneBindGroup(device, info);
		this.setBackgroundTextureBindGroup(device, info);
	}

	/**
	 * @param {GPUDevice} device
	 * @param {BackgroundBindGroupInfo} info
	 */
	setBackgroundSceneBindGroup(device, info) {
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
			layout: this.#pipeline.getBindGroupLayout(0),
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
	 * @param {GPUDevice} device
	 * @param {BackgroundBindGroupInfo} info
	 */
	setBackgroundTextureBindGroup(device, info) {
		if (!info.background) {
			throw new Error("Tried to set a background when none defined.");
		}
		const sampler = info.samplers.get(info.background.sampler);
		if (!sampler) {
			throw new Error(`Sampler ${String(info.background.sampler)} was not found.`);
		}
		const texuture = info.textures.get(info.background.environmentMap);
		if (!texuture) {
			throw new Error(
				`Texture ${String(info.background.environmentMap)} was not found.`,
			);
		}

		const textureBindGroup = device.createBindGroup({
			layout: this.#pipeline.getBindGroupLayout(1),
			entries: [
				{ binding: 0, resource: sampler },
				{
					binding: 1,
					resource: texuture.createView({
						dimension: "cube",
						label: "background-cube-view",
					}),
				},
			],
		});
		info.passEncoder.setBindGroup(1, textureBindGroup);
	}

	/**
	 * @param {GPUDevice} device
	 * @param {Mesh} root
	 * @param {AttachmentViews} attachmentViews }
	 * @param {{
	 *  meshContainers: Map<Mesh, MeshContainer>,
	 *  lights: Map<string | symbol, Light>,
	 *  shadowMaps: Map<string | symbol, GPUTexture>,
	 *  textures: Map<string | symbol, GPUTexture>,
	 *  samplers: Map<string | symbol, GPUSampler>,
	 *  materials: Map<string | symbol, Material>,
	 *  cameras: Map<string | symbol, Camera>,
	 *  probes: Map<string | symbol, Probe>,
	 *  background: IBackground
	 * }} info
	 */
	render(device, root, attachmentViews, info) {
		if (!info.background) return;
		const commandEncoder = device.createCommandEncoder({
			label: "background-command-encoder",
		});

		const passEncoder = commandEncoder.beginRenderPass({
			label: `background-render-pass`,
			colorAttachments: [
				{
					storeOp: "store",
					loadOp: "load",
					view: attachmentViews.colorView,
				},
			],
			depthStencilAttachment: {
				view: attachmentViews.depthView,
				depthStoreOp: "store",
				depthLoadOp: "load",
			},
		});

		passEncoder.setPipeline(this.#pipeline);

		const meshContainer = info.meshContainers.get(root);
		if (!meshContainer) {
			throw new Error(`No mesh was defined for the background`);
		}
		const camera = info.cameras.get(DEFAULT_CAMERA);
		if (!camera) {
			throw new Error(`Default camera did not exist.`);
		}

		this.setBackgroundBindGroups(device, {
			passEncoder,
			camera,
			samplers: info.samplers,
			textures: info.textures,
			background: info.background,
		});
		passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
		passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
		passEncoder.drawIndexed(meshContainer.mesh.indices.length);

		passEncoder.end();
		device.queue.submit([commandEncoder.finish()]);
	}
}
