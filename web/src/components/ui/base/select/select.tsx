import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Select — 单选下拉（Radix Select）。
 *
 * - API：value/onChange/options/placeholder/disabled/allowClear/size/ariaLabel/className/id。
 * - 选项值为字符串；清空时 onChange(undefined)。多选和标签输入用 TagsInput。
 * - 样式只吃语义 token，浮层与定位由 Radix 承担。
 */

export type SelectSize = "sm" | "md";

export interface SelectOption<V extends string = string> {
    value: V;
    label: ReactNode;
    disabled?: boolean;
    /** 原生 title */
    title?: string;
}

export interface SelectProps<V extends string = string> {
    value?: V;
    onChange?: (value: V) => void;
    options?: Array<SelectOption<V>>;
    placeholder?: string;
    disabled?: boolean;
    allowClear?: boolean;
    size?: SelectSize;
    ariaLabel?: string;
    className?: string;
    id?: string;
}

export function Select<V extends string = string>({ value, onChange, options = [], placeholder, disabled = false, allowClear = false, size = "md", ariaLabel, className, id }: SelectProps<V>) {
    const hasValue = value !== undefined && value !== null && value !== "";
    return (
        <div className={cn("relative inline-flex w-full", className)}>
            <SelectRoot value={hasValue ? value : ""} onValueChange={(next) => onChange?.(next as V)} disabled={disabled}>
                <SelectTrigger id={id} size={size === "sm" ? "sm" : "default"} aria-label={ariaLabel} className={cn("w-full min-w-0", allowClear && hasValue && "pr-12")}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value} disabled={option.disabled} title={option.title}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </SelectRoot>
            {allowClear && hasValue && !disabled ? (
                <button type="button" aria-label="清空选择" className="absolute top-1/2 right-7 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground" onClick={() => onChange?.(undefined as unknown as V)}>
                    <X className="size-3.5" />
                </button>
            ) : null}
        </div>
    );
}
