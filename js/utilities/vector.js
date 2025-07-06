export function getRotationXMatrix(theta) {
	return new Float32Array([
		1, 0, 0, 0,
		0, Math.cos(theta), -Math.sin(theta), 0,
		0, Math.sin(theta), Math.cos(theta), 0,
		0, 0, 0, 1
	]);
}

export function getRotationYMatrix(theta) {
	return Float32Array([
		Math.cos(theta), 0, Math.sin(theta), 0,
		0, 1, 0, 0,
		-Math.sin(theta), 0, Math.cos(theta), 0,
		0, 0, 0, 1
	]);
}

export function getRotationZMatrix(theta) {
	return new Float32Array([
		Math.cos(theta), -Math.sin(theta), 0, 0,
		Math.sin(theta), Math.cos(theta), 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]);
}

export function getTranslationMatrix(x, y, z) {
	return new Float32Array([
		1, 0, 0, x,
		0, 1, 0, y,
		0, 0, 1, z,
		0, 0, 0, 1
	]);
}

export function getScaleMatrix(x, y, z){
	return new Float32Array([
		x, 0, 0, 0,
		0, y, 0, 0,
		0, 0, z, 0,
		0, 0, 0, 1
	]);
}

export function getIdentityMatrix() {
	return new Float32Array([
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]);
}

export function multiplyMatrixVector(vector, matrix) {
	//normalize 3 vectors
	if (vector.length === 3) {
		vector.push(1);
	}

	return [
		vector[0] * matrix[0][0] + vector[1] * matrix[0][1] + vector[2] * matrix[0][2] + vector[3] * matrix[0][3],
		vector[0] * matrix[1][0] + vector[1] * matrix[1][1] + vector[2] * matrix[1][2] + vector[3] * matrix[1][3],
		vector[0] * matrix[2][0] + vector[1] * matrix[2][1] + vector[2] * matrix[2][2] + vector[3] * matrix[2][3],
		vector[0] * matrix[3][0] + vector[1] * matrix[3][1] + vector[2] * matrix[3][2] + vector[3] * matrix[3][3]
	];
}

export function getVectorMagnitude(vec) {
	let sum = 0;
	for(const el of vec){
		sum += el ** 2;
	}
	return Math.sqrt(sum);
}

export function addVector(a, b) {
	return [
		a[0] + b[0],
		a[1] + b[1],
		a[2] + b[2]
	];
}

export function subtractVector(a, b) {
	return a.map((x, i) => x - b[i]);
}

export function scaleVector(vec, s) {
	return vec.map(x => x * s);
}

export function divideVector(vec, s) {
	return [
		vec[0] / s,
		vec[1] / s,
		vec[2] / s
	];
}

export function normalizeVector(vec) {
	return divideVector(vec, getVectorMagnitude(vec));
}

export function crossVector(a, b) {
	return new Float32Array([
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0]
	]);
}

/**
 * Gets dot product of 2 vectors, does not check if vectors are same length
 * @param {Float32Array} a 
 * @param {Float32Array} b 
 * @returns
 */
export function dotVector(a, b) {
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result += a[i] * b[i];
	}
	return result;
}

export function invertVector(vec){
	return vec.map(x => -x);
}

export function reflectVector(vec, normal) {
	return [
		vec[0] - 2 * dotVector(vec, normal) * normal[0],
		vec[1] - 2 * dotVector(vec, normal) * normal[1],
		vec[2] - 2 * dotVector(vec, normal) * normal[2],
	];
}

export const UP = [0, 1, 0];
export const FORWARD = [0, 0, 1];
export const RIGHT = [1, 0, 0];

// polygons
export function getVectorIntersectPlane(planePoint, planeNormal, lineStart, lineEnd) {
	planeNormal = normalizeVector(planeNormal);
	const planeDot = dotVector(planePoint, planeNormal);
	const startDot = dotVector(lineStart, planeNormal);
	const endDot = dotVector(lineEnd, planeNormal);
	const t = (planeDot - startDot) / (endDot - startDot);
	if (t === Infinity || t === -Infinity) {
		return null;
	}
	const line = subtractVector(lineEnd, lineStart);
	const deltaToIntersect = scaleVector(line, t);
	return addVector(lineStart, deltaToIntersect);
}

export function isPointInInsideSpace(point, planeNormal, planePoint) {
	planeNormal = normalizeVector(planeNormal);
	return dotVector(planeNormal, subtractVector(planePoint, point)) > 0;
}

//order matters! CCW from bottom to top
export function triangleNormal(pointA, pointB, pointC) {
	const vector1 = subtractVector(pointC, pointA);
	const vector2 = subtractVector(pointB, pointA);
	return normalizeVector(crossVector(vector1, vector2));
}

export function polyArea(points) {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const nextI = (i + 1) % points.length;
		sum += (points[i][0] * points[nextI][1]) - (points[nextI][0] * points[i][1]);
	}
	return Math.abs(sum) / 2;
}

