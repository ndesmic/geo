//@ts-check
/**
 * @typedef {import("../../../entities/light.js").Light} Light
 * @typedef {import("../../../entities/material.js").Material} Material
 * @typedef {import("../../../entities/pipeline.d.ts").IPipeline} IPipeline
 * @typedef {import("../../../entities/pipeline.d.ts").MeshContainer} MeshContainer
 * @typedef {import("../../../entities/pipeline.d.ts").AttachmentViews} AttachmentViews
 * @typedef {import("./background-pipeline.js").IBackground} IBackground
 */
import { pack } from "../../../utilities/buffer-utils.js";
import {
	getLightProjectionMatrix,
	getLightViewMatrix,
} from "../../../utilities/light-utils.js";
import {
	getEmptyMatrix,
	getInverse,
	getTranspose,
	multiplyMatrix,
	multiplyMatrixVector,
	trimMatrix,
	getWorldToCameraMatrixFromDirection,
	CUBEMAP_DIRECTIONS
} from "../../../utilities/vector.js";
import { uploadShader } from "../../../utilities/wgpu-utils.js";
import { Group } from "../../../entities/group.js";
import { Mesh } from "../../../entities/mesh.js";
import {
	DEFAULT_SHADOW_SAMPLER,
	PLACEHOLDER_SHADOW_MAP,
} from "../constants.js";
import { getRange } from "../../../utilities/iterator-utils.js";
import { BackgroundPipeline } from "./background-pipeline.js";
import { ShadowMapPipeline } from "./shadow-map-pipeline.js";
import { Camera } from "../../../entities/camera.js";
import { Probe } from "../../../entities/probe.js";

/**
 * @implements {IPipeline}
 */
