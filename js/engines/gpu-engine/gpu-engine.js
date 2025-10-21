//@ts-check

/**
 * @typedef {import("../../entities/pipeline.d.ts").IPipeline} IPipeline
 * @typedef {import("../../entities/pipeline.d.ts").RenderInfo} RenderInfo
 * @typedef {import("../../entities/background.d.ts").IBackground} IBackground
 */
import { uploadMesh, uploadTexture, createColorTexture } from "../../utilities/wgpu-utils.js";
import { BackgroundPipeline } from "./pipelines/background-pipeline.js";
import { ShadowMapPipeline } from "./pipelines/shadow-map-pipeline.js";
import { IrridiancePipeline } from "./pipelines/irridiance-map-pipeline.js";
import { MainPipeline } from "./pipelines/main-pipeline.js";
import { setupExtractDepthBuffer } from "../../utilities/debug-utils.js";
import { Group } from "../../entities/group.js";
import { Mesh } from "../../entities/mesh.js";
import { Light } from "../../entities/light.js";
import { Camera } from "../../entities/camera.js";
import { Material } from "../../entities/material.js";
import { Probe } from "../../entities/probe.js";
import { screenTri } from "../../utilities/mesh-generator.js";
import { 
	PLACEHOLDER_CUBEMAP,
	PLACEHOLDER_SHADOW_MAP,
	PLACEHOLDER_TEXTURE,
	DEPTH_TEXTURE,
	DEFAULT_SAMPLER,
	DEFAULT_NEAREST_SAMPLER,
	DEFAULT_SHADOW_SAMPLER
} from "./constants.js";

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
	/** @type {Map<string | symbol, IPipeline>} */
	#pipelines = new Map();
	#cameras = new Map();
	#lights = new Map();
	#shadowMaps = new Map();
	#textures = new Map();
	#materials = new Map();
	#samplers = new Map();
	#probes = new Map();
	/**
	 * @type {IBackground | undefined}
	 */
	#background = undefined;

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
		this.#textures.set(PLACEHOLDER_CUBEMAP, createColorTexture(this.#device, { label: "placeholder-cubemap", colors: [
			[0,0,0,1],[0,0,0,1],[0,0,0,1],[0,0,0,1],[0,0,0,1],[0,0,0,1]
		] }));

		this.#shadowMaps.set(PLACEHOLDER_SHADOW_MAP, this.#device.createTexture({
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
	initializeLight(light, defaultName) {
		const key = light.name ?? defaultName;
		this.#lights.set(key ?? key, light);

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
	initializeProbe(probe, defaultName){
		const key = probe.name ?? defaultName;
		this.#probes.set(key, probe);
		this.#textures.set(`${key}-cubemap`, this.#device.createTexture({
			size: [probe.resolution, probe.resolution, 6],
			format: "rgba32float",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		}));
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
			} else if (child instanceof Probe){
				this.initializeProbe(child, `${key}-${i}`);
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
	async initializePipelines() {
		const mainPipeline = new MainPipeline();
		await mainPipeline.createPipeline(this.#device);
		this.#pipelines.set("main", mainPipeline);

		const shadowMapPipeline = new ShadowMapPipeline();
		await shadowMapPipeline.createPipeline(this.#device);
		this.#pipelines.set("shadow-map", shadowMapPipeline);

		const backgroundPipeline = new BackgroundPipeline();
		await backgroundPipeline.createPipeline(this.#device);
		this.#pipelines.set("background", backgroundPipeline);

		const irridiancePipeline = new IrridiancePipeline();
		await irridiancePipeline.createPipeline(this.#device);
		this.#pipelines.set("irridiance", irridiancePipeline);
	}
	updateCanvasSize() {
		this.initDepthTexture();
	}
	async preprocess(){
		/** @type {RenderInfo} */
		const renderInfo = {
			meshContainers: this.#meshContainers,
			lights: this.#lights,
			shadowMaps: this.#shadowMaps,
			textures: this.#textures,
			samplers: this.#samplers,
			materials: this.#materials,
			probes: this.#probes,
			cameras: this.#cameras,
			background: this.#background
		};

		const colorView = this.#context.getCurrentTexture().createView({ label: "canvas-view" });
		const depthView = this.#textures.get(DEPTH_TEXTURE).createView({ label: "depth-view" });

		this.#pipelines.get("irridiance")?.render(this.#device, this.#sceneRoot, { colorView, depthView }, renderInfo);
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
	render(_timestamp) {
		/** @type {RenderInfo} */
		const renderInfo = {
			meshContainers: this.#meshContainers,
			lights: this.#lights,
			shadowMaps: this.#shadowMaps,
			textures: this.#textures,
			samplers: this.#samplers,
			materials: this.#materials,
			probes: this.#probes,
			cameras: this.#cameras,
			background: this.#background
		};

		const colorView = this.#context.getCurrentTexture().createView({ label: "canvas-view" });
		const depthView = this.#textures.get(DEPTH_TEXTURE).createView({ label: "depth-view" });

		this.#pipelines.get("shadow-map")?.render(this.#device, this.#sceneRoot, null, renderInfo);
		this.#pipelines.get("main")?.render(this.#device, this.#sceneRoot, { colorView, depthView }, renderInfo);
		this.#pipelines.get("background")?.render(this.#device, this.#background?.mesh, { colorView, depthView }, renderInfo);

		this.#onRender?.();
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