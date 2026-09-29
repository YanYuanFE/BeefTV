import { zodResolver } from "@hookform/resolvers/zod";
import { Select } from "@/components/ui/base/select";
import { Switch } from "@/components/ui/base/switch";
import { SegmentedControl } from "@/components/ui/base/segmented-control";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AppModal } from "@/components/ui/product/app-modal";
import { FileArchive, FileText, GitBranch, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { fallbackSkillCategories } from "@/pages/skills/skill-catalog";
import { isLocalRuntimeMode } from "@/lib/runtime-mode";
import { installGitHubSkill, installSkillUpload, type Skill } from "@/services/api/skills";
import { toast } from "sonner";

type InstallMode = "markdown" | "zip" | "github";

const MAX_SKILL_FILE_BYTES = 20 * 1024 * 1024;

// URL check matching the former form rule (http/https/ftp or protocol-relative).
const URL_PATTERN = /^(?:(?:https?|ftp):)?\/\/[^\s/$.?#].[^\s]*$/i;

function installSchema(mode: InstallMode) {
    return z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        tag: z.string().min(1, "请选择技能分类"),
        is_public: z.boolean(),
        url: mode === "github"
            ? z.string().min(1, "请填写 GitHub 仓库地址").regex(URL_PATTERN, "请输入有效链接")
            : z.string().optional(),
        ref: z.string().optional(),
        subdir: z.string().optional(),
        autoUpdate: z.boolean(),
    });
}

type InstallFormValues = z.infer<ReturnType<typeof installSchema>>;

const defaultInstallValues: InstallFormValues = { tag: "creative", is_public: true, autoUpdate: true, name: "", description: "", url: "", ref: "", subdir: "" };

const modeOptions = [
    { value: "markdown", label: <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" />Markdown</span> },
    { value: "zip", label: <span className="inline-flex items-center gap-1.5"><FileArchive className="size-3.5" />ZIP 技能包</span> },
    { value: "github", label: <span className="inline-flex items-center gap-1.5"><GitBranch className="size-3.5" />GitHub</span> },
];

export function SkillInstallModal({ open, onClose, onInstalled, onManualCreate }: { open: boolean; onClose: () => void; onInstalled: (skill: Skill) => void; onManualCreate: () => void }) {
    const [mode, setMode] = useState<InstallMode>("markdown");
    const schema = useMemo(() => installSchema(mode), [mode]);
    const form = useForm<InstallFormValues>({ resolver: zodResolver(schema), mode: "onChange", defaultValues: defaultInstallValues });
    const [file, setFile] = useState<File | null>(null);
    const [installing, setInstalling] = useState(false);
    const localRuntime = isLocalRuntimeMode();
    const availableModeOptions = localRuntime ? modeOptions.filter((option) => option.value !== "github") : modeOptions;

    useEffect(() => {
        if (!open) return;
        setMode("markdown");
        setFile(null);
        form.reset(defaultInstallValues);
    }, [form, open]);

    const install = async (values: InstallFormValues) => {
        if (mode !== "github" && !file) {
            toast.warning(`请选择一个 ${mode === "zip" ? "ZIP 技能包" : "Markdown 文件"}`);
            return;
        }
        setInstalling(true);
        try {
            const result = mode === "github"
                ? await installGitHubSkill({
                    url: values.url || "",
                    ref: values.ref || undefined,
                    subdir: values.subdir || undefined,
                    tag: values.tag,
                    isPrivate: !values.is_public,
                    autoUpdate: values.autoUpdate,
                })
                : await installSkillUpload({
                    file: file as File,
                    sourceType: mode,
                    name: values.name || undefined,
                    description: values.description || undefined,
                    tag: values.tag,
                    isPrivate: !values.is_public,
                });
            toast.success("技能已安装");
            onInstalled(result.skill);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "技能安装失败");
        } finally {
            setInstalling(false);
        }
    };

    return (
        <AppModal
            className="skill-install-modal border-foreground/10 bg-popover"
            open={open}
            width={680}
            maskClosable={!installing}
            title={<span className="text-[length:var(--fs-heading-lg)] font-[620]">安装技能</span>}
            onCancel={onClose}
            footer={(
                <div className="flex w-full items-center justify-between gap-3">
                    <Button variant="ghost" onClick={onManualCreate}>从空白创建单文件技能</Button>
                    <div className="flex gap-2"><Button variant="outline" onClick={onClose}>取消</Button><Button loading={installing} onClick={() => void form.handleSubmit(install)()}>安装技能</Button></div>
                </div>
            )}
        >
            <p className="mb-4 text-sm leading-6 text-foreground/55">支持标准 <code>SKILL.md</code> 或包含多层目录的 ZIP 技能包。名称和简介会优先从技能入口自动读取。</p>
            <SegmentedControl className="skill-install-mode" block ariaLabel="安装方式" options={availableModeOptions} value={mode} onChange={(value) => { setMode(value as InstallMode); setFile(null); }} />

            <Form {...form}>
                <form className="skill-install-form grid gap-4" noValidate onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(install)(); }}>
                    {mode === "github" ? (
                        <>
                            <FormField
                                control={form.control}
                                name="url"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>GitHub 地址</FormLabel>
                                        <div className="relative">
                                            <GitBranch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground/35" />
                                            <FormControl>
                                                <Input {...field} value={field.value ?? ""} className="pl-8" type="url" inputMode="url" spellCheck={false} placeholder="https://github.com/owner/repository" />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
                                <TextField form={form} name="ref" label="分支或标签" extra="留空时使用默认分支" placeholder="main" spellCheck={false} />
                                <TextField form={form} name="subdir" label="技能子目录" extra="仓库仅含一个技能时可留空" placeholder="skills/ai-director" spellCheck={false} />
                            </div>
                        </>
                    ) : (
                        <>
                            <SkillFileDropzone
                                mode={mode}
                                file={file}
                                onChange={setFile}
                            />
                            <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
                                <TextField form={form} name="name" label="覆盖名称" extra="可选，留空时自动读取" maxLength={80} autoComplete="off" />
                                <TextField form={form} name="description" label="覆盖简介" extra="可选，留空时自动读取" maxLength={500} autoComplete="off" />
                            </div>
                        </>
                    )}

                    <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="tag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>技能分类</FormLabel>
                                    <Select id={`${field.name}-select`} ariaLabel="技能分类" value={field.value} options={fallbackSkillCategories} onChange={field.onChange} />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="is_public"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>公开状态<OptionalMark /></FormLabel>
                                    <FormControl>
                                        <Switch className="justify-self-start" checked={field.value} checkedChildren="公开" unCheckedChildren="私有" onChange={field.onChange} />
                                    </FormControl>
                                    <FormDescription>公开后其他用户可以加入使用。</FormDescription>
                                </FormItem>
                            )}
                        />
                    </div>
                    {mode === "github" ? (
                        <FormField
                            control={form.control}
                            name="autoUpdate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>自动同步<OptionalMark /></FormLabel>
                                    <FormControl>
                                        <Switch className="justify-self-start" checked={field.value} checkedChildren="开启" unCheckedChildren="关闭" onChange={field.onChange} />
                                    </FormControl>
                                    <FormDescription>后台每 6 小时检查一次提交版本，并记录最近检查与同步时间。</FormDescription>
                                </FormItem>
                            )}
                        />
                    ) : null}
                </form>
            </Form>
        </AppModal>
    );
}

