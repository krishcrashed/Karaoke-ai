"use client"

export default function PulsingLights() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <div className="lights-container size-full" />
    </div>
  )
}
