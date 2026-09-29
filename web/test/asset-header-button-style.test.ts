import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("asset library header buttons", () => {
    test("user pages share control geometry without a light-only outline override", () => {
        const css = readFileSync(resolve(import.meta.dir, "../src/styles/globals.css"), "utf8");
        const product = readFileSync(resolve(import.meta.dir, "../src/styles/workspace-product.css"), "utf8");
        const page = readFileSync(resolve(import.meta.dir, "../src/pages/assets/index.tsx"), "utf8");
        expect(page).toContain('import { Button } from "@/components/ui/button";');
        expect(page).toContain('<div className="assets-header-action-buttons">');
        for (const styles of [css, product]) {
            expect(styles).not.toContain("html:not(.dark) .library-page .app-page-header .ant-btn");
            expect(styles).not.toContain("html .assets-library-page .app-page-header .assets-header-action-buttons .ant-btn");
            expect(styles).not.toContain("html:not(.dark) .library-page .app-page-header [data-slot=button]");
            expect(styles).not.toContain("html .assets-library-page .app-page-header .assets-header-action-buttons [data-slot=button]");
        }
    });
});
