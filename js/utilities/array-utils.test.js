import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { getValuesFromEntriesRecursive } from "./array-utils.js";

describe("array-utils", () => {
    describe("valuesFromEntriesRecursive", () => {
        it("should get flat values", () => {
            const result = getValuesFromEntriesRecursive([
                ["foo", 123],
                ["bar", "hello"],
                ["baz", 321]
            ]);
            expect(result).toEqual([
                123,
                "hello",
                321
            ]);
        });
        it("should get recursive values", () => {
            const result = getValuesFromEntriesRecursive([
                ["foo", 123],
                ["bar", [
                    ["a", 1],
                    ["b", 2],
                    ["c", 3]
                ]],
                ["baz", 321]
            ]);
            expect(result).toEqual([
                123,
                [1,2,3],
                321
            ]);
        });
    });
})