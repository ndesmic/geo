//@ts-check
// align / size https://www.w3.org/TR/WGSL/#alignment-and-size
/**@type {Record<string,{align:number,size:number}>}  */

import { getValuesFromEntriesRecursive } from "./array-utils.js";

/**@constant */
const gpuTypeAlignSize = {
	bool: { align: 4, size: 4},
	i32: { align: 4, size: 4},
	u32: { align: 4, size: 4},
	f32: { align: 4, size: 4},
	f16: { align: 2, size: 2},
	atomic: { align: 4, size: 4},
	vec2bool: { align: 8, size: 8},
	vec2i32: { align: 8, size: 8},
	vec2u32: { align: 8, size: 8},
	vec2f32: { align: 8, size: 8},
	vec2f16: { align: 4, size: 4},
	vec3bool: { align: 16, size: 12},
	vec3i32: { align: 16, size: 12},
	vec3u32: { align: 16, size: 12},
	vec3f32: { align: 16, size: 12},
	vec3f16: { align: 8, size: 6},
	vec4bool: { align: 16, size: 16},
	vec4i32: { align: 16, size: 16},
	vec4u32: { align: 16, size: 16},
	vec4f32: { align: 16, size: 16},
	vec4f16: { align: 8, size: 8},
	mat2x2f32: { align: 8, size: 16},
	mat2x2f16: { align: 4, size: 8},
	mat3x2f32: { align: 8, size: 24},
	mat3x2f16: { align: 4, size: 12},
	mat4x2f32: { align: 8, size: 32},
	mat4x2f16: { align: 4, size: 16},
	mat2x3f32: { align: 16, size: 32},
	mat2x3f16: { align: 8, size: 16},
	mat3x3f32: { align: 16, size: 48},
	mat3x3f16: { align: 8, size: 24},
	mat4x3f32: { align: 16, size: 64},
	mat4x3f16: { align: 8, size: 32},
	mat2x4f32: { align: 16, size: 32},
	mat2x4f16: { align: 8, size: 16},
	mat3x4f32: { align: 16, size: 48},
	mat3x4f16: { align: 8, size: 24},
	mat4x4f32: { align: 16, size: 64},
	mat4x4f16: { align: 8, size: 32}
};
/**
 * @typedef {keyof gpuTypeAlignSize} GpuScalarType
 * @typedef {GpuScalarType | GpuScalarType[] } GpuType
 */

/**
 * 
 * @param {Float32Array} buffer 
 * @param {ArrayLike | undefined} attributes 
 * @param {number} index 
 * @param {number} attributeOffset offset in terms of indices (not bytes, assume f32)
 * @param {number | undefined} vertexLength number of values per vertex 
 * @param {number} elementStride number of indicies per element
 * @returns 
 */
function packAttribute(buffer, attributes, index, attributeOffset, vertexLength, elementStride){
	if(!vertexLength || !attributes) return;
	for (let j = 0; j < vertexLength; j++) {
		buffer[index * elementStride + attributeOffset + j] = attributes[index * vertexLength + j]
	}
}
/**
 * 
 * @param {{ 
 * 	positions: Float32Array, 
 *  colors?: Float32Array, 
 *  uvs?: Float32Array, 
 *  normals?: Float32Array, 
 *  tangents?: Float32Array,
 *  vertexLength: number, 
 *  positionSize?: number, 
 *  colorSize?: number, 
 *  uvSize?: number, 
 *  normalSize?: number, 
 *  tangentSize?: number 
 * }} mesh 
 */
export function packMesh(mesh){
	const stride = (mesh.positionSize ?? 0) + (mesh.colorSize ?? 0) + (mesh.uvSize ?? 0) + (mesh.normalSize ?? 0) + (mesh.tangentSize ?? 0); //stride in terms of indices (not bytes, assume F32s)
	const buffer = new Float32Array(stride * mesh.vertexLength);

	const positionOffset = 0;
	const colorOffset = mesh.positionSize ?? 0;
	const uvOffset = colorOffset + (mesh.colorSize ?? 0);
	const normalOffset = uvOffset + (mesh.uvSize ?? 0);
	const tangentOffset = uvOffset + (mesh.uvSize ?? 0);

	for(let i = 0; i < mesh.vertexLength; i++){
		packAttribute(buffer, mesh.positions, i, positionOffset, mesh.positionSize, stride);
		packAttribute(buffer, mesh.colors, i, colorOffset, mesh.colorSize, stride);
		packAttribute(buffer, mesh.uvs, i, uvOffset, mesh.uvSize, stride);
		packAttribute(buffer, mesh.normals, i, normalOffset, mesh.normalSize, stride);
		packAttribute(buffer, mesh.tangents, i, tangentOffset, mesh.tangentSize, stride);
	}

	return buffer;
}

