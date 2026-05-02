//@ts-check

/**
 * @typedef {import("../../../entities/camera.js").Camera} Camera
 * @typedef {import("../../../entities/material.js").Material} Material
 * @typedef {import("../../../entities/probe.js").Probe} Probe
 * @typedef {import("../../../entities/mesh.js").Mesh} Mesh
 * @typedef {import("../../../entities/light.js").Light} Light
 * @typedef {import("../../../entities/group.js").Group} Group
 * @typedef {import("../../../entities/background.d.ts").IBackground} IBackground
 * @typedef {import("../../../entities/pipeline.d.ts").IPipeline} IPipeline
 * @typedef {import("../../../entities/pipeline.d.ts").MeshContainer} MeshContainer
 * @typedef {import("../../../entities/pipeline.d.ts").AttachmentViews} AttachmentViews
 * @typedef {{ shape: [number, number], values: Float32Array }} ConvolutionKernel2D
 */

import { uploadShader } from "../../../utilities/wgpu-utils.js";
import { pack } from "../../../utilities/buffer-utils.js";

/**
 * @implements {IPipeline}
 */
export class ConvolutionPipeline {
	#bindGroupLayouts = new Map();
	#pipeline;
	#sampler;
	#vertexBuffer;

	/**
	 * @param {GPUDevice} device
	 * @param {{ textureType?: "texture" | "depthmap" | "cubemap", sampler?: GPUSampler }} options
	 */
	async createPipeline(device, options = {}) {
		const textureType = options.textureType ?? "texture";
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

		let samplerType;
		let sampleType;
		let viewDimension;
		let url;

		switch (textureType) {
			// case "texture": {
			// 	samplerType = "filtering";
			// 	sampleType = "float";
			// 	viewDimension = "2d";
			// 	url = "../shaders/convolute-texture.wgsl";
			// 	break;
			// }
			case "cubemap": {
				samplerType = "filtering";
				sampleType = "float";
				viewDimension = "2d-array";
				url = "../shaders/convolute-cubemap.wgsl";
				break;
			}
				// case "depthmap": {
				// 	samplerType = "non-filtering";
				// 	sampleType = "depth";
				// 	viewDimension = "2d";
				// 	url = "../shaders/display-texture.wgsl";
				// 	break;
				// }
			default: {
				throw new Error(`type ${textureType} not supported by convolution pipeline`);
			}
		}

		const relativeShaderUrl = import.meta.resolve(url);
		const shaderModule = await uploadShader(device, relativeShaderUrl);

		this.#bindGroupLayouts.set(
			"texture",
			device.createBindGroupLayout({
				label: `convolution-texture-bindgroup-layout`,
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: {
							type: samplerType
						}
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						texture: {
							sampleType,
							viewDimension
						}
					}
				]
			})
		);

		this.#bindGroupLayouts.set(
			"kernel",
			device.createBindGroupLayout({
				label: `convolution-kernel-bindgroup-layout`,
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: {
							type: "uniform"
						}
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: {
							type: "read-only-storage"
						}
					},
					{
						binding: 2,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: {
							type: "uniform"
						}
					}
				]
			})
		);

		const pipelineLayout = device.createPipelineLayout({
			label: "convolute-pipeline-layout",
			bindGroupLayouts: this.#bindGroupLayouts.values().toArray()
		});

		const pipelineDescriptor = {
			label: "convolute-pipeline",
			layout: pipelineLayout,
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
			}
		};

		this.#pipeline = device.createRenderPipeline(pipelineDescriptor);

		this.#sampler = options.sampler;
		const vertices = new Float32Array([
			-1.0, -1.0, 0.0, 1.0,
			3.0, -1.0, 2.0, 1.0,
			-1.0, 3.0, 0.0, -1.0
		]);

		this.#vertexBuffer = device.createBuffer({
			label: "convolute-tri",
			size: vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
		});
		device.queue.writeBuffer(this.#vertexBuffer, 0, vertices);
	}

	/**
	 * @param {GPUDevice} device
	 * @param {Mesh} root
	 * @param {AttachmentViews} attachmentViews }
	 * @param {{
	 *  meshContainers: Map<Mesh, MeshContainer>,
	 *  lights: Map<string | symbol, Light>,
	 *  shadowMaps: Map<string | symbol, GPUTexture>,
	 *  textures: Map<string | symbol, GPUTexture>,
	 *  samplers: Map<string | symbol, GPUSampler>,
	 *  materials: Map<string | symbol, Material>,
	 *  cameras: Map<string | symbol, Camera>,
	 *  primaryCamera: Camera;
	 *  probes: Map<string | symbol, Probe>,
	 *  background: IBackground
	 *  commandEncoder: GPUCommandEncoder
	 * }} info
	 * @param {{ inTexture: string, outTexture: string, inResolution: [number, number], outResolution: [number, number], kernel: ConvolutionKernel2D }} args
	 */
	render(device, root, attachmentViews, info, args) {
		const commandEncoder = info.commandEncoder ?? device.createCommandEncoder({
			label: "convolute-command-encoder"
		});

		const outTexture = device.createTexture({
			size: [...args.outResolution, 6],
			format: "rgba8unorm",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			dimension: "2d"
		});
		info.textures.set(args.outTexture, outTexture);

		const textureBindGroup = device.createBindGroup({
			label: "convolute-texture-bind-group",
			layout: this.#bindGroupLayouts.get("texture"),
			entries: [
				{ binding: 0, resource: this.#sampler },
				{ binding: 1, resource: info.textures.get(args.inTexture)?.createView({ dimension: "2d-array", label: `convolution-texture` })  }
			]
		});

		//Kernel
		const kernelData = pack(args.kernel, [
			["shape", "vec2u32"],
			["values", ["f32"]]
		]);

		const kernelBuffer = device.createBuffer({
			size: kernelData.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: "convolute-kernel-buffer"
		});

		device.queue.writeBuffer(kernelBuffer, 0, kernelData);

		//Size
		const size = {
            width: args.inResolution[0],
			height: args.inResolution[1],
		};

		const sizeData = pack(size, [
			["height", "u32"],
			["width", "u32"]
		]);

		const sizeBuffer = device.createBuffer({
			size: sizeData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: "convolute-size-buffer"
		});

		device.queue.writeBuffer(sizeBuffer, 0, sizeData);


		for(let face = 0; face < 6; face++){
			const faceData = pack({ value: face }, [["value", "u32"]]);

			const faceBuffer = device.createBuffer({
				size: faceData.byteLength,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				label: `convolute-face-buffer-${face}`
			});

			device.queue.writeBuffer(faceBuffer, 0, faceData);

			const kernelBindGroup = device.createBindGroup({
				label: "convolute-kernel-bind-group",
				layout: this.#bindGroupLayouts.get("kernel"),
				entries: [
					{ binding: 0, resource: sizeBuffer },
					{ binding: 1, resource: kernelBuffer },
					{ binding: 2, resource: faceBuffer }
				]
			});

			const passEncoder = commandEncoder.beginRenderPass({
				label: "convolute-render-pass",
				//@ts-expect-error WGPU types are not good
				colorAttachments: [
					{
						storeOp: "store",
						loadOp: "clear",
						clearValue: { r: 0, g: 0, b: 0, a: 1 },
						view: outTexture.createView({
							dimension: "2d-array",
							baseArrayLayer: face,
							arrayLayerCount: 1,
							label: `convolution-output-view`
						})
					}
				]
			});

			passEncoder.setPipeline(this.#pipeline);
			passEncoder.setBindGroup(0, textureBindGroup);
			passEncoder.setBindGroup(1, kernelBindGroup);
			passEncoder.setVertexBuffer(0, this.#vertexBuffer);
			passEncoder.draw(3);
			passEncoder.end();
		}

		if (!info.commandEncoder) {
			device.queue.submit([commandEncoder.finish()]);
		}
	}
}
