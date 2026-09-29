import * as React from "react"
import { Check } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type MenuClickInfo = { key: string; domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement> }

type MenuItem =
  | { type: "divider"; key?: string }
  | {
      type?: undefined
      key: string
      label: React.ReactNode
      icon?: React.ReactNode
      danger?: boolean
      disabled?: boolean
      title?: string
      onClick?: (info: MenuClickInfo) => void
      children?: MenuItem[]
    }

type MenuPlacement = "bottom" | "bottomLeft" | "bottomRight" | "top" | "topLeft" | "topRight" | "left" | "right"

type MenuDropdownProps = {
  items: MenuItem[]
  onClick?: (info: MenuClickInfo) => void
  /** Keys rendered with a check mark (AntD menu selectedKeys). */
  selectedKeys?: string[]
  placement?: MenuPlacement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  contentClassName?: string
  /** Trigger element; must accept a ref. */
  children: React.ReactElement
}

const PLACEMENT: Record<MenuPlacement, { side: "top" | "bottom" | "left" | "right"; align: "start" | "center" | "end" }> = {
  bottom: { side: "bottom", align: "center" },
  bottomLeft: { side: "bottom", align: "start" },
  bottomRight: { side: "bottom", align: "end" },
  top: { side: "top", align: "center" },
  topLeft: { side: "top", align: "start" },
  topRight: { side: "top", align: "end" },
  left: { side: "left", align: "start" },
  right: { side: "right", align: "start" },
}

// Data-driven action menu replacing AntD Dropdown menu={{ items, onClick }}.
function MenuDropdown({ items, onClick, selectedKeys, placement = "bottomLeft", open, onOpenChange, disabled, contentClassName, children }: MenuDropdownProps) {
  const { side, align } = PLACEMENT[placement]
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className={cn("min-w-40", contentClassName)}>
        <MenuItems items={items} onClick={onClick} selectedKeys={selectedKeys} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuItems({ items, onClick, selectedKeys }: { items: MenuItem[]; onClick?: (info: MenuClickInfo) => void; selectedKeys?: string[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.type === "divider") return <DropdownMenuSeparator key={item.key ?? `divider-${index}`} />
        if (item.children?.length) {
          return (
            <DropdownMenuSub key={item.key}>
              <DropdownMenuSubTrigger disabled={item.disabled} title={item.title}>
                {item.icon}
                {item.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                <MenuItems items={item.children} onClick={onClick} selectedKeys={selectedKeys} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        }
        const selected = selectedKeys?.includes(item.key)
        return (
          <DropdownMenuItem
            key={item.key}
            disabled={item.disabled}
            title={item.title}
            variant={item.danger ? "destructive" : "default"}
            data-selected={selected || undefined}
            onClick={(event) => {
              const info = { key: item.key, domEvent: event }
              item.onClick?.(info)
              onClick?.(info)
            }}
          >
            {item.icon}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {selected ? <Check className="ml-auto" /> : null}
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

export { MenuDropdown }
export type { MenuClickInfo, MenuDropdownProps, MenuItem, MenuPlacement }
