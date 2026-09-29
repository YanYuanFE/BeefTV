import { useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

type CanvasImagePreviewProps = {
    src: string;
    alt?: string;
    onClose: () => void;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 12;
const SCALE_STEP = 0.25;

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

// Fullscreen image viewer with wheel/button zoom and drag-to-move.
export function CanvasImagePreview({ src, alt = "图片", onClose }: CanvasImagePreviewProps) {
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

    if (!src) return null;

    const zoomBy = (delta: number) => setScale((current) => clampScale(current + delta));
    const reset = () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    };
    const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
        zoomBy(event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
    };
    const handlePointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y };
    };
    const handlePointerMove = (event: ReactPointerEvent<HTMLImageElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        setOffset({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY });
    };
    const handlePointerUp = (event: ReactPointerEvent<HTMLImageElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const toolButtonClass = "inline-flex size-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40 motion-reduce:transition-none";

    return (
        <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay data-slot="image-preview-mask" className="fixed inset-0 z-[1080] bg-black/80" />
                <DialogPrimitive.Content data-slot="image-preview" aria-describedby={undefined} data-canvas-no-zoom className="fixed inset-0 z-[1080] flex items-center justify-center overflow-hidden outline-none" onWheel={handleWheel}>
                    <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
                    <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
                    <img
                        src={src}
                        alt={alt}
                        draggable={false}
                        className="relative max-h-[90vh] max-w-[90vw] cursor-grab select-none object-contain active:cursor-grabbing"
                        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    />
                    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-2 py-1">
                        <button type="button" className={toolButtonClass} aria-label="缩小" disabled={scale <= MIN_SCALE} onClick={() => zoomBy(-SCALE_STEP)}>
                            <ZoomOut className="size-4" />
                        </button>
                        <span className="min-w-12 text-center text-xs tabular-nums text-white/85">{Math.round(scale * 100)}%</span>
                        <button type="button" className={toolButtonClass} aria-label="放大" disabled={scale >= MAX_SCALE} onClick={() => zoomBy(SCALE_STEP)}>
                            <ZoomIn className="size-4" />
                        </button>
                        <button type="button" className={toolButtonClass} aria-label="重置" onClick={reset}>
                            <RotateCcw className="size-4" />
                        </button>
                    </div>
                    <DialogPrimitive.Close asChild>
                        <button type="button" className={`${toolButtonClass} absolute top-5 right-5 bg-black/40`} aria-label="关闭预览">
                            <X className="size-5" />
                        </button>
                    </DialogPrimitive.Close>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
