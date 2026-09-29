/** Floating layers (dialogs, sheets, popovers, menus, select lists) rendered in portals; canvas and shortcut handlers ignore events inside them. */
export const OVERLAY_SELECTOR = [
    "[data-slot=app-modal]",
    "[data-slot=app-drawer]",
    "[data-slot=dialog-content]",
    "[data-slot=alert-dialog-content]",
    "[data-slot=sheet-content]",
    "[data-slot=popover-content]",
    "[data-slot=dropdown-menu-content]",
    "[data-slot=dropdown-menu-sub-content]",
    "[data-slot=context-menu-content]",
    "[data-slot=context-menu-sub-content]",
    "[data-slot=select-content]",
].join(",");

/** Popover-like layers only (no dialogs). */
export const POPOVER_SELECTOR = "[data-slot=popover-content],[data-slot=dropdown-menu-content],[data-slot=dropdown-menu-sub-content],[data-slot=select-content]";
