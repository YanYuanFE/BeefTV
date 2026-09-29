import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { safeRedirect } from "../src/pages/login";
import { accountChannel, isSignedIn, signOut } from "../src/services/account-session";
import { createModelChannel, defaultConfig, useConfigStore } from "../src/stores/use-config-store";

test("login redirect only allows same-site relative paths", () => {
    expect(safeRedirect("/canvas/p-1?tab=2")).toBe("/canvas/p-1?tab=2");
    expect(safeRedirect("//evil.example/x")).toBe("/");
    expect(safeRedirect("/\\evil.example")).toBe("/");
    expect(safeRedirect("/\t/evil.example")).toBe("/");
    expect(safeRedirect("https://evil.example")).toBe("/");
    expect(safeRedirect("/login?redirect=/x")).toBe("/");
    expect(safeRedirect(null)).toBe("/");
});

test("account channel key is the login state and sign-out clears it", () => {
    const signedIn = createModelChannel({ id: "account", name: "云端模型", baseUrl: "https://gw.example", apiKey: "sk-live", models: ["gpt-image-2"] });
    useConfigStore.getState().replaceConfig({ ...defaultConfig, channels: [signedIn] });
    expect(isSignedIn(useConfigStore.getState().config)).toBe(true);

    signOut();
    const after = useConfigStore.getState().config;
    expect(isSignedIn(after)).toBe(false);
    expect(after.channels).toHaveLength(1);
    expect(accountChannel(after)).toMatchObject({ id: "account", name: "云端模型", apiKey: "", models: [], baseUrl: "https://gw.example" });
    expect(after.imageModel).toBe("");
});

test("the UI never names the upstream gateway (distributor sites must not see it)", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
            const path = join(dir, entry);
            if (statSync(path).isDirectory()) walk(path);
            else if (/\.(tsx?|css)$/.test(entry) && /subrouter/i.test(readFileSync(path, "utf8"))) offenders.push(path);
        }
    };
    walk(new URL("../src", import.meta.url).pathname);
    expect(offenders).toEqual([]);
});
