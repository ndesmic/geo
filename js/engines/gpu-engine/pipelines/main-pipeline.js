//@ts-check

/**
 * @typedef {import("../../../entities/pipeline.d.ts").IPipeline} IPipeline
 * @typedef {import("../../../entities/pipeline.d.ts").MeshContainer} MeshContainer
 * @typedef {import("../../../entities/probe.js").Probe} Probe
 * @typedef {import("../../../entities/camera.js").Camera} Camera
 * @typedef {import("../../../entities/light.js").Light} Light
 * @typedef {import("../../../entities/material.js").Material} Material
 * @typedef {import("../../../entities/pipeline.d.ts").AttachmentViews} AttachmentViews
 */
import { Mesh } from "../../../entities/mesh.js";
import { Group } from "../../../entities/group.js";
import { uploadShader } from "../../../utilities/wgpu-utils.js";
import { pack } from "../../../utilities/buffer-utils.js";
import {
	getEmptyMatrix,
	getInverse,
	getTranspose,
	multiplyMatrix,
	multiplyMatrixVector,
	trimMatrix,
} from "../../../utilities/vector.js";
import { getRange } from "../../../utilities/iterator-utils.js";
import {
	getLightProjectionMatrix,
	getLightViewMatrix,
} from "../../../utilities/light-utils.js";
import {
DEFAULT_CAMERA,
	DEFAULT_SHADOW_SAMPLER,
	PLACEHOLDER_CUBEMAP,
	PLACEHOLDER_SHADOW_MAP,
} from "../constants.js";

/**
 * @implements {IPipeline}
 */
