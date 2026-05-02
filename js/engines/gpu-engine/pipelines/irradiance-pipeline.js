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
import { pack } from "../../../utilities/buffer-utils.js";
import { DEFAULT_SAMPLER } from "../constants.js";

/**
 * @implements {IPipeline}
 */
export class IrradiancePipeline {
    #bindGroupLayout;
    #pipeline;
    #vertexBuffer;

    /**
     * 
     * @param {GPUDevice} device 
     */
    async createPipeline(device) {
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

        const relativeShaderUrl = import.meta.resolve("../shaders/irradiance.wgsl");
        const shaderModule = await uploadShader(device, relativeShaderUrl);

        this.#bindGroupLayout = device.createBindGroupLayout({
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
                        viewDimension: "cube"
                    }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
						type: "uniform",
					}
                }
            ]
        });

        const pipelineLayout = device.createPipelineLayout({
            label: "irradiance-pipeline-layout",
            bindGroupLayouts: [this.#bindGroupLayout]
        });

        const pipelineDescriptor = {
            label: "irradiance-pipeline",
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

        const vertices = new Float32Array([
            -1.0, -1.0,
            3.0, -1.0,
            -1.0, 3.0
        ]);

        this.#vertexBuffer = device.createBuffer({
            label: "irradiance-tri",
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
     * @param {{ outTexture: string, inTexture: string, inResolution: number, outResolution: number, sampleCount: number }} args
     */
    render(device, root, attachmentViews, info, args) {
        const commandEncoder = info.commandEncoder ?? device.createCommandEncoder({
            label: "irradiance-command-encoder"
        });

		const irradianceCubeMap = device.createTexture({
			size: [args.outResolution, args.outResolution, 6],
			format: "rgba8unorm",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			dimension: "2d"
		});

        for(let i = 0; i < 6; i++){
            const colorView = irradianceCubeMap.createView({ dimension: "2d", baseArrayLayer:  i, arrayLayerCount: 1, label: `irradiance-scene-cube-map-${i}` });

            const passEncoder = commandEncoder.beginRenderPass({
                label: "irradiance-render-pass",
                colorAttachments: [
                    {
                        storeOp: "store",
                        loadOp: "clear",
                        clearValue: { r: 0, g: 0, b: 0, a: 1 },
                        view: colorView
                    }
                ]
            });

            const irradianceParams = {
                faceIndex: i,
                screenWidth: args.inResolution,
                sampleCount: args.sampleCount
            };
        
            const irradianceParamData = pack(irradianceParams, [
                ["faceIndex", "u32"],
                ["screenWidth", "u32"],
                ["sampleCount", "u32"]
            ]);
        
            const irradianceParamBuffer = device.createBuffer({
                size: irradianceParamData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                label: "main-scene-buffer",
            });
        
            device.queue.writeBuffer(irradianceParamBuffer, 0, irradianceParamData);

            const textureBindGroup = device.createBindGroup({
                label: "irradiance-bind-group",
                layout: this.#bindGroupLayout,
                entries: [
                    { binding: 0, resource: info.samplers.get(DEFAULT_SAMPLER) },
                    { binding: 1, resource: info.textures.get(args.inTexture)?.createView({ dimension: "cube", label: `irradiance-scene-cube-map-${i}` }) },
                    { binding: 2, resource: irradianceParamBuffer }
                ]
            });

            passEncoder.setPipeline(this.#pipeline);
            passEncoder.setBindGroup(0, textureBindGroup);
            passEncoder.setVertexBuffer(0, this.#vertexBuffer);
            passEncoder.draw(3);
            passEncoder.end();
        }

        info.textures.set(args.outTexture, irradianceCubeMap);

        if(!info.commandEncoder){
            device.queue.submit([commandEncoder.finish()]);
        }
    }
}
