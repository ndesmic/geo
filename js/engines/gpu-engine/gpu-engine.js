import { packArray, packStruct } from "../../utilities/buffer-utils.js";
import { getTranspose, getInverse, trimMatrix, getEmptyMatrix, multiplyMatrix } from "../../utilities/vector.js";
import { uploadMesh, uploadShader, uploadTexture, createColorTexture } from "../../utilities/wgpu-utils.js";
import { getLightViewMatrix, getLightProjectionMatrix } from "../../utilities/light-utils.js";
import { getMainPipeline, getShadowMapPipeline } from "./pipelines.js";
import { setupExtractDepthBuffer } from "../../utilities/debug-utils.js";
import { Group } from "../../entities/group.js";
import { Mesh } from "../../entities/mesh.js";
import { getRange } from "../../utilities/iterator-utils.js";

export const DEPTH_TEXTURE = Symbol("depth-texture");
export const PLACEHOLDER_TEXTURE = Symbol("placeholder-texture");
export const DEFAULT_SAMPLER = Symbol("default-sampler");
export const DEFAULT_SHADOW_SAMPLER = Symbol("default-shadow-sampler");

export class GpuEngine {
	#canvas;
	#context;
	#adapter;
	#device;
	#raf;
	#isRunning = false;
	#meshContainers = new Map();
	#groups = new Map();
	#pipelines = new Map();
	#cameras = new Map();
	#lights = new Map();
	#shadowMaps = new Map();
	#textures = new Map();
	#materials = new Map();
	#samplers = new Map();
	#pipelineMesh = new Map();

	#extractDepthBuffer;

