import { CheckCircle2, CloudCheck, CloudOff, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";
import { readAllCanvasSyncDrafts, readCanvasSyncDrafts, type CanvasSyncDraft } from "@/services/canvas-sync-drafts";
import { getActiveUserScope } from "@/lib/user-scope";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useSyncProgressStore } from "@/stores/use-sync-progress-store";
import { workspaceCapabilities } from "@/services/workspace-mode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MenuDropdown } from "@/components/ui/menu-dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CanvasSyncStatus({ projectId, onLoadLatest, onOpenVersions }: { projectId: string; onLoadLatest: () => Promise<void>; onOpenVersions?: () => void }) {
    const progress = useSyncProgressStore((state) => state.syncingProjects[projectId]);
    const localOnly = workspaceCapabilities().local;
    const [busy, setBusy] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const phase = progress?.phase;
    const conflict = phase === "conflict";
    const failed = phase === "error" || conflict || !phase;
    const saving = phase === "pending" || phase === "saving" || phase === "uploading";
    const label = localOnly ? "已保存在本地" : conflict ? "版本冲突 · 未同步" : !phase ? "尚未同步" : failed ? "云端未保存" : saving ? "正在保存" : "已保存";
    const run = async (operation: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await operation();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "操作失败，请重试");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={!localOnly && failed ? "text-destructive hover:text-destructive" : undefined}
                        aria-label={`画布保存状态：${label}`}
                    >
                        {localOnly ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : saving ? <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" /> : failed ? <CloudOff className="size-3.5" /> : <CloudCheck className="size-3.5" />}
                        <span className="canvas-sync-status-label text-xs">{label}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center" className="w-auto p-3">
                    <div className="max-w-80 space-y-3" data-canvas-no-zoom>
                        <p role="status" className="text-sm">
                            {localOnly ? "画布已保存在本机。" : progress?.message || (phase === "done" ? "画布已同步到云端" : "尚未确认云端保存，请保留本地内容")}
                        </p>
                        {!localOnly && conflict ? <p className="text-xs text-muted-foreground">此画布的自动提交已暂停。加载最新版前会保留本地草稿，可下载后从画布列表导入为副本。</p> : null}
                        <div className="flex flex-wrap gap-2">
                            {!localOnly ? <Button variant="outline" size="sm" loading={busy} onClick={() => void run(onLoadLatest)}>加载云端最新版本</Button> : null}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                    void run(async () => {
                                        const project = useCanvasStore.getState().openProject(projectId);
                                        if (project) {
                                            const result = await exportCanvasProjects([project], `${project.title}-本地草稿`);
                                            if (result === "cancelled") return;
                                        }
                                    })
                                }
                            >
                                下载当前内容
                            </Button>
                            {onOpenVersions ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setStatusOpen(false);
                                        onOpenVersions();
                                    }}
                                >
                                    版本记录{progress?.draftCount ? ` · ${progress.draftCount} 份草稿` : ""}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </>
    );
}

export function CanvasSyncDraftMenu({ projectId }: { projectId?: string }) {
    const [drafts, setDrafts] = useState<CanvasSyncDraft[]>([]);
    const [draftScope, setDraftScope] = useState("");
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    return (
        <MenuDropdown
            onOpenChange={(open) => {
                if (!open) return;
                const scope = getActiveUserScope();
                setDraftScope(scope);
                setDrafts([]);
                setLoading(true);
                void (projectId ? readCanvasSyncDrafts(projectId, scope) : readAllCanvasSyncDrafts(scope))
                    .then((items) => {
                        if (getActiveUserScope() === scope) setDrafts(items.reverse());
                    })
                    .catch(() => toast.error("读取本地草稿失败"))
                    .finally(() => setLoading(false));
            }}
            items={
                drafts.length
                    ? drafts.map((draft) => ({
                          key: draft.id,
                          label: `${draft.project.title} · ${new Date(draft.savedAt).toLocaleString()}`,
                          onClick: () => {
                              if (getActiveUserScope() !== draftScope) {
                                  setDrafts([]);
                                  toast.error("账号已切换，请重新打开本地草稿");
                                  return;
                              }
                              setExporting(true);
                              void exportCanvasProjects([draft.project], `${draft.project.title}-本地草稿`, { includeLocalDrawings: false })
                                  .then((result) => {
                                      if (result === "saved") toast.success("草稿已下载，可从画布列表导入为新画布");
                                  })
                                  .catch(() => toast.error("草稿下载失败，请重试"))
                                  .finally(() => setExporting(false));
                          },
                      }))
                    : [{ key: "empty", label: loading ? "正在读取草稿…" : "暂无本地草稿", disabled: true }]
            }
        >
            <Button variant="outline" size={projectId ? "sm" : "default"} loading={exporting}>
                本地草稿
            </Button>
        </MenuDropdown>
    );
}
