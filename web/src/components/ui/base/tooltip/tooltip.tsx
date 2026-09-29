import type { ReactNode } from "react";

import { Tooltip as TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Tooltip — 气泡提示（Radix Tooltip）。
 *
 * - API 保持 title/placement/delay/className/children；title 为空时不渲染浮层。
 * - trigger 包一层 inline-flex span，children 可为任意组件（不要求转发 ref）。
 * - 样式只吃语义 token：bg-surface-strong + text-foreground + border-border hairline。
 */

export type TooltipPlacement = "top" | "topLeft" | "topRight" | "bottom" | "bottomLeft" | "bottomRight" | "left" | "right";

const PLACEMENT_MAP: Record<TooltipPlacement, { side: "top" | "bottom" | "left" | "right"; align: "start" | "center" | "end" }> = {
    top: { side: "top", align: "center" },
    topLeft: { side: "top", align: "start" },
    topRight: { side: "top", align: "end" },
    bottom: { side: "bottom", align: "center" },
    bottomLeft: { side: "bottom", align: "start" },
    bottomRight: { side: "bottom", align: "end" },
    left: { side: "left", align: "center" },
    right: { side: "right", align: "center" },
};

export interface TooltipProps {
    title?: ReactNode;
    placement?: TooltipPlacement;
    /** 悬停延迟 ms（默认 350） */
    delay?: number;
    className?: string;
    children: ReactNode;
}

export function Tooltip({ title, placement = "top", delay = 350, className, children }: TooltipProps) {
    if (!title) return <>{children}</>;
    const { side, align } = PLACEMENT_MAP[placement];
    return (
        // Own provider keeps each tooltip self-contained (portals, isolated renders).
        <TooltipProvider delayDuration={delay}>
        <TooltipRoot>
            <TooltipTrigger asChild>
                <span className="inline-flex">{children}</span>
            </TooltipTrigger>
            <TooltipContent side={side} align={align} sideOffset={6} className={cn("max-w-64 border border-border bg-surface-strong px-2 py-1 leading-relaxed text-foreground shadow-md [&>svg:last-child]:hidden", className)}>
                {title}
            </TooltipContent>
        </TooltipRoot>
        </TooltipProvider>
    );
}
