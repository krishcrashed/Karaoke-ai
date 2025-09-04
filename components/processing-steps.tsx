"use client"
import { cn } from "@/lib/utils"

export default function ProcessingSteps({
  steps,
  currentStep,
}: {
  steps: string[]
  currentStep: number
}) {
  return (
    <div className="grid gap-3 min-h-[200px]">
      {steps.map((label, idx) => {
        const isCompleted = idx < currentStep
        const isActive = idx === currentStep
        const shouldShow = isCompleted || isActive

        if (!shouldShow) return <div key={idx} className="h-0" />

        return (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2 transition-all duration-500 ease-in-out",
              "animate-in fade-in slide-in-from-left-4",
              isActive ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/10" : "border-white/10 bg-black/30",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-block size-2 rounded-full transition-colors duration-300",
                isActive ? "bg-[#ec4899] animate-pulse" : isCompleted ? "bg-[#8b5cf6]" : "bg-white/20",
              )}
            />
            <span
              className={cn(
                "text-sm transition-colors duration-300",
                isActive ? "text-white" : isCompleted ? "text-white/90" : "text-white/70",
              )}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
