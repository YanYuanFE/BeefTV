import * as React from "react"

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ConfirmDialogOptions = {
  title?: React.ReactNode
  content?: React.ReactNode
  okText?: React.ReactNode
  cancelText?: React.ReactNode
  okButtonProps?: { danger?: boolean; disabled?: boolean }
  /** A returned promise keeps the dialog open with a spinner until it settles. */
  onOk?: () => unknown | Promise<unknown>
  onCancel?: () => void
  afterClose?: () => void
  /** Hide the cancel button (notice-style dialog). */
  hideCancel?: boolean
  /** false disables closing with Escape. */
  keyboard?: boolean
  className?: string
}

type Entry = ConfirmDialogOptions & { id: number }

let nextId = 1
let entries: Entry[] = []
const listeners = new Set<() => void>()

function publish(next: Entry[]) {
  entries = next
  listeners.forEach((listener) => listener())
}

/** Imperative confirmation replacing AntD modal.confirm; requires <ConfirmDialogHost /> mounted once. */
function confirmDialog(options: ConfirmDialogOptions) {
  const id = nextId++
  publish([...entries, { ...options, id }])
  return { destroy: () => publish(entries.filter((entry) => entry.id !== id)) }
}

/** Notice dialog with a single acknowledge button (AntD modal.warning). */
function warningDialog(options: ConfirmDialogOptions) {
  return confirmDialog({ okText: "知道了", ...options, hideCancel: true })
}

function ConfirmDialogHost() {
  const current = React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => entries,
    () => entries,
  )
  return (
    <>
      {current.map((entry) => (
        <ConfirmDialogView key={entry.id} entry={entry} />
      ))}
    </>
  )
}

function ConfirmDialogView({ entry }: { entry: Entry }) {
  const [open, setOpen] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  const close = () => {
    setOpen(false)
    // Unmount after the exit transition; a timer works with reduced motion too.
    window.setTimeout(() => {
      publish(entries.filter((item) => item.id !== entry.id))
      entry.afterClose?.()
    }, 200)
  }
  const cancel = () => {
    if (busy) return
    close()
    entry.onCancel?.()
  }
  const ok = () => {
    const result = entry.onOk?.()
    if (!(result instanceof Promise)) {
      close()
      return
    }
    setBusy(true)
    result.then(
      () => close(),
      (error: unknown) => {
        // Matches AntD: a rejected onOk keeps the dialog open; the error still surfaces.
        setBusy(false)
        throw error
      },
    )
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) cancel()
      }}
    >
      <AlertDialogContent
        className={cn(entry.className)}
        onEscapeKeyDown={(event) => {
          if (entry.keyboard === false || busy) event.preventDefault()
        }}
      >
        <AlertDialogHeader>
          {entry.title ? <AlertDialogTitle>{entry.title}</AlertDialogTitle> : <AlertDialogTitle className="sr-only">确认</AlertDialogTitle>}
          {entry.content ? <AlertDialogDescription asChild><div>{entry.content}</div></AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!entry.hideCancel ? (
            <Button variant="outline" disabled={busy} onClick={cancel}>
              {entry.cancelText ?? "取消"}
            </Button>
          ) : null}
          <Button variant={entry.okButtonProps?.danger ? "destructive" : "default"} disabled={entry.okButtonProps?.disabled} loading={busy} onClick={ok}>
            {entry.okText ?? "确定"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { confirmDialog, ConfirmDialogHost, warningDialog }
export type { ConfirmDialogOptions }
