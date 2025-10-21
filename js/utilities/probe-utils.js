import { getProjectionMatrix, getWorldToCameraMatrixFromDirection } from "./vector.js";

// Cubemaps defined like [+X, -X, +Y, -Y, +Z, -Z]
/**
 * 
 * @param {Float32Array} position 
 * @returns 
 */
export function getProbeViewMatrices(position) {
    return [
        [1,0,0],
        [-1,0,0],
        [0,1,0],
        [0,-1,0],
        [0,0,1],
        [0,0,-1]
    ].map(direction => getWorldToCameraMatrixFromDirection(position, direction));
}

export function getProbeProjectionMatrix(resolution) {
    return getProjectionMatrix(
        resolution,
        resolution,
        90,
        0.01,
        5
    );
}