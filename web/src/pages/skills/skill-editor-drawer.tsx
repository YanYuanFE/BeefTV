import { zodResolver } from "@hookform/resolvers/zod";
import { AppDrawer } from "@/components/ui/product/app-drawer";
import { Select } from "@/components/ui/base/select";
import { Switch } from "@/components/ui/base/switch";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, Save, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { fallbackSkillCategories } from "@/pages/skills/skill-catalog";
import { generateSkillDraft } from "@/lib/canvas/skill-drafting";
import { navigateToSettings } from "@/lib/settings-navigation";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { createSkill, updateSkill, type Skill, type SkillMutationInput, type SkillShowcaseMedia } from "@/services/api/skills";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";

// URL check matching the former form rule (http/https/ftp or protocol-relative).
const URL_PATTERN = /^(?:(?:https?|ftp):)?\/\/[^\s/$.?#].[^\s]*$/i;

function skillSchema(requireInstruction: boolean) {
    return z.object({
        skillName: z.string().min(1, "请填写技能名称").max(80, "最多 80 个字符"),
        description: z.string().min(1, "请填写技能简介").max(500, "最多 500 个字符"),
        instruction: requireInstruction ? z.string().min(1, "请填写技能指令").max(100000, "最多 100000 个字符") : z.string().optional(),
        tag: z.string().min(1, "请选择技能分类"),
        is_public: z.boolean(),
        markdownUrl: z.string().refine((value) => !value || URL_PATTERN.test(value), "请输入有效的 HTTP(S) 链接"),
        showcaseMedia: z.array(z.object({
            type: z.enum(["image", "video"], { error: "选择类型" }),
            showcaseUrl: z.string().min(1, "请填写媒体链接").regex(URL_PATTERN, "链接格式无效"),
            showcaseUri: z.string(),
        })),
        extraInfo: z.string().max(2000, "最多 2000 个字符"),
    });
}

type SkillFormValues = z.infer<ReturnType<typeof skillSchema>>;

const labelClass = "text-[length:var(--fs-caption)] font-[560] text-foreground/68";

export function SkillEditorDrawer({ open, skill, onClose, onSaved }: { open: boolean; skill: Skill | null; onClose: () => void; onSaved: (skill: Skill) => void }) {
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [draftIdea, setDraftIdea] = useState("");
    const [drafting, setDrafting] = useState(false);
    const effectiveConfig = useEffectiveConfig();
    const isPackageSkill = Boolean(skill && skill.sourceType !== "markdown" && skill.sourceType !== "builtin" && skill.sourceType !== "");
    const schema = useMemo(() => skillSchema(!isPackageSkill), [isPackageSkill]);
    const form = useForm<SkillFormValues>({ resolver: zodResolver(schema), mode: "onChange", defaultValues: skillFormValues(skill) });
    const media = useFieldArray({ control: form.control, name: "showcaseMedia" });

    useEffect(() => {
        if (!open) return;
        form.reset(skillFormValues(skill));
        setDirty(false);
    }, [form, open, skill]);

    // Mark dirty on user edits only; reset/setValue do not emit "change".
    useEffect(() => {
        const subscription = form.watch((_, { type }) => {
            if (type === "change") setDirty(true);
        });
        return () => subscription.unsubscribe();
    }, [form]);

    const requestClose = () => {
        if (!dirty) {
            onClose();
            return;
        }
        confirmDialog({ title: "放弃未保存的修改？", content: "当前填写内容不会保留。", okText: "放弃修改", okButtonProps: { danger: true }, cancelText: "继续编辑", onOk: onClose });
    };

    const submit = async (values: SkillFormValues) => {
        setSaving(true);
        try {
            const input: SkillMutationInput = {
                skillName: values.skillName,
                description: values.description,
                // Package skills do not render the instruction field, so it is not submitted.
                instruction: isPackageSkill ? "" : values.instruction || "",
                tag: values.tag,
                isPrivate: !values.is_public,
                markdownUrl: values.markdownUrl || "",
                showcaseMedia: (values.showcaseMedia || []).map((item) => ({ ...item, showcaseUri: item.showcaseUri || "" })),
                extraInfo: values.extraInfo || "",
            };
            const result = skill ? await updateSkill(skill.skillId, input) : await createSkill(input);
            setDirty(false);
            toast.success(skill ? "技能已更新" : "技能已创建");
            onSaved(result.skill);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "技能保存失败");
        } finally {
            setSaving(false);
        }
    };

    const draftFromIdea = async () => {
        const idea = draftIdea.trim();
        if (!idea) {
            toast.warning("请先描述你想沉淀的技能");
            return;
        }
        if (!useConfigStore.getState().isAiConfigReady(effectiveConfig, effectiveConfig.model)) {
            toast.info("尚未配置可用的文本模型，请先到设置页配置");
            navigateToSettings({ section: "models", continueCreation: true });
            return;
        }
        setDrafting(true);
        try {
            const draft = await generateSkillDraft(idea, effectiveConfig);
            form.setValue("skillName", draft.skillName || "");
            form.setValue("description", draft.description || "");
            form.setValue("instruction", draft.instruction || "");
            if (draft.tag) form.setValue("tag", draft.tag);
            setDirty(true);
            toast.success("草稿已生成，请检查并调整后保存");
        } catch (error) {
            toast.error(error instanceof Error ? `起草失败：${error.message}` : "起草失败");
        } finally {
            setDrafting(false);
        }
    };

    const addMedia = () => {
        media.append(emptyMedia());
        setDirty(true);
    };

    const removeMedia = (index: number) => {
        media.remove(index);
        setDirty(true);
    };

    return (
        <AppDrawer
            className="library-drawer border-0 bg-popover shadow-[var(--elevation-panel)] [&>[data-slot=app-drawer-body]]:px-7 [&>[data-slot=app-drawer-body]]:pt-[22px] [&>[data-slot=app-drawer-body]]:pb-[30px] [&>[data-slot=app-drawer-header]]:min-h-[70px] [&>[data-slot=app-drawer-header]]:border-foreground/[.08] [&>[data-slot=app-drawer-header]]:px-7 [&>[data-slot=app-drawer-header]]:pt-[22px] [&>[data-slot=app-drawer-header]]:pb-[15px] [&>[data-slot=app-drawer-header]>h2]:text-[length:var(--fs-heading-lg)] [&>[data-slot=app-drawer-header]>h2]:font-[620] max-[680px]:[&>[data-slot=app-drawer-body]]:p-[18px] max-[680px]:[&>[data-slot=app-drawer-header]]:px-[18px] max-[680px]:[&>[data-slot=app-drawer-header]]:pt-[18px] max-[680px]:[&>[data-slot=app-drawer-header]]:pb-[13px]"
            open={open}
            size={720}
            maskClosable={!dirty}
            title={skill ? "编辑技能" : "创建技能"}
            onClose={requestClose}
            extra={<Button variant="outline" loading={saving} onClick={() => void form.handleSubmit(submit)()}>{saving ? null : <Save className="size-4" />}保存技能</Button>}
        >
            {!isPackageSkill ? <div className="mb-4 rounded-xl border bg-foreground/[.02] p-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <Wand2 className="size-4" />
                    AI 起草
                    <span className="font-normal text-foreground/45">描述想法，一键生成名称、简介与指令草稿（可再编辑）</span>
                </div>
                <Textarea
                    value={draftIdea}
                    onChange={(event) => setDraftIdea(event.target.value)}
                    rows={3}
                    className="min-h-[76px] max-h-[136px]"
                    maxLength={2000}
                    disabled={drafting}
                    aria-label="技能想法"
                    placeholder="例如：我要一个竖屏短剧分镜技能——输入剧本段落，输出按景别排列的分镜表，每个镜头包含画面、台词、时长与转场…"
                />
                <CharCount value={draftIdea} max={2000} />
                <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-foreground/45">将使用你的文本模型生成一次草稿</span>
                    <Button variant="outline" loading={drafting} disabled={!draftIdea.trim()} onClick={() => void draftFromIdea()}>{drafting ? null : <Wand2 className="size-4" />}生成草稿</Button>
                </div>
            </div> : <div className="mb-4 rounded-xl border bg-foreground/[.02] p-3 text-sm leading-6 text-foreground/58">这是多文件技能包。这里仅编辑名称、简介、分类和展示信息；技能正文请更新 ZIP，或在 GitHub 仓库修改后执行同步。</div>}
            <Form {...form}>
                <form className="grid gap-5" noValidate onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(submit)(); }}>
                    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="skillName"
                            render={({ field }) => (
                                <FormItem className="content-start">
                                    <FormLabel className={labelClass}>技能名称</FormLabel>
                                    <FormControl>
                                        <Input {...field} maxLength={80} placeholder="例如：短剧导演分镜" autoComplete="off" />
                                    </FormControl>
                                    <CharCount value={field.value} max={80} />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="tag"
                            render={({ field }) => (
                                <FormItem className="content-start">
                                    <FormLabel className={labelClass}>技能分类</FormLabel>
                                    <Select ariaLabel="技能分类" value={field.value} options={fallbackSkillCategories.map(({ value, label }) => ({ value, label }))} onChange={field.onChange} />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={labelClass}>技能简介</FormLabel>
                                <FormControl>
                                    <Textarea {...field} rows={3} className="min-h-[76px] max-h-[136px]" maxLength={500} placeholder="说明适用场景、输入条件和最终产出" />
                                </FormControl>
                                <CharCount value={field.value} max={500} />
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {!isPackageSkill ? (
                        <FormField
                            control={form.control}
                            name="instruction"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={labelClass}>技能指令</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} value={field.value ?? ""} rows={14} className="min-h-[296px] max-h-[576px] font-mono text-xs leading-5 md:text-xs" maxLength={100000} placeholder="使用 Markdown 编写角色、约束、流程、检查清单和输出格式" />
                                    </FormControl>
                                    <CharCount value={field.value ?? ""} max={100000} />
                                    <FormDescription>单文件技能会作为 SKILL.md 安装，Agent 按任务需要读取。</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    ) : null}

                    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-[minmax(0,1fr)_180px]">
                        <FormField
                            control={form.control}
                            name="markdownUrl"
                            render={({ field }) => (
                                <FormItem className="content-start">
                                    <FormLabel className={labelClass}>{isPackageSkill ? "来源地址" : "Markdown 地址"}<OptionalMark /></FormLabel>
                                    <FormControl>
                                        <Input {...field} type="url" inputMode="url" spellCheck={false} placeholder="https://example.com/SKILL.md" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="is_public"
                            render={({ field }) => (
                                <FormItem className="content-start">
                                    <FormLabel className={labelClass}>公开状态<OptionalMark /></FormLabel>
                                    <FormControl>
                                        <Switch className="justify-self-start" checked={field.value} checkedChildren="公开" unCheckedChildren="私有" onChange={field.onChange} />
                                    </FormControl>
                                    <FormDescription>公开后其他用户可以加入使用。</FormDescription>
                                </FormItem>
                            )}
                        />
                    </div>

                    <section aria-labelledby="skill-media-title">
                        <div className="mb-3 flex items-center justify-between">
                            <div><h3 id="skill-media-title" className="text-sm font-medium">展示媒体</h3><p className="mt-1 text-xs text-foreground/50">可选，最多 8 个公开图片或视频链接。</p></div>
                            <Button variant="outline" disabled={media.fields.length >= 8} onClick={addMedia}><Plus className="size-4" />添加媒体</Button>
                        </div>
                        <div className="space-y-2">
                            {media.fields.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-[112px_minmax(0,1fr)_36px] gap-2">
                                    <FormField
                                        control={form.control}
                                        name={`showcaseMedia.${index}.type`}
                                        render={({ field }) => (
                                            <FormItem className="content-start gap-1">
                                                <Select ariaLabel="媒体类型" value={field.value} options={[{ value: "image", label: "图片" }, { value: "video", label: "视频" }]} onChange={field.onChange} />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`showcaseMedia.${index}.showcaseUrl`}
                                        render={({ field }) => (
                                            <FormItem className="content-start gap-1">
                                                <FormControl>
                                                    <Input {...field} aria-label="媒体链接" type="url" inputMode="url" spellCheck={false} placeholder="https://example.com/media" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button variant="outline" size="icon" aria-label="移除媒体" title="移除媒体" onClick={() => removeMedia(index)}><Minus className="size-4" /></Button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <FormField
                        control={form.control}
                        name="extraInfo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={labelClass}>补充信息<OptionalMark /></FormLabel>
                                <FormControl>
                                    <Textarea {...field} rows={2} className="min-h-[56px] max-h-[116px]" maxLength={2000} placeholder="版本说明、依赖工具或使用注意事项" />
                                </FormControl>
                                <CharCount value={field.value} max={2000} />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </AppDrawer>
    );
}

function skillFormValues(skill: Skill | null): SkillFormValues {
    return {
        skillName: skill?.skillName || "",
        description: skill?.description || "",
        instruction: skill?.instruction || "",
        tag: skill?.tag || "creative",
        is_public: skill ? !skill.isPrivate : true,
        markdownUrl: skill?.markdownUrl || skill?.sourceUrl || "",
        showcaseMedia: skill?.showcaseMedia || [],
        extraInfo: skill?.extraInfo || "",
    };
}

function CharCount({ value, max }: { value: string; max: number }) {
    return <span className="-mt-1 block text-right text-xs tabular-nums text-muted-foreground" aria-hidden="true">{value.length} / {max}</span>;
}

function OptionalMark(): ReactNode {
    return <span className="ml-1 font-normal text-muted-foreground">（可选）</span>;
}

function emptyMedia(): SkillShowcaseMedia {
    return { type: "image", showcaseUri: "", showcaseUrl: "" };
}
