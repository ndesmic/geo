import { uploadShader } from "../../../utilities/wgpu-utils.js";

export async function getIrridiancePipeline(device) {
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

    const relativeShaderUrl = import.meta.resolve("../../../../shaders/irridiance-map.wgsl");
    const shaderModule = await uploadShader(device, relativeShaderUrl);

    const sceneBindGroupLayout = device.createBindGroupLayout({
        label: "irridiance-scene-bind-group-layout",
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

    const materialBindGroupLayout = device.createBindGroupLayout({
        label: "irridiance-material-bind-group-layout",
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
                    sampleType: 'float',
                    viewDimension: '2d',
                    multisampled: false
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering"
                }
            },
            {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'float',
                    viewDimension: '2d',
                    multisampled: false
                }
            }
        ]
    });

    const lightBindGroupLayout = device.createBindGroupLayout({
        label: "main-light-bind-group-layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "read-only-storage"
                }
            }
        ]
    });

    const pipelineLayout = device.createPipelineLayout({
        label: "irridiance-pipeline-layout",
        bindGroupLayouts: [
            sceneBindGroupLayout,
            materialBindGroupLayout,
            lightBindGroupLayout
        ]
    });


    const pipelineDescriptor = {
        label: "irridiance-pipeline",
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
            topology: "triangle-list",
            frontFace: "ccw",
            cullMode: "back"
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less-equal",
            format: "depth32float"
        }
    };
    return device.createRenderPipeline(pipelineDescriptor);
}