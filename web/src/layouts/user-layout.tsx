import { useLayoutEffect, type ReactNode } from "react";
import { useLocation } from "react-router";

import { AppWorkspaceShell } from "@/components/layout/app-top-nav";
import { cn } from "@/lib/utils";
import { isSpatialWorkbenchPath } from "@/lib/workspace-routes";
import { useWorkspaceButtonFeedback } from "@/hooks/use-workspace-button-feedback";
import "@/styles/workspace-product.css";

export default function UserLayout({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const spatialWorkbench = isSpatialWorkbenchPath(pathname);
    const productWorkspace = !/^\/canvas\/[^/]+(?:\/|$)/.test(pathname);
    useWorkspaceButtonFeedback(productWorkspace);

    useLayoutEffect(() => {
        // 浮层挂载在 body，必须用路由级标记隔离用户工作台与画布编辑器。
        document.body.classList.add("app-user-overlays");
        document.body.classList.toggle("app-spatial-overlays", spatialWorkbench);
        document.body.classList.toggle("app-product-overlays", productWorkspace);
        return () => {
            document.body.classList.remove("app-user-overlays");
            document.body.classList.remove("app-spatial-overlays");
            document.body.classList.remove("app-product-overlays");
        };
    }, [spatialWorkbench, productWorkspace]);

    return (
        <div className={cn("app-user-workspace h-dvh overflow-hidden text-foreground", spatialWorkbench && "app-spatial-workspace", productWorkspace && "app-product-workspace")}>
            <AppWorkspaceShell>{children}</AppWorkspaceShell>
        </div>
    );
}
