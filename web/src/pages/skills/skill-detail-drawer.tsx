import { AppModal } from "@/components/ui/product/app-modal";
import { Tooltip } from "@/components/ui/base/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { SegmentedControl } from "@/components/ui/base/segmented-control";
import { Check, ChevronRight, Code2, ExternalLink, File, FileArchive, FileCode2, FileImage, FileText, Folder, FolderOpen, Heart, Pencil, Plus, RefreshCw, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { formatSkillCount, formatSkillDate, skillCategoryLabel } from "@/pages/skills/skill-catalog";
import { isLocalRuntimeMode } from "@/lib/runtime-mode";
import { getSkillFile, listSkillFiles, skillFileRawURL, type Skill, type SkillCategory, type SkillPackageFile, type SkillPackageFileContent } from "@/services/api/skills";

type PreviewMode = "preview" | "source";

export function SkillDetailModal({ skill, loading, mutating, categories, onClose, onAdd, onLike, onEdit, onSync }: { skill: Skill | null; loading: boolean; mutating: boolean; categories: SkillCategory[]; onClose: () => void; onAdd: (skill: Skill) => void; onLike: (skill: Skill) => void; onEdit: (skill: Skill) => void; onSync: (skill: Skill) => void }) {
    const [files, setFiles] = useState<SkillPackageFile[]>([]);
    const [filesLoading, setFilesLoading] = useState(false);
    const [filesError, setFilesError] = useState("");
    const [activePath, setActivePath] = useState("SKILL.md");
    const [content, setContent] = useState<SkillPackageFileContent | null>(null);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [previewMode, setPreviewMode] = useState<PreviewMode>("preview");
    const [pathFilter, setPathFilter] = useState("");
    const localRuntime = isLocalRuntimeMode();

    useEffect(() => {
        if (!skill) {
            setFiles([]);
            setContent(null);
            return;
        }
        let cancelled = false;
        setFilesLoading(true);
        setFilesError("");
        setPathFilter("");
        listSkillFiles(skill.skillId)
            .then((result) => {
                if (cancelled) return;
                setFiles(result.files);
                const first = result.files.find((file) => file.path === "SKILL.md")?.path || result.files[0]?.path || "";
                setActivePath(first);
            })
            .catch((error) => {
                if (cancelled) return;
                setFiles([]);
                setFilesError(error instanceof Error ? error.message : "技能文件加载失败");
            })
            .finally(() => {
                if (!cancelled) setFilesLoading(false);
            });
        return () => { cancelled = true; };
    }, [skill?.skillId, skill?.versionId]);

    useEffect(() => {
        if (!skill || !activePath) {
            setContent(null);
            return;
        }
        let cancelled = false;
        setContentLoading(true);
        setContentError("");
        getSkillFile(skill.skillId, activePath)
            .then((result) => { if (!cancelled) setContent(result.file); })
            .catch((error) => {
                if (cancelled) return;
                setContent(null);
                setContentError(error instanceof Error ? error.message : "文件读取失败");
            })
            .finally(() => { if (!cancelled) setContentLoading(false); });
        return () => { cancelled = true; };
    }, [activePath, skill?.skillId, skill?.versionId]);

    useEffect(() => {
        setPreviewMode("preview");
    }, [activePath]);

    const visibleFiles = useMemo(() => {
        const needle = pathFilter.trim().toLowerCase();
        return needle ? files.filter((file) => file.path.toLowerCase().includes(needle)) : files;
    }, [files, pathFilter]);
    const treeData = useMemo(() => buildSkillTree(visibleFiles), [visibleFiles]);
    const filePaths = useMemo(() => new Set(files.map((file) => file.path)), [files]);
    const selectedFile = files.find((file) => file.path === activePath);
    const canPreviewMarkdown = selectedFile?.kind === "markdown" && !content?.binary;

    return (
        <AppModal
            className="skill-package-modal rounded-[var(--r-xl)] border-foreground/[.11] bg-popover shadow-[var(--elevation-panel)] max-[860px]:!h-[90vh]"
            open={Boolean(skill)}
            width="82vw"
            footer={null}
            onCancel={onClose}
            flush styles={{ container: { height: "82vh" }, body: { height: "100%" } }}
        >
            {skill ? (
                <div className="skill-package-shell">
                    <header className="skill-package-header">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-[var(--fs-label)] text-foreground/45">
                                <span>{skillCategoryLabel(skill.tag, categories)}</span><span aria-hidden="true">/</span><span>{sourceLabel(skill.sourceType)}</span><span aria-hidden="true">/</span><span>v{skill.version || "1"}</span><span aria-hidden="true">/</span><span>更新于 {formatSkillDate(skill.updatedAt)}</span>
                            </div>
                            <h1 className="mt-1 truncate text-[var(--fs-heading-lg)] font-semibold text-foreground">{skill.skillName}</h1>
                            <p className="mt-1 line-clamp-2 max-w-4xl text-sm leading-5 text-foreground/58">{skill.description}</p>
                        </div>
                        <div className="skill-package-actions">
                            {!localRuntime && skill.sourceType === "github" && skill.isOwner ? <Tooltip title={skill.syncError || "从 GitHub 检查并同步最新提交"}><Button variant="outline" loading={mutating} onClick={() => onSync(skill)}>{mutating ? null : <RefreshCw className="size-4" />}<ActionLabel>同步</ActionLabel></Button></Tooltip> : null}
                            {skill.isOwner ? <Button variant="outline" onClick={() => onEdit(skill)}><Pencil className="size-4" /><ActionLabel>编辑</ActionLabel></Button> : null}
                            <Button variant="outline" loading={mutating} onClick={() => onLike(skill)}>{mutating ? null : <Heart className={`size-4 ${skill.isLike ? "fill-current text-rose-500" : ""}`} />}<ActionLabel>{skill.isLike ? "已收藏" : "收藏"}</ActionLabel></Button>
                            <Button variant={skill.isAdded ? "outline" : "default"} loading={mutating} disabled={skill.isOwner} onClick={() => onAdd(skill)}>{mutating ? null : skill.isAdded ? <Check className="size-4" /> : <Plus className="size-4" />}<ActionLabel>{skill.isOwner ? "我的技能" : skill.isAdded ? "已加入" : "加入技能"}</ActionLabel></Button>
                        </div>
                    </header>

                    <div className="skill-package-workspace">
                        <aside className="skill-package-sidebar" aria-label="技能文件">
                            <div className="skill-package-sidebar-summary">
                                <span><FileArchive className="size-3.5" />{skill.fileCount || files.length} 个文件</span>
                                <span>{formatBytes(skill.totalBytes)}</span>
                            </div>
                            <div className="relative">
                                <File aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-foreground/30" />
                                <Input className="h-7 pr-7 pl-7 text-sm" aria-label="筛选文件" value={pathFilter} onChange={(event) => setPathFilter(event.target.value)} placeholder="筛选文件…" />
                                {pathFilter ? (
                                    <button type="button" aria-label="清空筛选" className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground" onClick={() => setPathFilter("")}>
                                        <X className="size-3" />
                                    </button>
                                ) : null}
                            </div>
                            <div className="skill-package-tree thin-scrollbar">
                                {filesLoading || loading ? <SkeletonLines rows={10} /> : filesError ? <div className="skill-package-empty">{filesError}</div> : treeData.length ? (
                                    <SkillFileTree nodes={treeData} activePath={activePath} onSelect={setActivePath} />
                                ) : <div className="skill-package-empty">没有匹配文件</div>}
                            </div>
                            <div className="skill-package-sidebar-footer">
                                <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{formatSkillCount(skill.addedCount)} 人加入</span>
                                <span>{skill.isPrivate ? "仅自己可见" : "公开"}</span>
                            </div>
                        </aside>

                        <main className="skill-package-preview">
                            <div className="skill-package-preview-toolbar">
                                <div className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/58">{activePath || "请选择文件"}</div>
{canPreviewMarkdown ? <SegmentedControl size="sm" value={previewMode} onChange={(value) => setPreviewMode(value as PreviewMode)} options={[{ value: "preview", label: <span className="inline-flex items-center gap-1"><FileText className="size-3.5" />预览</span> }, { value: "source", label: <span className="inline-flex items-center gap-1"><Code2 className="size-3.5" />源码</span> }]} /> : null}
                                {activePath ? <Tooltip title="打开原始文件"><a className="skill-package-raw-link" href={skillFileRawURL(skill.skillId, activePath)} target="_blank" rel="noreferrer" aria-label="打开原始文件"><ExternalLink className="size-4" /></a></Tooltip> : null}
                            </div>
                            <div className="skill-package-preview-body thin-scrollbar">
                                {contentLoading ? <SkeletonLines rows={18} title /> : contentError ? <div className="skill-package-empty">{contentError}</div> : content && selectedFile ? (
                                    <SkillFilePreview skill={skill} file={selectedFile} content={content} mode={previewMode} filePaths={filePaths} onNavigate={setActivePath} />
                                ) : <div className="skill-package-empty">从左侧选择一个文件</div>}
                            </div>
                        </main>
                    </div>
                </div>
            ) : null}
        </AppModal>
    );
}

function SkillFilePreview({ skill, file, content, mode, filePaths, onNavigate }: { skill: Skill; file: SkillPackageFile; content: SkillPackageFileContent; mode: PreviewMode; filePaths: Set<string>; onNavigate: (path: string) => void }) {
    const rawURL = skillFileRawURL(skill.skillId, file.path);
    if (content.binary) {
        if (file.kind === "image") return <div className="skill-package-media-stage"><img src={rawURL} alt={file.path} /></div>;
        if (file.kind === "video") return <div className="skill-package-media-stage"><video src={rawURL} controls playsInline preload="metadata" /></div>;
        if (file.kind === "audio") return <div className="skill-package-media-stage"><audio src={rawURL} controls preload="metadata" /></div>;
        return <div className="skill-package-empty"><FileArchive className="mb-3 size-9" /><div>该文件不支持在线预览</div><a className="mt-3 inline-flex items-center gap-1 text-foreground underline" href={rawURL} target="_blank" rel="noreferrer">打开原始文件<ExternalLink className="size-3.5" /></a></div>;
    }
    if (file.kind === "markdown" && mode === "preview") {
        return <SkillMarkdown source={content.content} currentPath={file.path} filePaths={filePaths} onNavigate={onNavigate} />;
    }
    return <pre className="skill-package-source"><code>{content.content}</code></pre>;
}

function SkillMarkdown({ source, currentPath, filePaths, onNavigate }: { source: string; currentPath: string; filePaths: Set<string>; onNavigate: (path: string) => void }) {
    const navigate = (event: MouseEvent<HTMLAnchorElement>, href?: string) => {
        const target = resolveSkillPath(currentPath, href || "");
        if (!target || !filePaths.has(target)) return;
        event.preventDefault();
        onNavigate(target);
    };
    return (
        <article className="skill-package-markdown">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ children, href }) => <a href={href} target={isExternalURL(href) ? "_blank" : undefined} rel={isExternalURL(href) ? "noreferrer" : undefined} onClick={(event) => navigate(event, href)}>{children}</a>,
                    table: ({ children }) => <div className="skill-package-table-wrap"><table>{children}</table></div>,
                    img: ({ src, alt }) => {
                        if (isExternalURL(src)) return <img src={src} alt={alt || ""} loading="lazy" />;
                        const target = resolveSkillPath(currentPath, src || "");
                        if (target && filePaths.has(target)) return <button type="button" className="skill-package-inline-file" onClick={() => onNavigate(target)}><FileImage className="size-4" />{alt || target}</button>;
                        return <span className="skill-package-inline-missing">{alt || src || "图片"}</span>;
                    },
                }}
            >{source}</ReactMarkdown>
        </article>
    );
}

