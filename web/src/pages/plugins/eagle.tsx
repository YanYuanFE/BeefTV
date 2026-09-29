import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Download, FileAudio, FileBox, FileImage, FileVideo, FolderOpen, FolderPlus, Loader2, RefreshCw, Search, Settings2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { IconButton } from "@/components/ui/base/buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDrawer } from "@/components/ui/product/app-drawer";
import { EmptyState } from "@/components/ui/product/empty-state";
import { useNavigate } from "react-router";

import "@/lib/plugins/builtin";
import { createEagleAssetSource, EAGLE_DEFAULT_BASE_URL, eagleAssetPlugin } from "@/lib/plugins/builtin/eagle";
import type { ExternalAssetFolder, ExternalAssetItem } from "@/lib/plugins/plugin-types";
import type { Asset } from "@/stores/use-asset-store";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { usePluginStore } from "@/stores/use-plugin-store";
import { CollectionGrid, ListToolbar, PageHeader, PaginationBar, WorkspacePage } from "@/components/layout/workspace-page";
import { AssetLibraryCard, AssetLibraryCardMedia } from "@/components/assets/asset-library-card";
import { toast } from "sonner";
import "./eagle.css";

export default function EagleLibraryPage() {
    const navigate = useNavigate();
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const installations = usePluginStore((state) => state.installations);
    const hydrated = usePluginStore((state) => state.hydrated);
    const ensurePlugin = usePluginStore((state) => state.ensurePlugin);
    const installation = installations.find((item) => item.manifest.id === eagleAssetPlugin.manifest.id);
    const enabled = Boolean(installation?.enabled);
    const savedBaseUrl = installation?.config.baseUrl;
    const baseUrl = typeof savedBaseUrl === "string" && savedBaseUrl.trim() ? savedBaseUrl.trim() : EAGLE_DEFAULT_BASE_URL;
    const provider = useMemo(() => createEagleAssetSource(baseUrl), [baseUrl]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [folders, setFolders] = useState<ExternalAssetFolder[]>([]);
    const [items, setItems] = useState<ExternalAssetItem[]>([]);
    const [selectedFolder, setSelectedFolder] = useState("");
    const [keyword, setKeyword] = useState("");
    const [folderName, setFolderName] = useState("");
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [loading, setLoading] = useState(false);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(40);
    const [previewItem, setPreviewItem] = useState<ExternalAssetItem | null>(null);
    const [foldersExpanded, setFoldersExpanded] = useState(true);

    const treeData = useMemo<EagleFolderNode[]>(() => renderFolderNodes(folders), [folders]);
    const folderPath = useMemo(() => externalFolderPath(folders, selectedFolder), [folders, selectedFolder]);
    const currentFolder = folders.find((folder) => folder.id === selectedFolder);
    const visibleItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
    const totalBytes = useMemo(() => items.reduce((total, item) => total + (item.bytes || 0), 0), [items]);

    useEffect(() => {
        ensurePlugin(eagleAssetPlugin.manifest);
    }, [ensurePlugin]);

    const load = async (folderId = selectedFolder, search = keyword) => {
        setLoading(true);
        setError("");
        try {
            const [nextFolders, nextItems] = await Promise.all([
                provider.listFolders?.(),
                provider.list?.({ folderId: folderId || undefined, keyword: search.trim() || undefined, limit: 100, offset: 0 }),
            ]);
            setFolders(nextFolders || []);
            setItems(nextItems || []);
            setPage(1);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "连接 Eagle 失败，请确认 Eagle 已启动");
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!enabled) return;
        setSelectedFolder("");
        setKeyword("");
        void load("", "");
        // provider 随本机 API 地址变化；页面进入或配置变化时重新读取 Eagle。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, provider]);

    const handleFolderSelect = (nextFolder: string) => {
        const folderId = nextFolder === "root" ? "" : nextFolder;
        setSelectedFolder(folderId);
        setKeyword("");
        setPreviewItem(null);
        setPage(1);
        void load(folderId, "");
    };

    const handleCreateFolder = async () => {
        const name = folderName.trim();
        if (!name || !provider.createFolder || creatingFolder) return;
        setCreatingFolder(true);
        setError("");
        try {
            await provider.createFolder(name, selectedFolder || undefined);
            setFolderName("");
            toast.success("已在" + (currentFolder?.name || "Eagle 素材库") + "中新建文件夹");
            await load();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "新建 Eagle 文件夹失败");
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (!files.length || !provider.uploadFile || working) return;
        setWorking(true);
        setError("");
        let uploaded = 0;
        try {
            for (const [index, file] of files.entries()) {
                setProgress("正在写入 " + (index + 1) + "/" + files.length + "：" + file.name);
                await provider.uploadFile(file, selectedFolder || undefined);
                uploaded += 1;
            }
            toast.success("已写入 Eagle " + uploaded + " 个文件");
            await load();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "写入 Eagle 失败");
            if (uploaded) toast.warning("已写入 " + uploaded + " 个文件，剩余文件未完成");
        } finally {
            setProgress("");
            setWorking(false);
        }
    };

    if (hydrated && !enabled) {
        return (
            <WorkspacePage grid className="library-page eagle-library-page">
                <PageHeader
                    title="Eagle 素材库"
                    description={`把 Eagle 作为${brandName}的外部素材来源，直接浏览和管理 Eagle 原始文件。`}
                    actions={<Button variant="outline" onClick={() => navigate("/assets")}><ArrowLeft className="size-3.5" />返回{brandName}素材库</Button>}
                />
                <section className="mt-4 library-card-surface flex min-h-72 flex-col items-center justify-center rounded-[var(--r-xl)] px-6 py-10 text-center">
                    <span className="grid size-14 place-items-center rounded-[var(--r-lg)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"><FolderOpen className="size-7" aria-hidden="true" /></span>
                    <h2 className="mt-4 text-base font-semibold">先启用 Eagle 素材来源</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-foreground/55">启用后，这里会直接显示 Eagle 原本的文件夹和文件，不会把素材复制成{brandName}本地素材。</p>
                    <Button className="mt-5" onClick={() => navigate("/plugins")}><Settings2 className="size-4" />去插件中心启用</Button>
                </section>
            </WorkspacePage>
        );
    }

    return (
        <>
            <WorkspacePage grid className="library-page assets-library-page canvas-library-page eagle-library-page">
                <div className="studio-band">
                    <PageHeader
                        title="Eagle 素材库"
                        description={`Eagle 是${brandName}的外部素材来源；这里复用${brandName}素材库的浏览方式，直接读取和写入 Eagle 原始文件。`}
                        meta={<span className="app-projects-header-meta assets-header-meta">{error ? "Eagle · 连接异常" : "Eagle · 已连接"}</span>}
                        actions={(
                            <div className="assets-header-actions">
                                <div className="assets-header-action-buttons">
                                    <Button className="library-primary-action" onClick={() => fileInputRef.current?.click()} disabled={working}><Upload className="size-3.5" />写入素材</Button>
                                    <Button variant="outline" onClick={() => navigate("/assets")}><ArrowLeft className="size-3.5" />{brandName}素材库</Button>
                                    <Button variant="outline" onClick={() => navigate("/plugins")}><Settings2 className="size-3.5" />插件设置</Button>
                                </div>
                            </div>
                        )}
                    />
                    <ListToolbar
                        className="library-toolbar"
                        active={Boolean(keyword)}
                        onReset={() => { setKeyword(""); setPage(1); void load(selectedFolder, ""); }}
                        trailing={<Button variant="outline" loading={loading} onClick={() => void load()}>{loading ? null : <RefreshCw className="size-3.5" />}刷新</Button>}
                    >
                        <div className="relative w-full sm:w-80">
                            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground/40" />
                            <Input
                                className="pr-8 pl-8"
                                aria-label="搜索 Eagle 素材"
                                value={keyword}
                                placeholder="搜索 Eagle 素材标题、标签或文件夹"
                                onChange={(event) => { setPage(1); setKeyword(event.target.value); }}
                                onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) void load(); }}
                            />
                            {keyword ? (
                                <button type="button" aria-label="清空搜索" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground" onClick={() => { setPage(1); setKeyword(""); }}>
                                    <X className="size-3.5" />
                                </button>
                            ) : null}
                        </div>
                    </ListToolbar>
                </div>

                {error ? <div className="mt-3 flex items-start justify-between gap-3 rounded-[var(--r-lg)] bg-danger/[.08] px-4 py-3 text-sm text-danger" role="alert"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-3.5" />重试</Button></div> : null}

                <div className="canvas-library-frame assets-library-frame eagle-library-frame mt-4">
                    <div className="grid min-h-0 gap-4 lg:grid-cols-[176px_minmax(0,1fr)]">
                        <aside className="eagle-folder-sidebar thin-scrollbar flex gap-2 overflow-x-auto py-3 lg:sticky lg:top-0 lg:block lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto lg:pr-3">
                            <div className="eagle-folder-sidebar-header">
                                <span className="text-[var(--fs-label)] font-semibold">Eagle 文件夹</span>
                                <IconButton size="sm" variant="ghost" icon={RefreshCw} aria-label="刷新 Eagle 文件夹" loading={loading} onClick={() => void load()} />
                            </div>
                            <button type="button" className={"assets-filter-item " + (selectedFolder === "" ? "is-active" : "")} aria-pressed={selectedFolder === ""} onClick={() => handleFolderSelect("root")}>
                                <span className="assets-filter-item-label">全部素材</span>
                                <span className="assets-filter-count">{items.length}</span>
                            </button>
                            <div className="eagle-folder-sidebar-label">
                                <span>文件夹</span>
                                <button type="button" className="eagle-folder-collapse" aria-expanded={foldersExpanded} aria-controls="eagle-folder-tree" onClick={() => setFoldersExpanded((expanded) => !expanded)}>
                                    {foldersExpanded ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
                                    <span className="sr-only">{foldersExpanded ? "收起文件夹" : "展开文件夹"}</span>
                                </button>
                            </div>
                            {foldersExpanded ? (treeData.length ? <div id="eagle-folder-tree"><EagleFolderTree nodes={treeData} selectedFolder={selectedFolder} onSelect={handleFolderSelect} /></div> : <div className="eagle-folder-empty">Eagle 中还没有文件夹</div>) : null}
                            <Button variant="outline" className="eagle-folder-create" onClick={() => setFolderName((value) => value ? "" : "新文件夹")}><FolderPlus className="size-3.5" />新建文件夹</Button>
                        </aside>

                        <section className="min-w-0">
                            <nav aria-label="Eagle 文件夹路径" className="mb-3 flex min-w-0 items-center gap-1 text-xs text-foreground/48">
                                <button type="button" className="truncate rounded px-1.5 py-1 hover:bg-surface-hover" onClick={() => handleFolderSelect("root")}>Eagle 素材库</button>
                                {folderPath.map((folder) => <span key={folder.id} className="contents"><span aria-hidden="true">/</span><button type="button" className="truncate rounded px-1.5 py-1 font-medium text-foreground hover:bg-surface-hover" onClick={() => handleFolderSelect(folder.id)}>{folder.name}</button></span>)}
                            </nav>

                            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-base font-semibold">{currentFolder?.name || "全部素材"}</h2>
                                        <span className="app-projects-header-meta">{items.length} 个素材</span>
                                    </div>
                                    <p className="mt-1 text-xs text-foreground/48">{currentFolder ? `当前文件夹由 Eagle 管理，${brandName}只负责展示和调用。` : "当前展示 Eagle 素材库中的全部文件。"}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button variant="outline" onClick={() => setFolderName((value) => value ? "" : "新文件夹")}><FolderPlus className="size-3.5" />新建文件夹</Button>
                                    <Button variant="outline" onClick={() => { const firstFile = visibleItems.find((item) => item.fileUrl); if (firstFile?.fileUrl) window.open(firstFile.fileUrl, "_blank", "noopener,noreferrer"); }}><Download className="size-3.5" />下载当前文件</Button>
                                </div>
                            </div>

                            {folderName ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--r-lg)] bg-surface-secondary p-3">
                                <Input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) void handleCreateFolder(); }} placeholder="输入文件夹名称" className="min-w-48 flex-1" aria-label="新文件夹名称" />
                                <Button loading={creatingFolder} onClick={() => void handleCreateFolder()}>创建</Button>
                                <Button variant="outline" onClick={() => setFolderName("")}>取消</Button>
                            </div> : null}

                            {loading ? <div className="library-loading-grid grid min-h-64 place-items-center"><div className="flex flex-col items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-6 animate-spin" aria-hidden="true" />读取 Eagle 文件…</div></div> : items.length ? (
                                <>
                                    <CollectionGrid className="library-grid assets-library-grid eagle-assets-grid">
                                        {visibleItems.map((item) => <EagleItemCard key={item.id} item={item} selected={previewItem?.id === item.id} onOpen={() => setPreviewItem(item)} />)}
                                    </CollectionGrid>
                                    <PaginationBar current={page} pageSize={pageSize} total={items.length} pageSizeOptions={[20, 40, 80]} onChange={(nextPage, nextPageSize) => { setPage(nextPageSize !== pageSize ? 1 : nextPage); setPageSize(nextPageSize); }} />
                                </>
                            ) : <div className="eagle-empty-state"><EmptyState size="compact" title="当前 Eagle 文件夹没有文件" /></div>}
                        </section>
                    </div>
                </div>

                <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={(event) => void handleUpload(event)} />
            </WorkspacePage>
            <EagleAssetDrawer item={previewItem} onClose={() => setPreviewItem(null)} totalBytes={totalBytes} />
        </>
    );
}

