import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("completed generation effects commit to the desktop canonical repository", () => {
    const source = readFileSync(resolve(import.meta.dir, "../src/services/canvas-generation-consumer.ts"), "utf8");
    const durableCommit = source.indexOf("const persisted = await withCanvasStorePersistenceLock(");
    const backendCommit = source.indexOf("await syncLocalCanvasGenerationProjectToBackend(input.projectId)");
    expect(durableCommit).toBeGreaterThan(-1);
    expect(backendCommit).toBeGreaterThan(durableCommit);
    expect(source.indexOf("return persisted;", backendCommit)).toBeGreaterThan(backendCommit);
});

test("a concurrent-update conflict first falls back to writing only the generation's target nodes", () => {
    const source = readFileSync(resolve(import.meta.dir, "../src/services/canvas-generation-consumer.ts"), "utf8");
    const conflictBranch = source.indexOf('conflict.reason === "concurrent-update"');
    const fallback = source.indexOf("rebaseGenerationOntoTargetNodes(durable, delta, input)", conflictBranch);
    const conflictError = source.indexOf('throw new Error("画布生成副作用与并发修改冲突")', conflictBranch);
    expect(conflictBranch).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(conflictBranch);
    expect(conflictError).toBeGreaterThan(fallback);
});
