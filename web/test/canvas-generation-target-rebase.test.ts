import { expect, test } from "bun:test";

import { rebaseGenerationTargetNodes } from "../src/lib/canvas/canvas-storage-revision";
import type { CanvasProject } from "../src/stores/canvas/use-canvas-store";
import type { CanvasNodeData } from "../src/types/canvas";

const EFFECT = "task-1:image";

function node(id: string, patch: Partial<CanvasNodeData> = {}, metadata: Record<string, unknown> = {}): CanvasNodeData {
    return { id, type: "image", title: id, position: { x: 0, y: 0 }, width: 320, height: 180, ...patch, metadata: { status: "idle", ...metadata } } as CanvasNodeData;
}

function project(nodes: CanvasNodeData[]): CanvasProject {
    return { id: "p1", title: "画布", nodes, connections: [], revision: 7 } as unknown as CanvasProject;
}

const isTarget = (candidate: CanvasNodeData) => Boolean((candidate.metadata as { generationEffectKeys?: string[] } | undefined)?.generationEffectKeys?.includes(EFFECT));

test("applies only the generation's own changes onto the target node and keeps concurrent edits", () => {
    const base = [node("target", {}, { prompt: "猫" }), node("other")];
    // The generation filled content/status and resized the node.
    const local = [
        node("target", { height: 320 }, { prompt: "猫", status: "success", content: "resource:abc", generationEffectKeys: [EFFECT] }),
        node("other"),
    ];
    // Meanwhile another writer renamed and moved the target and edited its prompt, and changed another node.
    const durable = project([
        node("target", { title: "封面图", position: { x: 40, y: 60 } }, { prompt: "橘猫" }),
        node("other", { title: "别人改的" }),
    ]);

    const rebased = rebaseGenerationTargetNodes({ durable, baseNodes: base, localNodes: local, isTarget });

    expect(rebased).toBeDefined();
    const target = rebased!.nodes.find((item) => item.id === "target")!;
    expect(target.title).toBe("封面图");
    expect(target.position).toEqual({ x: 40, y: 60 });
    expect(target.height).toBe(320);
    expect(target.metadata).toMatchObject({ prompt: "橘猫", status: "success", content: "resource:abc", generationEffectKeys: [EFFECT] });
    expect(rebased!.nodes.find((item) => item.id === "other")!.title).toBe("别人改的");
    expect(rebased!.revision).toBe(7);
});

test("adds a node the generation created and refuses to resurrect a concurrently deleted target", () => {
    const created = node("output", {}, { status: "success", content: "resource:new", generationEffectKeys: [EFFECT] });
    const added = rebaseGenerationTargetNodes({ durable: project([node("kept")]), baseNodes: [node("kept")], localNodes: [node("kept"), created], isTarget });
    expect(added!.nodes.map((item) => item.id)).toEqual(["kept", "output"]);

    const deleted = rebaseGenerationTargetNodes({
        durable: project([]),
        baseNodes: [node("target")],
        localNodes: [node("target", {}, { status: "success", generationEffectKeys: [EFFECT] })],
        isTarget,
    });
    expect(deleted).toBeUndefined();
});
