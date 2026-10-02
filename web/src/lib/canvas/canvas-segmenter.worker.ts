/// <reference lib="webworker" />

import { InteractiveSegmenterLegacy } from "@mediapipe/tasks-vision";

import type { CanvasSegmentPoint } from "./canvas-segmentation";

type SegmentRequest = {
    id: number;
    image: ImageBitmap;
    points: CanvasSegmentPoint[];
};

type SegmentResponse = {
    id: number;
    width?: number;
    height?: number;
    confidence?: Float32Array;
    error?: string;
};

let segmenterPromise: Promise<InteractiveSegmenterLegacy> | null = null;

const workerGlobal = self as typeof self & {
    importScripts: (...urls: string[]) => void;
    import?: (url: string) => Promise<unknown>;
};

// Same module-worker loader shim as canvas-face-detector.worker.ts.
workerGlobal.importScripts = () => { throw new TypeError("module worker uses dynamic import"); };
workerGlobal.import = async (url: string) => {
    const response = await fetch(url.replace(/\?import(?:&.*)?$/, ""));
    if (!response.ok) throw new Error(`MediaPipe loader 加载失败：${response.status}`);
    const blobUrl = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
    try {
        return await import(/* @vite-ignore */ blobUrl);
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
};

function getSegmenter() {
    if (!segmenterPromise) {
        segmenterPromise = InteractiveSegmenterLegacy.createFromOptions(
            {
                wasmLoaderPath: "/mediapipe/wasm/vision_wasm_module_internal.js",
                wasmBinaryPath: "/mediapipe/wasm/vision_wasm_module_internal.wasm",
            },
            {
                baseOptions: { modelAssetPath: "/canvas/models/magic_touch.tflite" },
                outputConfidenceMasks: true,
                outputCategoryMask: false,
            },
        );
    }
    return segmenterPromise;
}

self.onmessage = async (event: MessageEvent<SegmentRequest>) => {
    const { id, image, points } = event.data;
    const response: SegmentResponse = { id };
    try {
        const segmenter = await getSegmenter();
        const roi = points.length === 1 ? { keypoint: points[0] } : { scribble: points };
        segmenter.segment(image, roi, (result) => {
            const mask = result.confidenceMasks?.[0];
            if (!mask) throw new Error("抠图模型没有返回遮罩");
            response.width = mask.width;
            response.height = mask.height;
            // Mask memory is only valid inside this callback.
            response.confidence = mask.getAsFloat32Array().slice();
        });
    } catch (error) {
        response.error = error instanceof Error ? error.message : "抠图失败";
    } finally {
        image.close();
    }
    self.postMessage(response, response.confidence ? [response.confidence.buffer] : []);
};

export {};
