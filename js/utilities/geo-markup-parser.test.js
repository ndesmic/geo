import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { parseIntOrDefault, parseFloatOrDefault, parseListOrDefault, parseFloatVector, parseListOfFloatVector } from "./geo-markup-parser.js";


describe("geo-markup-parser", () => {
    describe("parseIntOrDefault", () => {
        it("should parse int", () => {
            const result = parseIntOrDefault("123");
            expect(result).toEqual(123);
        });
        it("should use default if not defined", () => {
            const result = parseIntOrDefault(null, 77);
            expect(result).toEqual(77);
        });
    });
    describe("parseFloatOrDefault", () => {
        it("should parse float", () => {
            const result = parseFloatOrDefault("123.456");
            expect(result).toEqual(123.456);
        });
        it("should use default if not defined", () => {
            const result = parseFloatOrDefault(null, 77.7);
            expect(result).toEqual(77.7);
        });
    });
    describe("parseListOrDefault", () => {
        it("should parse list", () => {
            const result = parseListOrDefault("foo, bar,  baz");
            expect(result).toEqual(["foo", "bar", "baz"]);
        });
        it("should use default if not defined", () => {
            const result = parseListOrDefault(" ", ["default"]);
            expect(result).toEqual(["default"]);
        });
    });
    describe("parseFloatVector", () => {
        it("should parse float vector", () => {
            const result = parseFloatVector("123.1, 456.2, 789.3", 3);
            expect(result).toEqual([123.1, 456.2, 789.3]);
        });
        it("should use default if not defined", () => {
            const result = parseFloatVector(" ", 3, [1.1, 2.2, 3.3]);
            expect(result).toEqual([1.1, 2.2, 3.3]);
        });
        it("should truncate if too many values", () => {
            const result = parseFloatVector("1.1, 2.2, 3.3, 4.4", 3, [0,0,0]);
            expect(result).toEqual([1.1, 2.2, 3.3]);
        });
    });
    describe("parseListOfFloatVector", () => {
        it("should parse float vector", () => {
            const result = parseListOfFloatVector("1.1, 2.2, 3.3; 4.4, 5.5, 6.6", 3);
            expect(result).toEqual([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]]);
        });
        it("should use default if not defined", () => {
            const result = parseListOfFloatVector(" ", 3, [[0,0,0]]);
            expect(result).toEqual([[0,0,0]]);
        });
        it("should truncate if too many values", () => {
            const result = parseListOfFloatVector("1.1, 2.2, 3.3, 4.4; 5.5, 6.6, 7.7, 8.8", 3, [[0,0,0]]);
            expect(result).toEqual([[1.1, 2.2, 3.3],[5.5, 6.6, 7.7]]);
        });
    });
});