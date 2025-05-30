"use client"

import * as React from "react"
import { Button, ButtonProps } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LoadingButtonProps extends ButtonProps {
  /**
   * Whether the button is in a loading state
   */
  isLoading?: boolean
  /**
   * The text to display when the button is in a loading state
   */
  loadingText?: string
  /**
   * The spinner component to display when the button is in a loading state
   */
  spinner?: React.ReactNode
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ 
    className, 
    children, 
    isLoading = false, 
    loadingText, 
    spinner,
    disabled,
    ...props 
  }, ref) => {
    return (
      <Button
        className={cn(className)}
        disabled={disabled || isLoading}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <>
            {spinner || <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"

export { LoadingButton }