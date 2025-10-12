import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getAlignments, getPaddedSize, packArray, packMesh, packStruct, roundSmallMagnitudeValues } from "./buffer-utils.js";
import { Mesh } from "../entities/mesh.js";

describe("buffer-utils", () => {
	describe("packMesh", () => {
		it("should pack a 2d quad with uvs", () => {
			const mesh = new Mesh({
				positions: new Float32Array([
					-1.0, -1.0,
					1.0, -1.0,
					1.0, 1.0,

					-1.0, -1.0,
					1.0, 1.0,
					-1.0, 1.0,
				]),
				uvs: new Float32Array([
					0.0, 1.0,
					1.0, 1.0,
					1.0, 0.0,

					0.0, 1.0,
					1.0, 0.0,
					0.0, 0.0
				]),
				positionSize: 2,
				vertexLength: 6
			})
			const buffer = packMesh(mesh);

			expect(buffer).toEqual(new Float32Array([
				-1.0, -1.0, 0.0, 1.0,
				1.0, -1.0, 1.0, 1.0,
				1.0, 1.0, 1.0, 0.0,

				-1.0, -1.0, 0.0, 1.0,
				1.0, 1.0, 1.0, 0.0,
				-1.0, 1.0, 0.0, 0.0
			]));
		});
		it("should pack a 2d quad without uvs", () => {
			const mesh = new Mesh({
				positions: new Float32Array([
					-1.0, -1.0,
					1.0, -1.0,
					1.0, 1.0,

					-1.0, -1.0,
					1.0, 1.0,
					-1.0, 1.0,
				]),
				uvs: new Float32Array([
					0.0, 1.0,
					1.0, 1.0,
					1.0, 0.0,

					0.0, 1.0,
					1.0, 0.0,
					0.0, 0.0
				]),
				positionSize: 2,
				vertexLength: 6
			})
			.useAttributes("positions");

			const buffer = packMesh(mesh);

			expect(buffer).toEqual(new Float32Array([
				-1.0, -1.0, 
				1.0, -1.0,
				1.0, 1.0, 

				-1.0, -1.0,
				1.0, 1.0, 
				-1.0, 1.0
			]));
		});
	});
	describe("getPaddedSize", () => {
		it("should return same size if aligned", () => {
			expect(getPaddedSize(32, 16)).toEqual(32);
		});
		it("should get padded (bigger) size when not aligned", () => {
			expect(getPaddedSize(204, 16)).toEqual(208);
		});
	});
	describe("getAlignments", () => {
		it("should get alignments", () => {
			const results = getAlignments([
				"mat4x4f32",
				"mat4x4f32",
				"mat4x4f32",
				"mat3x3f32",
				"vec3f32"
			]);

			expect(results).toEqual({
				offsets: [
					0,
					64,
					128,
					192,
					240
				],
				totalSize: 256
			});
		});
	});
	describe("packStruct", () => {
		it("should pack f32", () => {
			const data = {
				val: 33
			};
			const schema = [
				["val", "f32"]
			];
			const buffer = packStruct(data, schema);
			const view = new Float32Array(buffer);

			expect(view).toEqual(new Float32Array([
				33,
			]));
		});
		it("should use buffer and offset if provided", () => {
			const data = {
				val: 33
			};
			const schema = [
				["val", "f32"]
			];
			const buffer = packStruct(data, schema, {
				buffer: new ArrayBuffer(12), 
				offset: 4
			});
			const view = new Float32Array(buffer);

			expect(view).toEqual(new Float32Array([
				0,
				33,
				0,
			]));
		});
		it("should pack mat3x3f32", () => {
			const data = {
				val: new Float32Array([
					1,2,3,
					4,5,6,
					7,8,9
				])
			};
			const schema = [
				["val", "mat3x3f32"]
			];
			const buffer = packStruct(data, schema);
			const view = new Float32Array(buffer);

			expect(view).toEqual(new Float32Array([
				1,2,3,0,
				4,5,6,0,
				7,8,9,0
			]));
		});
	});
	describe("packArray", () => {
		it("should pack array", () => {
			const data = [
				{ a: 10, b: new Float32Array([1, 2]), c: 7 },
				{ a: 34, b: new Float32Array([3, 4]), c: 9 },
				{ a: 77, b: new Float32Array([5, 6]), c: 11 },
			];
			const schema = [
				["a", "f32"],
				["b", "vec2f32"],
				["c", "f32"]
			];
			const buffer = packArray(data, schema);
			const view = new Float32Array(buffer);

			expect(view).toEqual(new Float32Array([
				10,0,1,2,7,
				0,
				34,0,3,4,9,
				0,
				77,0,5,6,11,
				0
			]));
		});

		it("should pack array at location", () => {
			const data = [
				{ a: 10, b: new Float32Array([1, 2]), c: 7 },
				{ a: 34, b: new Float32Array([3, 4]), c: 9 },
				{ a: 77, b: new Float32Array([5, 6]), c: 11 },
			];
			const schema = [
				["a", "f32"],
				["b", "vec2f32"],
				["c", "f32"]
			];
			const buffer = new ArrayBuffer(100);
			const outBuffer = packArray(data, schema, {
				buffer, 
				offset: 16
			});
			const view = new Float32Array(outBuffer);

			expect(view).toEqual(new Float32Array([
				0,0,0,0,
				10,0,1,2,7,
				0,
				34,0,3,4,9,
				0,
				77,0,5,6,11,
				0,0,0,0
			]));
		});
	});
	describe("roundSmallMagnitudeValues", () => {
		it("should round small positive values to zero", () => {
			const result = roundSmallMagnitudeValues(new Float32Array([ 1, 2, 6.123234262925839e-17, 4]));
			expect(result).toEqual(new Float32Array([1, 2, 0, 4]));
		});
		it("should round small negative values to zero", () => {
			const result = roundSmallMagnitudeValues(new Float32Array([ 1, -6.123234262925839e-17, 3, 4]));
			expect(result).toEqual(new Float32Array([1, 0, 3, 4]));
		});
	});
});