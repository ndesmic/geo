
/**
 * 
 * @param {Float32Array} buffer 
 * @param {Array} attributes 
 * @param {number} index 
 * @param {number} attributeOffset offset in terms of indices (not bytes, assume f32)
 * @param {number} attributeLength number of values per vertex 
 * @param {number} elementStride number of indicies per element
 * @returns 
 */
function packAttribute(buffer, attributes, index, attributeOffset, attributeLength, elementStride){
	if(!attributeLength) return;
	for (let j = 0; j < attributeLength; j++) {
		buffer[index * elementStride + attributeOffset + j] = attributes[index * attributeLength + j]
	}
}
/**
 * 
 * @param {{ positions: Float32Array, colors?: Float32Array, uvs?: Float32Array, normals?: Float32Array, indices?: Float32Array, length: number }} meshAttributes 
 * @param {{ positionSize?: number, colorSize?: number, indices: boolean, uvSize?: number, normalSize?: number }} options number of 32-bit elements per vertex
 */
export function packMesh(meshAttributes, options){
	const stride = (options.positionSize ?? 0) + (options.colorSize ?? 0) + (options.uvSize ?? 0) + (options.normalSize ?? 0); //stride in terms of indices (not bytes, assume F32s)
	const buffer = new Float32Array(stride * meshAttributes.length);

	const positionOffset = 0;
	const colorOffset = options.positionSize ?? 0;
	const uvOffset = colorOffset + (options.colorSize ?? 0);
	const normalOffset = uvOffset + (options.uvSize ?? 0);

	for(let i = 0; i < meshAttributes.length; i++){
		packAttribute(buffer, meshAttributes.positions, i, positionOffset, options.positionSize, stride);
		packAttribute(buffer, meshAttributes.colors, i, colorOffset, options.colorSize, stride);
		packAttribute(buffer, meshAttributes.uvs, i, uvOffset, options.uvSize, stride);
		packAttribute(buffer, meshAttributes.normals, i, normalOffset, options.normalSize, stride);
	}

	return buffer;
}


const gpuTypeAlignSize = {
	bool: [4,4],
	i32: [4,4],
	u32: [4,4],
	f32: [4,4],
	f16: [2,2],
	atomic: [4,4],
	vec2bool: [8,8],
	vec2i32: [8,8],
	vec2u32: [8,8],
	vec2f32: [8,8],
	vec2f16: [4,4],
	vec3bool: [16,12],
	vec3i32: [16,12],
	vec3u32: [16,12],
	vec3f32: [16,12],
	vec3f16: [8,6],
	vec4bool: [16,16],
	vec4i32: [16,16],
	vec4u32: [16,16],
	vec4f32: [16,16],
	vec4f16: [8,8],
	mat2x2f32: [8,16],
	mat2x2f16: [4,8],
	mat3x2f32: [8,24],
	mat3x2f16: [4,12],
	mat4x2f32: [8,32],
	mat4x2f16: [4,16],
	mat2x3f32: [16,32],
	mat2x3f16: [8,16],
	mat3x3f32: [16,48],
	mat3x3f16: [8,24],
	mat4x3f32: [16,64],
	mat4x3f16: [8,32],
	mat2x4f32: [16,32],
	mat2x4f16: [8,16],
	mat3x4f32: [16,48],
	mat3x4f16: [8,24],
	mat4x4f32: [16,64],
	mat4x4f16: [8,32]
}


/**
 * 
 * @param {number} size 
 * @param {number} smallestUnitSize 
 * @returns
 */
export function getPaddedSize(size, smallestUnitSize) {
	const remainder = size % smallestUnitSize;
	if (remainder === 0) {
		return size;
	}
	return size + smallestUnitSize - remainder;
}

export function getPaddedBuffer(buffer, smallestUnitSize){
	const newSize = getPaddedSize(buffer.byteLength, smallestUnitSize);
	if(newSize === buffer.byteLength) return buffer;
	const newBuffer = new Float32Array(newSize);
	newBuffer.set(buffer, 0);
	return newBuffer;
}

/**
 * @typedef {keyof gpuTypeAlignSize} GpuType
 * @param {GpuType[]} typesToPack 
 */
export function getAlignments(typesToPack){
	let offset = 0;
	let maxAlign = 0;
	const offsets = new Array(typesToPack.length);
	for(let i = 0; i < typesToPack.length; i++){
		const alignmentSize = gpuTypeAlignSize[typesToPack[i]];
		if(maxAlign < alignmentSize[0]){
			maxAlign = alignmentSize[0];
		}
		offset = getPaddedSize(offset, alignmentSize[0])
		offsets[i] = offset;
		offset += alignmentSize[1];
	}
	return {
		offsets,
		totalSize: getPaddedSize(offset, maxAlign)
	};
}