type SkillTreeNode = { key: string; name: string; file?: SkillPackageFile; children?: SkillTreeNode[] };

function buildSkillTree(files: SkillPackageFile[]): SkillTreeNode[] {
    const roots: SkillTreeNode[] = [];
    const folders = new Map<string, SkillTreeNode>();
    for (const file of files) {
        const parts = file.path.split("/");
        let children = roots;
        let prefix = "";
        parts.forEach((part, index) => {
            const isLeaf = index === parts.length - 1;
            prefix = prefix ? `${prefix}/${part}` : part;
            if (isLeaf) {
                children.push({ key: file.path, name: part, file });
                return;
            }
            let folder = folders.get(prefix);
            if (!folder) {
                folder = { key: `folder:${prefix}`, name: part, children: [] };
                folders.set(prefix, folder);
                children.push(folder);
            }
            children = folder.children || [];
        });
    }
    return roots;
}

/** File tree: folders start expanded and toggle on click; leaves select the previewed file. */
function SkillFileTree({ nodes, activePath, onSelect }: { nodes: SkillTreeNode[]; activePath: string; onSelect: (path: string) => void }) {
    const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
    const toggle = (key: string) => setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
    const renderNodes = (items: SkillTreeNode[], depth: number): ReactNode => items.map((node) => {
        const isFolder = Boolean(node.children);
        const expanded = isFolder && !collapsed.has(node.key);
        const selected = !isFolder && node.key === activePath;
        return (
            <li key={node.key} role="treeitem" aria-expanded={isFolder ? expanded : undefined} aria-selected={isFolder ? undefined : selected}>
                <button
                    type="button"
                    className={`flex min-h-[30px] w-full min-w-0 items-center rounded-[var(--r-sm)] pr-[7px] text-left hover:bg-foreground/[.06] focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-[var(--ring)] ${selected ? "!bg-foreground/[.09] text-foreground" : ""}`}
                    style={{ paddingLeft: depth * 14 }}
                    onClick={() => (isFolder ? toggle(node.key) : onSelect(node.key))}
                >
                    <span className="grid h-[30px] w-5 shrink-0 place-items-center text-foreground/38 hover:text-foreground/72" aria-hidden="true">
                        {isFolder ? <ChevronRight className={`skill-package-tree-chevron size-3.5 ${expanded ? "is-expanded" : ""}`} /> : null}
                    </span>
                    <span className="grid h-[30px] w-5 shrink-0 place-items-center text-foreground/55">
                        {isFolder ? (expanded ? <FolderOpen aria-hidden="true" className="size-4" /> : <Folder aria-hidden="true" className="size-4" />) : node.file ? fileIcon(node.file) : null}
                    </span>
                    <span className="block min-w-0 flex-1 pl-0.5">
                        {isFolder ? <span className="skill-package-folder-title">{node.name}</span> : node.file ? treeTitle(node.name, node.file) : node.name}
                    </span>
                </button>
                {isFolder && expanded && node.children?.length ? <ul role="group">{renderNodes(node.children, depth + 1)}</ul> : null}
            </li>
        );
    });
    return <ul role="tree" aria-label="技能文件" className="text-[length:var(--fs-label)] text-foreground/70">{renderNodes(nodes, 0)}</ul>;
}

