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
 */

import { uploadShader } from "../../../utilities/wgpu-utils.js";

/**
 * @implements {IPipeline}
 */
export class DisplayTexturePipeline {
	#bindGroupLayouts = new Map();
	#pipeline;
	#sampler;
	#vertexBuffer;

	/**
	 * 
	 * @param {GPUDevice} device 
	 * @param {{ textureType?: "texture" | "depthmap" | "cubemap"}} options 
	 */
	async createPipeline(device, options = {}) {
		const textureType = options.textureType ?? "texture";
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

		let samplerType;
		let sampleType;
		let viewDimension;
		let url;

		switch(textureType){
			case "texture": {
				samplerType = "filtering";
				sampleType = "float";
				viewDimension = "2d";
				url = "../shaders/display-texture.wgsl";
				break;
			}
			case "cubemap": {
				samplerType = "filtering";
				sampleType = "float";
				viewDimension = "2d-array";
				url = "../shaders/display-cubemap.wgsl";
				break;
			}
			case "depthmap": {
				samplerType = "non-filtering";
				sampleType = "depth";
				viewDimension = "2d";
				url = "../shaders/display-texture.wgsl";
				break;
			}
		}

		const relativeShaderUrl = import.meta.resolve(url);
		const shaderModule = await uploadShader(device, relativeShaderUrl);

		this.#bindGroupLayouts.set("texture", device.createBindGroupLayout({
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
		}));

		const pipelineLayout = device.createPipelineLayout({
			label: "display-texture-pipeline-layout",
			bindGroupLayouts: this.#bindGroupLayouts.values().toArray()
		});

		const pipelineDescriptor = {
			label: "display-texture-pipeline",
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
			-1.0, -1.0,
			3.0, -1.0,
			-1.0, 3.0
		]);

		this.#vertexBuffer = device.createBuffer({
			label: "display-texture-tri",
			size: vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
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
	 * @param {GPUTextureView?} args
	 */
	render(device, root, attachmentViews, info, args) {
		const commandEncoder = info.commandEncoder ?? device.createCommandEncoder({
			label: "display-texture-command-encoder"
		});

		const passEncoder = commandEncoder.beginRenderPass({
			label: "display-texture-render-pass",
			//@ts-expect-error WGPU types are not good
			colorAttachments: [
				{
					storeOp: "store",
					loadOp: "clear",
					clearValue: { r: 0, g: 0, b: 0, a: 1 },
					view: attachmentViews.colorView
				}
			]
		});

		const textureBindGroup = device.createBindGroup({
			label: "display-texture-bind-group",
			layout: this.#bindGroupLayouts.get("texture"),
			entries: [
				{ binding: 0, resource: this.#sampler },
				{ binding: 1, resource: args},
			]
		});

		passEncoder.setPipeline(this.#pipeline);
		passEncoder.setBindGroup(0, textureBindGroup);
		passEncoder.setVertexBuffer(0, this.#vertexBuffer);
		passEncoder.draw(3);
		passEncoder.end();

		if(!info.commandEncoder){
			device.queue.submit([commandEncoder.finish()]);
		}
	}
}