function EagleItemCard({ item, selected, onOpen }: { item: ExternalAssetItem; selected: boolean; onOpen: () => void }) {
    return <AssetLibraryCard selected={selected}>
        <AssetLibraryCardMedia className={item.kind === "image" || item.kind === "video" ? "assets-cover" : "assets-cover is-light"}>
            <button type="button" className="assets-cover-link" onClick={onOpen} aria-label={"查看 Eagle 素材：" + item.title}>
                {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} loading="lazy" decoding="async" className="assets-cover-media" /> : <div className="assets-cover-fallback"><AssetKindIcon kind={item.kind} size="size-7" /></div>}
                <span className="assets-cover-vignette" aria-hidden="true" />
            </button>
            <span className="assets-cover-badges">
                <span className="assets-cover-badge is-kind"><AssetKindIcon kind={item.kind} size="size-3" />{assetKindLabel(item.kind)}</span>
                <span className="assets-cover-badge is-category">Eagle</span>
            </span>
            {item.fileUrl ? <a href={item.fileUrl} download={item.title} target="_blank" rel="noreferrer" className="eagle-cover-download" aria-label={"下载原文件：" + item.title}><Download className="size-3.5" aria-hidden="true" /></a> : null}
        </AssetLibraryCardMedia>
        <button type="button" className="block w-full px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--workspace-accent)]" onClick={onOpen}>
            <div className="flex min-w-0 items-center justify-between gap-2">
                <h2 className="truncate text-[var(--fs-body)] font-semibold text-foreground" title={item.title}>{item.title}</h2>
                <span className="shrink-0 text-[var(--fs-tiny)] tabular-nums text-foreground/38">{formatBytes(item.bytes || 0)}</span>
            </div>
            <div className="mt-1 truncate text-[var(--fs-label)] text-foreground/52" title={item.folderPath?.join(" / ") || "Eagle 根目录"}>{item.folderPath?.join(" / ") || "Eagle 根目录"}</div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[var(--fs-tiny)] text-foreground/38">
                <span className="truncate">{formatDimensions(item)}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">Eagle 原文件</span>
            </div>
        </button>
    </AssetLibraryCard>;
}

