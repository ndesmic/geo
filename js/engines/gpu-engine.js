import { Camera } from "../entities/camera.js";
import { Mesh } from "../entities/mesh.js";
import { screenQuad, quad, uvSphere } from "../utilities/mesh-generator.js";
import { packMesh, getAlignments } from "../utilities/buffer-utils.js";
import { getTranspose, getInverse, trimMatrix, multiplyMatrix } from "../utilities/vector.js";
import { loadImage } from "../utilities/image-utils.js";

export class GpuEngine {
	#canvas;
	#context;
	#adapter;
	#device;
	#meshes = new Map();
	#pipelines = new Map();
	#cameras = new Map();
	#textures = new Map();
	#samplers = new Map();
	#pipelineMesh = new Map();

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
		this.initializeMeshes();
		await this.initializeTextures();
		this.initializeSamplers();
		this.initializePipelines();
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
	initializeMeshes(){
		{
			const mesh = new Mesh(uvSphere(8));
			const vertices = packMesh(mesh, { positions: 3, uvs: 2 });

			const vertexBuffer = this.#device.createBuffer({
				label: "earth-mesh",
				size: vertices.byteLength,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			});
			this.#device.queue.writeBuffer(vertexBuffer, 0, vertices);

			const indexBuffer = this.#device.createBuffer({
				size: mesh.indices.byteLength,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			});
			this.#device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

			this.#meshes.set("earth", {
				vertexBuffer,
				indexBuffer,
				mesh
			});
		}
		{
			const mesh = new Mesh(screenQuad());
			const vertices = packMesh(mesh, { positions: 2 });

			const vertexBuffer = this.#device.createBuffer({
				label: "background-mesh",
				size: vertices.byteLength,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			});
			this.#device.queue.writeBuffer(vertexBuffer, 0, vertices);

			const indexBuffer = this.#device.createBuffer({
				size: mesh.indices.byteLength,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			});
			this.#device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

			this.#meshes.set("background", {
				vertexBuffer,
				indexBuffer,
				mesh
			});
		}
	}
	async initializeTextures(){
		const image = await loadImage("./img/earth.png");

		const textureSize = {
			width: image.width,
			height: image.height,
			depthOrArrayLayers: 1
		};
		const texture = this.#device.createTexture({
			size: textureSize,
			dimension: '2d',
			format: `rgba8unorm`,
			usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		});

		this.#device.queue.copyExternalImageToTexture(
			{
				source: image,
				flipY: true
			},
			{
				texture: texture
			},
			{
				width: image.width,
				height: image.height,
				depthOrArrayLayers: 1
			}
		);

		this.#textures.set("earth", texture);

		//cubemap -> [+X, -X, +Y, -Y, +Z, -Z]
		const cubeSideImages = await Promise.all([
			loadImage("./img/space_front.png"),
			loadImage("./img/space_right.png"),
			loadImage("./img/space_left.png"),
			loadImage("./img/space_back.png"),
			loadImage("./img/space_top.png"),
			loadImage("./img/space_bottom.png"),
		]);

		const cubemapSize = {
			width: cubeSideImages[0].width,
			height: cubeSideImages[0].height,
			depthOrArrayLayers: 6
		};

		const cubemap = this.#device.createTexture({
			size: cubemapSize,
			dimension: "2d",
			format: `rgba8unorm`,
			usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		});

		cubeSideImages.forEach((img, layer) => {
			this.#device.queue.copyExternalImageToTexture(
				{
					source: img,
					flipY: true
				},
				{
					texture: cubemap,
					origin: [0, 0, layer]
				},
				{
					width: img.width,
					height: img.height,
					depthOrArrayLayers: 1
				}
			);
		});

		this.#textures.set("space", cubemap);
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
	initializePipelines(){
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
					}
				],
				arrayStride: 20,
				stepMode: "vertex"
			}];

			const shaderModule = this.#device.createShaderModule({
				code: `
					struct VertexOut {
						@builtin(position) position : vec4<f32>,
						@location(0) uv : vec2<f32>
					};
					struct Uniforms {
						view_matrix: mat4x4<f32>,
						projection_matrix: mat4x4<f32>,
						model_matrix: mat4x4<f32>,
						normal_matrix: mat3x3<f32>,
						camera_position: vec3<f32>
					}
					

					@group(0) @binding(0) var<uniform> uniforms : Uniforms;
					@group(1) @binding(0) var main_sampler: sampler;
					@group(1) @binding(1) var earth_texture: texture_2d<f32>;

					@vertex
					fn vertex_main(@location(0) position: vec3<f32>, @location(1) uv: vec2<f32>) -> VertexOut
					{
						var output : VertexOut;
						output.position =  uniforms.projection_matrix * uniforms.view_matrix * uniforms.model_matrix * vec4<f32>(position, 1.0);
						output.uv = uv;
						return output;
					}

					@fragment
					fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
					{
						return textureSample(earth_texture, main_sampler, fragData.uv);
					}
				`
			});

			//manually setting bind groups
			const uniformBindGroupLayout = this.#device.createBindGroupLayout({
				label: "main-uniform-bind-group-layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
						buffer: {
							type: "uniform"
						}
					}
				]
			});
			const textureBindGroupLayout = this.#device.createBindGroupLayout({
				label: "main-texture-bind-group-layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: {
							type: "filtering"
						}
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						texture: {
							sampleType: "float",
							viewDimension: "2d",
							multisampled: false
						}
					}
				]
			});

			const pipelineLayout = this.#device.createPipelineLayout({
				label: "main-pipeline-layout",
				bindGroupLayouts: [
					uniformBindGroupLayout,
					textureBindGroupLayout
				]
			});

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
				layout: pipelineLayout
			};

			this.#pipelines.set("main", {
				pipeline: this.#device.createRenderPipeline(pipelineDescriptor),
				pipelineLayout,
				bindGroupLayouts: new Map([
					["uniforms", uniformBindGroupLayout],
					["textures", textureBindGroupLayout]
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

			const shaderModule = this.#device.createShaderModule({
				code: `
					struct VertexOut {
						@builtin(position) frag_position : vec4<f32>,
						@location(0) clip_position: vec4<f32>
					};

					@group(0) @binding(0) var<uniform> inverse_view_matrix: mat4x4<f32>;
					@group(1) @binding(0) var main_sampler: sampler;
					@group(1) @binding(1) var space_texture: texture_cube<f32>;

					@vertex
					fn vertex_main(@location(0) position: vec2<f32>) -> VertexOut
					{
						var output : VertexOut;
						output.frag_position =  vec4(position, 0.0, 1.0);
						output.clip_position = vec4(position, 0.0, 1.0);
						return output;
					}

					@fragment
					fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
					{
						var pos = inverse_view_matrix * fragData.clip_position;
						return textureSample(space_texture, main_sampler, pos.xyz);
					}
				`
			});

			//manually setting bind groups
			const uniformBindGroupLayout = this.#device.createBindGroupLayout({
				label: "background-bind-group-layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
						buffer: {
							type: "uniform"
						}
					}
				]
			});
			const textureBindGroupLayout = this.#device.createBindGroupLayout({
				label: "background-texture-bind-group-layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: {
							type: "filtering"
						}
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						texture: {
							sampleType: "float",
							viewDimension: "cube",
							multisampled: false
						}
					}
				]
			});

			const pipelineLayout = this.#device.createPipelineLayout({
				label: "background-pipeline-layout",
				bindGroupLayouts: [
					uniformBindGroupLayout,
					textureBindGroupLayout
				]
			});

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
					topology: "triangle-list",
					frontFace: "ccw",
					cullMode: "back"
				},
				layout: pipelineLayout
			};

			this.#pipelines.set("background", {
				pipeline: this.#device.createRenderPipeline(pipelineDescriptor),
				pipelineLayout,
				bindGroupLayouts: new Map([
					["uniforms", uniformBindGroupLayout],
					["textures", textureBindGroupLayout]
				]),
				bindMethod: this.setBackgroundBindGroups.bind(this)
			});
		}
	}
	initializePipelineMesh(){
		this.#pipelineMesh.set("background", ["background"]);
		this.#pipelineMesh.set("main", ["earth"]);
	}
	start() {
		this.renderLoop();
	}
	renderLoop() {
		requestAnimationFrame((timestamp) => {
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

		const passEncoder = commandEncoder.beginRenderPass({
			label: "main-render-pass",
			colorAttachments: [
				{
					storeOp: "store",
					loadOp: "load",
					view: this.#context.getCurrentTexture().createView()
				}
			]
		});

		const camera = this.#cameras.get("main");

		for(const [pipelineName, meshNames] of this.#pipelineMesh.entries()){
			const pipelineContainer = this.#pipelines.get(pipelineName);

			passEncoder.setPipeline(pipelineContainer.pipeline);

			for(const meshName of meshNames){
				const meshContainer = this.#meshes.get(meshName);

				pipelineContainer.bindMethod(passEncoder, pipelineContainer.bindGroupLayouts, camera, meshContainer.mesh);
				passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
				passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");
				passEncoder.drawIndexed(meshContainer.mesh.indices.length);
			}
		}

		passEncoder.end();

		this.#device.queue.submit([commandEncoder.finish()]);
	}

	get cameras(){
		return this.#cameras;
	}
}