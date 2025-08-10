import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getVertexBufferLayout } from "./wgpu-utils.js";
import { Mesh } from "../entities/mesh.js";

describe("wgpu-utils", () => {
	describe("getVertexBufferLayout", () => {
		it("should get layout with positions and uvs", () => {
			const result = getVertexBufferLayout(new Mesh({
				positions: [
					-1, -1, 0,
					1, -1, 0,
					0, 1, 0
				],
				positionSize: 3,
				uvs: [0, 0, 1, 0, 0.5, 1],
				uvSize: 2
			}));
			
			expect(result).toEqual([{
				attributes: [
					{
						shaderLocation: 0,
						offset: 0,
						format: "float32x3"
					},
					{
						shaderLocation: 1,
						offset: 12,
						format: "float32x2"
					}
				],
				arrayStride: 20,
				stepMode: "vertex"
			}]);
		});
		it("should get layout with positions, uvs, and normals", () => {
			const result = getVertexBufferLayout(new Mesh({
				positions: [
					-1, -1, 0, 
					1, -1, 0, 
					0, 1, 0
				],
				positionSize: 3,
				uvs: [0, 0, 1, 0, 0.5, 1],
				uvSize: 2,
				normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
				normalSize: 3
			}));

			expect(result).toEqual([{
				attributes: [
					{
						shaderLocation: 0,
						offset: 0,
						format: "float32x3"
					},
					{
						shaderLocation: 1,
						offset: 12,
						format: "float32x2"
					},
					{
						shaderLocation: 2,
						offset: 20,
						format: "float32x3"
					}
				],
				arrayStride: 32,
				stepMode: "vertex"
			}]);
		});
	});
});