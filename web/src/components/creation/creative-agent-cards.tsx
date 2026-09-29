import { useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/base/checkbox";
import { MenuDropdown } from "@/components/ui/menu-dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Callout } from "@/components/ui/product/callout";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AIMessageMarkdown } from "@/components/ai/ai-message-markdown";
import { validateCreativeAnswers, type CreativeAnswers, type CreativeAssetOption, type CreativePlan, type CreativeProposal, type CreativeQuestionRequest } from "@/lib/creation/creative-agent-contract";
import "./creative-agent-cards.css";

export type CreativeQuestionCardProps = {
    request: CreativeQuestionRequest; answers: CreativeAnswers; onAnswersChange: (answers: CreativeAnswers) => void;
    onSubmit: (answers: CreativeAnswers) => void | Promise<void>; onModify?: () => void; assets: CreativeAssetOption[]; busy?: boolean; disabled?: boolean; error?: string;
};
export function CreativeQuestionCard({ request, answers, onAnswersChange, onSubmit, onModify, assets, busy, disabled, error }: CreativeQuestionCardProps) {
    const [page, setPage] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const detailId = useId();
    const [localError, setLocalError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const currentPage = Math.min(page, Math.max(request.questions.length - 1, 0));
    const question = request.questions[currentPage];
    if (!question) return null;
    const answer = answers[question.id] ?? { selected: [], custom: "" };
    const locked = request.status !== "pending" || busy || disabled || submitting;
    const options = question.type === "asset" ? assets : question.options;
    const archived = request.status !== "pending";
    const summary = request.questions.map((item) => {
        const value = answers[item.id];
        const choices = item.type === "asset" ? assets : item.options;
        return value ? [...value.selected.map((id) => choices.find((option) => option.id === id)?.label ?? "素材已不可用"), value.custom].filter(Boolean).join("、") : "";
    }).filter(Boolean).join(" · ") || `${request.questions.length} 项创作信息`;
    const change = (patch: Partial<typeof answer>) => { setLocalError(""); onAnswersChange({ ...answers, [question.id]: { ...answer, ...patch } }); };
    const optionItems = options.map((option) => <label className="creative-agent-option" key={option.id} data-selected={answer.selected.includes(option.id)} data-disabled={Boolean(locked)}>
        {question.type === "single" ? <RadioGroupItem value={option.id} className="mt-0.5" /> : <Checkbox bare className="mt-0.5" checked={answer.selected.includes(option.id)} disabled={locked} onChange={(event) => change({ selected: event.target.checked ? [...answer.selected, option.id] : answer.selected.filter((id) => id !== option.id) })} />}
        <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
    </label>);
    const move = (index: number) => { setPage(index); requestAnimationFrame(() => headingRef.current?.focus()); };
    const submit = async () => {
        const invalid = validateCreativeAnswers(request, answers, assets);
        if (invalid) { setLocalError(invalid.message); move(request.questions.findIndex((item) => item.id === invalid.questionId)); return; }
        setSubmitting(true); setLocalError("");
        try { await onSubmit(answers); } catch (cause) { setLocalError(cause instanceof Error ? cause.message : "提交失败，请重试"); } finally { setSubmitting(false); }
    };
    return <section className="creative-agent-card creative-agent-question-card" data-canvas-no-zoom data-canvas-wheel-scroll aria-label="需求问答">
        {archived && <div className="creative-agent-archive-row"><span className="creative-agent-archive-summary" title={summary}>{request.status === "submitted" ? "已回答" : "已更新"} · {summary}</span><Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)}>{expanded ? "收起" : "查看"}</Button>{onModify && <Button variant="ghost" size="sm" disabled={busy} onClick={onModify}>修改</Button>}</div>}
        {(!archived || expanded) && <div id={detailId} className="creative-agent-card-content">
        <div className="creative-agent-card-row creative-agent-overline"><span>补充创作信息 · {currentPage + 1}/{request.questions.length}</span><span className="creative-agent-step-dots" aria-hidden="true">{request.questions.map((item, index) => <i key={item.id} data-current={index === currentPage} />)}</span></div>
        {request.status === "submitted" ? <Badge variant="secondary">已提交</Badge> : request.status === "superseded" ? <Badge variant="secondary">已更新，请使用新问题</Badge> : null}
        <h3 ref={headingRef} tabIndex={-1}>{question.title}</h3>
        {question.description && <p className="creative-agent-muted">{question.description}</p>}
        {question.type === "single" ? <RadioGroup className="creative-agent-options" value={answer.selected[0] ?? ""} disabled={Boolean(locked)} onValueChange={(id) => change({ selected: [id], custom: "" })}>{optionItems}</RadioGroup> : <div className="creative-agent-options">{optionItems}</div>}
        {question.type === "asset" && !assets.length && <p className="creative-agent-muted">暂无可用素材，请先添加素材或补充说明。</p>}
        {question.allowCustom && <label className="creative-agent-custom-answer"><span>{question.type === "text" ? "你的想法" : "也可以自定义或补充"}</span><Textarea aria-label={question.type === "text" ? question.title : "自定义回答"} value={answer.custom} disabled={locked} rows={2} className="field-sizing-content min-h-[3.25rem] max-h-36" onChange={(event) => change({ custom: event.target.value, ...(question.type === "single" ? { selected: [] } : {}) })} placeholder="补充你的想法" /></label>}
        {(error || localError) && <Callout tone="error" role="alert" title={error || localError} />}
        <div className="creative-agent-actions">
            <Button variant="outline" disabled={currentPage === 0} onClick={() => move(currentPage - 1)}>上一题</Button>
            {currentPage < request.questions.length - 1 ? <Button variant={archived ? "outline" : "default"} onClick={() => move(currentPage + 1)}>下一题</Button> : !archived && <Button disabled={locked} loading={busy || submitting} onClick={() => void submit()}>提交回答</Button>}
            {!question.required && !locked && <Button variant="ghost" onClick={() => { change({ selected: [], custom: "" }); if (currentPage < request.questions.length - 1) move(currentPage + 1); }}>跳过</Button>}
        </div>
        {request.status === "submitted" && <p className="creative-agent-muted">{[...answer.selected.map((id) => options.find((option) => option.id === id)?.label ?? "素材已不可用"), answer.custom].filter(Boolean).join("、") || "已跳过"}</p>}
        </div>}
    </section>;
}

