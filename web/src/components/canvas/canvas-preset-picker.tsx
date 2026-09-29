import { useMemo, useState } from "react";
import { LayoutTemplate, Search, WandSparkles, X } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { canvasThemes } from "@/lib/canvas-theme";
import { CANVAS_BUILTIN_PRESETS, type CanvasPromptPreset } from "@/lib/prompts";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import type { CanvasGenerationMode } from "@/types/canvas";
import type { CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";

export type { CanvasPromptPreset };

export function CanvasPresetPicker({
    mode,
    skillReferences = [],
    open,
    onOpenChange,
    onSelect,
    compact = false,
    dense = false,
    appearance = "default",
}: {
    mode: CanvasGenerationMode;
    skillReferences?: CanvasResourceReference[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSelect: (preset: CanvasPromptPreset) => void;
    compact?: boolean;
    dense?: boolean;
    appearance?: "default" | "quiet";
}) {
    const theme = canvasThemes[useActiveTheme()];
    const [internalOpen, setInternalOpen] = useState(false);
    const [query, setQuery] = useState("");
    const actualOpen = open ?? internalOpen;
    const setOpen = (next: boolean) => {
        if (!next) setQuery("");
        setInternalOpen(next);
        onOpenChange?.(next);
    };
    const presets = useMemo(() => {
        const skills = skillReferences.flatMap((reference): CanvasPromptPreset[] => {
            if (!reference.skill) return [];
            return [
                {
                    id: `skill:${reference.skill.skillId}`,
                    name: reference.skill.skillName,
                    description: reference.skill.description || reference.skill.instruction || "已加入技能",
                    prompt: `@${reference.skill.skillName} `,
                    modes: ["text", "image", "video", "audio"],
                    source: "skill",
                },
            ];
        });
        const normalized = query.trim().toLowerCase();
        return [...CANVAS_BUILTIN_PRESETS.filter((preset) => preset.modes.includes(mode)), ...skills].filter((preset) => !normalized || `${preset.name} ${preset.description}`.toLowerCase().includes(normalized));
    }, [mode, query, skillReferences]);

    const content = (
        <div data-canvas-no-zoom className="canvas-preset-picker-menu w-[var(--panel-width-compact)] max-w-[calc(100vw-24px)]" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <div className="canvas-preset-picker-search flex h-8 items-center gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--workspace-accent)_7%,transparent)] px-[9px] text-[color-mix(in_srgb,var(--foreground)_66%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--workspace-accent)_11%,transparent)]">
                <Search className="size-3.5 shrink-0" />
                <input
                    className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    autoFocus
                    placeholder="搜索预设或已加入技能"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                    <button type="button" aria-label="清空搜索" className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground" onClick={() => setQuery("")}>
                        <X className="size-3" />
                    </button>
                ) : null}
            </div>
            <div className="thin-scrollbar mt-1 max-h-72 space-y-0.5 overflow-y-auto">
                {presets.length ? (
                    presets.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            className="canvas-preset-picker-option"
                            onClick={() => {
                                onSelect(preset);
                                setOpen(false);
                            }}
                        >
                            <span className="canvas-preset-picker-option-icon" style={{ background: theme.accent.primarySoft, color: theme.accent.primary }}>
                                <WandSparkles className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.node.text }}>
                                    <span className="truncate">{preset.name}</span>
                                    <span className="shrink-0 text-[var(--fs-micro)] font-medium" style={{ color: theme.accent.primary }}>
                                        {preset.source === "skill" ? "技能" : "预设"}
                                    </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[var(--fs-tiny)] leading-4" style={{ color: theme.node.muted }}>
                                    {preset.description}
                                </span>
                            </span>
                        </button>
                    ))
                ) : (
                    <div className="py-8 text-center text-xs" style={{ color: theme.node.muted }}>
                        没有匹配的预设
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Popover open={actualOpen} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={`canvas-preset-picker-trigger ${appearance === "quiet" ? "canvas-node-composer-header-action" : ""} inline-flex shrink-0 items-center justify-center gap-1 rounded-lg transition focus-visible:outline-none ${compact ? "size-6" : dense ? "h-6 px-1.5" : "h-7 px-2"}`}
                    style={appearance === "quiet" ? undefined : { background: theme.accent.primarySoft, color: theme.accent.primary }}
                    title={appearance === "quiet" ? "预设" : "打开提示词预设"}
                    aria-label={appearance === "quiet" ? "预设" : "打开提示词预设"}
                    aria-expanded={actualOpen}
                >
                    {appearance === "quiet" ? <LayoutTemplate className="size-3" /> : <WandSparkles className={dense ? "size-3" : "size-3.5"} />}
                    {compact ? null : <span className="text-[var(--fs-tiny)] font-medium">预设</span>}
                </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="canvas-preset-picker-popover canvas-composer-popover-surface canvas-composer-popover-content w-auto gap-0 p-0">
                {content}
            </PopoverContent>
        </Popover>
    );
}
