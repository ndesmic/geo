import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getRow, getColumn, getTranspose, multiplyMatrix, trimMatrix, getDeterminant, scaleMatrix, getDeterminantSubmatrix, getCofactorMatrix, getAdjugate, getInverse, multiplyMatrixVector, addVector, subtractVector, scaleVector, divideVector, multiplyPointsByMatrix, getRotationZMatrix } from "./vector.js";
import { roundSmallMagnitudeValues } from "./buffer-utils.js";

describe("vector", () => {
	describe("addVector", () => {
		it("should add two vectors", () => {
			const result = addVector([1,2,3], [2,2,1]);
			expect(result).toEqual([3,4,4]);
		});
	});
	describe("subtractVector", () => {
		it("should subtract two vectors", () => {
			const result = subtractVector([1, 2, 3], [2, 2, 1]);
			expect(result).toEqual([-1, 0, 2]);
		});
	});
	describe("scaleVector", () => {
		it("should scale a vector", () => {
			const result = scaleVector([1, 2, 3], 3);
			expect(result).toEqual([3, 6, 9]);
		});
	});
	describe("divideVector", () => {
		it("should divide a vector", () => {
			const result = divideVector([1, 2, 3], 3);
			expect(result).toEqual([1/3, 2/3, 1]);
		});
	});
	describe("multiplyMatrixVector", () => {
		it("should multiply 2x2 matrix with vec2", () => {
			const vec = new Float32Array([5,6]);
			const matrix = new Float32Array([
				1,0,
				0,1
			]);
			const result = multiplyMatrixVector(vec, matrix, 2);
			expect(result).toEqual(new Float32Array([
				5,6
			]));
		});
		it("should multiply 3x3 matrix with vec3", () => {
			const vec = new Float32Array([1,2,3]);
			const matrix = new Float32Array([
				1, 2, 3,
				4, 5, 6,
				7, 8, 9,
			]);
			const result = multiplyMatrixVector(vec, matrix, 3);
			expect(result).toEqual(new Float32Array([
				14, 32, 50
			]));
		});
		it("should multiply 4x4 matrix with vec4", () => {
			const vec = new Float32Array([9, 8, 7, 6]);
			const matrix = new Float32Array([
				1, 2, 3, 4,
				5, 6, 7, 8,
				9, 10, 11, 12,
				13, 14, 15, 16
			]);
			const result = multiplyMatrixVector(vec, matrix, 4);
			expect(result).toEqual(new Float32Array([
				70, 190, 310, 430
			]));
		});
	});
	describe("getTranspose", () => {
		it("should transpose a square matrix", () => {
			const result = getTranspose(new Float32Array([
				1,2,3,
				4,5,6,
				7,8,9
			]), [3,3]);
			expect(result).toEqual(new Float32Array([
				1,4,7,
				2,5,8,
				3,6,9
			]));
		});
		it("should transpose a rectangular matrix", () => {
			const result = getTranspose(new Float32Array([
				1, 2, 3,
				4, 5, 6,
			]), [3,2]);
			expect(result).toEqual(new Float32Array([
				1, 4,
				2, 5,
				3, 6
			]));
		});
	});
	describe("getRow", () => {
		it("should get a row vector from a matrix", () => {
			const result = getRow(new Float32Array([
				1, 2, 3,
				4, 5, 6
			]), [2, 3], 1);
			expect(result).toEqual(new Float32Array([4, 5, 6]));
		});
	});
	describe("getColumn", () => {
		it("should get a column vector from a matrix", () => {
			const result = getColumn(new Float32Array([
				1, 2, 3,
				4, 5, 6
			]), [2,3], 1);
			expect(result).toEqual(new Float32Array([2,5]));
		});
	});
	describe("multiplyMatrix", () => {
		it("should multiply two square matrices", () => {
			const result = multiplyMatrix(new Float32Array([
				1, 2,
				3, 4
			]), 
			[2,2],
			new Float32Array([
				5, 6,
				7, 8
			]),
			[2,2]);

			expect(result).toEqual(new Float32Array([
				19, 22,
				43, 50
			]));
		});
		it("should multiply two rectangular matrices", () => {
			const result = multiplyMatrix(new Float32Array([
				1, 2, 3,
				4, 5, 6
			]),
				[2, 3],
				new Float32Array([
					7, 8,
					9, 10,
					11, 12
				]),
				[3, 2]);

			expect(result).toEqual(new Float32Array([
				58, 64,
				139, 154
			]));
		});
	});
	describe("trimMatrix", () => {
		it("should trim matrix", () => {
			const result = trimMatrix(new Float32Array([
				1,2,3,
				4,5,6,
				7,8,9
			]), [3,3], [2, 2]);

			expect(result).toEqual(new Float32Array([
				1,2,
				4,5
			]));
		});
	});
	describe("scaleMatrix", () => {
		it("should scale matrix", () => {
			const result = scaleMatrix(new Float32Array([
				1,2,
				3,4
			]), [2,2], 3);
			expect(result).toEqual(new Float32Array([
				3,6,
				9,12
			]));
		});
	});
	describe("getDeterminantSubmatrix", () => {
		it("should get submatrix for determinant (0,0)", () =>{
			const result = getDeterminantSubmatrix(new Float32Array([
				1, 2, 3,
				4, 5, 6,
				7, 8, 9
			]), [3,3], 0, 0);

			expect(result).toEqual(new Float32Array([
				5, 6,
				8, 9
			]));
		});
		it("should get submatrix for determinant (1,1)", () => {
			const result = getDeterminantSubmatrix(new Float32Array([
				1, 2, 3,
				4, 5, 6,
				7, 8, 9
			]), [3, 3], 1, 1);

			expect(result).toEqual(new Float32Array([
				1, 3,
				7, 9
			]));
		});
		it("should get submatrix for determinant (2,2)", () => {
			const result = getDeterminantSubmatrix(new Float32Array([
				1, 2, 3,
				4, 5, 6,
				7, 8, 9
			]), [3, 3], 2, 2);

			expect(result).toEqual(new Float32Array([
				1, 2,
				4, 5
			]));
		});
	});
	describe("getDeterminant", () => {
		it("should get determinant of empty", () => {
			const result = getDeterminant(new Float32Array(0), [0, 0]);

			expect(result).toEqual(1);
		});
		it("should get determinant of 1x1", () => {
			const result = getDeterminant(new Float32Array([-0.5]), [1,1]);

			expect(result).toEqual(-0.5);
		});
		it("should get determinant of 2x2", () => {
			const result = getDeterminant(new Float32Array([
				0.25, -0.5,
				0, -0.5
			]), [2,2]);

			expect(result).toEqual(-0.125);
		});
		it("should get determinant of 3x3", () => {
			const result = getDeterminant(new Float32Array([
				1, 2, 3,
				0, 4, 5,
				1, 0, 6
			]), [3, 3]);

			expect(result).toEqual(22);
		});
	});
	describe("getCofactorMatrix", () => {
		it("should get cofactor matrix 1x1", () => {
			const result = getCofactorMatrix(new Float32Array([
				7
			]), [1, 1]);

			expect(result).toEqual(new Float32Array([
				1
			]));
		});
		it("should get cofactor matrix 2x2", () => {
			const result = getCofactorMatrix(new Float32Array([
				0.25, -0.5,
				0, -0.5
			]), [2,2]); 
			
			expect(result).toEqual(new Float32Array([
				-0.5, -0,
				0.5, 0.25
			]));
		});
		it("should get cofactor matrix 3x3", () => {
			const result = getCofactorMatrix(new Float32Array([
				2, 3, 1,
				4, 5, 6,
				7, 8, 9
			]), [3, 3]);

			expect(result).toEqual(new Float32Array([
				-3, 6, -3,
				-19, 11, 5,
				13, -8, -2
			]));
		});
	});
	describe("getAdjugate", () => {
		it("should get adjugate of 1x1", () => {
			const result = getAdjugate(new Float32Array([
				5
			]), [1, 1]);

			expect(result).toEqual(new Float32Array([
				1
			]));
		});
		it("should get adjugate of 2x2", () => {
			const result = getAdjugate(new Float32Array([
				0.25, -0.5,
				0, -0.5
			]), [2,2]);
			
			expect(result).toEqual(new Float32Array([
				-0.5, 0.5,
				-0, 0.25
			]));
		});
		it("should get adjugate of 3x3", () => {
			const result = getAdjugate(new Float32Array([
				1, 2, 3,
				0, 4, 5,
				1, 0, 6
			]), [3, 3]);

			expect(result).toEqual(new Float32Array([
				24, -12, -2,
				5, 3, -5,
				-4, 2, 4
			]));
		});
	});
	describe("getInverse", () => {
		it("should get inverse of 1x1", () => {
			const result = getInverse(new Float32Array([
				7
			]), [1, 1]);

			expect(result).toEqual(new Float32Array([
				1/7
			]));
		});
		it("should get inverse infinity of 1x1 if 0 (non-invertable)", () => {
			const result = getInverse(new Float32Array([
				0
			]), [1, 1]);

			expect(result).toEqual(new Float32Array([
				Infinity
			]));
		});
		it("should get inverse of 2x2", () => {
			const result = getInverse(new Float32Array([
				0.25, -0.5,
				0, -0.5
			]), [2,2]);
			
			expect(result).toEqual(new Float32Array([
				4, -4,
				0, -2
			]));
		});
		it("should get inverse of 3x3", () => {
			const result = getInverse(new Float32Array([
				2, 1, 3,
				1, 0, 2,
				4, 1, 8
			]), [3, 3]);

			expect(result).toEqual(new Float32Array([
				2, 5, -2,
				0, -4, 1,
				-1, -2, 1
			]));
		});
	});
	describe("multiplyPointsByMatrix", () => {
		it("should multiply points", () => {
			const result = multiplyPointsByMatrix(new Float32Array([
				1, 1, 1,
				2, 2, 2,
				3, 3, 3
			]), 3, new Float32Array([
				1,0,0,
				0,2,0,
				0,0,3
			]));

			expect(result).toEqual(new Float32Array([
				1, 2, 3,
				2, 4, 6,
				3, 6, 9
			]));
		});
		it("should multiply points (rotation)", () => {
			const result = multiplyPointsByMatrix(new Float32Array([
				1, 0, 0, 1,
				0, 1, 0, 1,
				1, 2, 3, 1
			]), 4, getRotationZMatrix(Math.PI / 2));
			roundSmallMagnitudeValues(result);

			expect(result).toEqual(new Float32Array([
				0, 1, 0, 1,
				-1, 0, 0, 1,
				-2, 1, 3, 1
			]));
		});
	});
});