export class MainPipeline {
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
			"../../../../shaders/pbr.wgsl",
		);
		const shaderModule = await uploadShader(device, relativeShaderUrl);

		this.#bindGroupLayouts.set("scene", device.createBindGroupLayout({
			label: "main-scene-bind-group-layout",
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

		this.#bindGroupLayouts.set("materials", device.createBindGroupLayout({
			label: "main-material-bind-group-layout",
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
		}));

		this.#bindGroupLayouts.set("lights", device.createBindGroupLayout({
			label: "main-light-bind-group-layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: "read-only-storage",
					},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {
						type: "comparison",
					},
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						sampleType: "depth",
						viewDimension: "2d",
						multisampled: false,
					},
				},
				{
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						sampleType: "depth",
						viewDimension: "2d",
						multisampled: false,
					},
				},
				{
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						sampleType: "depth",
						viewDimension: "2d",
						multisampled: false,
					},
				},
				{
					binding: 5,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						sampleType: "depth",
						viewDimension: "2d",
						multisampled: false,
					},
				},
				{
					binding: 6,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						sampleType: "float",
						viewDimension: "cube",
						multisampled: false,
					},
				},
			],
		}));

		const pipelineLayout = device.createPipelineLayout({
			label: "main-pipeline-layout",
			bindGroupLayouts: this.#bindGroupLayouts.values()
		});

		const pipelineDescriptor = {
			label: "main-pipeline",
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
	 * @typedef {{
	 *  passEncoder: GPURenderPassEncoder
	 *  camera: Camera,
	 *  mesh: Mesh,
	 *  lights: Map<string | symbol, Light>,
	 *  materials: Map<string | symbol, Material>,
	 *  samplers: Map<string | symbol, GPUSampler>,
	 *  shadowMaps: Map<string | symbol, GPUTexture>,
	 *  textures: Map<string | symbol, GPUTexture>,
	 * }} BindGroupInfo
	 * @param {GPUDevice} device
	 * @param {BindGroupInfo} info
	 */

	setMainBindGroups(device, info) {
		this.setMainSceneBindGroup(device, {
			passEncoder: info.passEncoder,
			camera: info.camera,
			mesh: info.mesh,
		});
		this.setMainMaterialBindGroup(device, {
			passEncoder: info.passEncoder,
			mesh: info.mesh,
			materials: info.materials,
			textures: info.textures,
			samplers: info.samplers,
		});
		this.setMainLightBindGroup(device, {
			passEncoder: info.passEncoder,
			lights: info.lights,
			shadowMaps: info.shadowMaps,
			textures: info.textures,
			samplers: info.samplers,
			ambientLightMap: info.mesh.ambientLightMap,
		});
	}

	/**
	 * @typedef {{
	 *  passEncoder: GPURenderPassEncoder
	 *  camera: Camera,
	 *  mesh: Mesh
	 * }} SceneBindGroupInfo
	 * @param {GPUDevice} device
	 * @param {SceneBindGroupInfo} info
	 */

	setMainSceneBindGroup(device, info) {
		const scene = {
			viewMatrix: info.camera.viewMatrix, //TODO: probably needs transpose
			projectionMatrix: info.camera.projectionMatrix, //TODO: probably needs transpose
			modelMatrix: getTranspose(info.mesh.modelMatrix, [4, 4]), //change to col major
			worldMatrix: getTranspose(info.mesh.worldMatrix, [4, 4]), //change to col major
			normalMatrix: getInverse(
				trimMatrix(
					multiplyMatrix(info.mesh.worldMatrix, [4, 4], info.mesh.modelMatrix, [
						4,
						4,
					]),
					[4, 4],
					[3, 3],
				),
				[3, 3],
			), //also col major but needs a transpose that cancels out
			cameraPosition: info.camera.position, //TODO: probably needs a transform...
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
			label: "main-scene-buffer",
		});

		device.queue.writeBuffer(sceneBuffer, 0, sceneData);

		const sceneBindGroup = device.createBindGroup({
			label: "main-scene-bind-group",
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
	 * @typedef {{
	 *  passEncoder: GPURenderPassEncoder,
	 *  mesh: Mesh,
	 *  materials: Map<string | symbol, Material>,
	 *  samplers: Map<string | symbol, GPUSampler>,
	 *  textures: Map<string | symbol, GPUTexture>
	 * }} MaterialBindGroupInfo
	 * @param {GPUDevice} device
	 * @param {MaterialBindGroupInfo} info
	 */

	setMainMaterialBindGroup(device, info) {
		//TODO: pack the class directly
		const material = info.materials.get(info.mesh.material);
		if (!material) {
			return new Error(`Material ${info.mesh.material} not found!`);
		}

		const materialModel = {
			useRoughnessMap: material.useRoughnessMap ? 1 : 0, //0 => constant, 1 => map
			roughness: material.roughness,
			metalness: material.metalness,
			baseReflectance: material.baseReflectance,
		};
		const materialData = pack(materialModel, [
			["useRoughnessMap", "u32"],
			["roughness", "f32"],
			["metalness", "f32"],
			["baseReflectance", "vec3f32"],
		]);

		const materialBuffer = device.createBuffer({
			size: materialData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "main-roughness-buffer",
		});

		device.queue.writeBuffer(materialBuffer, 0, materialData);

		const materialBindGroup = device.createBindGroup({
			layout: /** @type {GPUBindGroupLayout} */ (this.#bindGroupLayouts.get(
				"materials",
			)),
			entries: [
				{
					binding: 0,
					resource: /** @type {GPUSampler} */ (info.samplers.get(
						material.albedoSampler,
					)),
				},
				{
					binding: 1,
					resource:
						/** @type {GPUTextureView} */ (info.textures.get(material.albedoMap)
							?.createView()),
				},
				{
					binding: 2,
					resource: {
						buffer: materialBuffer,
						offset: 0,
						size: materialData.byteLength,
					},
				},
				{
					binding: 3,
					resource: /** @type {GPUSampler} */ (info.samplers.get(
						material.roughnessSampler,
					)),
				},
				{
					binding: 4,
					resource: /** @type {GPUTextureView} */ (info.textures.get(
						material.roughnessMap,
					)?.createView()),
				},
			],
		});
		info.passEncoder.setBindGroup(1, materialBindGroup);
	}

	/**
	 * @typedef {{
	 *  passEncoder: GPURenderPassEncoder,
	 *  lights: Map<string | symbol, Light>,
	 *  samplers: Map<string | symbol, GPUSampler>,
	 *  shadowMaps: Map<string | symbol, GPUTexture>,
	 *  textures: Map<string | symbol, GPUTexture>,
	 *  ambientLightMap: string
	 * }} LightBindGroupInfo
	 * @param {GPUDevice} device
	 * @param {LightBindGroupInfo} info
	 */

	setMainLightBindGroup(device, info) {
		let shadowMapIndex = 0;
		const shadowMappedLights = info.lights
			.entries()
			.map(([key, value]) => {
				const shadowMap = info.shadowMaps.get(key);
				if (!shadowMap) {
					throw new Error(`Could not find shadow map ${String(key)}`);
				}
				const shadowMapAspectRatio = shadowMap.width / shadowMap.height;
				const combinedModelMatrix = multiplyMatrix(
					value.worldMatrix,
					[4, 4],
					value.modelMatrix,
					[4, 4],
				);

				return {
					typeInt: value.typeInt,
					position: multiplyMatrixVector(
						combinedModelMatrix,
						value.position,
						4,
					),
					direction: multiplyMatrixVector(
						combinedModelMatrix,
						value.direction,
						4,
					),
					color: value.color,
					shadowMap,
					projectionMatrix: shadowMap
						? getLightProjectionMatrix(shadowMapAspectRatio)
						: getEmptyMatrix([4, 4]), //probably needs transpose
					viewMatrix: shadowMap
						? getLightViewMatrix(value.direction)
						: getEmptyMatrix([4, 4]), //probably needs transpose
					castsShadow: value.castsShadow ? 1 : 0,
					shadowMapIndex: (value.castsShadow && shadowMap)
						? shadowMapIndex++
						: -1,
				};
			}).toArray();

		const shadowMapsToBind = shadowMappedLights
			.filter((lightData) => lightData.shadowMapIndex > -1)
			.map((lightData) => lightData.shadowMap);

		const lightData = pack(
			{
				lights: shadowMappedLights,
				lightCount: shadowMappedLights.length,
			},
			[
				["lightCount", "u32"],
				["lights", [
					["typeInt", "u32"],
					["position", "vec3f32"],
					["direction", "vec3f32"],
					["color", "vec4f32"],
					["projectionMatrix", "mat4x4f32"],
					["viewMatrix", "mat4x4f32"],
					["castsShadow", "u32"],
					["shadowMapIndex", "i32"],
				]],
			],
			{ minSize: 64 },
		);

		const lightBuffer = device.createBuffer({
			size: lightData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST |
				GPUBufferUsage.STORAGE,
			label: "main-light-buffer",
		});
		device.queue.writeBuffer(lightBuffer, 0, lightData);

		const placeholderView =
			/** @type {GPUTexture} */ (info.shadowMaps.get(PLACEHOLDER_SHADOW_MAP))
				.createView({ label: "placeholder-view" });

		const lightBindGroup = device.createBindGroup({
			label: "main-light-bind-group",
			layout:
				/** @type {GPUBindGroupLayout} */ (this.#bindGroupLayouts.get(
					"lights",
				)),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: lightBuffer,
						offset: 0,
						size: lightData.byteLength,
					},
				},
				{
					binding: 1,
					resource: /** @type {GPUSampler} */ (info.samplers.get(
						DEFAULT_SHADOW_SAMPLER,
					)),
				},
				...(getRange({ end: 3 }).map((index) => {
					const shadowMap = shadowMapsToBind[index];
					return {
						binding: index + 2, //manually offset bind index
						resource: shadowMap
							? shadowMap.createView({ label: `shadow-view-${index}` })
							: placeholderView,
					};
				})),
				{
					binding: 6,
					resource: /** @type {GPUTexture} */ (info.textures.get(
						info.ambientLightMap ?? PLACEHOLDER_CUBEMAP,
					)).createView({
						dimension: "cube",
						label: "ambient-light-cube-view",
					}),
				},
			],
		});

		info.passEncoder.setBindGroup(2, lightBindGroup);
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
			label: "main-command-encoder",
		});

		const camera = info.cameras.get(DEFAULT_CAMERA);
		if(!camera){
			throw new Error(`Default camera did not exist.`);
		}

		const passEncoder = commandEncoder.beginRenderPass({
			label: `main-render-pass`,
			colorAttachments: [
				{
					storeOp: "store",
					loadOp: "clear",
					clearValue: { r: 0.1, g: 0.3, b: 0.8, a: 1.0 },
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
					/** @type {MeshContainer} */ (info.meshContainers.get(meshOrGroup));

				this.setMainBindGroups(device, {
					passEncoder,
					camera,
					mesh: meshContainer.mesh,
					lights: info.lights,
					shadowMaps: info.shadowMaps,
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
		device.queue.submit([commandEncoder.finish()]);
	}
}
