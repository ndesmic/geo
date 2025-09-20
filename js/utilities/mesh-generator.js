import { sphericalToCartesian, inverseLerp, TWO_PI } from "./math-helpers.js";

/**
 * @typedef {{ positions: Float32Array, colors?: Float32Array, uvs?: Float32Array, normals?: Float32Array, length: number }} MeshData
 */

/**
 * 
 * @param {number} density 
 * @param {{ uvOffset?: number }} options 
 * @returns {MeshData}
 */

export function uvSphere(density, { uvOffset } = {}){
	const radiansPerUnit = Math.PI / density;
	const pointsPerRing = density * 2;
	const vertexLength = ((density + 1) * (pointsPerRing + 1)) - 2; //poles don't need UV overlap vertex
	const uOffset = uvOffset?.u ?? 0;
	const vOffset = uvOffset?.y ?? 0;

	//positions
	const positions = new Float32Array(vertexLength * 3);
	const uvs = new Float32Array(vertexLength * 2);
	const normals = new Float32Array(vertexLength * 3);

	{
		let positionBufferIndex = 0;
		let uvBufferIndex = 0;
		let normalBufferIndex = 0;
		let latitude = -Math.PI / 2;

		for(let i = 0; i <= density; i++){
			let longitude = 0;
			const vertexLength = pointsPerRing + (i > 0 && i < density ? 1 : 0); //middle rings have one overlap for U value

			for(let j = 0; j < vertexLength; j++){
				const position = sphericalToCartesian([latitude, longitude, 1]);
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
	//pointsPerRing faces with 6 verts each (quad) for middle layers, pointsPerRing faces with 3 verts (tris) for top and bottom (2)
	const indices = new Uint16Array(((density - 2) * pointsPerRing * 6) + (2 * pointsPerRing * 3));
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
				} else if(ring === density - 1){
					indices.set([currentPoint, nextPoint, nextRingPoint], indexBufferIndex);
					indexBufferIndex += 3;
				} else if(ring > 0 && ring < density - 1 && density > 2){
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
		positionSize: 3,
		uvs,
		uvSize: 2,
		normals,
		normalSize: 3,
		indices,
		vertexLength
	};
}

/**
 * Generates a quad facing negative Z, like a wall
 * @returns {MeshData}
 */
export function quad(){
	return {
		positions: new Float32Array([
			-1.0, -1.0, 0.0,
			1.0, -1.0, 0.0,
			1.0, 1.0, 0.0,
			-1.0, 1.0, 0.0,
		]),
		positionSize: 3,
		uvs: new Float32Array([
			0.0, 1.0,
			1.0, 1.0,
			1.0, 0.0,
			0.0, 0.0,
		]),
		uvSize: 2,
		normals: new Float32Array([
			0, 0, -1,
			0, 0, -1,
			0, 0, -1,
			0, 0, -1
		]),
		normalSize: 3,
		indices: [0,1,2,0,2,3],
		vertexLength: 4
	}
}

/**
 * Generate a triangle that covers the whole screen
 * @returns {MeshData}
 */
export function screenTri(){
	return {
		positions: new Float32Array([
			-1.0, -1.0,
			3.0, -1.0,
			-1.0, 3.0
		]),
		positionSize: 2,
		uvs: new Float32Array([
			0.0, -1.0,
			3.0, 1.0,
			0.0, 3.0,
		]),
		uvSize: 2,
		normals: new Float32Array([
			0, 0, -1,
			0, 0, -1,
			0, 0, -1
		]),
		indices: [0,1,2],
		vertexLength: 3
	}
}

/**
 * Generates a flat surface made up of multiple quads, faces +Y, each quad is 1x1
 * @param {number} rowCount 
 * @param {number} colCount 
 */
export function surfaceGrid(rowCount, colCount){
	const vertexLength = (rowCount + 1) * (colCount + 1);
	const positions = new Float32Array(vertexLength * 3);
	const uvs = new Float32Array(vertexLength * 2);
	const normals = new Float32Array(vertexLength * 3);
	const tangents = new Float32Array(vertexLength * 3);
	const indices = new Int16Array(rowCount * colCount * 6);

	let z = -(rowCount / 2);

	for (let row = 0; row < rowCount + 1; row++) {
		let x = -(colCount / 2);
		for (let col = 0; col < colCount + 1; col++) {
			positions.set([
				x, 0, z 
			], (row * (colCount + 1) + col) * 3);
			uvs.set([
				col / colCount, row / rowCount
			], (row * (colCount + 1) + col) * 2);
			normals.set([
				0, 1, 0
			], (row * (colCount + 1) + col) * 3);
			tangents.set([
				1, 0, 0
			], (row * (colCount + 1) + col) * 3)
			x++;
		}
		z++;
	}

	for(let row = 0; row < rowCount; row++){
		for(let col = 0; col < colCount; col++){
			const index = row * (colCount + 1) + col;
			indices.set([
				index, index + 1, index + colCount + 2, //take into account the extra vert at end of row
				index, index + colCount + 2, index + colCount + 1
			], (row * colCount + col) * 6);
		}
	}

	return {
		positions,
		uvs,
		normals,
		indices,
		tangents,
		vertexLength
	};
}

/**
 * Generates a quad facing negative Z, like a wall
 * @returns {MeshData}
 */
export function cube(){
	return {
		positions: new Float32Array([
			//front
			-1, -1, -1,
			1, -1, -1,
			1, 1, -1, 
			-1, 1, -1,
			//right
			1, -1, -1,
			1, -1, 1,
			1, 1, 1,
			1, 1, -1,
			//back
			1, -1, 1,
			-1, -1,	1,
			-1, 1, 1,
			1, 1, 1,
			//left
			-1, -1, 1,
			-1, -1, -1,
			-1, 1, -1,
			-1, 1, 1,
			//top
			-1, 1, -1,
			1, 1, -1, 
			1, 1, 1,
			-1, 1, 1,
			//bottom
			1, -1, -1,
			-1, -1, -1,
			-1, -1, 1,
			1, -1, 1
		]),
		positionSize: 3,
		uvs: new Float32Array([
			0, 1,
			1, 1,
			1, 0,
			0, 0,

			0, 1,
			1, 1,
			1, 0,
			0, 0,

			1, 1,
			0, 1,
			0, 0,
			1, 0,

			0, 1,
			1, 1,
			1, 0,
			0, 0,

			0, 1,
			1, 1,
			1, 0,
			0, 0,

			0, 1,
			1, 1,
			1, 0,
			0, 0
		]),
		uvSize: 2,
		normals: new Float32Array([
			0, 0, -1,
			0, 0, -1,
			0, 0, -1,
			0, 0, -1,

			1, 0, 0,
			1, 0, 0,
			1, 0, 0,
			1, 0, 0,

			0, 0, 1,
			0, 0, 1,
			0, 0, 1,
			0, 0, 1,

			-1, 0, 0,
			-1, 0, 0,
			-1, 0, 0,
			-1, 0, 0,

			0, 1, 0,
			0, 1, 0,
			0, 1, 0,
			0, 1, 0
		]),
		normalSize: 3,
		indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
		vertexLength: 24
	}
}