export function getPolygonCentroid2d(points) {
	const area = polyArea(points);

	let sumX = 0;
	let sumY = 0;
	for (let i = 0; i < points.length; i++) {
		const nextI = (i + 1) % points.length;
		const x0 = points[i][0];
		const x1 = points[nextI][0];
		const y0 = points[i][1];
		const y1 = points[nextI][1];

		const doubleArea = (x0 * y1) - (x1 * y0);
		sumX += (x0 + x1) * doubleArea;
		sumY += (y0 + y1) * doubleArea;
	}

	const cx = sumX / (6 * area);
	const cy = sumY / (6 * area);

	return [cx, cy];
}

export function getPolygonCentroid3d(points) {
	const n = triangleNormal(points[0], points[1], points[2]);
	const u = normalizeVector(subtractVector(points[1], points[2]));
	const v = normalizeVector(crossVector(u, n));
	const p0 = points[0];

	const mappedPoints = points.map(p => [dotVector(subtractVector(p, p0), u), dotVector(subtractVector(p, p0), v)]);
	const [cu, cv] = getPolygonCentroid2d(mappedPoints);

	return [
		dotVector([p0[0], u[0], v[0]], [1, cu, cv]),
		dotVector([p0[1], u[1], v[1]], [1, cu, cv]),
		dotVector([p0[2], u[2], v[2]], [1, cu, cv])
	];
}

//Matrices

/**
 * Gets a row vector for a matrix
 * @param {Float32Array} matrix 
 * @param {[number, number]} shape 
 * @param {number} row 
 * @returns 
 */
export function getRow(matrix, shape, row) {
	const result = new Float32Array(shape[1]);
	for (let col = 0; col < shape[1]; col++) {
		result[col] = matrix[row * shape[1] + col];
	}
	return result;
}

/**
 * Gets a column vector from a matrix
 * @param {Float32Array} matrix 
 * @param {[number, number]} shape 
 * @param {number} col 
 * @returns 
 */

export function getColumn(matrix, shape, col) {
	const result = new Float32Array(shape[0]);
	for (let row = 0; row < shape[0]; row++) {
		result[row] = matrix[row * shape[1] + col];
	}
	return result;
}

/**
 * Multiplies 2 matrices. Sides must match [A,B] x [B,A], no validation done
 * @param {Float32Array} valuesA 
 * @param {[number,number]} shapeA 
 * @param {Float32Array} valuesB 
 * @param {[number,number]} shapeB 
 * @returns 
 */

export function multiplyMatrix(valuesA, shapeA, valuesB, shapeB) {
	const result = new Float32Array(shapeA[0] * shapeB[1]);
	for (let row = 0; row < shapeA[0]; row++) {
		for (let col = 0; col < shapeB[1]; col++) {
			result[row * shapeB[1] + col] = dotVector(getRow(valuesA, shapeA, row), getColumn(valuesB, shapeB, col));
		}
	}
	return result;
}

export function getProjectionMatrix(screenHeight, screenWidth, fieldOfView, zNear, zFar) {
	const aspectRatio = screenHeight / screenWidth;
	const fieldOfViewRadians = fieldOfView * (Math.PI / 180);
	const fovRatio = 1 / Math.tan(fieldOfViewRadians / 2);

	return new Float32Array([
		aspectRatio * fovRatio, 0, 0, 0,
		0, fovRatio, 0, 0,
		0, 0, zFar / (zFar - zNear), 1,
		0, 0, (-zFar * zNear) / (zFar - zNear), 0
	]);
}

export function getOrthoMatrix(left, right, bottom, top, near, far) {
	return new Float32Array([
		2 / (right - left), 0, 0, -(right + left) / (right - left),
		0, 2 / (top - bottom), 0, -(top + bottom) / (top - bottom),
		0, 0, -2 / (near - far), -(near + far) / (near - far),
		0, 0, 0, 1
	]);
}

export function getPointAtMatrix(position, target, up) {
	const forward = normalizeVector(subtractVector(target, position));
	const newUp = normalizeVector(subtractVector(up, scaleVector(forward, dotVector(up, forward))));
	const right = crossVector(newUp, forward);

	return [
		[right[0], right[1], right[2], 0],
		[newUp[0], newUp[1], newUp[2], 0],
		[forward[0], forward[1], forward[2], 0],
		[position[0], position[1], position[2], 1]
	];
}

export function getLookAtMatrix(position, target, up) {
	const forward = normalizeVector(subtractVector(target, position));
	const newUp = normalizeVector(subtractVector(up, scaleVector(forward, dotVector(up, forward))));
	const right = crossVector(newUp, forward);

	return new Float32Array([
		right[0], newUp[0], forward[0], 0,
		right[1], newUp[1], forward[1], 0,
		right[2], newUp[2], forward[2], 0,
		-dotVector(position, right), -dotVector(position, newUp), -dotVector(position, forward), 1
	]);
}

/**
 * Transposes a matrix
 * @param {Float32Array} matrix 
 * @param {[number,number]} shape rowCOunt,colCount 
 * @returns 
 */
