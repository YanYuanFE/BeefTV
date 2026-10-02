/** Scales each RGBA pixel's alpha by its foreground confidence; returns the count of pixels left visible. */
export function applyCutoutMask(pixels: Uint8ClampedArray, confidence: Float32Array) {
    if (pixels.length !== confidence.length * 4) throw new Error("抠图遮罩尺寸与图片不一致");
    let visible = 0;
    for (let index = 0; index < confidence.length; index += 1) {
        const offset = index * 4 + 3;
        const alpha = Math.round(pixels[offset] * Math.min(1, Math.max(0, confidence[index])));
        pixels[offset] = alpha;
        if (alpha > 0) visible += 1;
    }
    return visible;
}
