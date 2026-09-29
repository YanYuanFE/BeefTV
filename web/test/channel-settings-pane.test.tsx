import { expect, test } from "bun:test";
import { channelValidationError, modelConfigChannelStatusLabel } from "../src/pages/settings/channel-settings-pane";
import { createModelChannel } from "../src/stores/use-config-store";

test("account channel status reflects login and catalog state", () => {
    const signedOut = createModelChannel({ id: "account", name: "云端模型", apiKey: "", models: [] });
    expect(channelValidationError(signedOut)).toBe("请先登录");
    expect(modelConfigChannelStatusLabel(signedOut, { status: "idle", revision: 0, dirty: false, error: "" })).toBe("待登录");

    const noModels = createModelChannel({ id: "account", name: "云端模型", apiKey: "sk-live", models: [] });
    expect(channelValidationError(noModels)).toBe("请先拉取模型");

    const ready = createModelChannel({ id: "account", name: "云端模型", apiKey: "sk-live", models: ["gpt-image-2"] });
    expect(channelValidationError(ready)).toBe("");
    expect(modelConfigChannelStatusLabel(ready, { status: "saving", revision: 3, dirty: true, error: "" })).toBe("保存中");
});
