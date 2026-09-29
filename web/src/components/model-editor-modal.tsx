import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppModal } from "@/components/ui/product/app-modal";
import type { ReactNode } from "react";
import "./model-editor-modal.css";

export function ModelEditorModal({
    title,
    subtitle,
    open,
    onClose,
    footer,
    activeKey,
    onTabChange,
    items,
    busy = false,
    admin = false,
    children,
}: {
    title: string;
    subtitle?: string;
    open: boolean;
    onClose: () => void;
    footer: ReactNode;
    activeKey?: string;
    onTabChange?: (key: string) => void;
    items?: Array<{ key: string; label: string; children: ReactNode }>;
    busy?: boolean;
    admin?: boolean;
    children?: ReactNode | ((tabs: ReactNode) => ReactNode);
}) {
    const tabs = items?.length ? (
        <Tabs className="model-editor-tabs gap-0" value={activeKey} defaultValue={items[0].key} onValueChange={onTabChange}>
            <TabsList variant="line" className="model-editor-tabs-nav">
                {items.map((item) => (
                    <TabsTrigger key={item.key} value={item.key} className="flex-none">
                        {item.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            <div className="model-editor-tabs-body">
                {/* forceMount keeps every panel's fields mounted, like AntD forceRender. */}
                {items.map((item) => (
                    <TabsContent key={item.key} value={item.key} forceMount className="data-[state=inactive]:hidden">
                        <div className="model-editor-panel">{item.children}</div>
                    </TabsContent>
                ))}
            </div>
        </Tabs>
    ) : null;
    const content = typeof children === "function" ? children(tabs) : children || tabs;

    return (
        <AppModal
            open={open}
            width={1120}
            rootClassName={`${admin ? "admin-modal-root " : ""}model-editor-modal`}
            title={
                <div>
                    {title}
                    {subtitle && <p className="model-editor-subtitle">{subtitle}</p>}
                </div>
            }
            maskClosable={false}
            keyboard={!busy}
            closable={!busy}
            onCancel={onClose}
            footer={footer}
            flush styles={{ body: { minHeight: 0, flex: 1 }, header: { margin: 0 }, footer: { margin: 0 } }}
        >
            {content}
        </AppModal>
    );
}
