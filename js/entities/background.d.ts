import type { Mesh } from "./mesh.js";

export interface IBackground {
    sampler: string | symbol;
    environmentMap: string | symbol;
    mesh: Mesh
}