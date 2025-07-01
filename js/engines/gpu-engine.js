export class GpuEngine {
	#canvas;
	#context;
	#adapter;
	#device;
	#meshes = new Map();
	#pipelines = new Map();

	constructor(options) {
		this.#canvas = options.canvas;
		this.#context = options.canvas.getContext("webgpu");
	}
	async initialize(){
		this.#adapter = await navigator.gpu.requestAdapter();
		this.#device = await this.#adapter.requestDevice();
		this.#context.configure({
			device: this.#device,
			format: "bgra8unorm"
		});

		this.initializeMeshes();
		this.initializePipelines();
	}
	initializeMeshes(){
		//test position + uv
		const vertices = new Float32Array([
			-1.0, -1.0, 0.0, 1.0,
			1.0, -1.0, 1.0, 1.0,
			1.0, 1.0, 1.0, 0.0,

			-1.0, -1.0, 0.0, 1.0,
			1.0, 1.0, 1.0, 0.0,
			-1.0, 1.0, 0.0, 0.0
		]);

		const vertexBuffer = this.#device.createBuffer({
			size: vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		});
		this.#device.queue.writeBuffer(vertexBuffer, 0, vertices);

		this.#meshes.set("background", {
			vertices: vertexBuffer,
			pipeline: "main"
		});
	}
	initializePipelines(){
		const vertexBufferDescriptor = [{
			attributes: [
				{
					shaderLocation: 0,
					offset: 0,
					format: "float32x2"
				},
				{
					shaderLocation: 1,
					offset: 8,
					format: "float32x2"
				}
			],
			arrayStride: 16,
			stepMode: "vertex"
		}];

		const shaderModule = this.#device.createShaderModule({
			code: `
				struct VertexOut {
                    @builtin(position) position : vec4<f32>,
                    @location(0) uv : vec2<f32>
                };

                @vertex
                fn vertex_main(@location(0) position: vec2<f32>, @location(1) uv: vec2<f32>) -> VertexOut
                {
                    var output : VertexOut;
                    output.position = vec4<f32>(position, 0.0, 1.0);
                    output.uv = uv;
                    return output;
                }

                @fragment
                fn fragment_main(fragData: VertexOut) -> vec4<f32>
                {
                    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
                }
			`
		});

		const pipelineDescriptor = {
			label: "pipeline",
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
			layout: "auto"
		};

		this.#pipelines.set("main", this.#device.createRenderPipeline(pipelineDescriptor));
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
	render() {
		const commandEncoder = this.#device.createCommandEncoder();
		const clearColor = { r: 0, g: 0, b: 0, a: 1 };
		const renderPassDescriptor = {
			colorAttachments: [
				{
					loadValue: clearColor,
					storeOp: "store",
					loadOp: "load",
					view: this.#context.getCurrentTexture().createView()
				}
			]
		};
		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.#pipelines.get("main"));
		passEncoder.setVertexBuffer(0, this.#meshes.get("background").vertices);
		passEncoder.draw(6); //TODO need index buffer
		passEncoder.end();
		this.#device.queue.submit([commandEncoder.finish()]);
	}
}