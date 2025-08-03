import { Camera } from "../entities/camera.js";
import { Mesh } from "../entities/mesh.js";
import { screenTri, uvSphere } from "../utilities/mesh-generator.js";
import { getAlignments } from "../utilities/buffer-utils.js";
import { getTranspose, getInverse, trimMatrix, multiplyMatrix } from "../utilities/vector.js";
import { uploadMesh, uploadShader, uploadTexture, uploadObj } from "../utilities/wgpu-utils.js";

export class GpuEngine {
	#canvas;
	#context;
	#adapter;
	#device;
	#raf;
	#isRunning = false;
	#meshes = new Map();
	#pipelines = new Map();
	#cameras = new Map();
	#textures = new Map();
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
		await this.initializeMeshes();
		await this.initializeTextures();
		this.initializeSamplers();
		await this.initializePipelines();
		this.initializePipelineMesh();
	}
	initializeCameras(){
		this.#cameras.set("main", new Camera({
			position: [0, 0, -2],
			screenHeight: this.#canvas.height,
			screenWidth: this.#canvas.width,
			fieldOfView: 90,
			near: 0.01,
			far: 5,
			isPerspective: true
		}))
	}
	async initializeMeshes(){
		// {
		// 	const mesh = new Mesh(uvSphere(8))
		// 	const { vertexBuffer, indexBuffer } = uploadMesh(this.#device, mesh, { positionLength: 3, uvLength: 2, label: "earth-mesh" });
		// 	this.#meshes.set("earth", { vertexBuffer, indexBuffer, mesh });
		// }
		{
			const { mesh, vertexBuffer, indexBuffer} = await uploadObj(this.#device, "./objs/teapot-low.obj", { 
				reverseWinding: true, 
				normalizePositions: 1
			});
			this.#meshes.set("teapot", { vertexBuffer, indexBuffer, mesh });
		}
		{
			const mesh = new Mesh(screenTri());
			const { vertexBuffer, indexBuffer } = uploadMesh(this.#device, mesh, { positionSize: 2, label: "background-mesh" });
			this.#meshes.set("background", { vertexBuffer, indexBuffer, mesh });
		}
	}
	async initializeTextures(){
		this.#textures.set("earth", await uploadTexture(this.#device, "./img/earth.png"));

		this.#textures.set("space", await uploadTexture(this.#device, [
			"./img/space_right.png",
			"./img/space_left.png",
			"./img/space_top.png",
			"./img/space_bottom.png",
			"./img/space_front.png",
			"./img/space_back.png"
		]));

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
	}
	initializeSamplers(){
		const sampler = this.#device.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			magFilter: "linear",
			minFilter: "nearest"
		});
		this.#samplers.set("main", sampler);
	}
	async initializePipelines(){
		{
			const vertexBufferDescriptor = [{
				attributes: [
					{
						shaderLocation: 0,
						offset: 0,
						format: "float32x3"
					},
					{
						shaderLocation: 1,
						offset: 12,
						format: "float32x2"
					},
					{
						shaderLocation: 2,
						offset: 20,
						format: "float32x3"
					}
				],
				arrayStride: 32,
				stepMode: "vertex"
			}];

			const shaderModule = await uploadShader(this.#device, "./shaders/textured-earth.wgsl");

			const pipelineDescriptor = {
				label: "main-pipeline",
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
					topology: "triangle-list",
					frontFace: "ccw",
					cullMode: "back"
				},
				depthStencil: {
					depthWriteEnabled: true,
					depthCompare: "less-equal",
					format: "depth32float"
				},
				layout: "auto"
			};
			const pipeline = this.#device.createRenderPipeline(pipelineDescriptor);

			this.#pipelines.set("main", {
				pipeline,
				bindGroupLayouts: new Map([
					["uniforms", pipeline.getBindGroupLayout(0)],
					["textures", pipeline.getBindGroupLayout(1)]
				]),
				bindMethod: this.setMainBindGroups.bind(this)
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
					["uniforms", pipeline.getBindGroupLayout(0)],
					["textures", pipeline.getBindGroupLayout(1)]
				]),
				bindMethod: this.setBackgroundBindGroups.bind(this)
			});
		}
	}
	initializePipelineMesh(){
		this.#pipelineMesh.set("main", ["teapot"]);
		this.#pipelineMesh.set("background", ["background"]);
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

	//The offsets here are auto but to large, optimize perhaps with manual layouts
	setMainBindGroups(passEncoder, bindGroupLayouts, camera, mesh){
		this.setMainUniformBindGroup(passEncoder, bindGroupLayouts, camera, mesh);
		this.setMainTextureBindGroup(passEncoder, bindGroupLayouts);
	}
	setMainUniformBindGroup(passEncoder, bindGroupLayouts, camera, mesh){
		const viewMatrix = camera.getViewMatrix();
		const projectionMatrix = camera.getProjectionMatrix();
		const modelMatrix = mesh.getModelMatrix();
		const normalMatrix = getTranspose(getInverse(trimMatrix(multiplyMatrix(modelMatrix, [4, 4], viewMatrix, [4, 4]), [4, 4], [3, 3]), [3, 3]), [3, 3]);
		const cameraPosition = camera.getPosition();

		const alignment = getAlignments([
			"mat4x4f32",
			"mat4x4f32",
			"mat4x4f32",
			"mat3x3f32",
			"vec3f32"
		]);

		const bufferSize = alignment.totalSize;

		const uniformBuffer = this.#device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "main-uniform-buffer"
		});
		const uniformData = new Float32Array(bufferSize / 4);
		uniformData.set(viewMatrix, alignment.offsets[0] / 4);
		uniformData.set(projectionMatrix, alignment.offsets[1] / 4),
		uniformData.set(modelMatrix, alignment.offsets[2] / 4);
		uniformData.set(normalMatrix, alignment.offsets[3] / 4);
		uniformData.set(cameraPosition, alignment.offsets[4] / 4);

		this.#device.queue.writeBuffer(uniformBuffer, 0, uniformData);

		const uniformBindGroup = this.#device.createBindGroup({
			label: "main-uniform-bind-group",
			layout: bindGroupLayouts.get("uniforms"),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: uniformBuffer,
						offset: 0,
						size: bufferSize
					}
				}
			]
		});

		passEncoder.setBindGroup(0, uniformBindGroup);
	}
	setMainTextureBindGroup(passEncoder, bindGroupLayouts){
		const textureBindGroup = this.#device.createBindGroup({
			layout: bindGroupLayouts.get("textures"),
			entries: [
				{ binding: 0, resource: this.#samplers.get("main") },
				{ binding: 1, resource: this.#textures.get("earth").createView() },
			]
		});
		passEncoder.setBindGroup(1, textureBindGroup);
	}
	setBackgroundBindGroups(passEncoder, bindGroupLayouts, camera, mesh){
		this.setBackgroundUniformBindGroup(passEncoder, bindGroupLayouts, camera, mesh);
		this.setBackgroundTextureBindGroup(passEncoder, bindGroupLayouts);
	}
	setBackgroundUniformBindGroup(passEncoder, bindGroupLayouts, camera, mesh){
		const inverseViewMatrix = getInverse(camera.getViewMatrix(), [4,4]);

		const uniformBuffer = this.#device.createBuffer({
			size: inverseViewMatrix.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "background-uniform-buffer"
		});
		this.#device.queue.writeBuffer(uniformBuffer, 0, inverseViewMatrix);

		const uniformBindGroup = this.#device.createBindGroup({
			label: "background-uniform-bind-group",
			layout: bindGroupLayouts.get("uniforms"),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: uniformBuffer,
						offset: 0,
						size: inverseViewMatrix.byteLength
					}
				}
			]
		});

		passEncoder.setBindGroup(0, uniformBindGroup);
	}
	setBackgroundTextureBindGroup(passEncoder, bindGroupLayouts){
		const textureBindGroup = this.#device.createBindGroup({
			layout: bindGroupLayouts.get("textures"),
			entries: [
				{ binding: 0, resource: this.#samplers.get("main") },
				{ binding: 1, resource: this.#textures.get("space").createView({ dimension: "cube" }) },
			]
		});
		passEncoder.setBindGroup(1, textureBindGroup);
	}
	render() {
		const commandEncoder = this.#device.createCommandEncoder({
			label: "main-command-encoder"
		});

		const camera = this.#cameras.get("main");
		let isFirstPass = true;

		const depthView = this.#textures.get("depth").createView();

		for(const [pipelineName, meshNames] of this.#pipelineMesh.entries()){
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

			for(const meshName of meshNames){
				const meshContainer = this.#meshes.get(meshName);

				pipelineContainer.bindMethod(passEncoder, pipelineContainer.bindGroupLayouts, camera, meshContainer.mesh);
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