	constructor(options) {
		this.#canvas = options.canvas;
		this.#context = options.canvas.getContext("webgpu");
	}
	async initialize(options) {
		this.#adapter = await navigator.gpu.requestAdapter();
		this.#device = await this.#adapter.requestDevice();
		this.#context.configure({
			device: this.#device,
			format: "rgba8unorm"
		});
		await this.initializeScene(options.scene);

		this.renderDepthBuffer = setupExtractDepthBuffer(this.#device, this.#context);
	}
	async initializeScene(scene) {
		this.initializeCameras(scene.cameras);
		await this.initializeTextures(scene.textures);
		this.initializeMaterials(scene.materials);
		this.initializeSamplers();
		await this.initializeMeshes(scene.meshes);
		this.initializeGroups(scene.groups);
		this.initializeLights(scene.lights);
		await this.initializePipelines();
		this.initializePipelineMeshes(scene.pipelineMeshes);
	}
	initializeCameras(cameras) {
		for (const [key, camera] of Object.entries(cameras)) {
			this.#cameras.set(key, camera);
		}
	}
	async initializeTextures(textures) {
		for (const [key, texture] of Object.entries(textures)) {
			if (texture.image ?? texture.images) {
				this.#textures.set(key, await uploadTexture(this.#device, texture.image ?? texture.images, { label: `${key}-texture` }));
			} else if (texture.color) {
				this.#textures.set(key, createColorTexture(this.#device, { color: texture.color, label: `${key}-texture` }));
			}
		}

		//default textures
		this.#textures.set(DEPTH_TEXTURE, this.#device.createTexture({
			label: "depth-texture",
			size: {
				width: this.#canvas.width,
				height: this.#canvas.height,
				depthOrArrayLayers: 1
			},
			format: "depth32float",
			usage: GPUTextureUsage.RENDER_ATTACHMENT
		}));

		this.#textures.set(PLACEHOLDER_TEXTURE, createColorTexture(this.#device, { label: "placeholder-texture" }));
	}
	initializeMaterials(materials) {
		for (const [key, material] of Object.entries(materials)) {
			this.#materials.set(key, material);
		}
	}
	initializeSamplers() {
		this.#samplers.set(DEFAULT_SAMPLER, this.#device.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			magFilter: "linear",
			minFilter: "linear"
		}));
		this.#samplers.set(DEFAULT_SHADOW_SAMPLER, this.#device.createSampler({
			label: "shadow-map-default-sampler",
			compare: "less",
			magFilter: "linear",
			minFilter: "linear"
		}));
		this.#samplers.set("shadow-map-debug", this.#device.createSampler({
			label: "shadow-map-debug-sampler",
			compare: undefined,
		}));
	}
	initializeMesh(mesh, key) {
		const { vertexBuffer, indexBuffer } = uploadMesh(this.#device, mesh, { label: `${key}-mesh` });
		this.#meshContainers.set(mesh, { mesh, vertexBuffer, indexBuffer });
	}
	initializeMeshes(meshes) {
		for (const [key, mesh] of Object.entries(meshes)) {
			this.initializeMesh(mesh, key);
		}
	}
	initializeGroups(groups) {
		for (const [key, group] of Object.entries(groups)) {
			this.initializeGroup(group, key);
		}
	}
	initializeGroup(group, key) {
		for (const child of group.children) {
			if (child instanceof Mesh) {
				this.initializeMesh(child);
			} else if (child instanceof Group) {
				this.initializeGroup(child);
			}
		}
		this.#groups.set(key, group);
	}
	initializeLights(lights) {
		for (const [key, light] of Object.entries(lights)) {
			this.#lights.set(key, light)
		}

		for (const key of this.#lights.keys()) {
			this.#shadowMaps.set(key, this.#device.createTexture({
				label: `shadow-map-${key}`,
				size: {
					width: 2048,
					height: 2048,
					depthOrArrayLayers: 1
				},
				format: "depth32float",
				usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
			}));
		}
		this.#shadowMaps.set("placeholder", this.#device.createTexture({
			label: "placeholder-depth-texture",
			size: { width: 1, height: 1, depthOrArrayLayers: 1 },
			format: "depth32float",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		}));
	}
	async initializePipelines() {
		{
			const pipeline = await getMainPipeline(this.#device);

			this.#pipelines.set("main", {
				pipeline,
				bindGroupLayouts: new Map([
					["scene", pipeline.getBindGroupLayout(0)],
					["materials", pipeline.getBindGroupLayout(1)],
					["lights", pipeline.getBindGroupLayout(2)]
				]),
				bindMethod: this.setMainBindGroups.bind(this)
			});
		}
		{
			const pipeline = await getShadowMapPipeline(this.#device);

			this.#pipelines.set("shadow-map", {
				pipeline,
				bindGroupLayouts: new Map([
					["scene", pipeline.getBindGroupLayout(0)],
				]),
				bindMethod: this.setShadowMapBindGroups.bind(this)
			});
		}
		{
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

			const shaderModule = await uploadShader(this.#device, "./shaders/space-background.wgsl");

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

			const pipeline = this.#device.createRenderPipeline(pipelineDescriptor);

			this.#pipelines.set("background", {
				pipeline: pipeline,
				bindGroupLayouts: new Map([
					["scene", pipeline.getBindGroupLayout(0)],
					["materials", pipeline.getBindGroupLayout(1)]
				]),
				bindMethod: this.setBackgroundBindGroups.bind(this)
			});
		}
	}
	initializePipelineMeshes(pipelineMeshes) {
		for (const { pipeline, meshKey } of pipelineMeshes) {
			if (this.#pipelineMesh.has(pipeline)) {
				this.#pipelineMesh.get(pipeline).push(meshKey);
			} else {
				this.#pipelineMesh.set(pipeline, [meshKey]);
			}
		}
	}
	start() {
		this.#isRunning = true;
		this.renderLoop();
	}
	stop() {
		cancelAnimationFrame(this.#raf);
		this.#isRunning = false;
	}
	renderLoop() {
		this.#raf = requestAnimationFrame((timestamp) => {
			this.render(timestamp);
			this.renderLoop();
		});
	}

	setMainBindGroups(passEncoder, bindGroupLayouts, camera, mesh, lights, shadowMaps) {
		this.setMainSceneBindGroup(passEncoder, bindGroupLayouts, camera, mesh);
		this.setMainMaterialBindGroup(passEncoder, bindGroupLayouts, mesh);
		this.setMainLightBindGroup(passEncoder, bindGroupLayouts, lights, shadowMaps);
	}
	setMainSceneBindGroup(passEncoder, bindGroupLayouts, camera, mesh) {
		const scene = {
			viewMatrix: camera.getViewMatrix(),
			projectionMatrix: camera.getProjectionMatrix(),
			modelMatrix: getTranspose(mesh.modelMatrix, [4, 4]), //change to col major
			worldMatrix: mesh.worldMatrix,
			normalMatrix: getTranspose(
				getInverse(
					trimMatrix(
						multiplyMatrix(mesh.worldMatrix, [4, 4], mesh.modelMatrix, [4, 4]),
						[4, 4],
						[3, 3]
					),
					[3, 3]
				),
				[3, 3]),
			cameraPosition: camera.getPosition()
		};

		const sceneData = packStruct(scene, [
			["viewMatrix", "mat4x4f32"],
			["projectionMatrix", "mat4x4f32"],
			["modelMatrix", "mat4x4f32"],
			["worldMatrix", "mat4x4f32"],
			["normalMatrix", "mat3x3f32"],
			["cameraPosition", "vec3f32"]
		]);

		const sceneBuffer = this.#device.createBuffer({
			size: sceneData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "main-scene-buffer"
		});

		this.#device.queue.writeBuffer(sceneBuffer, 0, sceneData);

		const sceneBindGroup = this.#device.createBindGroup({
			label: "main-scene-bind-group",
			layout: bindGroupLayouts.get("scene"),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: sceneBuffer,
						offset: 0,
						size: sceneData.byteLength
					}
				}
			]
		});

		passEncoder.setBindGroup(0, sceneBindGroup);
	}
	setMainMaterialBindGroup(passEncoder, bindGroupLayouts, mesh) {
		const material = this.#materials.get(mesh.material);

		//TODO: pack the class directly
		const materialModel = {
			useRoughnessMap: material.useRoughnessMap ? 1 : 0, //0 => constant, 1 => map
			roughness: material.roughness,
			metalness: material.metalness,
			baseReflectance: material.baseReflectance
		};
		const materialData = packStruct(materialModel, [
			["useRoughnessMap", "u32"],
			["roughness", "f32"],
			["metalness", "f32"],
			["baseReflectance", "vec3f32"]
		]);

		const materialBuffer = this.#device.createBuffer({
			size: materialData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "main-roughness-buffer"
		});

		this.#device.queue.writeBuffer(materialBuffer, 0, materialData);

		const materialBindGroup = this.#device.createBindGroup({
			layout: bindGroupLayouts.get("materials"),
			entries: [
				{ binding: 0, resource: this.#samplers.get(material.albedoSampler) },
				{ binding: 1, resource: this.#textures.get(material.albedoMap).createView() },
				{
					binding: 2,
					resource: {
						buffer: materialBuffer,
						offset: 0,
						size: materialData.byteLength
					}
				},
				{ binding: 3, resource: this.#samplers.get(material.roughnessSampler) },
				{ binding: 4, resource: this.#textures.get(material.roughnessMap).createView() }
			]
		});
		passEncoder.setBindGroup(1, materialBindGroup);
	}
	setMainLightBindGroup(passEncoder, bindGroupLayouts, lights, shadowMaps) {
		let shadowMapIndex = 0;
		const shadowMappedLights = lights
			.entries()
			.map(([key, value]) => {
				const shadowMap = shadowMaps.get(key);
				const shadowMapAspectRatio = shadowMap.width / shadowMap.height;

				return {
					typeInt: value.typeInt,
					position: value.position,
					direction: value.direction,
					color: value.color,
					shadowMap,
					projectionMatrix: shadowMap ? getLightProjectionMatrix(shadowMapAspectRatio) : getEmptyMatrix([4, 4]),
					viewMatrix: shadowMap ? getLightViewMatrix(value.direction) : getEmptyMatrix([4, 4]),
					castsShadow: value.castsShadow ? 1 : 0,
					shadowMapIndex: (value.castsShadow && shadowMap) ? shadowMapIndex++ : -1
				};
			}).toArray();

		const shadowMapsToBind = shadowMappedLights
			.filter(lightData => lightData.shadowMapIndex > -1)
			.map(lightData => lightData.shadowMap);

		const lightData = packArray(shadowMappedLights,
			[
				["typeInt", "u32"],
				["position", "vec3f32"],
				["direction", "vec3f32"],
				["color", "vec4f32"],
				["projectionMatrix", "mat4x4f32"],
				["viewMatrix", "mat4x4f32"],
				["castsShadow", "u32"],
				["shadowMapIndex", "i32"]
			]
			, 64);

		const lightBuffer = this.#device.createBuffer({
			size: lightData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
			label: "main-light-buffer"
		});
		this.#device.queue.writeBuffer(lightBuffer, 0, lightData);

		const lightCountBuffer = this.#device.createBuffer({
			size: 4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "main-light-count-buffer"
		});
		this.#device.queue.writeBuffer(lightCountBuffer, 0, new Int32Array([lights.size]));

		const placeholderView = shadowMaps.get("placeholder").createView({ label: "placeholder-view" });

		const lightBindGroup = this.#device.createBindGroup({
			label: "main-light-bind-group",
			layout: bindGroupLayouts.get("lights"),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: lightBuffer,
						offset: 0,
						size: lightData.byteLength
					}
				},
				{
					binding: 1,
					resource: {
						buffer: lightCountBuffer,
						offset: 0,
						size: 4
					}
				},
				{
					binding: 2,
					resource: this.#samplers.get(DEFAULT_SHADOW_SAMPLER)
				},
				...(getRange({ end: 3 }).map((index) => {
					const shadowMap = shadowMapsToBind[index];
					return {
						binding: index + 3,
						resource: shadowMap ? shadowMap.createView({ label: `shadow-view-${index}` }) : placeholderView
					};
				})),
				{
					binding: 7,
					resource: this.#samplers.get("shadow-map-debug")
				}
			]
		});

		passEncoder.setBindGroup(2, lightBindGroup);
	}
	setShadowMapBindGroups(passEncoder, bindGroupLayouts, light, shadowMap, mesh) {
		const shadowMapAspectRatio = shadowMap.width / shadowMap.height;

		const viewMatrix = getLightViewMatrix(light.direction);
		const projectionMatrix = getLightProjectionMatrix(shadowMapAspectRatio);

		const scene = {
			viewMatrix,
			projectionMatrix,
			modelMatrix: getTranspose(mesh.modelMatrix, [4, 4]), //change to col major?
			worldMatrix: mesh.worldMatrix,
			normalMatrix: getTranspose(
				getInverse(
					trimMatrix(
						multiplyMatrix(mesh.worldMatrix, [4, 4], mesh.modelMatrix, [4, 4]),
						[4, 4],
						[3, 3]
					),
					[3, 3]
				),
				[3, 3])
		};

		const sceneData = packStruct(scene, [
			["viewMatrix", "mat4x4f32"],
			["projectionMatrix", "mat4x4f32"],
			["modelMatrix", "mat4x4f32"],
			["worldMatrix", "mat4x4f32"],
			["normalMatrix", "mat3x3f32"]
		]);

		const sceneBuffer = this.#device.createBuffer({
			size: sceneData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "shadow-map-scene-buffer"
		});

		this.#device.queue.writeBuffer(sceneBuffer, 0, sceneData);

		const sceneBindGroup = this.#device.createBindGroup({
			label: "shadow-map-scene-bind-group",
			layout: bindGroupLayouts.get("scene"),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: sceneBuffer,
						offset: 0,
						size: sceneData.byteLength
					}
				}
			]
		});

		passEncoder.setBindGroup(0, sceneBindGroup);
	}
	setBackgroundBindGroups(passEncoder, bindGroupLayouts, camera, mesh) {
		this.setBackgroundSceneBindGroup(passEncoder, bindGroupLayouts, camera, mesh);
		this.setBackgroundTextureBindGroup(passEncoder, bindGroupLayouts);
	}
	setBackgroundSceneBindGroup(passEncoder, bindGroupLayouts, camera, mesh) {
		const inverseViewMatrix = getInverse(camera.getViewMatrix(), [4, 4]);

		const sceneBuffer = this.#device.createBuffer({
			size: inverseViewMatrix.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "background-scene-buffer"
		});
		this.#device.queue.writeBuffer(sceneBuffer, 0, inverseViewMatrix);

		const sceneBindGroup = this.#device.createBindGroup({
			label: "background-scene-bind-group",
			layout: bindGroupLayouts.get("scene"),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: sceneBuffer,
						offset: 0,
						size: inverseViewMatrix.byteLength
					}
				}
			]
		});

		passEncoder.setBindGroup(0, sceneBindGroup);
	}
	setBackgroundTextureBindGroup(passEncoder, bindGroupLayouts) {
		const textureBindGroup = this.#device.createBindGroup({
			layout: bindGroupLayouts.get("material"),
			entries: [
				{ binding: 0, resource: this.#samplers.get("main") },
				{ binding: 1, resource: this.#textures.get("space").createView({ dimension: "cube" }) },
			]
		});
		passEncoder.setBindGroup(1, textureBindGroup);
	}
	render() {
		this.renderShadowMaps();
		//this.renderDepthBuffer(this.#shadowMaps.get("light1").createView());
		this.renderScene();
	}

	renderShadowMaps() {
		const commandEncoder = this.#device.createCommandEncoder({
			label: "shadow-map-command-encoder"
		});
		const shadowMapPipelineContainer = this.#pipelines.get("shadow-map");

		for (const [key, light] of this.#lights) {
			let isFirstPass = true;
			const passEncoder = commandEncoder.beginRenderPass({
				label: `shadow-map-render-pass`,
				colorAttachments: [],
				depthStencilAttachment: {
					view: this.#shadowMaps.get(key).createView(),
					depthClearValue: 1.0,
					depthStoreOp: "store",
					depthLoadOp: isFirstPass ? "clear" : "load",
				}
			});
			passEncoder.setPipeline(shadowMapPipelineContainer.pipeline);

			const renderRecursive = (meshOrGroup) => {
				if (meshOrGroup instanceof Group) {
					for (const child of meshOrGroup.children) {
						renderRecursive(child)
					}
				} else {
					const shadowMap = this.#shadowMaps.get(key);
					const meshContainer = this.#meshContainers.get(meshOrGroup);

					shadowMapPipelineContainer.bindMethod(passEncoder, shadowMapPipelineContainer.bindGroupLayouts, light, shadowMap, meshOrGroup);
					passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
					passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
					passEncoder.drawIndexed(meshContainer.mesh.indices.length);
				}
			}
			for (const meshName of this.#pipelineMesh.get("main")) {
				const group = this.#groups.get(meshName);
				renderRecursive(group);
			}

			passEncoder.end();
			isFirstPass = false;
		}

		this.#device.queue.submit([commandEncoder.finish()]);
	}
	renderScene() {
		const commandEncoder = this.#device.createCommandEncoder({
			label: "main-command-encoder"
		});

		const camera = this.#cameras.get("main");
		let isFirstPass = true;

		const depthView = this.#textures.get(DEPTH_TEXTURE).createView();

		for (const [pipelineName, meshNames] of this.#pipelineMesh.entries()) {
			const passEncoder = commandEncoder.beginRenderPass({
				label: `${pipelineName}-render-pass`,
				colorAttachments: [
					{
						storeOp: "store",
						loadOp: isFirstPass ? "clear" : "load",
						clearValue: { r: 0.1, g: 0.3, b: 0.8, a: 1.0 },
						view: this.#context.getCurrentTexture().createView()
					}
				],
				depthStencilAttachment: {
					view: depthView,
					depthClearValue: 1.0,
					depthStoreOp: "store",
					depthLoadOp: isFirstPass ? "clear" : "load"
				}
			});

			const pipelineContainer = this.#pipelines.get(pipelineName);

			passEncoder.setPipeline(pipelineContainer.pipeline);

			const renderRecursive = (meshOrGroup) => {
				if (meshOrGroup instanceof Group) {
					for (const child of meshOrGroup.children) {
						renderRecursive(child)
					}
				} else {
					const meshContainer = this.#meshContainers.get(meshOrGroup);

					pipelineContainer.bindMethod(passEncoder, pipelineContainer.bindGroupLayouts, camera, meshContainer.mesh, this.#lights, this.#shadowMaps);
					passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
					passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
					passEncoder.drawIndexed(meshContainer.mesh.indices.length);
				}
			}

			for (const meshName of meshNames) {
				const group = this.#groups.get(meshName);
				renderRecursive(group);
			}

			passEncoder.end();
			isFirstPass = false;
		}

		this.#device.queue.submit([commandEncoder.finish()]);
	}

	get cameras() {
		return this.#cameras;
	}
	get isRunning() {
		return this.#isRunning;
	}
}