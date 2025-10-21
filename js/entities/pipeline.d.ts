import type { Mesh } from "./mesh.js"
import type { Light } from "./light.js";
import type { Material } from "./material.js";
import type { Probe } from "./probe.js";
import type { Camera } from "./camera.js"; 


import { IBackground } from "../engines/gpu-engine/pipelines/background-pipeline.js";

type MeshContainer = {
    mesh: Mesh,
    vertexBuffer: GPUBuffer,
    indexBuffer: GPUBuffer
};

export type RenderInfo = {
    meshContainers: Map<Mesh, MeshContainer>,
    lights: Map<string | symbol, Light>,
    shadowMaps: Map<string | symbol, GPUTexture>,
    textures: Map<string | symbol, GPUTexture>,
    samplers: Map<string | symbol, GPUSampler>,
    materials: Map<string | symbol, Material>,
    probes: Map<string | symbol, Probe>,
    cameras: Map<string | symbol, Camera>,
    background?: IBackground
}

type AttachmentViews = {
    colorView: GPUTextureView,
    depthView: GPUTextureView
}

export interface IPipeline {
    createPipeline(device: GPUDevice): Promise<void>
    render(device: GPUDevice, root: any, attachmentViews: AttachmentViews | null, info: RenderInfo): void
}