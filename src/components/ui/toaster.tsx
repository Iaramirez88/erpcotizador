"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastIcon,
  ToastProgress,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const duration = typeof props.duration === "number" ? props.duration : 5000

        return (
          <Toast key={id} {...props}>
            <ToastIcon variant={props.variant} />
            <div className="grid flex-1 gap-1 pr-2">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? <ToastDescription>{description}</ToastDescription> : null}
            </div>
            {action}
            <ToastClose />
            <ToastProgress variant={props.variant} duration={duration} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}