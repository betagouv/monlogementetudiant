'use client'

import { FC, useEffect, useRef } from 'react'
import { HelpSimulatorForm } from '~/components/helps-simulator/help-simulator-form'
import { HelpSimulatorHeader } from '~/components/helps-simulator/help-simulator-header'

interface HelpSimulatorProps {
  onHeightChange?: (height: number) => void
}

export const HelpSimulator: FC<HelpSimulatorProps> = ({ onHeightChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onHeightChange || !containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onHeightChange(entry.contentRect.height)
      }
    })

    resizeObserver.observe(containerRef.current)

    // Initial height
    onHeightChange(containerRef.current.offsetHeight)

    return () => {
      resizeObserver.disconnect()
    }
  }, [onHeightChange])

  return (
    <div ref={containerRef}>
      <HelpSimulatorHeader />
      <div className="fr-py-5w fr-px-8w">
        <HelpSimulatorForm />
      </div>
    </div>
  )
}
