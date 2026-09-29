import type { CSSProperties, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AppModal — 产品弹窗（Radix Dialog）。
 *
 * - 覆盖业务常用的弹窗 props：title/footer/onCancel/onOk/okText/cancelText/okButtonProps/
 *   confirmLoading/width/closable/mask/maskClosable/keyboard/afterOpenChange/afterClose/styles。
 * - footer 未传时渲染默认“取消/确定”；传 null 时不渲染页脚。
 * - flush 去掉内容区内边距，供自带外壳的弹窗使用。
 * - 结构：[data-slot=app-modal] 内容外壳 → header / [data-slot=app-modal-body] / footer。
 */

type ModalButtonProps = { danger?: boolean; disabled?: boolean; loading?: boolean; type?: "primary" | "default" };

export type AppModalProps = {
    open?: boolean;
    title?: ReactNode;
    children?: ReactNode;
    /** undefined renders the default cancel/ok buttons; null renders none. */
    footer?: ReactNode;
    onCancel?: () => void;
    onOk?: () => void;
    okText?: ReactNode;
    cancelText?: ReactNode;
    okButtonProps?: ModalButtonProps;
    cancelButtonProps?: { disabled?: boolean };
    confirmLoading?: boolean;
    width?: number | string;
    className?: string;
    rootClassName?: string;
    style?: CSSProperties;
    styles?: { body?: CSSProperties; content?: CSSProperties; container?: CSSProperties; header?: CSSProperties; footer?: CSSProperties };
    closable?: boolean;
    mask?: boolean;
    maskClosable?: boolean;
    keyboard?: boolean;
    flush?: boolean;
    afterOpenChange?: (open: boolean) => void;
    afterClose?: () => void;
    zIndex?: number;
};

export function AppModal({
    open = false,
    title,
    children,
    footer,
    onCancel,
    onOk,
    okText = "确定",
    cancelText = "取消",
    okButtonProps,
    cancelButtonProps,
    confirmLoading = false,
    width = 520,
    className,
    rootClassName,
    style,
    styles,
    closable = true,
    mask = true,
    maskClosable = true,
    keyboard = true,
    flush = false,
    afterOpenChange,
    afterClose,
    zIndex,
}: AppModalProps) {
    const layer = zIndex === undefined ? undefined : { zIndex };
    const defaultFooter = (
        <>
            <Button variant="outline" disabled={cancelButtonProps?.disabled} onClick={onCancel}>
                {cancelText}
            </Button>
            <Button
                variant={okButtonProps?.danger ? "destructive" : okButtonProps?.type === "default" ? "outline" : "default"}
                disabled={okButtonProps?.disabled}
                loading={confirmLoading || okButtonProps?.loading}
                onClick={onOk}
            >
                {okText}
            </Button>
        </>
    );
    const footerContent = footer === undefined ? defaultFooter : footer;

    return (
        <DialogPrimitive.Root
            open={open}
            onOpenChange={(next) => {
                if (!next) onCancel?.();
            }}
        >
            <DialogPrimitive.Portal>
                {mask ? (
                    <DialogPrimitive.Overlay
                        data-slot="app-modal-mask"
                        style={layer}
                        className="fixed inset-0 z-50 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
                    />
                ) : null}
                <DialogPrimitive.Content
                    data-slot="app-modal"
                    aria-describedby={undefined}
                    style={{ width: typeof width === "number" ? `${width}px` : width, ...layer, ...style, ...styles?.container, ...styles?.content }}
                    className={cn(
                        "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-sm text-popover-foreground shadow-xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                        !flush && "p-5",
                        rootClassName,
                        className,
                    )}
                    onEscapeKeyDown={(event) => {
                        if (!keyboard) event.preventDefault();
                    }}
                    onInteractOutside={(event) => {
                        if (!maskClosable || !mask) event.preventDefault();
                    }}
                    onOpenAutoFocus={() => afterOpenChange?.(true)}
                    onCloseAutoFocus={() => {
                        afterOpenChange?.(false);
                        afterClose?.();
                    }}
                >
                    {title ? (
                        <DialogPrimitive.Title data-slot="app-modal-title" style={styles?.header} className={cn("pr-8 text-base font-semibold text-foreground", flush ? "px-5 pt-5" : "mb-4")}>
                            {title}
                        </DialogPrimitive.Title>
                    ) : (
                        <DialogPrimitive.Title className="sr-only">对话框</DialogPrimitive.Title>
                    )}
                    <div data-slot="app-modal-body" style={styles?.body} className="min-h-0 flex-1 overflow-y-auto">
                        {children}
                    </div>
                    {footerContent ? (
                        <div data-slot="app-modal-footer" style={styles?.footer} className={cn("flex flex-wrap items-center justify-end gap-2", flush ? "px-5 pb-5" : "mt-5")}>
                            {footerContent}
                        </div>
                    ) : null}
                    {closable ? (
                        <DialogPrimitive.Close asChild>
                            <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label="关闭">
                                <XIcon />
                            </Button>
                        </DialogPrimitive.Close>
                    ) : null}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
