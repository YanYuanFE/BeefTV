import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { BookOpenText, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useNavigate } from "react-router";

import { PaginationBar } from "@/components/layout/workspace-page";
import { Input } from "@/components/ui/input";
import { AppModal } from "@/components/ui/product/app-modal/app-modal";
import type { ProjectUnit } from "@/services/api/projects";

type Props = {
    projectId: string;
    units: ProjectUnit[];
    unitId?: string;
    stage?: string;
};

export function WorkflowChapterNavigator({ projectId, units, unitId, stage }: Props) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
    const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));
    const orderedUnits = useMemo(() => units.slice().sort((left, right) => left.position - right.position), [units]);
    const currentIndex = Math.max(0, orderedUnits.findIndex((unit) => unit.id === unitId));
    const current = orderedUnits[currentIndex];
    const filteredUnits = useMemo(() => {
        if (!deferredQuery) return orderedUnits;
        const numericQuery = /^\d+$/.test(deferredQuery) ? deferredQuery.replace(/^0+/, "") || "0" : "";
        return orderedUnits.filter((unit, index) => (numericQuery && String(index + 1).startsWith(numericQuery)) || unit.title.toLocaleLowerCase("zh-CN").includes(deferredQuery));
    }, [deferredQuery, orderedUnits]);
    const pageCount = Math.max(1, Math.ceil(filteredUnits.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const pagedUnits = filteredUnits.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

    const openPicker = () => {
        setQuery("");
        setPage(Math.floor(currentIndex / pageSize) + 1);
        setOpen(true);
    };

    const goTo = (target?: ProjectUnit) => {
        if (!target) return;
        setOpen(false);
        navigate(`/projects/${projectId}/workflow/${target.id}/${stage || "video"}`);
    };

    if (!current) return null;
    return (
        <>
            <div className="workflow-chapter-navigator">
                <button type="button" disabled={currentIndex === 0} onClick={() => goTo(orderedUnits[currentIndex - 1])} aria-label="上一章" title="上一章"><ChevronLeft /></button>
                <button type="button" className="workflow-chapter-current" onClick={openPicker} aria-haspopup="dialog" aria-label={`定位章节，当前第 ${currentIndex + 1} 章`}>
                    <span>第 {currentIndex + 1} 章</span><strong>{current.title}</strong><em>{currentIndex + 1}/{orderedUnits.length}</em><ChevronDown />
                </button>
                <button type="button" disabled={currentIndex >= orderedUnits.length - 1} onClick={() => goTo(orderedUnits[currentIndex + 1])} aria-label="下一章" title="下一章"><ChevronRight /></button>
            </div>
            <AppModal flush open={open} footer={null} title={null} className="workspace-modal workspace-modal-wide workflow-chapter-modal" onCancel={() => setOpen(false)}>
                <div className="workflow-chapter-modal-shell">
                    <header className="workflow-chapter-modal-head">
                        <div className="workflow-chapter-modal-title"><span><BookOpenText /></span><div><strong>定位章节</strong><p>快速搜索并跳转到需要制作的剧情章节</p></div></div>
                        <div className="workflow-chapter-modal-current"><span>当前</span><strong>第 {currentIndex + 1} 章</strong></div>
                    </header>
                    <div className="workflow-chapter-modal-search">
                        <div className="relative flex min-w-[280px] max-w-[720px] flex-[1_1_720px] items-center">
                            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                            <Input autoFocus className="h-10 pr-9 pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="输入章节序号或标题" />
                            {query ? <button type="button" aria-label="清空搜索" className="absolute right-2.5 grid size-5 place-items-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" onClick={() => { setQuery(""); setPage(1); }}><X className="size-3.5" /></button> : null}
                        </div>
                        <span>{deferredQuery ? `找到 ${filteredUnits.length.toLocaleString("zh-CN")} 章` : `共 ${orderedUnits.length.toLocaleString("zh-CN")} 章`}</span>
                    </div>
                    <div className="workflow-chapter-list thin-scrollbar">
                        {pagedUnits.length ? <div className="workflow-chapter-grid">{pagedUnits.map((unit) => {
                        const index = orderedUnits.findIndex((item) => item.id === unit.id);
                        const selected = unit.id === current.id;
                        return <button key={unit.id} type="button" className={`workflow-chapter-item${selected ? " is-active" : ""}`} onClick={() => goTo(unit)}><span className="workflow-chapter-item-index">{String(index + 1).padStart(Math.max(2, String(orderedUnits.length).length), "0")}</span><span className="workflow-chapter-item-copy"><strong title={unit.title}>{unit.title}</strong><small>第 {index + 1} 章 · {(unit.wordCount || 0).toLocaleString("zh-CN")} 字</small></span>{selected ? <em>当前</em> : <ChevronRight />}</button>;
                        })}</div> : <div className="workflow-chapter-empty"><Search /><strong>没有匹配的章节</strong><span>换一个章节序号或标题试试</span></div>}
                    </div>
                    <footer className="workflow-chapter-modal-pagination"><PaginationBar alwaysShow current={safePage} pageSize={pageSize} total={filteredUnits.length} pageSizeOptions={[100, 200, 500]} itemLabel="章" onChange={(nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} /></footer>
                </div>
            </AppModal>
        </>
    );
}