type TextFieldName = "name" | "description" | "ref" | "subdir";

/** Optional single-line text field with help text. */
function TextField({ form, name, label, extra, placeholder, maxLength, autoComplete, spellCheck }: { form: UseFormReturn<InstallFormValues>; name: TextFieldName; label: ReactNode; extra: ReactNode; placeholder?: string; maxLength?: number; autoComplete?: string; spellCheck?: boolean }) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className="content-start">
                    <FormLabel>{label}<OptionalMark /></FormLabel>
                    <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder={placeholder} maxLength={maxLength} autoComplete={autoComplete} spellCheck={spellCheck} />
                    </FormControl>
                    <FormDescription>{extra}</FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function OptionalMark() {
    return <span className="ml-1 font-normal text-muted-foreground">（可选）</span>;
}

/** Single-file drag-and-drop picker; rejects files over 20MB. */
function SkillFileDropzone({ mode, file, onChange }: { mode: "markdown" | "zip"; file: File | null; onChange: (file: File | null) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const accept = mode === "zip" ? ".zip,application/zip" : ".md,.markdown,text/markdown";

    const pick = (next: File | undefined) => {
        if (!next) return;
        if (next.size > MAX_SKILL_FILE_BYTES) {
            toast.error("技能文件不能超过 20MB");
            return;
        }
        onChange(next);
    };

    const drop = (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setDragging(false);
        pick(event.dataTransfer.files[0]);
    };

    return (
        <div>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(event) => {
                    pick(event.target.files?.[0]);
                    event.target.value = "";
                }}
            />
            <button
                type="button"
                className={`block w-full rounded-[var(--r-lg)] border border-dashed bg-foreground/[.025] px-4 py-6 text-center transition-colors hover:border-foreground/28 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${dragging ? "border-foreground/28" : "border-foreground/14"}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={drop}
            >
                <UploadCloud className="mx-auto mb-3 size-8 text-foreground/38" />
                <div className="text-sm font-medium">拖入或选择 {mode === "zip" ? "ZIP 技能包" : "Markdown 文件"}</div>
                <div className="mt-1 text-xs text-foreground/45">{mode === "zip" ? "根目录或唯一子目录中必须包含 SKILL.md" : "普通 .md 会作为技能入口 SKILL.md 安装"}</div>
            </button>
            {file ? (
                <div className="mt-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-hover">
                    <Paperclip aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <Button variant="ghost" size="icon-xs" aria-label="移除文件" onClick={() => onChange(null)}>
                        <Trash2 />
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
