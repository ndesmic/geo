import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { chunk, getRange } from "./iterator-utils.js";

describe("iterator tools", () => {
	describe("chunk", () => {
		it("gets chunk", () => {
			function* values() {
				for (let i = 0; i < 9; i++) {
					yield i;
				}
			}
			const result = chunk(values(), 3);
			expect(result.toArray()).toEqual([
				[0, 1, 2],
				[3, 4, 5],
				[6, 7, 8],
			])
		});
		it("gets chunk with remainder", () => {
			function* values() {
				for (let i = 0; i < 10; i++) {
					yield i;
				}
			}
			const result = chunk(values(), 3);
			expect(result.toArray()).toEqual([
				[0, 1, 2],
				[3, 4, 5],
				[6, 7, 8],
				[9]
			])
		});
	});

	describe("getRange", () => {
		it("should get range (end only)", () => {
			const result = getRange({ end: 10 }).toArray();
			expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		});
		it("should get range (start to end)", () => {
			const result = getRange({ start: -5, end: 10 }).toArray();
			expect(result).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		});
		it("should get range (start to end with step)", () => {
			const result = getRange({ start: -4, end: 10, step: 2 }).toArray();
			expect(result).toEqual([-4, -2, 0, 2, 4, 6, 8, 10]);
		});
		it("should get range with remainder", () => {
			const result = getRange({ end: 10, step: 3 }).toArray();
			expect(result).toEqual([0, 3, 6, 9]);
		});
	});
});