import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUp, LoaderCircle, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { applyCutoutMask } from "@/lib/canvas/canvas-cutout-mask";
import { segmentCanvasImage, type CanvasSegmentationResult, type CanvasSegmentPoint } from "@/lib/canvas/canvas-segmentation";
import { imageToDataUrl } from "@/services/image-storage";

type CanvasImageCutoutEditorProps = {
    image: { url: string; storageKey?: string };
    onCancel: () => void;
    onConfirm: (cutoutDataUrl: string) => void | Promise<void>;
};

/** Inline point-to-select cutout: each click adds a point, the local model re-segments, confirm exports a transparent PNG. */
export function CanvasImageCutoutEditor({ image, onCancel, onConfirm }: CanvasImageCutoutEditorProps) {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const [sourceDataUrl, setSourceDataUrl] = useState("");
    const [points, setPoints] = useState<CanvasSegmentPoint[]>([]);
    const [segmentation, setSegmentation] = useState<CanvasSegmentationResult | null>(null);
    const [isSegmenting, setIsSegmenting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setSourceDataUrl(""); setPoints([]); setSegmentation(null);
        imageToDataUrl(image)
            .then((dataUrl) => { if (!cancelled) setSourceDataUrl(dataUrl || ""); })
            .catch((error: unknown) => { if (!cancelled) toast.error(error instanceof Error ? `读取图片失败：${error.message}` : "读取图片失败"); });
        return () => { cancelled = true; };
    }, [image.storageKey, image.url]);
    useEffect(() => () => abortRef.current?.abort(), []);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onCancel]);
    useEffect(() => renderPreview(previewCanvasRef.current, segmentation), [segmentation]);

    const addPoint = async (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        if (!sourceDataUrl || isSubmitting) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const point = { x: clamp01((event.clientX - rect.left) / Math.max(1, rect.width)), y: clamp01((event.clientY - rect.top) / Math.max(1, rect.height)) };
        const nextPoints = [...points, point];
        setPoints(nextPoints);
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsSegmenting(true);
        try {
            const result = await segmentCanvasImage(sourceDataUrl, nextPoints, controller.signal);
            if (!controller.signal.aborted) setSegmentation(result);
        } catch (error) {
            if (controller.signal.aborted) return;
            setPoints(points);
            toast.error(error instanceof Error ? `抠图失败：${error.message}` : "抠图失败，请重试");
        } finally {
            if (abortRef.current === controller) setIsSegmenting(false);
        }
    };
    const reset = () => { abortRef.current?.abort(); setIsSegmenting(false); setPoints([]); setSegmentation(null); };
    const confirm = async () => {
        if (!segmentation || isSubmitting || isSegmenting) return;
        setIsSubmitting(true);
        try {
            await onConfirm(await buildCutoutPng(sourceDataUrl, segmentation));
        } catch (error) {
            toast.error(error instanceof Error ? `抠图失败：${error.message}` : "抠图失败，请重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    const status = !sourceDataUrl ? "正在读取图片" : isSegmenting ? "正在识别主体" : points.length ? "继续点选可补充区域" : "点击要保留的主体";

    return (
        <div
            data-image-cutout-inline="true"
            className="absolute inset-0 z-[calc(var(--node-z-overlay)+2)] overflow-hidden rounded-[inherit] select-none"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div aria-label="点选抠图区域" className="absolute inset-0 cursor-crosshair bg-black/10" onPointerDown={(event) => void addPoint(event)}>
                <canvas ref={previewCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                {points.map((point, index) => (
                    <span key={index} className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />
                ))}
            </div>
            <div className="absolute bottom-3 left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/12 bg-[#202020]/94 p-1.5 pl-2.5 text-white shadow-xl backdrop-blur-xl">
                <button type="button" aria-label="取消抠图" title="取消抠图" onClick={onCancel} className="grid size-8 place-items-center rounded-xl text-white/72 transition hover:bg-white/10 hover:text-white">
                    <X className="size-4" />
                </button>
                <span className="flex items-center gap-1.5 whitespace-nowrap border-l border-white/12 pl-3 pr-1 text-xs font-medium text-white/88">
                    {isSegmenting || !sourceDataUrl ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                    {status}
                </span>
                <button type="button" aria-label="重新点选" title="重新点选" disabled={!points.length} onClick={reset} className="grid size-8 place-items-center rounded-xl text-white/72 transition hover:bg-white/10 hover:text-white disabled:opacity-40">
                    <RotateCcw className="size-4" />
                </button>
                <button
                    type="button"
                    aria-label={isSubmitting ? "正在生成抠图" : "生成抠图"}
                    title={isSubmitting ? "正在生成抠图" : "生成抠图"}
                    disabled={!segmentation || isSegmenting || isSubmitting}
                    onClick={() => void confirm()}
                    className="grid size-8 place-items-center rounded-xl bg-white text-black transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSubmitting ? <LoaderCircle className="size-4 animate-spin" stroke="#111111" strokeWidth={2.25} /> : <ArrowUp className="size-4" stroke="#111111" strokeWidth={2.25} />}
                </button>
            </div>
        </div>
    );
}

/** Dims everything outside the selected subject. */
function renderPreview(canvas: HTMLCanvasElement | null, segmentation: CanvasSegmentationResult | null) {
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (!segmentation) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    canvas.width = segmentation.width;
    canvas.height = segmentation.height;
    const overlay = context.createImageData(segmentation.width, segmentation.height);
    segmentation.confidence.forEach((value, index) => { overlay.data[index * 4 + 3] = Math.round((1 - value) * 170); });
    context.putImageData(overlay, 0, 0);
}

async function buildCutoutPng(dataUrl: string, segmentation: CanvasSegmentationResult) {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    if (image.naturalWidth !== segmentation.width || image.naturalHeight !== segmentation.height) throw new Error("抠图遮罩尺寸与图片不一致");
    const canvas = document.createElement("canvas");
    canvas.width = segmentation.width;
    canvas.height = segmentation.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持画布绘制");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    if (applyCutoutMask(pixels.data, segmentation.confidence) === 0) throw new Error("没有识别到可保留的主体，请换个位置点选");
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
}

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}