/**
 * @typedef {[string|((object)=>string),GpuType | Prop[]]} Prop
 * @typedef {Prop[]} Schema
 * 
 * @param {object} data 
 * @param {Schema} schema
 * @param {{ minSize?: number, buffer?: ArrayBuffer, offset?: number, arrayCount?: number }} options
 */
export function packStruct(data, schema, options = {}){
	const offset = options.offset ?? 0;
	const { offsets, totalSize } = getAlignments(getValuesFromEntriesRecursive(schema),	{ minSize: options.minSize, arrayCount: options.arrayCount });
	const outBuffer = options.buffer ?? new ArrayBuffer(totalSize);
	const dataView = new DataView(outBuffer);

	for(let i = 0; i < schema.length; i++){
		const [name, type] = schema[i];
		let value;
		if(typeof(name) === "function"){
			value = name(data);
		} else {
			value = data[name];
		}
		//TODO: add other GPU Types
		const totalOffset = offset + offsets[i];
		switch(type){
			case "i32": {
				dataView.setInt32(totalOffset, value, true);
				break;
			}
			case "u32": {
				dataView.setUint32(totalOffset, value, true);
				break;
			}
			case "f32": {
				dataView.setFloat32(totalOffset, value, true);
				break;
			}
			case "vec2f32": {
				dataView.setFloat32(totalOffset, value[0], true);
				dataView.setFloat32(totalOffset + 4, value[1], true);
				break;
			}
			case "vec3f32": {
				dataView.setFloat32(totalOffset, value[0], true);
				dataView.setFloat32(totalOffset + 4, value[1], true);
				dataView.setFloat32(totalOffset + 8, value[2], true);
				break;
			}
			case "vec4f32": {
				dataView.setFloat32(totalOffset, value[0], true);
				dataView.setFloat32(totalOffset + 4, value[1], true);
				dataView.setFloat32(totalOffset + 8, value[2], true);
				dataView.setFloat32(totalOffset + 12, value[3], true);
				break;
			}
			case "mat2x2f32": {
				dataView.setFloat32(totalOffset, value[0], true);
				dataView.setFloat32(totalOffset + 4, value[1], true);

				dataView.setFloat32(totalOffset + 8, value[2], true);
				dataView.setFloat32(totalOffset + 12, value[3], true);
				break;
			}
			case "mat3x3f32": {
				dataView.setFloat32(totalOffset, value[0], true);
				dataView.setFloat32(totalOffset + 4, value[1], true);
				dataView.setFloat32(totalOffset + 8, value[2], true);

				dataView.setFloat32(totalOffset + 16, value[3], true);
				dataView.setFloat32(totalOffset + 20, value[4], true);
				dataView.setFloat32(totalOffset + 24, value[5], true);

				dataView.setFloat32(totalOffset + 32, value[6], true);
				dataView.setFloat32(totalOffset + 36, value[7], true);
				dataView.setFloat32(totalOffset + 40, value[8], true);
				break;
			}
			case "mat4x4f32": {
				dataView.setFloat32(totalOffset, value[0], true);
				dataView.setFloat32(totalOffset + 4, value[1], true);
				dataView.setFloat32(totalOffset + 8, value[2], true);
				dataView.setFloat32(totalOffset + 12, value[3], true);

				dataView.setFloat32(totalOffset + 16, value[4], true);
				dataView.setFloat32(totalOffset + 20, value[5], true);
				dataView.setFloat32(totalOffset + 24, value[6], true);
				dataView.setFloat32(totalOffset + 28, value[7], true);

				dataView.setFloat32(totalOffset + 32, value[8], true);
				dataView.setFloat32(totalOffset + 36, value[9], true);
				dataView.setFloat32(totalOffset + 40, value[10], true);
				dataView.setFloat32(totalOffset + 44, value[11], true);

				dataView.setFloat32(totalOffset + 48, value[12], true);
				dataView.setFloat32(totalOffset + 52, value[13], true);
				dataView.setFloat32(totalOffset + 56, value[14], true);
				dataView.setFloat32(totalOffset + 60, value[15], true);
				break;
			}
			default: {
				if(Array.isArray(type)){
					packArray(value, /** @type {Prop[]}*/(type), { buffer: outBuffer, offset: totalOffset });
				} else {
					throw new Error(`Cannot pack type ${type} at prop index ${i} with value ${value}`);
				}
			}
		}
	}

	return outBuffer;
}

