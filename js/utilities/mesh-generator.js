import { latLngToCartesian, inverseLerp, TWO_PI } from "./math-helpers.js";

/**
 * @typedef {{ positions: Float32Array, colors?: Float32Array, uvs?: Float32Array, normals?: Float32Array, length: number }} Mesh
 */

/**
 * 
 * @param {number} density 
 * @param {{ uvOffset?: number }} options 
 * @returns {Mesh}
 */

export function uvSphere(density, { uvOffset } = {}){
	const radiansPerUnit = Math.PI / density;
	const pointsPerRing = density * 2;
	const totalVertices = ((density + 1) * (pointsPerRing + 1)) - 2; //poles don't need UV overlap vertex
	const uOffset = uvOffset?.u ?? 0;
	const vOffset = uvOffset?.y ?? 0;

	//positions
	const positions = new Float32Array(totalVertices * 3);
	const uvs = new Float32Array(totalVertices * 2);
	const normals = new Float32Array(totalVertices * 3);

	{
		let positionBufferIndex = 0;
		let uvBufferIndex = 0;
		let normalBufferIndex = 0;
		let latitude = -Math.PI / 2;

		for(let i = 0; i <= density; i++){
			let longitude = 0;
			const vertexLength = pointsPerRing + (i > 0 && i < density ? 1 : 0); //middle rings have one overlap for U value

			for(let j = 0; j < vertexLength; j++){
				const position = latLngToCartesian([latitude, longitude, 1]);
				positions.set(position, positionBufferIndex);
				positionBufferIndex += 3;

				uvs.set([
					inverseLerp(0, TWO_PI, longitude) + uOffset,
					inverseLerp(-Math.PI / 2, Math.PI / 2, latitude) + vOffset
				], uvBufferIndex);
				uvBufferIndex += 2;

				normals.set(position, normalBufferIndex); //unit sphere so these are the same as positions
				normalBufferIndex += 2;

				longitude += radiansPerUnit;
			}
			latitude += radiansPerUnit; //next ring
		}
	}

	//indices/triangles
	const indices = new Uint16Array(density * pointsPerRing * 6);
	{
		const sliceVertexCount = density * 2;
		let indexBufferIndex = 0;
		let ringStartPoint = 0;

		for (let ring = 0; ring < density; ring++) { // start at first ring
			const vertexBump = (ring > 0 ? 1 : 0);

			for (let sliceVertex = 0; sliceVertex < sliceVertexCount; sliceVertex++) {
				//making quads
				const currentPoint = ringStartPoint + sliceVertex;
				const nextPoint = ringStartPoint + sliceVertex + 1;
				const nextRingPoint = currentPoint + sliceVertexCount + vertexBump;
				const nextRingNextPoint = nextPoint + sliceVertexCount + vertexBump;

				if(ring === 0){
					indices.set([currentPoint, nextRingNextPoint, nextRingPoint], indexBufferIndex);
					indexBufferIndex += 3;
				}
				if(ring === density - 1){
					indices.set([currentPoint, nextPoint, nextRingPoint], indexBufferIndex);
					indexBufferIndex += 3;
				}
				if(ring > 0 && ring < density - 1 && density > 2){
					indices.set([
						currentPoint,
						nextRingNextPoint,
						nextRingPoint,
						currentPoint,
						nextPoint,
						nextRingNextPoint
					], indexBufferIndex);
					indexBufferIndex += 6;
				}
			}
			if (ring === 0) {
				ringStartPoint += sliceVertexCount;
			} else {
				ringStartPoint += sliceVertexCount + 1;
			}
		}
	}

	return {
		positions,
		uvs,
		normals,
		indices,
		length: totalVertices
	};
}

/**
 * Generates a quad facing negative Z, like a wall
 * @returns {Mesh}
 */
export function quad(){
	return {
		positions: new Float32Array([
			-1.0, -1.0, 0.0,
			1.0, -1.0, 0.0,
			1.0, 1.0, 0.0,
			-1.0, 1.0, 0.0,
		]),
		uvs: new Float32Array([
			0.0, 1.0,
			1.0, 1.0,
			1.0, 0.0,
			0.0, 0.0,
		]),
		indices: [0,1,2,0,2,3],
		length: 4
	}
}

/**
 * Generates a screen space quad. For UI/backgrounds
 * @returns {Mesh}
 */
export function screenQuad() {
	return {
		positions: new Float32Array([
			-1.0, -1.0,
			1.0, -1.0,
			1.0, 1.0,
			-1.0, 1.0,
		]),
		uvs: new Float32Array([
			0.0, 1.0,
			1.0, 1.0,
			1.0, 0.0,
			0.0, 0.0,
		]),
		indices: [0, 1, 2, 0, 2, 3],
		length: 4
	}
}