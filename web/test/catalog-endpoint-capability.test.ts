import { expect, test } from "bun:test";

import { catalogModelMapping, mergeFetchedChannelModelProfiles } from "../src/lib/channel-model-catalog";
import { createModelChannel } from "../src/stores/use-config-store";

// Endpoint shapes copied from a real new-api /v1/models response; order varies per model.
const cases: Array<[string, string[], string | undefined]> = [
    ["minimax-h3", ["openai", "openai-video"], "video"],
    ["minimax-h3-cloud", ["openai", "openai-video"], "video"],
    ["seedance-2.5", ["openai-video", "openai"], "video"],
    ["fal-ai/kling-video/v3/pro/text-to-video", ["openai-video", "fal-queue"], "video"],
    ["gpt-image-2-text-to-image", ["image-generation", "openai", "openai-video"], "image"],
    ["fal-ai/nano-banana-pro/edit", ["image-generation", "fal-queue", "image-edit"], "image"],
    ["gpt-image-2", ["image-generation", "openai", "openai-response", "openai-response-compact", "anthropic", "gemini", "image-edit"], "image"],
    ["gpt-5.5", ["openai", "openai-response", "openai-response-compact", "anthropic", "gemini", "openai-completion", "openai-video"], undefined],
    ["claude-opus-4-8", ["openai", "anthropic", "openai-response", "openai-response-compact", "gemini", "openai-video"], undefined],
    ["glm-5.2", ["openai"], undefined],
];

test("catalog endpoint types decide image/video capability regardless of order", () => {
    for (const [id, supportedEndpointTypes, capability] of cases) {
        expect([id, catalogModelMapping({ id, supportedEndpointTypes }, { endpointCapability: true }).capability]).toEqual([id, capability]);
    }
});

test("only the account channel infers media capability from endpoint types", () => {
    const catalog = [{ id: "minimax-h3", supportedEndpointTypes: ["openai", "openai-video"] }];
    const account = mergeFetchedChannelModelProfiles(createModelChannel({ id: "account", name: "云端模型" }), catalog);
    expect(account).toMatchObject([{ model: "minimax-h3", capability: "video", protocol: "newapi" }]);
    const manual = mergeFetchedChannelModelProfiles(createModelChannel({ id: "manual", name: "自定义" }), catalog);
    expect(manual).toEqual([]);
});
