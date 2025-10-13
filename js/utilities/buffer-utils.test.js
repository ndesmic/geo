import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getAlignments, getPaddedSize, packArray, packMesh, packStruct, pack, roundSmallMagnitudeValues, getMaxAlign } from "./buffer-utils.js";
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
	describe("getMaxAlign", () => {
		it("should get max align (u32)", () => {
			const result = getMaxAlign([
				"u32",
				"f32"
			]);
			expect(result).toEqual(4);
		});
		it("should get max align (mat2x3f32)", () => {
			const result = getMaxAlign([
				"f32",
				"vec2f32",
				"mat2x3f32"
			]);
			expect(result).toEqual(16);
		});
		it("should get max align (nested)", () => {
			const result = getMaxAlign([
				"f32",
				[
					"vec2f32"
				],
				"u32"
			]);
			expect(result).toEqual(16);
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
				maxAlign: 16,
				totalSize: 256
			});
		});
		it("should get alignments for struct with array", () => {
			const types = [
				"u32",
				[
					"vec3f32"
				],
			];
			expect(getAlignments(types, { arrayCount: 2 })).toEqual({
				offsets: [
					0,
					16
				],
				maxAlign: 16,
				totalSize: 48
			})
		});
		it("should error if array is not final element", () => {
			const types = [
				"f32",
				[
					"f32",
					"i32"
				],
				"i32"
			];
			expect(() => getAlignments(types)).toThrow("Array must be the last element in a struct!");
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
		it("should pack array value", () => {
			const data = {
				val: 33,
				arr: [
					{ val: 1 },
					{ val: 2 },
					{ val: 3 }
				]
			};
			const schema = [
				["val", "f32"],
				["arr", [
					["val", "f32"]
				]]
			];
			const buffer = packStruct(data, schema);
			const view = new Float32Array(buffer);

			expect(view).toEqual(new Float32Array([
				33,
				0,0,0,
				1,2,3,
				0
			]));
		});
		it("should error if array is not the final element", () => {
			const data = {
				val: 33,
				arr: [
					{ val: 1 },
					{ val: 2 },
					{ val: 3 }
				]
			};
			const schema = [
				["val", "f32"],
				["arr", [
					["val", "f32"]
				]],
				["int", "i32"]
			];
			expect(() => packStruct(data, schema)).toThrow("Array must be the last element in a struct!");
		});
		it.only("should pack a struct (more complex)", () => {
			const data = {
				baseReflectance: [1.059, 0.773, 0.307],
				metalness: 1,
				roughness: 0.2,
				useRoughnessMap: 0
			};
			const schema = [
				["useRoughnessMap", "u32"],
				["roughness","f32"],
				["metalness","f32"],
				["baseReflectance","vec3f32"]
			];
			const buffer = packStruct(data, schema);
			expect(buffer).toEqual(new Float32Array([
				0,
				0.20000000298023224,
				1,
				0,
				1.059000015258789,
				0.7730000019073486,
				0.3070000112056732,
				0
			]))

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
	describe("pack", () => {
		it("should pack struct with f32", () => {
			const data = {
				val: 33
			};
			const schema = [
				["val", "f32"]
			];
			const buffer = pack(data, schema);
			const view = new Float32Array(buffer);

			expect(view).toEqual(new Float32Array([
				33,
			]));
		});
		it("should pack struct and use buffer and offset if provided", () => {
			const data = {
				val: 33
			};
			const schema = [
				["val", "f32"]
			];
			const buffer = pack(data, schema, {
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
		it("should pack struct with mat3x3f32", () => {
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
			const buffer = pack(data, schema);
			const view = new Float32Array(buffer);

			expect(view).toEqual(new Float32Array([
				1,2,3,0,
				4,5,6,0,
				7,8,9,0
			]));
		});
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
			const buffer = pack(data, schema);
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
			const outBuffer = pack(data, schema, {
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
		it("should pack struct with array", () => {
			const data = {
				value: 678.12,
				mat: new Float32Array([9,8,7,6]),
				array: [
					{ a: 10, b: new Float32Array([1, 2]), c: 7 },
					{ a: 34, b: new Float32Array([3, 4]), c: 9 },
					{ a: 77, b: new Float32Array([5, 6]), c: 11 },
				]
			}
			const schema = [
				["value", "f32"],
				["mat", "mat2x2f32"],
				["array", [
					["a", "f32"],
					["b", "vec2f32"],
					["c", "f32"]
				]]
			];

			const outBuffer = pack(data, schema, { arrayCount: 3 });
			const view = new Float32Array(outBuffer);
			expect(view).toEqual(new Float32Array([
				678.1199951171875,0,0,0,
				9,8,7,6,
				10, 0, 1, 2, 7, 0,
				34, 0, 3, 4, 9, 0,
				77, 0, 5, 6, 11,0,
				0,0,
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