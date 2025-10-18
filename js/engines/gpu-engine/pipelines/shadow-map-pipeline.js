import { uploadShader } from "../../../utilities/wgpu-utils.js";

export async function getShadowMapPipeline(device) {
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

    const shaderModule = await uploadShader(device, "../../../../shaders/shadow-map.wgsl");

    const sceneBindGroupLayout = device.createBindGroupLayout({
        label: "shadow-scene-bind-group-layout",
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

    const pipelineLayout = device.createPipelineLayout({
        label: "main-pipeline-layout",
        bindGroupLayouts: [
            sceneBindGroupLayout
        ]
    });

    const pipelineDescriptor = {
        label: "shadow-map-pipeline",
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: "vertex_main",
            buffers: vertexBufferDescriptor
        },
        primitive: {
            topology: "triangle-list",
            frontFace: "ccw",
            cullMode: "back"
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            depthBias: 1000000,
            depthBiasSlopeScale: 2.0,
            format: "depth32float"
        },
    };
    return device.createRenderPipeline(pipelineDescriptor);
}
