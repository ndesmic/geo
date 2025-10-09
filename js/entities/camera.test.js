import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Camera } from "../entities/camera.js";

describe("Camera", () => {
    describe("moveBy", () => {
        it("should move in y", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [0, 0, 1]
            });
            camera.moveBy({ y: 1 });
            expect(camera.position).toEqual(new Float32Array([
                0, 1, -2, 1,
            ]));
        });
        it("should move in y (tilted)", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [0, 1, 1]
            });
            camera.moveBy({ y: 1 });
            expect(camera.position).toEqual(new Float32Array([
                0, 1, -2, 1,
            ]));
        });
        it("should move in x", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [0, 0, 1]
            });
            camera.moveBy({ x: 1 });
            expect(camera.position).toEqual(new Float32Array([
                1, 0, -2, 1,
            ]));
        });
        it("should move in x (tilted)", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [1, 0, 1]
            });
            camera.moveBy({ x: 1 });
            expect(camera.position).toEqual(new Float32Array([
                1, 0, -2, 1,
            ]));
        });
        it("should move in z", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [0, 0, 1]
            });
            camera.moveBy({ z: 1 });
            expect(camera.position).toEqual(new Float32Array([
                0, 0, -1, 1,
            ]));
        });
    });
    describe("panBy", () => {
        it("should pan up", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [0, 0, 1]
            });
            camera.panBy({ up: 1 });
            expect(camera.position).toEqual(new Float32Array([
                0, 1, -2, 1,
            ]));
        });
        it("should pan up (tilted)", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [0, 1, 1]
            });
            camera.panBy({ up: 1 });
            expect(camera.position).toEqual(new Float32Array([
                0, 0.7071067690849304, -2.707106828689575, 1,
            ]));
        });
        it("should pan right", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [0, 0, 1]
            });
            camera.panBy({ right: 1 });
            expect(camera.position).toEqual(new Float32Array([
                1, 0, -2, 1,
            ]));
        });
        it("should pan right (tilted)", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [1, 0, 1]
            });
            camera.panBy({ right: 1 });
            expect(camera.position).toEqual(new Float32Array([
                0.7071067690849304, 0, -2.707106828689575, 1,
            ]));
        });
        it("should pan forward", () => {
            const camera = new Camera({
                name: "test",
                position: [0,0,-2],
                screenHeight: 100,
                screenWidth: 100,
                near: 0.01,
                far: 100,
                fieldOfView: 90,
                isPerspective: true,
                direction: [0, 0, 1]
            });
            camera.panBy({ forward: 1 });
            expect(camera.position).toEqual(new Float32Array([
                0, 0, -1, 1,
            ]));
        });
    });
});