export function getTranspose(matrix, shape) {
	const result = new Float32Array(matrix.length);
	for (let row = 0; row < shape[0]; row++) {
		for (let col = 0; col < shape[1]; col++) {
			result[row * shape[1] + col] = matrix[col * shape[0] + row];
		}
	}
	return result;
}

/**
 * Gets the submatrix for determinants greater than 2x2 (removes the row and col and returns new matrix)
 * @param {Float32Array} matrix 
 * @param {[number, number]} shape 
 * @param {number} row 
 * @param {number} col 
 * @returns 
 */
export function getDeterminantSubmatrix(matrix, shape, row, col) {
	const newShape = [shape[0] - 1, shape[1] -1];
	const result = new Float32Array(newShape[1] * newShape[0]);

	let newRow = 0;
	for (let i = 0; i < shape[0]; i++) {
		if (i === row) continue;
		let newCol = 0;
		for (let j = 0; j < shape[1]; j++) {
			if (j === col) continue;
			result[newRow * newShape[1] + newCol] = matrix[i * shape[1] + j];
			newCol++;
		}
		newRow++;
	}
	return result;
}

/**
 * Get the determinant of a matrix
 * @param {Float32Array} matrix Must be a square matrix, no validation is performed
 * @param {[number, number]} shape 
 * @returns 
 */
export function getDeterminant(matrix, shape) {
	let result = 0;

	if(shape[0] === 0 || shape[1] === 0) return 1;
	if(shape[0] === 1) return matrix[0];
	if (shape[0] === 2 && shape[1] === 2) return (matrix[0] * matrix[3]) - (matrix[1] * matrix[2]);

	for (let i = 0; i < shape[1]; i++) {
		if (i % 2 === 0) {
			result += matrix[i] * getDeterminant(getDeterminantSubmatrix(matrix, shape, 0, i), [shape[0] - 1, shape[1] - 1]);
		} else {
			result -= matrix[i] * getDeterminant(getDeterminantSubmatrix(matrix, shape, 0, i), [shape[0] - 1, shape[1] - 1]);
		}
	}

	return result;
}

/**
 * Gets the cofactor of an element in a matrix
 * @param {Float32Array} matrix 
 * @param {[number, number]} shape 
 * @param {number} row 
 * @param {number} col 
 * @returns 
 */
export function getCofactor(matrix, shape, row, col) {
	const determinant = getDeterminant(getDeterminantSubmatrix(matrix, shape, row, col), [shape[0] - 1, shape[1] - 1]);
	return (row + col) % 2 === 1
		? -determinant
		: determinant;
}

/**
 * Gets a matrix where each element is replaced by its cofactor
 * @param {Float32Array} matrix Must be a square matrix, no validation is performed
 * @param {[number, number]} shape 
 * @returns 
 */
export function getCofactorMatrix(matrix, shape) {
	const result = new Float32Array(shape[1] * shape[0]);
	for (let row = 0; row < shape[0]; row++) {
		for (let col = 0; col < shape[1]; col++) {
			result[row * shape[1] + col] = getCofactor(matrix, shape, row, col);
		}
	}
	return result;
}

/**
 * 
 * @param {Float32Array} matrix 
 * @param {[number, number]} shape 
 * @returns 
 */
export function getAdjugate(matrix, shape) {
	return getTranspose(getCofactorMatrix(matrix, shape), shape);
}


/**
 * 
 * @param {Float32Array} matrix 
 * @param {[number, number]} shape 
 * @param {number} scaleValue 
 * @returns 
 */
export function scaleMatrix(matrix, shape, scaleValue) {
	const result = new Float32Array(matrix.length);
	for (let row = 0; row < shape[0]; row++) {
		for (let col = 0; col < shape[1]; col++) {
			result[row * shape[1] + col] = matrix[row * shape[1] + col] * scaleValue
		}
	}
	return result;
}

export function getInverse(matrix, shape) {
	return scaleMatrix(getAdjugate(matrix, shape), shape, 1 / getDeterminant(matrix, shape));
}

/**
 * 
 * @param {Float32Array} matrix 
 * @param {[number,number]} shape
 * @returns 
 */
export function trimMatrix(matrix, oldShape, newShape){
	const result = new Float32Array(newShape[0] * newShape[1]);
	for (let row = 0; row < newShape[0]; row++) {
		for (let col = 0; col < newShape[1]; col++) {
			result[row * newShape[1] + col] = matrix[row * oldShape[1] + col];
		}
	}
	return result;
}

export function getTangentVectors(trianglePositions, triangleUVs){
	const deltaUV = [
		subtractVector(triangleUVs[1], triangleUVs[0]),
		subtractVector(triangleUVs[2], triangleUVs[0])
	];
	const deltaPositions = [
		subtractVector(trianglePositions[1], trianglePositions[0]),
		subtractVector(trianglePositions[2], trianglePositions[0])
	];

	const inverseDeltaUV = getInverse(deltaUV);
	return multiplyMatrix(inverseDeltaUV, deltaPositions);
}