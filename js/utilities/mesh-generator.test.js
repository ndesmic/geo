import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { surfaceGrid, uvSphere } from "./mesh-generator.js";

expect.extend({
	toBeCloseToArray(context, expected, precision = 1e-7) {
		for(let i = 0; i < context.value.length; i++) {
			const pass = Math.abs(context.value[i] - expected[i]) < precision;
			if(!pass){
				return {
					message: () => `Expected ${context.value[i]} to be ${expected[i]} at index ${i}}`,
					pass
				}
			}
		}
		return {
			pass: true
		}
	}
});

describe("mesh-generator", () => {
	describe("uvSphere", () => {
		it("should match for density 2", () => {
			const result = uvSphere(2);

			expect(result.positions).toBeCloseToArray(new Float32Array([
				0, -1, 0,
				0, -1, 0,
				0, -1, 0,
				0, -1, 0,
				1, 0, 0,
				0, 0, 1,
				-1, 0, 0,
				0, 0, -1,
				1, 0, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
			]));

			expect(result.uvs).toBeCloseToArray(new Float32Array([
				0, 0,
				0.25, 0,
				0.5, 0,
				0.75, 0,
				0, 0.5,
				0.25, 0.5,
				0.5, 0.5,
				0.75, 0.5,
				1, 0.5,
				0, 1,
				0.25, 1,
				0.5, 1,
				0.75, 1,
			]));

			expect(result.indices).toEqual(new Uint16Array([
				0, 5, 4,
				1, 6, 5,
				2, 7, 6,
				3, 8, 7,
				4, 5, 9,
				5, 6, 10,
				6, 7, 11,
				7, 8, 12
			]));
		});
		it("should match for density 3", () => {
			const result = uvSphere(3);

			expect(result.positions).toBeCloseToArray(new Float32Array([
				0, -1, 0,
				0, -1, 0,
				0, -1, 0,
				0, -1, 0,
				0, -1, 0,
				0, -1, 0,
				0.8660253882408142, -0.5, 0,
				0.4330126941204071, -0.5, 0.75,
				-0.4330126941204071, -0.5, 0.75,
				-0.8660253882408142, -0.5, 0,
				-0.4330126941204071, -0.5, -0.75,
				0.4330126941204071, -0.5, -0.75,
				0.8660253882408142, -0.5, 0,
				0.8660253882408142, 0.5, 0,
				0.4330126941204071, 0.5, 0.75,
				-0.4330126941204071, 0.5, 0.75,
				-0.8660253882408142, 0.5, 0,
				-0.4330126941204071, 0.5, -0.75,
				0.4330126941204071, 0.5, -0.75,
				0.8660253882408142, 0.5, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0
			]));

			expect(result.uvs).toBeCloseToArray(new Float32Array([
				0, 0, 
				0.1666666716337204, 0, 
				0.3333333432674408, 0, 
				0.5, 0, 
				0.6666666865348816, 0, 
				0.8333333134651184, 0, 
				0, 0.3333333432674408, 
				0.1666666716337204, 0.3333333432674408, 
				0.3333333432674408, 0.3333333432674408, 
				0.5, 0.3333333432674408, 
				0.6666666865348816, 0.3333333432674408, 
				0.8333333134651184, 0.3333333432674408, 
				1, 0.3333333432674408, 
				0, 0.6666666865348816, 
				0.1666666716337204, 0.6666666865348816, 
				0.3333333432674408, 0.6666666865348816, 
				0.5, 0.6666666865348816, 
				0.6666666865348816, 0.6666666865348816, 
				0.8333333134651184, 0.6666666865348816, 
				1, 0.6666666865348816, 
				0, 1, 
				0.1666666716337204, 1, 
				0.3333333432674408, 1, 
				0.5, 1, 
				0.6666666865348816, 1, 
				0.8333333134651184, 1
			]));

			expect(result.indices).toEqual(new Uint16Array([
				0, 7, 6,
				1, 8, 7,
				2, 9, 8,
				3, 10, 9,
				4, 11, 10,
				5, 12, 11,
				6, 14, 13,
				6, 7, 14,
				7, 15, 14,
				7, 8, 15,
				8, 16, 15,
				8, 9, 16,
				9, 17, 16,
				9, 10, 17,
				10, 18, 17,
				10, 11, 18,
				11, 19, 18,
				11, 12, 19,
				13, 14, 20,
				14, 15, 21,
				15, 16, 22,
				16, 17, 23,
				17, 18, 24,
				18, 19, 25
			]));
		});
	});
	describe("surfaceGrid", () => {
		it("should generate a 1x1 surface", () => {
			const result = surfaceGrid(1, 1);

			expect(result.positions).toEqual(new Float32Array([
				-0.5, 0, -0.5,
				0.5, 0, -0.5,
				-0.5, 0, 0.5,
				0.5, 0, 0.5
			]));

			expect(result.uvs).toEqual(new Float32Array([
				0, 0,
				1, 0,
				0, 1,
				1, 1
			]));

			expect(result.normals).toEqual(new Float32Array([
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0
			]));

			expect(result.tangents).toEqual(new Float32Array([
				1, 0, 0,
				1, 0, 0,
				1, 0, 0,
				1, 0, 0
			]));

			expect(result.indices).toEqual(new Int16Array([
				0, 1, 3,
				0, 3, 2
			]));

			expect(result.vertexLength).toEqual(4);
		});
		it("should generate a 2x2 surface", () => {
			const result = surfaceGrid(2, 2);

			expect(result.positions).toEqual(new Float32Array([
				-1, 0, -1,
				0, 0, -1,
				1, 0, -1,
				-1, 0, 0,
				0, 0, 0,
				1, 0, 0,
				-1, 0, 1,
				0, 0, 1,
				1, 0, 1
			]));

			expect(result.uvs).toEqual(new Float32Array([
				0, 0,
				0.5, 0,
				1, 0,
				0, 0.5,
				0.5, 0.5,
				1, 0.5,
				0, 1,
				0.5, 1,
				1, 1
			]));

			expect(result.normals).toEqual(new Float32Array([
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0,
				0, 1, 0
			]));

			expect(result.tangents).toEqual(new Float32Array([
				1, 0, 0,
				1, 0, 0,
				1, 0, 0,
				1, 0, 0,
				1, 0, 0,
				1, 0, 0,
				1, 0, 0,
				1, 0, 0,
				1, 0, 0
			]));

			expect(result.indices).toEqual(new Int16Array([
				0, 1, 4,
				0, 4, 3,
				1, 2, 5,
				1, 5, 4,
				3, 4, 7,
				3, 7, 6,
				4, 5, 8,
				4, 8, 7
			]));

			expect(result.vertexLength).toEqual(9)
		});
	});
});