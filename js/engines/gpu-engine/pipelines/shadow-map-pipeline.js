//@ts-check
/**
 * @typedef {import("../../../entities/camera.js").Camera} Camera
 * @typedef {import("../../../entities/light.js").Light} Light
 * @typedef {import("../../../entities/material.js").Material} Material
 * @typedef {import("../../../entities/probe.js").Probe} Probe
 * @typedef {import("./irridiance-map-pipeline.js").IPipeline} IPipeline
 * @typedef {import("./irridiance-map-pipeline.js").MeshContainer} MeshContainer
 * @typedef {import("../../../entities/pipeline.d.ts").AttachmentViews} AttachmentViews
 */
import { Mesh } from "../../../entities/mesh.js";
import { Group } from "../../../entities/group.js";
import { uploadShader } from "../../../utilities/wgpu-utils.js";
import {
	getLightProjectionMatrix,
	getLightViewMatrix,
} from "../../../utilities/light-utils.js";
import {
	getInverse,
	getTranspose,
	multiplyMatrix,
	trimMatrix,
} from "../../../utilities/vector.js";
import { pack } from "../../../utilities/buffer-utils.js";

/**
 * @implements {IPipeline}
 */
export class ShadowMapPipeline {
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

		const shaderModule = await uploadShader(
			device,
			"../../../../shaders/shadow-map.wgsl",
		);

		this.#bindGroupLayouts.set("scene", device.createBindGroupLayout({
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
		}));

		const pipelineLayout = device.createPipelineLayout({
			label: "main-pipeline-layout",
			bindGroupLayouts: this.#bindGroupLayouts.values(),
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
		this.#pipeline = device.createRenderPipeline(pipelineDescriptor);
	}

	/**
	 * @typedef {{
	 *  passEncoder: GPURenderPassEncoder
	 *  mesh: Mesh,
	 *  light: Light,
	 *  shadowMap: GPUTexture
	 * }} BindGroupInfo
	 * @param {GPUDevice} device
	 * @param {BindGroupInfo} info
	 */

	setShadowMapBindGroups(device, info) {
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
			layout:
				/** @type {GPUBindGroupLayout} */ (this.#bindGroupLayouts.get("scene")),
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
	 *  shadowMaps: Map<string | symbol, GPUTexture>,
	 *  textures: Map<string | symbol, GPUTexture>,
	 *  samplers: Map<string | symbol, GPUSampler>,
	 *  materials: Map<string | symbol, Material>,
	 *  cameras: Map<string | symbol, Camera>,
	 *  probes: Map<string | symbol, Probe>
	 * }} info
	 */
	render(device, root, attachmentViews, info) {
		const commandEncoder = device.createCommandEncoder({
			label: "shadow-map-command-encoder"
		});

		for (const [key, light] of info.lights) {
			let isFirstPass = true;
			const passEncoder = commandEncoder.beginRenderPass({
				label: `shadow-map-render-pass`,
				colorAttachments: [],
				depthStencilAttachment: {
					view: /**@type {GPUTexture} */(info.shadowMaps.get(key)).createView(),
					depthClearValue: 1.0,
					depthStoreOp: "store",
					depthLoadOp: isFirstPass ? "clear" : "load",
				}
			});
			passEncoder.setPipeline(this.#pipeline);

			const renderRecursive = (meshOrGroup) => {
				if (meshOrGroup instanceof Group) {
					for (const child of meshOrGroup.children) {
						renderRecursive(child)
					}
				} else if(meshOrGroup instanceof Mesh){
					const shadowMap = /**@type {GPUTexture} */(info.shadowMaps.get(key));
					const meshContainer = /**@type {MeshContainer} */(info.meshContainers.get(meshOrGroup));

					this.setShadowMapBindGroups(device, {
						passEncoder,
						light, 
						shadowMap, 
						mesh: meshOrGroup,
					});
					passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
					passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
					passEncoder.drawIndexed(meshContainer.mesh.indices.length);
				}
			}

			renderRecursive(root);

			passEncoder.end();
			isFirstPass = false;
		}

		device.queue.submit([commandEncoder.finish()]);
	}
}