function EagleAssetDrawer({ item, onClose, totalBytes }: { item: ExternalAssetItem | null; onClose: () => void; totalBytes: number }) {
    return <AppDrawer className={libraryDrawerClassName} title="素材档案" open={Boolean(item)} size="large" onClose={onClose}>
        {item ? <div className="space-y-4">
            <div className="asset-archive-header">
                <span className="asset-archive-header-icon"><AssetKindIcon kind={item.kind} size="size-5" /></span>
                <div className="min-w-0">
                    <h2 className="asset-archive-title">{item.title}</h2>
                    <p className="asset-archive-subtitle">Eagle 原文件 · {item.folderPath?.join(" / ") || "根目录"}</p>
                </div>
            </div>
            <div className="eagle-drawer-preview">
                {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} loading="lazy" decoding="async" /> : <AssetKindIcon kind={item.kind} size="size-9" />}
            </div>
            <div className="grid gap-2">
                <EagleFact label="类型" value={assetKindLabel(item.kind)} />
                <EagleFact label="尺寸" value={formatDimensions(item)} />
                <EagleFact label="文件大小" value={formatBytes(item.bytes || 0)} />
                <EagleFact label="所在文件夹" value={item.folderPath?.join(" / ") || "Eagle 根目录"} />
                <EagleFact label="素材库总大小" value={formatBytes(totalBytes)} />
            </div>
            {item.tags?.length ? <div><span className="text-xs font-semibold">标签</span><div className="mt-2 flex flex-wrap gap-1.5">{item.tags.map((tag) => <Badge key={tag} variant="outline" className="rounded-sm">{tag}</Badge>)}</div></div> : null}
            {item.description ? <div><span className="text-xs font-semibold">备注</span><p className="mt-2 text-sm leading-6 text-foreground/65">{item.description}</p></div> : null}
            {item.fileUrl ? <a href={item.fileUrl} download={item.title} target="_blank" rel="noreferrer" className="eagle-drawer-download inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium"><Download className="size-4" aria-hidden="true" />下载 Eagle 原文件</a> : null}
        </div> : null}
    </AppDrawer>;
}

