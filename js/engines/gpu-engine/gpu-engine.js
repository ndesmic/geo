import { Camera } from "../../entities/camera.js";
import { Mesh } from "../../entities/mesh.js";
import { surfaceGrid } from "../../utilities/mesh-generator.js";
import { packArray, packLights, packStruct } from "../../utilities/buffer-utils.js";
import { sphericalToCartesian } from "../../utilities/math-helpers.js";
import { getTranspose, getInverse, trimMatrix, getEmptyMatrix } from "../../utilities/vector.js";
import { uploadMesh, uploadShader, uploadTexture, createColorTexture } from "../../utilities/wgpu-utils.js";
import { fetchObjMesh } from "../../utilities/data-utils.js";
import { Material } from "../../entities/material.js";
import { ShadowMappedLight } from "../../entities/shadow-mapped-light.js";
import { getMainPipeline, getShadowMapPipeline } from "./pipelines.js";
import { setupExtractDepthBuffer } from "../../utilities/debug-utils.js";

export class GpuEngine {
	#canvas;
	#context;
	#adapter;
	#device;
	#raf;
	#isRunning = false;
	#meshContainers = new Map();
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
	async initialize(){
		this.#adapter = await navigator.gpu.requestAdapter();
		this.#device = await this.#adapter.requestDevice();
		this.#context.configure({
			device: this.#device,
			format: "rgba8unorm"
		});

		this.initializeCameras();
		await this.initializeTextures();
		this.initializeMaterials();
		this.initializeSamplers();
		await this.initializeMeshes();
		this.initializeLights();
		await this.initializePipelines();
		this.initializePipelineMesh();

		this.renderDepthBuffer = setupExtractDepthBuffer(this.#device, this.#context);
	}
	initializeCameras(){
		this.#cameras.set("main", new Camera({
			position: [0.5, 0.2, -0.5],
			screenHeight: this.#canvas.height,
			screenWidth: this.#canvas.width,
			fieldOfView: 90,
			near: 0.01,
			far: 5,
			isPerspective: true
		}))
	}
	async initializeMeshes(){
		{
			const mesh = await fetchObjMesh("./objs/teapot.obj", { reverseWinding: true });
			mesh.useAttributes(["positions", "uvs", "normals"])
				.normalizePositions()
				.resizeUvs(2)
				//.rotate({ x : -Math.PI / 2 })
				//.bakeTransforms()
				.setMaterial("gold");
			const { vertexBuffer, indexBuffer } = await uploadMesh(this.#device, mesh, { label: "teapot" });
			this.#meshContainers.set("teapot", { vertexBuffer, indexBuffer, mesh });
		}
		{
			const mesh = new Mesh(surfaceGrid(2,2))
				.useAttributes(["positions", "uvs", "normals"])
				.translate({ y: -0.25 })
				.bakeTransforms()
				.setMaterial("red-fabric")
			const { vertexBuffer, indexBuffer } = uploadMesh(this.#device, mesh, {
				label: "floor-mesh"
			});
			this.#meshContainers.set("floor", { vertexBuffer, indexBuffer, mesh });
		}
		// {
		// 	const mesh = new Mesh(screenTri());
		// 	const { vertexBuffer, indexBuffer } = uploadMesh(this.#device, mesh, { positionSize: 2, label: "background-mesh" });
		// 	this.#meshes.set("background", { vertexBuffer, indexBuffer, mesh });
		// }
	}
	initializeLights(){
		this.#lights.set("light", new ShadowMappedLight({
			type: "directional",
			//position: sphericalToCartesian([ Math.PI / 4, 0, 2]),
			color: [2.0,2.0,2.0,1],
			direction: [-1, -1, 0] 
		}));
		// this.#lights.set("light2", new Light({
		// 	type: "point",
		// 	position: sphericalToCartesian([Math.PI / 4, Math.PI, 2]),
		// 	color: [1,0,0,1]
		// }));

		for(const key of this.#lights.keys()){
			this.#shadowMaps.set(key, this.#device.createTexture({
				label: "depth-texture",
				size: {
					width: 4096,
					height: 4096,
					depthOrArrayLayers: 1
				},
				format: "depth32float",
				usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
			}));
		}
		this.#shadowMaps.set("dummy", this.#device.createTexture({
			label: "dummy-depth-texture",
			size: { width: 1, height: 1, depthOrArrayLayers: 1 },
			format: "depth32float",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		}));
	}
	async initializeTextures(){
		this.#textures.set("marble", await uploadTexture(this.#device, "./img/marble-white/marble-white-base.jpg"));
		this.#textures.set("marble-roughness", await uploadTexture(this.#device, "./img/marble-white/marble-white-roughness.jpg"));
		this.#textures.set("red-fabric", await uploadTexture(this.#device, "./img/red-fabric/red-fabric-base.jpg"));
		this.#textures.set("red-fabric-roughness", await uploadTexture(this.#device, "./img/red-fabric/red-fabric-roughness.jpg"));
		this.#textures.set("gold", createColorTexture(this.#device, { color: [0, 0, 0, 1], label: "gold-texture" }));
		// this.#textures.set("space", await uploadTexture(this.#device, [
		// 	"./img/space_right.png",
		// 	"./img/space_left.png",
		// 	"./img/space_top.png",
		// 	"./img/space_bottom.png",
		// 	"./img/space_front.png",
		// 	"./img/space_back.png"
		// ]));

		this.#textures.set("depth", this.#device.createTexture({
			label: "depth-texture",
			size: {
				width: this.#canvas.width,
				height: this.#canvas.height,
				depthOrArrayLayers: 1
			},
			format: "depth32float",
			usage: GPUTextureUsage.RENDER_ATTACHMENT
		}));

		this.#textures.set("dummy", createColorTexture(this.#device, { label: "dummy-texture" }));
	}
	initializeSamplers(){
		this.#samplers.set("default", this.#device.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			magFilter: "linear",
			minFilter: "linear"
		}));
		this.#samplers.set("shadow-map-default", this.#device.createSampler({
			label: "shadow-map-default-sampler",
			compare: "less",
			magFilter: "linear",
			minFilter: "linear"
		}));
	}
	initializeMaterials(){
		this.#materials.set("marble", new Material({
			texture: "marble",
			useSpecularMap: true,
			specularMap: "marble-roughness"
		}));
		this.#materials.set("red-fabric", new Material({
			texture: "red-fabric",
			useSpecularMap: true,
			specularMap: "red-fabric-roughness"
		}));
		this.#materials.set("gold", new Material({
			texture: "gold",
			useSpecularMap: false,
			roughness: 0.2,
			metalness: 1,
			baseReflectance: [1.059, 0.773, 0.307]
		}))
	}
	async initializePipelines(){
		{
			const pipeline = await getMainPipeline(this.#device);
			
			this.#pipelines.set("main", {
				pipeline,
				bindGroupLayouts: new Map([
					["scene", pipeline.getBindGroupLayout(0)],
					["materials", pipeline.getBindGroupLayout(1)],
					["lights", pipeline.getBindGroupLayout(2)],
					["shadows", pipeline.getBindGroupLayout(3)]
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
	initializePipelineMesh(){
		this.#pipelineMesh.set("main", ["teapot", "floor"]);
		//this.#pipelineMesh.set("background", ["background"]);
	}
	start() {
		this.#isRunning = true;
		this.renderLoop();
	}
	stop(){
		cancelAnimationFrame(this.#raf);
		this.#isRunning = false;
	}
	renderLoop() {
		this.#raf = requestAnimationFrame((timestamp) => {
			this.render(timestamp);
			this.renderLoop();
		});
	}

	setMainBindGroups(passEncoder, bindGroupLayouts, camera, mesh, lights, shadowMaps){
		this.setMainSceneBindGroup(passEncoder, bindGroupLayouts, camera, mesh);
		this.setMainMaterialBindGroup(passEncoder, bindGroupLayouts, mesh);
		this.setMainLightBindGroup(passEncoder, bindGroupLayouts, lights);
		this.setMainShadowBindGroup(passEncoder, bindGroupLayouts, lights, shadowMaps)
	}
	setMainSceneBindGroup(passEncoder, bindGroupLayouts, camera, mesh){
		const scene = {
			viewMatrix: camera.getViewMatrix(),
			projectionMatrix: camera.getProjectionMatrix(),
			modelMatrix: getTranspose(mesh.getModelMatrix(), [4, 4]), //change to col major?
			normalMatrix: getTranspose(
				getInverse(
					trimMatrix(
						//mesh.getModelMatrix(),
						new Float32Array([1, 0, 0, 0,   0, 1, 0, 0,   0, 0, 1, 0,  0, 0, 0, 1]),
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
	setMainMaterialBindGroup(passEncoder, bindGroupLayouts, mesh){
		const material = this.#materials.get(mesh.material);

		//TODO: pack the class directly
		const materialModel = {
			useSpecularMap: material.useSpecularMap ? 1 : 0, //0 => constant, 1 => map
			roughness: material.roughness,
			metalness: material.metalness,
			baseReflectance: material.baseReflectance
		};
		const materialData = packStruct(materialModel, [
			["useSpecularMap", "u32"],
			["roughness", "f32"],
			["metalness", "f32"],
			["baseReflectance", "vec3f32"]
		]);

		const materialBuffer = this.#device.createBuffer({
			size: materialData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "main-specular-buffer"
		});

		this.#device.queue.writeBuffer(materialBuffer, 0, materialData);

		const materialBindGroup = this.#device.createBindGroup({
			layout: bindGroupLayouts.get("materials"),
			entries: [
				{ binding: 0, resource: this.#samplers.get(material.textureSampler) },
				{ binding: 1, resource: this.#textures.get(material.texture).createView() },
				{ 
					binding: 2, 
					resource: {
						buffer: materialBuffer,
						offset: 0,
						size: materialData.byteLength
					}
				},
				{ binding: 3, resource: this.#samplers.get(material.specularSampler) },
				{ binding: 4, resource: this.#textures.get(material.specularMap).createView()}
			]
		});
		passEncoder.setBindGroup(1, materialBindGroup);
	}
	setMainLightBindGroup(passEncoder, bindGroupLayouts, lights){
		const lightData = packLights(lights.values().toArray());

		const bufferSize = lightData.byteLength;

		const lightBuffer = this.#device.createBuffer({
			size: bufferSize,
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

		const lightBindGroup = this.#device.createBindGroup({
			label: "main-light-bind-group",
			layout: bindGroupLayouts.get("lights"),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: lightBuffer,
						offset: 0,
						size: bufferSize
					}
				},
				{
					binding: 1,
					resource: {
						buffer: lightCountBuffer,
						offset: 0,
						size: 4
					}
				}
			]
		});

		passEncoder.setBindGroup(2, lightBindGroup);
	}
	setMainShadowBindGroup(passEncoder, bindGroupLayouts, lights, shadowMaps){
		const lightsArray = lights.entries().toArray();
		if(lightsArray.length > 4){
			throw new Exception("This engine can only handle shadows from 4 lights max");
		}

		const lightTransforms = [];
		const shadowMapsToBind = new Array(4).fill(null);

		let i = 0;
		for(const [key, light] of lightsArray){
			const shadowMap = shadowMaps.get(key);
			shadowMapsToBind[i++] = shadowMap;
			if(shadowMap){
				const shadowMapAspectRatio = shadowMap.width / shadowMap.height;
				lightTransforms.push({
					projectionMatrix: light.getProjectionMatrix(shadowMapAspectRatio),
					viewMatrix: light.getViewMatrix()
				})
			} else {
				lightTransforms.push({
					projectionMatrix: getEmptyMatrix([4, 4]),
					viewMatrix: getEmptyMatrix([4, 4])
				});
			}
		}

		const lightTransformData = packArray(lightTransforms, [
			["projectionMatrix", "mat4x4f32"],
			["viewMatrix", "mat4x4f32"]
		]);

		const lightTransformBuffer = this.#device.createBuffer({
			size: lightTransformData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
			label: "main-shadow-light-transform-buffer"
		});
		this.#device.queue.writeBuffer(lightTransformBuffer, 0, lightTransformData);

		const dummyView = shadowMaps.get("dummy").createView();
		const shadowBindGroup = this.#device.createBindGroup({
			label: "main-shadow-bind-group",
			layout: bindGroupLayouts.get("shadows"),
			entries: [
				{
					binding: 0,
					resource: this.#samplers.get("shadow-map-default")
				},
				{
					binding: 1,
					resource: {
						buffer: lightTransformBuffer,
						offset: 0,
						size: lightTransformData.byteLength
					}
				},
				...(shadowMapsToBind.map((value, i) => {
					return {
						binding: i + 2,
						resource: value ? value.createView() : dummyView
					};
				}))
			]
		});

		passEncoder.setBindGroup(3, shadowBindGroup);
	}
	setDebugBindGroup(passEncoder, bindGroupLayouts){
		const debugBindGroup = this.#device.createBindGroup({
			label: "main-debug-bind-group",
			layout: bindGroupLayouts.get("debug"),
			entries: [
				{
					binding: 0,
					resource: this.#samplers.get("shadow-map-default")
				}
			]
		});

		passEncoder.setBindGroup(4, debugBindGroup);
	}
	setShadowMapBindGroups(passEncoder, bindGroupLayouts, light, mesh){
		const shadowMap = this.#shadowMaps.get("light");
		const shadowMapAspectRatio = shadowMap.width / shadowMap.height;
		const viewMatrix = light.getViewMatrix();
		const projectionMatrix = light.getProjectionMatrix(shadowMapAspectRatio)

		const scene = {
			viewMatrix,
			projectionMatrix,
			modelMatrix: getTranspose(mesh.getModelMatrix(), [4, 4]), //change to col major?
			normalMatrix: getTranspose(
				getInverse(
					trimMatrix(
						mesh.getModelMatrix(),
						new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
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
	setBackgroundBindGroups(passEncoder, bindGroupLayouts, camera, mesh){
		this.setBackgroundSceneBindGroup(passEncoder, bindGroupLayouts, camera, mesh);
		this.setBackgroundTextureBindGroup(passEncoder, bindGroupLayouts);
	}
	setBackgroundUSceneBindGroup(passEncoder, bindGroupLayouts, camera, mesh){
		const inverseViewMatrix = getInverse(camera.getViewMatrix(), [4,4]);

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
	setBackgroundTextureBindGroup(passEncoder, bindGroupLayouts){
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
		//this.renderDepthBuffer(this.#shadowMaps.get("light").createView());
		this.renderScene();
	}

	renderShadowMaps(){
		const commandEncoder = this.#device.createCommandEncoder({
			label: "shadow-map-command-encoder"
		});
		const shadowMapPipelineContainer = this.#pipelines.get("shadow-map");
		let isFirstPass = true;

		for(const [key, light] of this.#lights){
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

			for (const meshName of this.#pipelineMesh.get("main")) {
				const meshContainer = this.#meshContainers.get(meshName);

				shadowMapPipelineContainer.bindMethod(passEncoder, shadowMapPipelineContainer.bindGroupLayouts, light, meshContainer.mesh);
				passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
				passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
				passEncoder.drawIndexed(meshContainer.mesh.indices.length);
			}

			passEncoder.end();
			isFirstPass = false;
		}

		this.#device.queue.submit([commandEncoder.finish()]);
	}
	renderScene(){
		const commandEncoder = this.#device.createCommandEncoder({
			label: "main-command-encoder"
		});

		const camera = this.#cameras.get("main");
		let isFirstPass = true;

		const depthView = this.#textures.get("depth").createView();

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

			for (const meshName of meshNames) {
				const meshContainer = this.#meshContainers.get(meshName);

				pipelineContainer.bindMethod(passEncoder, pipelineContainer.bindGroupLayouts, camera, meshContainer.mesh, this.#lights, this.#shadowMaps);
				passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
				passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
				passEncoder.drawIndexed(meshContainer.mesh.indices.length);
			}

			passEncoder.end();
			isFirstPass = false;
		}

		this.#device.queue.submit([commandEncoder.finish()]);
	}

	get cameras(){
		return this.#cameras;
	}
	get isRunning(){
		return this.#isRunning;
	}
}