export type CreativeProposalCardProps = { proposal: CreativeProposal; onApprove: () => void; onModify: () => void; onRedirect: () => void; busy?: boolean; disabled?: boolean; archived?: boolean; modifiable?: boolean };
export function CreativeProposalCard({ proposal, onApprove, onModify, onRedirect, busy, disabled, archived, modifiable }: CreativeProposalCardProps) {
    const [detailExpanded, setDetailExpanded] = useState(false);
    const [archivedExpanded, setArchivedExpanded] = useState(false);
    const expanded = archived ? archivedExpanded : detailExpanded;
    const setExpanded = archived ? setArchivedExpanded : setDetailExpanded;
    const detailId = useId();
    return <section className="creative-agent-card creative-agent-proposal-card" data-canvas-no-zoom data-canvas-wheel-scroll aria-label="创意方案">
        {archived ? <div className="creative-agent-archive-row"><strong className="creative-agent-archive-summary" title={proposal.title}>{proposal.title} · v{proposal.version}</strong><Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)}>{expanded ? "收起方案" : "查看方案"}</Button>{modifiable && <Button variant="ghost" size="sm" disabled={disabled || busy} onClick={onModify}>修改</Button>}</div> : <div className="creative-agent-card-row creative-agent-overline"><span>创意方案</span><span>版本 {proposal.version}</span></div>}
        {(!archived || expanded) && <>
        <h3>{proposal.title}</h3>
        <p className="creative-agent-proposal-summary">{proposal.summary}</p>
        {proposal.deliverables.length > 0 && <ul className="creative-agent-deliverables">{proposal.deliverables.map((item, index) => <li key={index}><span>产物 {index + 1}</span><strong>{item}</strong></li>)}</ul>}
        {!archived && <Button variant="outline" className="creative-agent-detail-toggle" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)}>{expanded ? "收起完整方案" : "查看完整方案"}</Button>}
        {expanded && <div id={detailId} className="creative-agent-detail"><AIMessageMarkdown>{proposal.markdown}</AIMessageMarkdown></div>}
        {!archived && <><div className="creative-agent-scope-note">确认后创建本阶段节点并在本机准备生成参数。</div>
        <div className="creative-agent-actions creative-agent-primary-actions"><Button loading={busy} disabled={disabled || busy} onClick={onApprove}>确认方案</Button><Button variant="outline" disabled={disabled || busy} onClick={onModify}>修改</Button><MenuDropdown items={[{ key: "redirect", label: "换个方向" }]} onClick={() => onRedirect()} disabled={disabled || busy}><Button variant="outline" disabled={disabled || busy}>更多</Button></MenuDropdown></div></>}
        </>}
    </section>;
}

const stepLabels = { pending: "待开始", running: "处理中", waiting: "等待你确认", completed: "已完成", failed: "失败", cancelled: "已取消" };
export function CreativePlanBar({ plan, onLocateNode }: { plan?: CreativePlan | null; onLocateNode?: (nodeId: string) => void }) {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const panelId = useId();
    if (!plan?.steps.length) return null;
    const completed = plan.steps.filter((step) => step.status === "completed").length;
    const running = plan.steps.filter((step) => step.status === "running").length;
    const current = plan.steps.find((step) => step.status === "running" || step.status === "waiting" || step.status === "failed");
    const close = () => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
    return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) trigger.current?.focus(); }}>
        <PopoverTrigger asChild><Button ref={trigger} variant="outline" className="creative-agent-plan-trigger" aria-label="查看制作计划" aria-expanded={open} aria-controls={panelId} onKeyDown={(event) => { if (event.key === "Escape") close(); }}><span className="creative-agent-plan-count">{completed}/{plan.steps.length}</span><span className="creative-agent-plan-current">{running > 1 ? `运行中 ${running} 项` : current ? current.title : completed === plan.steps.length ? "计划已完成" : "查看制作计划"}</span><span className="creative-agent-plan-chevron" aria-hidden="true">{open ? "⌄" : "⌃"}</span></Button></PopoverTrigger>
        <PopoverContent side="top" className="w-auto p-3" onOpenAutoFocus={(event) => { event.preventDefault(); panel.current?.focus(); }} onCloseAutoFocus={(event) => event.preventDefault()}>
            <div id={panelId} ref={panel} tabIndex={-1} className="creative-agent-plan" data-canvas-no-zoom data-canvas-wheel-scroll onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
                <div className="creative-agent-card-row"><strong>制作计划</strong><Button variant="outline" size="sm" onClick={close}>收起</Button></div>
                <ol>{plan.steps.map((step) => <li key={step.id} data-status={step.status}><div className="creative-agent-card-row"><strong>{step.title}</strong><Badge variant="secondary">{stepLabels[step.status]}</Badge></div>{step.detail && <p>{step.detail}</p>}{onLocateNode && step.nodeIds?.map((id, index) => <Button key={id} variant="link" onClick={() => onLocateNode(id)}>定位节点 {index + 1}</Button>)}</li>)}</ol>
            </div>
        </PopoverContent>
    </Popover>;
}