export class CubemapRenderPipeline {
	#bindGroupLayouts = new Map();
	#pipeline;
	/** @type {BackgroundPipeline | undefined} */
	#backgroundPipeline;
	/** @type {ShadowMapPipeline | undefined} */
	#shadowPipeline;

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
			"../shaders/pre-pbr.wgsl",
		);
		const shaderModule = await uploadShader(device, relativeShaderUrl);

		this.#bindGroupLayouts.set(
			"scene",
			device.createBindGroupLayout({
				label: "cubemap-render-scene-bind-group-layout",
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
				label: "cubemap-render-material-bind-group-layout",
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
				label: "cubemap-render-light-bind-group-layout",
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
				],
			}),
		);

		const pipelineLayout = device.createPipelineLayout({
			label: "cubemap-render-pipeline-layout",
			bindGroupLayouts: this.#bindGroupLayouts.values().toArray(),
		});

		const pipelineDescriptor = {
			label: "cubemap-render-pipeline",
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

		this.#backgroundPipeline = new BackgroundPipeline();
		await this.#backgroundPipeline.createPipeline(device);
		this.#shadowPipeline = new ShadowMapPipeline();
		await this.#shadowPipeline.createPipeline(device);
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
	 *   shadowMaps: Map<string | symbol, GPUTexture>,
	 *   materials: Map<string | symbol, Material>,
	 * }} info
	 */
	setBindGroups(device, info) {
		this.setCubemapRenderSceneBindGroup(device, {
			passEncoder: info.passEncoder,
			probe: info.probe,
			viewMatrix: info.viewMatrix,
			mesh: info.mesh,
		});
		this.setCubemapRenderMaterialBindGroup(device, {
			passEncoder: info.passEncoder,
			mesh: info.mesh,
			materials: info.materials,
			samplers: info.samplers,
			textures: info.textures,
		});
		this.setCubemapRenderLightBindGroup(device, {
			passEncoder: info.passEncoder,
			lights: info.lights,
			samplers: info.samplers,
			shadowMaps: info.shadowMaps,
			textures: info.textures,
		});
	}

	/**
	 * @typedef {{
	 *  passEncoder: GPURenderPassEncoder
	 *  mesh: Mesh,
	 *  probe: Probe,
	 *  viewMatrix: Float32Array,
	 * }} SceneBindGroupInfo
	 * @param {GPUDevice} device
	 * @param {SceneBindGroupInfo} info
	 */
	setCubemapRenderSceneBindGroup(device, info) {
		const viewMatrix = info.viewMatrix;
		const position = info.probe.position;
		const projectionMatrix = Probe.getProjectionMatrix(info.probe.resolution);

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
			cameraPosition: position,
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
			label: "cubemap-render-scene-buffer",
		});

		device.queue.writeBuffer(sceneBuffer, 0, sceneData);

		const sceneBindGroup = device.createBindGroup({
			label: "cubemap-render-scene-bind-group",
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
	setCubemapRenderMaterialBindGroup(device, info) {
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
			label: "irradiance-roughness-buffer",
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
							?.createView({ label: "irradiance-albedo-map" })),
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
					)?.createView({ label: "irradiance-roughness-map" })),
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
	 * }} LightBindGroupInfo
	 * @param {GPUDevice} device
	 * @param {LightBindGroupInfo} info
	 */

	setCubemapRenderLightBindGroup(device, info) {
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
			label: "irradiance-light-buffer",
		});
		device.queue.writeBuffer(lightBuffer, 0, lightData);

		const placeholderView =
			/** @type {GPUTexture} */ (info.shadowMaps.get(PLACEHOLDER_SHADOW_MAP))
				.createView({ label: "placeholder-view" });

		const lightBindGroup = device.createBindGroup({
			label: "irradiance-light-bind-group",
			layout: /** @type {GPUBindGroupLayout} */ (this.#bindGroupLayouts.get(
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
							? shadowMap.createView({
								label: `irradiance-shadow-view-${index}`,
							})
							: placeholderView,
					};
				})),
			],
		});

		info.passEncoder.setBindGroup(2, lightBindGroup);
	}

	renderScene(
		device,
		commandEncoder,
		root,
		attachmentViews,
		info,
		viewMatrix,
		probe,
		i,
	) {
		const mainPassEncoder = commandEncoder.beginRenderPass({
			label: `cubemap-render-render-pass-${i}`,
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
		mainPassEncoder.setPipeline(this.#pipeline);

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
					passEncoder: mainPassEncoder,
					probe,
					viewMatrix,
					mesh: meshContainer.mesh,
					lights: info.lights,
					textures: info.textures,
					samplers: info.samplers,
					materials: info.materials,
					shadowMaps: info.shadowMaps,
				});
				mainPassEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
				mainPassEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
				mainPassEncoder.drawIndexed(meshContainer.mesh.indices.length);
			}
		};

		renderRecursive(root);
		mainPassEncoder.end();
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
	 *  materials: Map<string | symbol, Material>,
	 *  probes: Map<string | symbol, Probe>,
	 *  cameras: Map<string | symbol, Camera>,
	 *  primaryCamera: Camera,
	 *  background: IBackground,
	 *  commandEncoder: GPUCommandEncoder
	 * }} info
	 * @param {{ outTexture: string, outResolution: number }} args 
	 */
	render(device, root, attachmentViews, info, args) {
		const commandEncoder = info.commandEncoder ?? device.createCommandEncoder({
			label: "cubemap-render-command-encoder",
		});

		const sceneCubeMap = device.createTexture({
			size: [args.outResolution, args.outResolution, 6],
			format: "rgba8unorm",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			dimension: "2d"
		});
		const sceneDepthMap = device.createTexture({
			label: "depth-texture",
			size: {
				width: args.outResolution,
				height: args.outResolution,
				depthOrArrayLayers: 1
			},
			format: "depth32float",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		});

		info.textures.set(args.outTexture, sceneCubeMap);

		for (const probe of info.probes.values()) {
			for (let i = 0; i < 6; i++) {
				const viewMatrix = getWorldToCameraMatrixFromDirection(probe.position, CUBEMAP_DIRECTIONS[i]);
				const colorView = sceneCubeMap.createView({ dimension: "2d", baseArrayLayer:  i, arrayLayerCount: 1, label: `cubemap-render-scene-cube-map-${i}` });
				const depthView = sceneDepthMap.createView({ label: "cubemap-render-scene-depth-map" });
				const attachmentViews = { colorView, depthView };

				const innerInfo = { ...info, commandEncoder, 
					primaryCamera: new Camera({ 
						name: `cubemap-render-map-direction-${i}`,
						position: probe.position,
						direction: CUBEMAP_DIRECTIONS[i],
						fieldOfView: Probe.FIELD_OF_VIEW, 
						near: Probe.NEAR, 
						far: Probe.FAR, 
						screenWidth: probe.resolution, 
						screenHeight: probe.resolution,
						isPerspective: true
					})
				};

				this.#shadowPipeline?.render(device, root, attachmentViews, innerInfo);
				this.renderScene(device, commandEncoder, root, attachmentViews, innerInfo, viewMatrix, probe, i);
				this.#backgroundPipeline?.render(device, info.background.mesh, attachmentViews, innerInfo);
			}
		}
		if(!info.commandEncoder){
			device.queue.submit([commandEncoder.finish()]);
		}
	}
}
