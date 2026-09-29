import * as React from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type ConfirmPopoverProps = {
  title: React.ReactNode
  description?: React.ReactNode
  okText?: React.ReactNode
  cancelText?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  onConfirm: () => unknown | Promise<unknown>
  onCancel?: () => void
  /** Trigger element; must accept a ref (Button, button, etc.). */
  children: React.ReactElement
}

// Inline confirmation replacing AntD Popconfirm; stays open with a spinner while onConfirm runs.
function ConfirmPopover({ title, description, okText = "确定", cancelText = "取消", danger, disabled, side = "top", align = "center", onConfirm, onCancel, children }: ConfirmPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  if (disabled) return children

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => (busy ? undefined : setOpen(next))}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-72 p-3" onClick={(event) => event.stopPropagation()}>
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div> : null}
        <div className="mt-3 flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              onCancel?.()
            }}
          >
            {cancelText}
          </Button>
          <Button size="sm" variant={danger ? "destructive" : "default"} loading={busy} onClick={() => void confirm()}>
            {okText}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { ConfirmPopover }
export type { ConfirmPopoverProps }
