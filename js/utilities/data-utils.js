import { loadObj } from "./obj-loader.js";
import { Mesh } from "../entities/mesh.js";

export function downloadUrl(url, fileName) {
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
}
export function downloadBlob(blob, fileName) {
	const url = URL.createObjectURL(blob);
	downloadUrl(url, fileName);
	URL.revokeObjectURL(url);
}
/**
 * Loads an .obj file
 * @param {GPUDevice} device 
 * @param {string} url 
 * @param {{ color?: [number, number, number, number], reverseWinding?: boolean, name?: string }} options
 * @returns 
 */
export async function fetchObjMesh(url, options = {}) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Could not fetch obj content from ${url}`);
	const objText = await response.text();
	const objContent = loadObj(objText, { color: options.color, reverseWinding: options.reverseWinding });
	const mesh = new Mesh(objContent);
	mesh.name = options.name
	return mesh;
}	