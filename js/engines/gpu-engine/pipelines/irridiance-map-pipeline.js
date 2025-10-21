//@ts-check
/**
 * @typedef {import("../../../entities/probe.js").Probe} Probe
 * @typedef {import("../../../entities/light.js").Light} Light
 * @typedef {import("../../../entities/material.js").Material} Material
 * @typedef {import("../../../entities/camera.js").Camera} Camera
 * @typedef {import("../../../entities/pipeline.d.ts").IPipeline} IPipeline
 * @typedef {import("../../../entities/pipeline.d.ts").MeshContainer} MeshContainer
 * @typedef {import("../../../entities/pipeline.d.ts").AttachmentViews} AttachmentViews
 */
import { pack } from "../../../utilities/buffer-utils.js";
import {
	getProbeProjectionMatrix,
	getProbeViewMatrices,
} from "../../../utilities/probe-utils.js";
import {
	getInverse,
	getTranspose,
	multiplyMatrix,
	trimMatrix,
} from "../../../utilities/vector.js";
import { uploadShader } from "../../../utilities/wgpu-utils.js";
import { Group } from "../../../entities/group.js";
import { Mesh } from "../../../entities/mesh.js";

/**
 * @implements {IPipeline}
 */
export class IrridiancePipeline {
	#bindGroupLayouts = new Map();
	#pipeline;

	async createPipeline(device) {
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

		const relativeShaderUrl = import.meta.resolve(
			"../../../../shaders/irridiance-map.wgsl",
		);
		const shaderModule = await uploadShader(device, relativeShaderUrl);

		this.#bindGroupLayouts.set(
			"scene",
			device.createBindGroupLayout({
				label: "irridiance-scene-bind-group-layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
						buffer: {
							type: "uniform",
						},
					},
				],
			}),
		);

		this.#bindGroupLayouts.set(
			"materials",
			device.createBindGroupLayout({
				label: "irridiance-material-bind-group-layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: {
							type: "filtering",
						},
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						texture: {
							sampleType: "float",
							viewDimension: "2d",
							multisampled: false,
						},
					},
					{
						binding: 2,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: {
							type: "uniform",
						},
					},
					{
						binding: 3,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: {
							type: "filtering",
						},
					},
					{
						binding: 4,
						visibility: GPUShaderStage.FRAGMENT,
						texture: {
							sampleType: "float",
							viewDimension: "2d",
							multisampled: false,
						},
					},
				],
			}),
		);

		this.#bindGroupLayouts.set(
			"lights",
			device.createBindGroupLayout({
				label: "main-light-bind-group-layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: {
							type: "read-only-storage",
						},
					},
				],
			}),
		);

		const pipelineLayout = device.createPipelineLayout({
			label: "irridiance-pipeline-layout",
			bindGroupLayouts: this.#bindGroupLayouts.values().toArray(),
		});

		const pipelineDescriptor = {
			label: "irridiance-pipeline",
			layout: pipelineLayout,
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
				frontFace: "ccw",
				cullMode: "back",
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: "less-equal",
				format: "depth32float",
			},
		};
		this.#pipeline = device.createRenderPipeline(pipelineDescriptor);
	}

	/**
	 * @param {GPUDevice} device
	 * @param {{
	 *   passEncoder: GPURenderPassEncoder,
	 *   probe: Probe,
	 *   viewMatrix: Float32Array,
	 *   mesh: Mesh,
	 *   lights: Map<string | symbol, Light>,
	 *   textures: Map<string | symbol, GPUTexture>,
	 *   samplers: Map<string | symbol, GPUSampler>,
	 *   materials: Map<string | symbol, Material>
	 * }} info
	 */
	setBindGroups(device, info) {
		const projectionMatrix = getProbeProjectionMatrix(info.probe.resolution);
		const scene = {
			viewMatrix: info.viewMatrix,
			projectionMatrix,
			modelMatrix: getTranspose(info.mesh.modelMatrix, [4, 4]), //change to col major?
			worldMatrix: getTranspose(info.mesh.worldMatrix, [4, 4]),
			normalMatrix: getTranspose(
				getInverse(
					trimMatrix(
						multiplyMatrix(
							info.mesh.worldMatrix,
							[4, 4],
							info.mesh.modelMatrix,
							[
								4,
								4,
							],
						),
						[4, 4],
						[3, 3],
					),
					[3, 3],
				),
				[3, 3],
			),
			cameraPosition: info.probe.position,
		};

		const sceneData = pack(scene, [
			["viewMatrix", "mat4x4f32"],
			["projectionMatrix", "mat4x4f32"],
			["modelMatrix", "mat4x4f32"],
			["worldMatrix", "mat4x4f32"],
			["normalMatrix", "mat3x3f32"],
			["cameraPosition", "vec3f32"],
		]);

		const sceneBuffer = device.createBuffer({
			size: sceneData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "irridiance-scene-buffer",
		});

		device.queue.writeBuffer(sceneBuffer, 0, sceneData);

		const sceneBindGroup = device.createBindGroup({
			label: "irridiance-scene-bind-group",
			layout: this.#bindGroupLayouts.get("scene"),
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

	/**
	 * @param {GPUDevice} device
	 * @param {Mesh | Group} root
	 * @param {AttachmentViews} attachmentViews }
	 * @param {{
	 *  meshContainers: Map<Mesh, MeshContainer>,
	 *  lights: Map<string | symbol, Light>,
	 *  shadowMaps: Map<string | symbol,  GPUTexture>,
	 *  textures: Map<string | symbol, GPUTexture>,
	 *  samplers: Map<string | symbol, GPUSampler>,
	 *  materials: Map<string | symbol, Material>
	 *  probes: Map<string | symbol, Probe>
	 *  cameras: Map<string | symbol, Camera>
	 * }} info
	 */
	render(device, root, attachmentViews, info) {
		for (const probe of info.probes.values()) {
			const commandEncoder = device.createCommandEncoder({
				label: "irridiance-command-encoder",
			});

			const viewMatrices = getProbeViewMatrices(probe.position);

			for (let i = 0; i < 6; i++) {
				const passEncoder = commandEncoder.beginRenderPass({
					label: `irridiance-render-pass-${i}`,
					colorAttachments: [
						{
							storeOp: "store",
							loadOp: "clear",
							clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
							view: attachmentViews.colorView,
						},
					],
					depthStencilAttachment: {
						view: attachmentViews.depthView,
						depthClearValue: 1.0,
						depthStoreOp: "store",
						depthLoadOp: "clear",
					},
				});
				passEncoder.setPipeline(this.#pipeline);

				const renderRecursive = (meshOrGroup) => {
					if (meshOrGroup instanceof Group) {
						for (const child of meshOrGroup.children) {
							renderRecursive(child);
						}
					} else if (meshOrGroup instanceof Mesh) {
						const meshContainer =
							/** @type {MeshContainer} */ (info.meshContainers.get(
								meshOrGroup,
							));

						this.setBindGroups(device, {
							passEncoder,
							probe,
							viewMatrix: viewMatrices[i],
							mesh: meshContainer.mesh,
							lights: info.lights,
							textures: info.textures,
							samplers: info.samplers,
							materials: info.materials,
						});
						passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
						passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
						passEncoder.drawIndexed(meshContainer.mesh.indices.length);
					}
				};

				renderRecursive(root);
				passEncoder.end();
			}
			device.queue.submit([commandEncoder.finish()]);
		}
	}
}
