import { loadImage } from "./image-utils.js";
import { packMesh, getPaddedSize } from "./buffer-utils.js";
import { Mesh } from "../entities/mesh.js";

/**
 * Loads an image url, uploads to GPU and returns texture ref.
 * Cubemaps defined like [+X, -X, +Y, -Y, +Z, -Z]
 * @param {GPUDevicee} device 
 * @param {string | string[]} urlOrUrls 
 * @param {*} options 
 */
export async function uploadTexture(device, urlOrUrls, options = {}) {
	const urls = [].concat(urlOrUrls);
	const images = await Promise.all(urls.map(url => loadImage(url)));

	const size = {
		width: images[0].width,
		height: images[0].height,
		depthOrArrayLayers: images.length
	};

	const texture = device.createTexture({
		size,
		dimension: "2d",
		format: `rgba8unorm`,
		usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
	});

	images.forEach((img, layer) => {
		device.queue.copyExternalImageToTexture(
			{
				source: img,
				flipY: true
			},
			{
				texture,
				origin: [0, 0, layer]
			},
			{
				width: img.width,
				height: img.height,
				depthOrArrayLayers: 1
			}
		);
	});

	return texture;
}

/**
 * 
 * @param {GPUDevice} device 
 * @param {Mesh} mesh 
 * @param {{ label?: string }} options 
 */
export function uploadMesh(device, mesh, options = {}){
	const vertices = packMesh(mesh);
	
	const vertexBuffer = device.createBuffer({
		label: options.label,
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(vertexBuffer, 0, vertices);
	
	const paddedIndexSize = getPaddedSize(mesh.indices.byteLength, 4);
	const indexBuffer = device.createBuffer({
		label: `${options.label}-indices`,
		size: paddedIndexSize,
		usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
	});
	let indexData = mesh.indices;
	if(paddedIndexSize !== mesh.indices.byteLength){
		indexData = new ArrayBuffer(paddedIndexSize);
		const indicesAsUint = new Uint16Array(indexData);
		indicesAsUint.set(mesh.indices, 0);
	}

	device.queue.writeBuffer(indexBuffer, 0, indexData);

	return {
		vertexBuffer,
		indexBuffer
	};
}

/**
 * 
 * @param {GPUDevice} device 
 * @param {string} url 
 * @param {*} options 
 * @returns 
 */
export async function uploadShader(device, url, options = {}) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Could not fetch text content from ${url}`);
	const code = await response.text();

	const shaderModule = device.createShaderModule({
		label: options.label ?? url,
		code
	});

	const compilationInfo = await shaderModule.getCompilationInfo();
	if(compilationInfo.messages.length > 0){
		throw new Error(`Failed to compile shader ${url}.`);
	}

	return shaderModule;
}

/**
 * 
 * @param {Mesh} mesh 
 * @returns {GPUVertexBufferLayout}
 */
export function getVertexBufferLayout(mesh){
	const attributes = [];
	let index = 0;
	let offset = 0;

	for(const [attrName, sizeAttrName] of Mesh.attributeOrdering){
		if(mesh[attrName]?.length > 0 && mesh[sizeAttrName] > 0){
			attributes.push({
				shaderLocation: index,
				offset,
				format: `float32x${mesh[sizeAttrName]}`
			});
			index++;
			offset += 4 * mesh[sizeAttrName];
		}
	}

	return [{
		attributes,
		arrayStride: offset,
		stepMode: "vertex"
	}];
}