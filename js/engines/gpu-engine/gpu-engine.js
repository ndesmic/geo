//@ts-check
import { uploadMesh, uploadTexture, createColorTexture } from "../../utilities/wgpu-utils.js";
import { getBackgroundPipelineRegistration } from "./pipelines/background-pipeline.js";
import { getShadowMapPipelineRegistration } from "./pipelines/shadow-map-pipeline.js";
import { getIrridiancePipelineRegistration } from "./pipelines/irridiance-map-pipeline.js";
import { getMainPipelineRegistration } from "./pipelines/main-pipeline.js";
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
	#pipelines = new Map();
	#cameras = new Map();
	#lights = new Map();
	#shadowMaps = new Map();
	#textures = new Map();
	#materials = new Map();
	#samplers = new Map();
	#probes = new Map();

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
		this.#pipelines.set("main", await getMainPipelineRegistration(this.#device));
		this.#pipelines.set("shadow-map", await getShadowMapPipelineRegistration(this.#device));
		this.#pipelines.set("background", await getBackgroundPipelineRegistration(this.#device));
		//this.#pipelines.set("irridiance", await getIrridiancePipelineRegistration(this.#device));
	}
	updateCanvasSize() {
		this.initDepthTexture();
	}
	async preprocess(){
		
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
		this.renderShadowMaps();
		//this.renderDepthBuffer?.(this.#shadowMaps.get("light1").createView());
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

					shadowMapPipelineContainer.bindMethod(this.#device, {
						passEncoder,
						bindGroupLayouts: shadowMapPipelineContainer.bindGroupLayouts, 
						light, 
						shadowMap, 
						mesh: meshOrGroup
					});
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

					pipelineContainer.bindMethod(this.#device, { passEncoder, bindGroupLayouts: pipelineContainer.bindGroupLayouts, camera, mesh: meshContainer.mesh, lights: this.#lights, shadowMaps: this.#shadowMaps, textures: this.#textures, samplers: this.#samplers, materials: this.#materials });
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

			pipelineContainer.bindMethod(this.#device, { 
				passEncoder, 
				bindGroupLayouts: pipelineContainer.bindGroupLayouts, 
				camera,
				samplers: this.#samplers,
				textures: this.#textures,
				background: this.#background
			});
			passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
			passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
			passEncoder.drawIndexed(meshContainer.mesh.indices.length);

			passEncoder.end();
		}

		this.#device.queue.submit([commandEncoder.finish()]);
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