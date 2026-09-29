import * as React from "react"

import { cn } from "@/lib/utils"

type NumberInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "size" | "min" | "max" | "step"> & {
  value?: number | null
  /** Emits null when the field is cleared. */
  onChange?: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  /** Decimal places kept on commit. */
  precision?: number
  size?: "sm" | "md"
  addonBefore?: React.ReactNode
  addonAfter?: React.ReactNode
  status?: "error" | "warning"
}

// Numeric field replacing AntD InputNumber: free typing, clamped and rounded on blur/Enter.
function NumberInput({ value, onChange, min, max, step = 1, precision, size = "md", addonBefore, addonAfter, status, className, disabled, onBlur, onKeyDown, ...props }: NumberInputProps) {
  const [draft, setDraft] = React.useState(() => formatNumber(value))
  React.useEffect(() => setDraft(formatNumber(value)), [value])

  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      onChange?.(null)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumber(value))
      return
    }
    const next = normalizeNumber(parsed, min, max, precision)
    setDraft(formatNumber(next))
    if (next !== value) onChange?.(next)
  }

  return (
    <div
      data-slot="number-input"
      data-disabled={disabled || undefined}
      aria-invalid={status === "error" || undefined}
      className={cn(
        "flex w-full min-w-0 items-center overflow-hidden rounded-lg border border-input bg-transparent text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-[disabled]:opacity-50 aria-invalid:border-destructive dark:bg-input/30",
        size === "sm" ? "h-7" : "h-8",
        className,
      )}
    >
      {addonBefore ? <span className="flex h-full shrink-0 items-center border-r border-input px-2 text-muted-foreground">{addonBefore}</span> : null}
      <input
        type="text"
        inputMode={precision === 0 ? "numeric" : "decimal"}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          commit()
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit()
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault()
            const base = value ?? min ?? 0
            onChange?.(normalizeNumber(base + (event.key === "ArrowUp" ? step : -step), min, max, precision))
          }
          onKeyDown?.(event)
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-2.5 tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        {...props}
      />
      {addonAfter ? <span className="flex h-full shrink-0 items-center border-l border-input px-2 text-muted-foreground">{addonAfter}</span> : null}
    </div>
  )
}

export function normalizeNumber(value: number, min?: number, max?: number, precision?: number) {
  let next = value
  if (min !== undefined) next = Math.max(min, next)
  if (max !== undefined) next = Math.min(max, next)
  if (precision !== undefined) next = Number(next.toFixed(precision))
  return next
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? "" : String(value)
}

export { NumberInput }
export type { NumberInputProps }
