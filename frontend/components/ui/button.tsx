import * as React from "react"
import { cn } from "../../lib/utils"

type Variant = "primary" | "outline" | "ghost" | "danger" | "secondary" | "link"
type Size = "sm" | "md" | "lg" | "icon"

// Retorno ao toque: leve redução de escala (160 ms, ease-out), só em transform/cor.
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-40"

const variants: Record<Variant, string> = {
  primary: "bg-accent font-bold text-accent-ink hover:bg-accent-hover",
  outline: "border border-line-strong text-ink hover:bg-raised",
  ghost: "text-soft hover:bg-raised hover:text-ink",
  danger: "border border-danger/60 text-danger hover:bg-danger hover:text-canvas",
  secondary: "bg-raised text-ink hover:bg-line",
  link: "text-accent underline-offset-4 hover:underline active:scale-100",
}

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 text-soft hover:text-ink",
}

/** Classes do botão do sistema, para usar também em <Link> e <a>. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra)
}

// Compatibilidade com as variantes antigas do componente
const legacy: Record<string, Variant> = { default: "primary", destructive: "danger", amber: "primary" }
const legacySize: Record<string, Size> = { default: "md" }

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant | "default" | "destructive" | "amber"
  size?: Size | "default"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClass(legacy[variant] ?? (variant as Variant), legacySize[size] ?? (size as Size), className)}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button }