/**
 * 
 * @param {object} data 
 * @param {Prop[]} schema 
 * @param {{ minSize?: number, offset?: number, buffer?: ArrayBuffer }} options 
 * @returns 
 */
export function packArray(data, schema, options = {}){
	const offset = options.offset ?? 0;
	const { totalSize: structSize } = getAlignments(getValuesFromEntriesRecursive(schema), { minSize: options.minSize });
	const totalSize = structSize * data.length;
	const outBuffer = options.buffer ?? new ArrayBuffer(totalSize);
	for(let i = 0; i < data.length; i++){
		packStruct(data[i], schema, {
			minSize: options.minSize, 
			buffer: outBuffer, 
			offset: offset + i * structSize
		});
	}
	return outBuffer;
}

/**
 * 
 * @param {object} data 
 * @param {Prop[]} schema 
 * @param {{ minSize?: number, offset?: number, buffer?: ArrayBuffer }} options 
 * @returns 
 */
export function pack(data, schema, options = {}){
	if(Array.isArray(data)){
		return packArray(data, schema, options);
	}
	return packStruct(data, schema, options);
}

export function getAlignSize(type, count = 1){
	if(Array.isArray(type)){
		let offset = 0;
		let maxAlign = 0;
		for(let i = 0; i < type.length; i++){
			const { align, size } = getAlignSize(type[i]);
			if(maxAlign < align){
				maxAlign = align;
			}
			offset = getPaddedSize(offset, align);
			offset += size;
		}
		offset = getPaddedSize(offset, maxAlign);
		const size  = offset * count;
		return { align: 16, size  };
	}
	return gpuTypeAlignSize[type];
}

/**
 * 
 * @param {number} size 
 * @param {number} smallestUnitSize
 * @param {number} minSize
 * @returns
 */
export function getPaddedSize(size, smallestUnitSize, minSize = 0) {
	const remainder = size % smallestUnitSize;
	if (remainder === 0) {
		return size > minSize ? size : minSize;
	}
	const computedSize = size + smallestUnitSize - remainder;
	return computedSize > minSize ? computedSize : minSize;
}

export function getPaddedBuffer(buffer, smallestUnitSize, minSize){
	const newSize = getPaddedSize(buffer.byteLength, smallestUnitSize, minSize);
	if(newSize === buffer.byteLength) return buffer;
	const newBuffer = new ArrayBuffer(newSize);
	const newBufferView = new Uint8Array(newBuffer);
	const oldBufferView = new Uint8Array(buffer);
	newBufferView.set(oldBufferView, 0);
	return newBuffer;
}

/**
 * @param {GpuType[]} typesToPack
 * @param {{ minSize?: number, arrayCount?: number }} options
 */
export function getAlignments(typesToPack, options = {}){
	let offset = 0;
	let maxAlign = 0;
	const offsets = new Array(typesToPack.length);

	for(let i = 0; i < typesToPack.length; i++){
		if(Array.isArray(typesToPack[i]) && i !== typesToPack.length - 1){
			throw new Error("Array must be the last element in a struct!");
		}
		const { align: alignment, size } = getAlignSize(typesToPack[i], options.arrayCount);

		if(maxAlign < alignment){
			maxAlign = alignment;
		}

		offset = getPaddedSize(offset, alignment);
		offsets[i] = offset;
		offset += size;
	}
	return {
		offsets,
		maxAlign,
		totalSize: getPaddedSize(offset, maxAlign, options.minSize)
	};
}

export function roundSmallMagnitudeValues(array, threshold = 1e-7){
	const newArray = new Float32Array(array);
	for(let i = 0; i < array.length; i++){
		newArray[i] = Math.abs(newArray[i]) < threshold ? 0 : newArray[i];
	}
	return newArray;
}