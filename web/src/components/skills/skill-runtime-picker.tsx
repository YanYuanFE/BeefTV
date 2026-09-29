import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";

import { Checkbox } from "@/components/ui/base/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { listAddedSkills, type Skill } from "@/services/api/skills";
import { SKILL_RUNTIME_PROFILES, type SkillRuntimeProfile } from "@/services/skill-runtime";

export function useSkillRuntimeCatalog() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        listAddedSkills()
            .then((result) => {
                if (!cancelled) setSkills(result.skills.filter((skill) => skill.isAdded));
            })
            .catch(() => {
                if (!cancelled) setSkills([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return { skills, loading };
}

export function SkillRuntimePicker({ skills, loading, value, onChange, placeholder = "选择本次生成使用的技能", profile = "canvas" }: { skills: Skill[]; loading?: boolean; value: string[]; onChange: (skillIds: string[]) => void; placeholder?: string; profile?: SkillRuntimeProfile }) {
    const options = useMemo(
        () => skills.map((skill) => ({ value: skill.skillId, label: skill.skillName, title: skill.description })),
        [skills],
    );
    const maxSkills = SKILL_RUNTIME_PROFILES[profile].maxSkills;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const labelById = useMemo(() => new Map(options.map((option) => [option.value, option.label])), [options]);
    const normalizedQuery = query.trim().toLowerCase();
    const visible = options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
    const full = Boolean(maxSkills) && value.length >= maxSkills;
    const toggle = (skillId: string, checked: boolean) => onChange(checked ? [...value, skillId] : value.filter((item) => item !== skillId));

    return (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
            <div className="relative w-full" style={{ width: "100%" }}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-label="本次生成使用的技能"
                        aria-haspopup="listbox"
                        className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent py-1 pr-12 pl-1.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                        {value.length ? (
                            value.map((skillId) => (
                                <span key={skillId} className="inline-flex max-w-full items-center rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground">
                                    <span className="truncate">{labelById.get(skillId) ?? skillId}</span>
                                </span>
                            ))
                        ) : (
                            <span className="px-1 text-muted-foreground">{placeholder}</span>
                        )}
                    </button>
                </PopoverTrigger>
                <span className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1 text-muted-foreground">
                    {value.length ? (
                        <button type="button" aria-label="清空技能" className="pointer-events-auto rounded p-0.5 hover:bg-surface-hover hover:text-foreground" onClick={() => onChange([])}>
                            <X className="size-3.5" />
                        </button>
                    ) : null}
                    {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
                </span>
            </div>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 gap-2 p-2">
                <div className="relative flex items-center">
                    <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
                    <Input autoFocus aria-label="搜索技能" className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
                <div className="max-h-64 overflow-y-auto" role="group" aria-label="技能">
                    {visible.length ? (
                        visible.map((option) => {
                            const checked = value.includes(option.value);
                            return (
                                <Checkbox key={option.value} className="w-full rounded-md px-2 py-1.5 hover:bg-surface-hover" title={option.title} checked={checked} disabled={!checked && full} onChange={(event) => toggle(option.value, event.target.checked)}>
                                    {option.label}
                                </Checkbox>
                            );
                        })
                    ) : (
                        <div className="px-2 py-3 text-center text-xs text-muted-foreground">{loading ? "正在读取技能库" : "暂无已加入的技能"}</div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
