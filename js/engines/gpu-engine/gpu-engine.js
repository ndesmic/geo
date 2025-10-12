//@ts-check
import { packArray, packStruct, roundSmallMagnitudeValues } from "../../utilities/buffer-utils.js";
import { getTranspose, getInverse, trimMatrix, getEmptyMatrix, multiplyMatrix, multiplyMatrixVector, printMatrix } from "../../utilities/vector.js";
import { uploadMesh, uploadTexture, createColorTexture } from "../../utilities/wgpu-utils.js";
import { getLightViewMatrix, getLightProjectionMatrix } from "../../utilities/light-utils.js";
import { getBackgroundPipeline, getMainPipeline, getShadowMapPipeline } from "./pipelines.js";
import { setupExtractDepthBuffer } from "../../utilities/debug-utils.js";
import { Group } from "../../entities/group.js";
import { Mesh } from "../../entities/mesh.js";
import { Light } from "../../entities/light.js";
import { Camera } from "../../entities/camera.js";
import { Material } from "../../entities/material.js";
import { getRange } from "../../utilities/iterator-utils.js";
import { screenTri } from "../../utilities/mesh-generator.js";

export const DEPTH_TEXTURE = Symbol("depth-texture");
export const PLACEHOLDER_TEXTURE = Symbol("placeholder-texture");
export const DEFAULT_SAMPLER = Symbol("default-sampler");
export const DEFAULT_NEAREST_SAMPLER = Symbol("default-nearest-sampler");
export const DEFAULT_SHADOW_SAMPLER = Symbol("default-shadow-sampler");

export class GpuEngine {
	#canvas;
	#context;
	#adapter;
	#device;
	#raf;
	#isRunning = false;
	#isInitialized = false;
	#onRender;
	#meshContainers = new Map();
	#sceneRoot = null;
	#pipelines = new Map();
	#cameras = new Map();
	#lights = new Map();
	#shadowMaps = new Map();
	#textures = new Map();
	#materials = new Map();
	#samplers = new Map();

	/**
	 * @type {{ mesh: Mesh, environmentMap: string, sampler: string | Symbol  } | null}
	 */
	#background = null;

