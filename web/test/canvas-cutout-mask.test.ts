import { describe, expect, test } from "bun:test";

import { applyCutoutMask } from "../src/lib/canvas/canvas-cutout-mask";

function pixels(count: number) {
    return new Uint8ClampedArray(Array.from({ length: count }, (_, index) => [10 + index, 20 + index, 30 + index, 255]).flat());
}

describe("applyCutoutMask", () => {
    test("maps foreground confidence to alpha and keeps rgb", () => {
        const data = pixels(4);
        applyCutoutMask(data, new Float32Array([1, 0, 0.5, 0.2]));
        expect(Array.from(data)).toEqual([10, 20, 30, 255, 11, 21, 31, 0, 12, 22, 32, 128, 13, 23, 33, 51]);
    });

    test("keeps existing transparency when mask is fully foreground", () => {
        const data = new Uint8ClampedArray([1, 2, 3, 40, 4, 5, 6, 200]);
        applyCutoutMask(data, new Float32Array([1, 1]));
        expect(Array.from(data)).toEqual([1, 2, 3, 40, 4, 5, 6, 200]);
    });

    test("clears every pixel when mask is empty", () => {
        const data = pixels(2);
        const kept = applyCutoutMask(data, new Float32Array([0, 0]));
        expect(Array.from(data).filter((_, index) => index % 4 === 3)).toEqual([0, 0]);
        expect(kept).toBe(0);
    });

    test("returns the number of visible pixels", () => {
        expect(applyCutoutMask(pixels(3), new Float32Array([0.9, 0.001, 0.3]))).toBe(2);
    });

    test("rejects a mask whose size does not match the image", () => {
        expect(() => applyCutoutMask(pixels(4), new Float32Array(3))).toThrow("抠图遮罩尺寸与图片不一致");
    });
});