/** Button label that collapses to icon-only on narrow screens. */
function ActionLabel({ children }: { children: ReactNode }) {
    return <span className="max-[640px]:sr-only">{children}</span>;
}

function SkeletonLines({ rows, title = false }: { rows: number; title?: boolean }) {
    return (
        <div className="space-y-3" aria-busy="true">
            {title ? <Skeleton className="h-5 w-2/5" /> : null}
            {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className={index === rows - 1 ? "h-4 w-3/5" : "h-4 w-full"} />)}
        </div>
    );
}

function treeTitle(name: string, file: SkillPackageFile): ReactNode {
    return <span className="skill-package-tree-title"><span>{name}</span><span>{formatBytes(file.size)}</span></span>;
}

function fileIcon(file: SkillPackageFile) {
    if (file.kind === "markdown" || file.kind === "text") return <FileText aria-hidden="true" className="size-3.5" />;
    if (file.kind === "code") return <FileCode2 aria-hidden="true" className="size-3.5" />;
    if (file.kind === "image") return <FileImage aria-hidden="true" className="size-3.5" />;
    return <File aria-hidden="true" className="size-3.5" />;
}

function resolveSkillPath(currentPath: string, href: string) {
    const cleanHref = href.split("#", 1)[0]?.split("?", 1)[0] || "";
    if (!cleanHref || isExternalURL(cleanHref) || cleanHref.startsWith("/")) return "";
    const base = currentPath.split("/").slice(0, -1);
    let decoded = cleanHref;
    try {
        decoded = decodeURIComponent(cleanHref);
    } catch {
        return "";
    }
    for (const segment of decoded.replaceAll("\\", "/").split("/")) {
        if (!segment || segment === ".") continue;
        if (segment === "..") base.pop();
        else base.push(segment);
    }
    return base.join("/");
}

function isExternalURL(value?: string) {
    return Boolean(value && /^(https?:|mailto:|data:)/i.test(value));
}

function sourceLabel(source: string) {
    if (source === "github") return "GitHub";
    if (source === "zip") return "ZIP 技能包";
    if (source === "builtin") return "内置技能";
    return "Markdown";
}

function formatBytes(value: number) {
    if (!value) return "0 B";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