	constructor(options) {
		this.#canvas = options.canvas;
		this.#context = options.canvas.getContext("webgpu");
		this.#onRender = options.onRender;
	}
	async initialize(options) {
		this.#adapter = await navigator.gpu.requestAdapter();
		this.#device = await this.#adapter.requestDevice();
		this.#context.configure({
			device: this.#device,
			format: "rgba8unorm"
		});
		await this.initializeScene(options.scene);

		this.renderDepthBuffer = setupExtractDepthBuffer(this.#device, this.#context, { shouldGammaScale: true });
	}
	async initializeScene(scene) {
		this.initializeSamplers();

		this.initializeGroup(scene.sceneRoot, 0);
		//default textures
		this.initDepthTexture();
		this.#textures.set(PLACEHOLDER_TEXTURE, createColorTexture(this.#device, { label: "placeholder-texture" }));

		this.#shadowMaps.set("placeholder", this.#device.createTexture({
			label: "placeholder-depth-texture",
			size: { width: 1, height: 1, depthOrArrayLayers: 1 },
			format: "depth32float",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		}));

		await this.initializePipelines();
		this.#isInitialized = true;
	}
	initializeCameras(camera) {
		this.#cameras.set(camera.name, camera);
	}
	initializeTexture(texture) {
		if (texture.image ?? texture.images) {
			this.#textures.set(texture.name, uploadTexture(this.#device, texture.image ?? texture.images, { label: `${texture.name}-texture` }));
		} else if (texture.color ?? texture.colors) {
			this.#textures.set(texture.name, createColorTexture(this.#device, { color: texture.color, colors: texture.colors, label: `${texture.name}-texture` }));
		}
	}
	initDepthTexture() {
		this.#textures.set(DEPTH_TEXTURE, this.#device.createTexture({
			label: "depth-texture",
			size: {
				width: this.#canvas.width,
				height: this.#canvas.height,
				depthOrArrayLayers: 1
			},
			format: "depth32float",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		}));
	}
	initializeMaterial(material) {
		this.#materials.set(material.name, material);
	}
	initializeSamplers() {
		this.#samplers.set(DEFAULT_SAMPLER, this.#device.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			magFilter: "linear",
			minFilter: "linear"
		}));
		this.#samplers.set(DEFAULT_NEAREST_SAMPLER, this.#device.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			magFilter: "nearest",
			minFilter: "nearest"
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
	initializeGroup(group, key) {
		for (let i = 0; i < group.children.length; i++) {
			const child = group.children[i];
			if (child instanceof Camera){
				this.initializeCameras(child);
			} else if(child instanceof Mesh) {
				this.initializeMesh(child);
			} else if(child instanceof Light){
				this.initializeLight(child, `${key}-${i}`);
			} else if (child instanceof Group) {
				this.initializeGroup(child, `${key}-${i}`);
			} else if (child instanceof Material){
				this.initializeMaterial(child);
			} else if (child.entity === "texture"){
				this.initializeTexture(child);
			} else if (child.entity === "background"){
				this.initializeBackground(child);
			} else {
				throw new Error(`Don't know what this entity is ${JSON.stringify(child)}`)
			}
		}
		this.#sceneRoot = group;
	}
	initializeLight(light, key) {
		this.#lights.set(key, light)

		if(light.castsShadow){
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
			const pipeline = await getBackgroundPipeline(this.#device);

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
	initializeBackground(background) {
		if (background) {
			const mesh = new Mesh(screenTri()).useAttributes(["positions"]);
			const { vertexBuffer, indexBuffer } = uploadMesh(this.#device, mesh, { label: `background-tri-mesh` });
			this.#meshContainers.set(mesh, { mesh, vertexBuffer, indexBuffer });
			this.#background = {
				mesh,
				environmentMap: background.environmentMap,
				sampler: background.sampler === "nearest" ? DEFAULT_NEAREST_SAMPLER : DEFAULT_SAMPLER
			};
		}
	}
	updateCanvasSize() {
		this.initDepthTexture();
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
			viewMatrix: camera.viewMatrix, //TODO: probably needs transpose
			projectionMatrix: camera.projectionMatrix, //TODO: probably needs transpose
			modelMatrix: getTranspose(mesh.modelMatrix, [4, 4]), //change to col major
			worldMatrix: getTranspose(mesh.worldMatrix, [4, 4]), //change to col major
			normalMatrix: getInverse(
					trimMatrix(
						multiplyMatrix(mesh.worldMatrix, [4, 4], mesh.modelMatrix, [4, 4]),
						[4, 4],
						[3, 3]
					),
					[3, 3]
				), //also col major but needs a transpose that cancels out
			cameraPosition: camera.position //TODO: probably needs a transform...
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
				const combinedModelMatrix = multiplyMatrix(value.worldMatrix, [4,4], value.modelMatrix, [4,4]);

				return {
					typeInt: value.typeInt,
					position: multiplyMatrixVector(combinedModelMatrix, value.position, 4),
					direction: multiplyMatrixVector(combinedModelMatrix, value.direction, 4),
					color: value.color,
					shadowMap,
					projectionMatrix: shadowMap ? getLightProjectionMatrix(shadowMapAspectRatio) : getEmptyMatrix([4, 4]), //probably needs transpose
					viewMatrix: shadowMap ? getLightViewMatrix(value.direction) : getEmptyMatrix([4, 4]), //probably needs transpose
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
			], { minSize: 64 });

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
	setBackgroundBindGroups(passEncoder, bindGroupLayouts, camera) {
		this.setBackgroundSceneBindGroup(passEncoder, bindGroupLayouts, camera);
		this.setBackgroundTextureBindGroup(passEncoder, bindGroupLayouts);
	}
	setBackgroundSceneBindGroup(passEncoder, bindGroupLayouts, camera) {
		const viewRotationOnly = camera.viewMatrix.slice();
		viewRotationOnly[12] = 0;
		viewRotationOnly[13] = 0;
		viewRotationOnly[14] = 0;

		const inverseViewMatrix = getInverse(viewRotationOnly, [4, 4])
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
		if(!this.#background) throw new Error("Tried to set a background when none defined.");
		const textureBindGroup = this.#device.createBindGroup({
			layout: bindGroupLayouts.get("materials"),
			entries: [
				{ binding: 0, resource: this.#samplers.get(this.#background.sampler) },
				{ binding: 1, resource: this.#textures.get(this.#background.environmentMap).createView({ dimension: "cube" }) },
			]
		});
		passEncoder.setBindGroup(1, textureBindGroup);
	}
	render(_timestamp) {
		this.renderShadowMaps();
		//this.renderDepthBuffer(this.#shadowMaps.get("light1").createView());
		this.renderScene();
		this.#onRender?.();
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
				} else if(meshOrGroup instanceof Mesh){
					const shadowMap = this.#shadowMaps.get(key);
					const meshContainer = this.#meshContainers.get(meshOrGroup);

					shadowMapPipelineContainer.bindMethod(passEncoder, shadowMapPipelineContainer.bindGroupLayouts, light, shadowMap, meshOrGroup);
					passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
					passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
					passEncoder.drawIndexed(meshContainer.mesh.indices.length);
				}
			}

			renderRecursive(this.#sceneRoot);

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

		const depthView = this.#textures.get(DEPTH_TEXTURE).createView({ label: "depth-texture-view"});
		const colorView = this.#context.getCurrentTexture().createView({ label: "color-texture-view"});

		{
			const passEncoder = commandEncoder.beginRenderPass({
				label: `main-render-pass`,
				colorAttachments: [
					{
						storeOp: "store",
						loadOp: "clear",
						clearValue: { r: 0.1, g: 0.3, b: 0.8, a: 1.0 },
						view: colorView
					}
				],
				depthStencilAttachment: {
					view: depthView,
					depthClearValue: 1.0,
					depthStoreOp: "store",
					depthLoadOp: "clear"
				}
			});

			const pipelineContainer = this.#pipelines.get("main");
			passEncoder.setPipeline(pipelineContainer.pipeline);

			const renderRecursive = (meshOrGroup) => {
				if (meshOrGroup instanceof Group) {
					for (const child of meshOrGroup.children) {
						renderRecursive(child)
					}
				} else if(meshOrGroup instanceof Mesh) {
					const meshContainer = this.#meshContainers.get(meshOrGroup);

					pipelineContainer.bindMethod(passEncoder, pipelineContainer.bindGroupLayouts, camera, meshContainer.mesh, this.#lights, this.#shadowMaps);
					passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
					passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
					passEncoder.drawIndexed(meshContainer.mesh.indices.length);
				}
			}

			renderRecursive(this.#sceneRoot);

			passEncoder.end();
		}
		if(this.#background){
			const passEncoder = commandEncoder.beginRenderPass({
				label: `background-render-pass`,
				colorAttachments: [
					{
						storeOp: "store",
						loadOp: "load",
						view: colorView
					}
				],
				depthStencilAttachment: {
					view: depthView,
					depthStoreOp: "store",
					depthLoadOp: "load"
				}
			});

			const pipelineContainer = this.#pipelines.get("background");
			passEncoder.setPipeline(pipelineContainer.pipeline);
				
			const meshContainer = this.#meshContainers.get(this.#background.mesh);

			pipelineContainer.bindMethod(passEncoder, pipelineContainer.bindGroupLayouts, camera, meshContainer.mesh, this.#lights, this.#shadowMaps);
			passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
			passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
			passEncoder.drawIndexed(meshContainer.mesh.indices.length);

			passEncoder.end();
		}

		this.#device.queue.submit([commandEncoder.finish()]);

		//this.renderDepthBuffer(depthView);
	}

	get cameras() {
		return this.#cameras;
	}
	get isRunning() {
		return this.#isRunning;
	}
	get isInitialized() {
		return this.#isInitialized;
	}
}