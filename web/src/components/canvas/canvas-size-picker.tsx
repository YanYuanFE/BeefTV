import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const sizeOptions = ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"];

type CanvasSizePickerProps = {
    value: string;
    className?: string;
    onChange: (value: string) => void;
};

export function CanvasSizePicker({ value, className, onChange }: CanvasSizePickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const extraOptions = [value, search.trim()].filter((item) => item && !sizeOptions.includes(item));
    const normalizedSearch = search.trim().toLowerCase();
    const options = [...sizeOptions, ...Array.from(new Set(extraOptions))]
        .filter((size) => !normalizedSearch || size.toLowerCase().includes(normalizedSearch))
        .map((size) => ({ value: size, label: size }));
    const selectSize = (next: string) => {
        onChange(next.trim());
        setSearch("");
        setOpen(false);
    };

    return (
        <div className={className}>
            <Popover
                open={open}
                onOpenChange={(next) => {
                    // Closing with a typed value commits it, matching the previous blur behavior.
                    if (!next && search.trim()) {
                        selectSize(search);
                        return;
                    }
                    setOpen(next);
                }}
            >
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "canvas-compact-control canvas-control-select flex h-full w-full min-w-0 items-center justify-between gap-1 rounded-lg border border-border bg-transparent px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        )}
                        aria-expanded={open}
                    >
                        <span className={cn("truncate", !value && "text-muted-foreground")}>{value || "比例"}</span>
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto min-w-32 gap-1 p-1" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                    <input
                        autoFocus
                        className="h-7 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                        placeholder="比例"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.nativeEvent.isComposing) return;
                            if (event.key === "Enter" && search.trim()) selectSize(search);
                        }}
                    />
                    <div className="thin-scrollbar max-h-64 overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                                onClick={() => selectSize(option.value)}
                            >
                                {option.label}
                                {option.value === value ? <Check className="size-3" /> : null}
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