function EagleFact({ label, value }: { label: string; value: string }) {
    return <div className="flex items-center justify-between gap-3 rounded-md bg-surface-secondary px-3 py-2 text-sm"><span className="text-foreground/48">{label}</span><span className="max-w-[65%] truncate text-right font-medium" title={value}>{value}</span></div>;
}

function AssetKindIcon({ kind, size = "size-5" }: { kind: Asset["kind"]; size?: string }) {
    if (kind === "image") return <FileImage className={size + " text-foreground/48"} aria-hidden="true" />;
    if (kind === "video") return <FileVideo className={size + " text-foreground/48"} aria-hidden="true" />;
    if (kind === "audio") return <FileAudio className={size + " text-foreground/48"} aria-hidden="true" />;
    return <FileBox className={size + " text-foreground/48"} aria-hidden="true" />;
}

function assetKindLabel(kind: Asset["kind"]) {
    if (kind === "image") return "图片";
    if (kind === "video") return "视频";
    if (kind === "audio") return "音频";
    if (kind === "model") return "模型";
    return "文件";
}

function formatBytes(bytes: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return String(bytes) + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDimensions(item: ExternalAssetItem) {
    if (item.width && item.height) return item.width + " × " + item.height;
    return item.mimeType || assetKindLabel(item.kind);
}

type EagleFolderNode = { key: string; name: string; children: EagleFolderNode[] };

function renderFolderNodes(folders: ExternalAssetFolder[], parentId = ""): EagleFolderNode[] {
    return folders.filter((folder) => (folder.parentId || "") === parentId).map((folder) => ({
        key: folder.id,
        name: folder.name,
        children: renderFolderNodes(folders, folder.id),
    }));
}

/** Folder tree: chevrons expand, titles select; clicking the selected folder returns to the root. */
function EagleFolderTree({ nodes, selectedFolder, onSelect }: { nodes: EagleFolderNode[]; selectedFolder: string; onSelect: (folderId: string) => void }) {
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
    const toggle = (key: string) => setExpanded((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
    const renderNodes = (items: EagleFolderNode[], depth: number) => items.map((node) => {
        const hasChildren = node.children.length > 0;
        const open = hasChildren && expanded.has(node.key);
        const selected = node.key === selectedFolder;
        return (
            <li key={node.key} role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={selected}>
                <div className="eagle-folder-tree-node" style={{ paddingLeft: depth * 12 }}>
                    {hasChildren ? (
                        <button type="button" className="eagle-folder-tree-switcher" aria-label={open ? `收起${node.name}` : `展开${node.name}`} onClick={() => toggle(node.key)}>
                            <ChevronRight aria-hidden="true" className={`size-3 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />
                        </button>
                    ) : <span className="eagle-folder-tree-switcher is-noop" aria-hidden="true" />}
                    <button type="button" className={`eagle-folder-tree-item${selected ? " is-selected" : ""}`} onClick={() => onSelect(selected ? "root" : node.key)}>
                        <span className="eagle-folder-tree-title" title={node.name}>{node.name}</span>
                    </button>
                </div>
                {open ? <ul role="group">{renderNodes(node.children, depth + 1)}</ul> : null}
            </li>
        );
    });
    return <ul role="tree" aria-label="Eagle 文件夹" className="eagle-folder-tree">{renderNodes(nodes, 0)}</ul>;
}

// Ports the shared library drawer shell (header/body spacing, title weight) onto AppDrawer.
const libraryDrawerClassName = "library-drawer border-0 bg-popover shadow-[var(--elevation-panel)] [&>[data-slot=app-drawer-body]]:px-7 [&>[data-slot=app-drawer-body]]:pt-[22px] [&>[data-slot=app-drawer-body]]:pb-[30px] [&>[data-slot=app-drawer-header]]:min-h-[70px] [&>[data-slot=app-drawer-header]]:border-foreground/[.08] [&>[data-slot=app-drawer-header]]:px-7 [&>[data-slot=app-drawer-header]]:pt-[22px] [&>[data-slot=app-drawer-header]]:pb-[15px] [&>[data-slot=app-drawer-header]>h2]:text-[length:var(--fs-heading-lg)] [&>[data-slot=app-drawer-header]>h2]:font-[620] max-[680px]:[&>[data-slot=app-drawer-body]]:p-[18px] max-[680px]:[&>[data-slot=app-drawer-header]]:px-[18px] max-[680px]:[&>[data-slot=app-drawer-header]]:pt-[18px] max-[680px]:[&>[data-slot=app-drawer-header]]:pb-[13px]";

function externalFolderPath(folders: ExternalAssetFolder[], folderId: string) {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const result: ExternalAssetFolder[] = [];
    const seen = new Set<string>();
    let current = byId.get(folderId);
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        result.unshift(current);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return result;
}
