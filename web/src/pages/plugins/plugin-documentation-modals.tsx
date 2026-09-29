import { CloudUpload, FileText, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

import { AppModal } from "@/components/ui/product/app-modal";
import type { RegisteredPlugin } from "@/lib/plugins/plugin-types";

import pluginDevelopmentGuideMarkdown from "./plugin-development-guide.md?raw";
import { getPluginDocumentation } from "./plugin-documentation";
import { PluginMarkdown } from "./plugin-markdown";
import "./plugins.css";

// Shared workspace modal shell (radius, surface, elevation) for the product dialogs.
const workspaceModalShell = "overflow-hidden border-0 rounded-[var(--modal-radius)] bg-popover shadow-[var(--elevation-overlay)]";

type UploadPluginModalProps = {
    open: boolean;
    onClose: () => void;
    onUpload: (file: File) => void;
};

export function UploadPluginModal({ open, onClose, onUpload }: UploadPluginModalProps) {
    const [isDraggingPlugin, setIsDraggingPlugin] = useState(false);
    const dragDepth = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePluginDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepth.current += 1;
        setIsDraggingPlugin(true);
    };

    const handlePluginDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setIsDraggingPlugin(false);
        }
    };

    const handlePluginDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepth.current = 0;
        setIsDraggingPlugin(false);
        const file = event.dataTransfer.files[0];
        if (file && isPluginPackage(file)) onUpload(file);
    };

    return (
        <AppModal
            className={`workspace-modal workspace-modal-wide plugin-upload-modal ${workspaceModalShell}`}
            title="上传插件"
            open={open}
            footer={null}
            onCancel={onClose}
            styles={{ body: { maxHeight: "min(82vh, 900px)", overflowY: "auto", overscrollBehavior: "contain" } }}
        >
            <div className="plugin-upload-layout">
                <section className="plugin-upload-guide">
                    <PluginMarkdown source={pluginDevelopmentGuideMarkdown} />
                </section>
                <aside className="plugin-upload-panel">
                    <div className="plugin-upload-panel-heading">
                        <span className="plugin-upload-panel-icon"><CloudUpload className="size-5" /></span>
                        <div>
                            <h2>安装插件包</h2>
                            <p>选择统一站点插件包，安装后会立即进入插件中心。</p>
                        </div>
                    </div>
                    <div
                        className={`plugin-upload-dropzone-shell${isDraggingPlugin ? " is-dragging" : ""}`}
                        onDragEnter={handlePluginDragEnter}
                        onDragLeave={handlePluginDragLeave}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handlePluginDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".beeftv-plugin,application/zip"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) onUpload(file);
                            }}
                        />
                        <button type="button" className="plugin-upload-dropzone" onClick={() => fileInputRef.current?.click()}>
                            <CloudUpload className="plugin-upload-dropzone-icon" />
                            <p className="plugin-upload-dropzone-text">{isDraggingPlugin ? "释放文件以上传插件" : "点击选择插件文件，也可拖拽到此处"}</p>
                            <p className="plugin-upload-dropzone-hint">支持 .beeftv-plugin 包 · 大小不超过 48 MiB</p>
                        </button>
                    </div>
                    <div className="plugin-upload-notice">
                        <ShieldCheck className="size-4" />
                        <span>上传前请确认插件来源可信。Web 入口只能进入声明的隔离运行时，不会获得主页面权限；密钥也不会从清单读取。</span>
                    </div>
                </aside>
            </div>
        </AppModal>
    );
}

type PluginDetailsModalProps = {
    plugin?: RegisteredPlugin;
    restoreFocus: boolean;
    onClose: () => void;
};

export function PluginDetailsModal({ plugin, restoreFocus, onClose }: PluginDetailsModalProps) {
    return (
        <AppModal
            className={`workspace-modal workspace-modal-wide plugin-details-modal ${workspaceModalShell}`}
            title={plugin ? (
                <div className="plugin-details-title">
                    <FileText className="size-4" />
                    <span>{plugin.manifest.name}</span>
                    <span className="plugin-version">v{plugin.manifest.version}</span>
                </div>
            ) : null}
            open={Boolean(plugin)}
            footer={null}
            onCancel={onClose}
            afterClose={() => {
                // Mouse openers were blurred on open; drop the focus Radix returns to them after close.
                if (!restoreFocus) window.setTimeout(() => (document.activeElement as HTMLElement | null)?.blur(), 0);
            }}
            styles={{ body: { maxHeight: "min(78vh, 820px)", overflowY: "auto", overscrollBehavior: "contain" } }}
        >
            {plugin ? <PluginMarkdown className="plugin-details-document" source={getPluginDocumentation(plugin.manifest)} /> : null}
        </AppModal>
    );
}

/** Mirrors the picker accept list for dropped files. */
function isPluginPackage(file: File) {
    return file.name.toLowerCase().endsWith(".beeftv-plugin") || file.type === "application/zip";
}
