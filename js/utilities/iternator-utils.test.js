import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { chunk } from "./iterator-utils.js";

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
});