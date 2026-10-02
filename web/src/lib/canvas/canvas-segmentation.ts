export type CanvasSegmentPoint = { x: number; y: number };

export type CanvasSegmentationResult = {
    width: number;
    height: number;
    /** Foreground confidence in [0, 1], one value per pixel, row-major. */
    confidence: Float32Array;
};

type SegmentResponse = {
    id: number;
    width?: number;
    height?: number;
    confidence?: Float32Array;
    error?: string;
};

type PendingRequest = {
    resolve: (result: CanvasSegmentationResult) => void;
    reject: (error: Error) => void;
    cleanup: () => void;
};

let segmenterWorker: Worker | null = null;
let requestSequence = 0;
const pendingRequests = new Map<number, PendingRequest>();

/** Segments the object under the given normalized points, fully in the browser. */
export async function segmentCanvasImage(dataUrl: string, points: CanvasSegmentPoint[], signal?: AbortSignal): Promise<CanvasSegmentationResult> {
    if (!__BEEFTV_HEAVY_MEDIA_ENABLED__) {
        throw new Error("精简版未包含本地抠图，请安装完整媒体包");
    }
    if (!points.length) throw new Error("请先在图片上点选要保留的主体");
    if (signal?.aborted) throw new DOMException("抠图已取消", "AbortError");
    const response = await fetch(dataUrl, { signal });
    if (!response.ok) throw new Error("无法读取源图片，请重新上传后再试");
    const image = await createImageBitmap(await response.blob());
    const worker = getSegmenterWorker();
    const id = ++requestSequence;
    return new Promise((resolve, reject) => {
        const abort = () => {
            const request = pendingRequests.get(id);
            if (!request) return;
            pendingRequests.delete(id);
            request.cleanup();
            reject(new DOMException("抠图已取消", "AbortError"));
        };
        const cleanup = () => signal?.removeEventListener("abort", abort);
        pendingRequests.set(id, { resolve, reject, cleanup });
        signal?.addEventListener("abort", abort, { once: true });
        worker.postMessage({ id, image, points }, [image]);
    });
}

function getSegmenterWorker() {
    if (segmenterWorker) return segmenterWorker;
    const worker = new Worker(new URL("./canvas-segmenter.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<SegmentResponse>) => {
        const request = pendingRequests.get(event.data.id);
        if (!request) return;
        pendingRequests.delete(event.data.id);
        request.cleanup();
        const { error, width, height, confidence } = event.data;
        if (error || !width || !height || !confidence) {
            request.reject(new Error(error || "抠图模型返回了空结果"));
            return;
        }
        request.resolve({ width, height, confidence });
    };
    worker.onerror = (event) => {
        const error = new Error(event.message || "抠图服务初始化失败");
        pendingRequests.forEach((request) => {
            request.cleanup();
            request.reject(error);
        });
        pendingRequests.clear();
        worker.terminate();
        segmenterWorker = null;
    };
    segmenterWorker = worker;
    return worker;
}
