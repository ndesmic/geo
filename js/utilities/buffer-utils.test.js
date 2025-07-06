import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getAlignments, getPaddedSize, packMesh } from "./buffer-utils.js";

describe("buffer-utils", () => {
	describe("packMesh", () => {
		it("should pack a quad with uvs", () => {
			const meshAttrs = {
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
				length: 6
			}
			const buffer = packMesh(meshAttrs, { positions: 2, uvs: 2 });

			expect(buffer).toEqual(new Float32Array([
				-1.0, -1.0, 0.0, 1.0,
				1.0, -1.0, 1.0, 1.0,
				1.0, 1.0, 1.0, 0.0,

				-1.0, -1.0, 0.0, 1.0,
				1.0, 1.0, 1.0, 0.0,
				-1.0, 1.0, 0.0, 0.0
			]));
		});
		it("should pack a quad without uvs", () => {
			const meshAttrs = {
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
				length: 6
			}
			const buffer = packMesh(meshAttrs, { positions: 2 });

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
});