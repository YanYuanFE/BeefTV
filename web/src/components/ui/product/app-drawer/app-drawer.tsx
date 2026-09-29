import type { CSSProperties, ReactNode } from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AppDrawer — 产品侧栏（Radix Dialog 侧滑）。
 *
 * - props：open/onClose/title/extra/footer/placement/width|size/closable/mask/maskClosable/keyboard/flush/styles。
 * - size "large" 等价 736px，默认 378px；width 优先。
 * - 结构：[data-slot=app-drawer] → header / [data-slot=app-drawer-body] / footer。
 */

export type AppDrawerProps = {
    open?: boolean;
    onClose?: () => void;
    title?: ReactNode;
    extra?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    placement?: "left" | "right" | "top" | "bottom";
    width?: number | string;
    size?: "default" | "large" | number | string;
    className?: string;
    rootClassName?: string;
    styles?: { body?: CSSProperties; header?: CSSProperties; footer?: CSSProperties; content?: CSSProperties; wrapper?: CSSProperties };
    closable?: boolean;
    closeIcon?: ReactNode;
    mask?: boolean;
    maskClosable?: boolean;
    keyboard?: boolean;
    flush?: boolean;
    loading?: boolean;
};

export function AppDrawer({
    open = false,
    onClose,
    title,
    extra,
    footer,
    children,
    placement = "right",
    width,
    size = "default",
    className,
    rootClassName,
    styles,
    closable = true,
    closeIcon,
    mask = true,
    maskClosable = true,
    keyboard = true,
    flush = false,
    loading = false,
}: AppDrawerProps) {
    const horizontal = placement === "left" || placement === "right";
    const extent = width ?? (size === "large" ? 736 : size === "default" ? 378 : size);
    const dimension = typeof extent === "number" ? `${extent}px` : extent;
    return (
        <SheetPrimitive.Root
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose?.();
            }}
        >
            <SheetPrimitive.Portal>
                {mask ? <SheetPrimitive.Overlay data-slot="app-drawer-mask" className="fixed inset-0 z-50 bg-black/30 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" /> : null}
                <SheetPrimitive.Content
                    data-slot="app-drawer"
                    data-side={placement}
                    aria-describedby={undefined}
                    style={{ ...(horizontal ? { width: dimension } : { height: dimension }), ...styles?.wrapper, ...styles?.content }}
                    className={cn(
                        "fixed z-50 flex max-w-full flex-col bg-popover text-sm text-popover-foreground shadow-xl outline-none transition duration-200 ease-in-out data-open:animate-in data-closed:animate-out",
                        placement === "right" && "inset-y-0 right-0 border-l border-border data-open:slide-in-from-right-10 data-closed:slide-out-to-right-10",
                        placement === "left" && "inset-y-0 left-0 border-r border-border data-open:slide-in-from-left-10 data-closed:slide-out-to-left-10",
                        placement === "top" && "inset-x-0 top-0 border-b border-border data-open:slide-in-from-top-10 data-closed:slide-out-to-top-10",
                        placement === "bottom" && "inset-x-0 bottom-0 border-t border-border data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10",
                        rootClassName,
                        className,
                    )}
                    onEscapeKeyDown={(event) => {
                        if (!keyboard) event.preventDefault();
                    }}
                    onInteractOutside={(event) => {
                        if (!maskClosable || !mask) event.preventDefault();
                    }}
                >
                    {title || extra || closable ? (
                        <div data-slot="app-drawer-header" style={styles?.header} className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
                            <SheetPrimitive.Title className={cn("min-w-0 flex-1 truncate text-base font-semibold text-foreground", !title && "sr-only")}>{title || "侧栏"}</SheetPrimitive.Title>
                            {extra}
                            {closable ? (
                                <SheetPrimitive.Close asChild>
                                    <Button variant="ghost" size="icon-sm" aria-label="关闭">
                                        {closeIcon ?? <XIcon />}
                                    </Button>
                                </SheetPrimitive.Close>
                            ) : null}
                        </div>
                    ) : (
                        <SheetPrimitive.Title className="sr-only">侧栏</SheetPrimitive.Title>
                    )}
                    <div data-slot="app-drawer-body" style={styles?.body} className={cn("min-h-0 flex-1 overflow-y-auto", !flush && "p-4")}>
                        {loading ? <div className="grid h-full place-items-center text-muted-foreground">加载中…</div> : children}
                    </div>
                    {footer ? (
                        <div data-slot="app-drawer-footer" style={styles?.footer} className="shrink-0 border-t border-border px-4 py-3">
                            {footer}
                        </div>
                    ) : null}
                </SheetPrimitive.Content>
            </SheetPrimitive.Portal>
        </SheetPrimitive.Root>
    );
}
