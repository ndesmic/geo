import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Mesh } from "../entities/mesh.js";

describe("Mesh", () => {
	describe("translate", () => {
		const mesh = new Mesh({
			positions: [
				-1, -1, 0,
				1, -1, 0,
				0, 1, 0
			],
			positionSize: 3,
			uvs: [0, 0, 1, 0, 0.5, 1],
			uvSize: 2,
			normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
			normalSize: 3,
			vertexLength: 3
		})
			.translate({ x: 1 });

		expect(mesh.getModelMatrix()).toEqual(new Float32Array([
			1, 0, 0, 1,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		]));
	});
	describe("bakeTransforms", () => {
		it("should bake translation", () => {
			const mesh = new Mesh({
				positions: [
					-1, -1, 0,
					1, -1, 0,
					0, 1, 0
				],
				positionSize: 3,
				uvs: [0, 0, 1, 0, 0.5, 1],
				uvSize: 2,
				normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
				normalSize: 3,
				vertexLength: 3
			})
				.translate({ x: 1 })
				.bakeTransforms();

			expect(mesh.positions).toEqual(new Float32Array([
				0, -1, 0,
				2, -1, 0,
				1, 1, 0
			]));
			expect(mesh.normals).toEqual(new Float32Array([
				0, 0, -1,
				0, 0, -1,
				0, 0, -1
			]));
		});
		it("should bake translation + scale", () => {
			const mesh = new Mesh({
				positions: [
					-1, -1, 0,
					1, -1, 0,
					0, 1, 0
				],
				positionSize: 3,
				uvs: [0, 0, 1, 0, 0.5, 1],
				uvSize: 2,
				normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
				normalSize: 3,
				vertexLength: 3
			})
				.scale({ x: 2, y: 2, z: 2 })
				.translate({ x: 1 })
				.bakeTransforms();

			expect(mesh.positions).toEqual(new Float32Array([
				-1, -2, 0,
				3, -2, 0,
				1, 2, 0
			]));
			expect(mesh.normals).toEqual(new Float32Array([
				0, 0, -1,
				0, 0, -1,
				0, 0, -1
			]));
		});
	});
	describe("normalizePositions", () => {
		it("should normalize positions to unit volume, no center", () => {
			const mesh = new Mesh({
				positions: [
					0, -1, 0,
					7, -1, 0,
					0, 1, 0
				],
				positionSize: 3,
				uvs: [0, 0, 1, 0, 0.5, 1],
				uvSize: 2,
				normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
				normalSize: 3,
				vertexLength: 3
			})
				.normalizePositions({ center: false });

			expect(mesh.positions).toEqual(new Float32Array([
				0, -0.1428571492433548, 0,
				1, -0.1428571492433548, 0,
				0, 0.1428571492433548, 0
			]));
		});
		it("should normalize positions to unit volume (with negatives, no center)", () => {
			const mesh = new Mesh({
				positions: [
					-2, -2, 0,
					0, -2, 0,
					-2, 0, 0
				],
				positionSize: 3,
				uvs: [0, 0, 1, 0, 0.5, 1],
				uvSize: 2,
				normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
				normalSize: 3,
				vertexLength: 3
			})
				.normalizePositions({ center: false });

			expect(mesh.positions).toEqual(new Float32Array([
				-1, -1, 0,
				0, -1, 0,
				-1, 0, 0
			]));
		});
		it("should normalize positions to unit volume (with negatives, centered)", () => {
			const mesh = new Mesh({
				positions: [
					-2, -2, 0,
					0, -2, 0,
					-2, 0, 0
				],
				positionSize: 3,
				uvs: [0, 0, 1, 0, 0.5, 1],
				uvSize: 2,
				normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
				normalSize: 3,
				vertexLength: 3
			})
				.normalizePositions();

			expect(mesh.positions).toEqual(new Float32Array([
				-0.5, -0.5, 0,
				0.5, -0.5, 0,
				-0.5, 0.5, 0
			]));
		});
		it("should normalize positions to center (with negatives, no scale)", () => {
			const mesh = new Mesh({
				positions: [
					-2, -2, 0,
					0, -2, 0,
					-2, 0, 0
				],
				positionSize: 3,
				uvs: [0, 0, 1, 0, 0.5, 1],
				uvSize: 2,
				normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
				normalSize: 3,
				vertexLength: 3
			})
				.normalizePositions({ scale: false });

			expect(mesh.positions).toEqual(new Float32Array([
				-1, -1, 0,
				1, -1, 0,
				-1, 1, 0
			]));
		});
	});
});