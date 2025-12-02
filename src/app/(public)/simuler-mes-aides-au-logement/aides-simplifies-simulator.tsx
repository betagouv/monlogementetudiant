'use client'

import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import { FC, useEffect, useRef } from 'react'

interface AidesSimplifiesSimulatorProps {
  onHeightChange?: (height: number) => void
}

export const AIDES_SIMPLIFIEES_IFRAME_ID = 'simulateur-aides'

const AidesSimplifiesSimulator: FC<AidesSimplifiesSimulatorProps> = ({ onHeightChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const script = document.createElement('script')
    script.src = process.env.NEXT_PUBLIC_AIDES_SIMPLIFIEES_IFRAME_URL ?? ''

    const container = containerRef.current
    if (container) {
      const existingIframe = document.getElementById(AIDES_SIMPLIFIEES_IFRAME_ID)
      if (existingIframe) {
        existingIframe.remove()
      }
      container.appendChild(script)
    }
    const observer = new MutationObserver(() => {
      if (container && onHeightChange) {
        onHeightChange(container.offsetHeight)
      }
    })

    if (container) {
      observer.observe(container, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      })
    }

    return () => {
      if (container) {
        container.removeChild(script)
        observer.disconnect()
      }
    }
  }, [onHeightChange])

  return <div ref={containerRef} id="simulator-container" className={clsx(fr.cx('fr-p-4w'))} />
}

export default AidesSimplifiesSimulator
