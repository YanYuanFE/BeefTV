import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type TagsInputProps = {
  value?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
  /** Characters that split typed text into tags, in addition to Enter. */
  tokenSeparators?: string[]
  /** Optional suggestions offered while typing. */
  suggestions?: string[]
  maxCount?: number
  disabled?: boolean
  autoFocus?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}

// Free-form tag entry replacing AntD Select mode="tags".
function TagsInput({ value = [], onChange, placeholder, tokenSeparators = [","], suggestions = [], maxCount, disabled, autoFocus, id, className, ...aria }: TagsInputProps) {
  const [draft, setDraft] = React.useState("")
  const listId = React.useId()
  const full = maxCount !== undefined && value.length >= maxCount

  const add = (raw: string) => {
    const pattern = new RegExp(`[${tokenSeparators.map(escapeRegExp).join("")}\\n]`)
    const incoming = raw.split(pattern).map((item) => item.trim()).filter(Boolean)
    if (!incoming.length) return
    const next = Array.from(new Set([...value, ...incoming]))
    onChange?.(maxCount === undefined ? next : next.slice(0, maxCount))
    setDraft("")
  }

  return (
    <div
      data-slot="tags-input"
      data-disabled={disabled || undefined}
      className={cn(
        "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-[disabled]:opacity-50 dark:bg-input/30",
        className,
      )}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground">
          <span className="truncate">{tag}</span>
          {!disabled ? (
            <button type="button" aria-label={`移除 ${tag}`} className="rounded text-muted-foreground hover:text-foreground" onClick={() => onChange?.(value.filter((item) => item !== tag))}>
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
      <input
        id={id}
        list={suggestions.length ? listId : undefined}
        value={draft}
        disabled={disabled || full}
        autoFocus={autoFocus}
        placeholder={value.length ? undefined : placeholder}
        aria-label={aria["aria-label"]}
        onChange={(event) => {
          const next = event.target.value
          if (tokenSeparators.some((separator) => next.includes(separator))) add(next)
          else setDraft(next)
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text")
          if (!text.includes("\n") && !tokenSeparators.some((separator) => text.includes(separator))) return
          event.preventDefault()
          add(draft + text)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault()
            add(draft)
          }
          if (event.key === "Backspace" && !draft && value.length) onChange?.(value.slice(0, -1))
        }}
        onBlur={() => add(draft)}
        className="h-6 min-w-16 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
      {suggestions.length ? (
        <datalist id={listId}>
          {suggestions.filter((item) => !value.includes(item)).map((item) => <option key={item} value={item} />)}
        </datalist>
      ) : null}
    </div>
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|-]/g, "\\$&")
}

export { TagsInput }
export type { TagsInputProps }
