'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FC, useEffect, useRef } from 'react'
import { HelpSimulatorForm } from '~/components/helps-simulator/help-simulator-form'
import { HelpSimulatorHeader } from '~/components/helps-simulator/help-simulator-header'
import { useHelpSimulatorStep } from '~/components/helps-simulator/use-help-simulator-step'
import styles from './help-simulator-cta.module.css'

interface HelpSimulatorProps {
  onHeightChange?: (height: number) => void
}

export const HelpSimulator: FC<HelpSimulatorProps> = ({ onHeightChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentStep] = useHelpSimulatorStep()
  const t = useTranslations('simulator.cta')

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

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
    <>
      <div ref={containerRef}>
        <HelpSimulatorHeader />
        <div className="fr-py-5w fr-px-8w">
          <HelpSimulatorForm onScrollToTop={scrollToTop} />
        </div>
      </div>
      {currentStep === 4 && (
        <div className={styles.container}>
          <h2 className={clsx('fr-h3 fr-mb-2w', styles.title)}>
            {t('titleLine1')}
            <br />
            {t('titleLine2')}
          </h2>
          <p className={clsx('fr-text--lg fr-mb-3w', styles.subtitle)}>{t('subtitle')}</p>
          <Button linkProps={{ href: '/trouver-un-logement-etudiant' }} iconId="ri-arrow-right-line" iconPosition="right">
            {t('button')}
          </Button>
        </div>
      )}
    </>
  )
}
