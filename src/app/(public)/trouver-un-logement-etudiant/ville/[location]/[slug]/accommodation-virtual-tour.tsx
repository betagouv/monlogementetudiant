'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { parseVirtualTour } from '~/utils/virtual-tour'
import styles from './logement.module.css'

const FRAME_STYLE = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 } as const
const RATIO_STYLE = { position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' } as const

/**
 * Le cadre n'obtient que ce dont une visite 3D ou une vidéo a besoin : exécuter ses scripts, ouvrir un
 * lien dans un nouvel onglet, passer en plein écran. Il ne peut ni rediriger la page, ni soumettre de
 * formulaire, ni déclencher de téléchargement. Les attributs du code d'intégration collé par le
 * bailleur ne sont jamais repris.
 */
const FRAME_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'
const FRAME_ALLOW = 'fullscreen; xr-spatial-tracking; accelerometer; gyroscope; autoplay'

const OpenLinkButton = ({ href }: { href: string }) => {
  const t = useTranslations('accomodation')
  const tA11y = useTranslations('accessibility')
  return (
    <Button
      iconId="ri-external-link-line"
      iconPosition="right"
      priority="secondary"
      linkProps={{
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: tA11y('linkNewWindow', { label: t('virtualTour.openLink') }),
      }}
    >
      {t('virtualTour.openLink')}
    </Button>
  )
}

const VideoPlayer = ({ src }: { src: string }) => {
  const [videoError, setVideoError] = useState(false)

  if (videoError) return <OpenLinkButton href={src} />

  return (
    <div style={RATIO_STYLE}>
      <video controls preload="metadata" style={FRAME_STYLE} onError={() => setVideoError(true)}>
        <source src={src} />
      </video>
    </div>
  )
}

const TourEmbed = ({ src }: { src: string }) => {
  const t = useTranslations('accomodation')
  const [iframeError, setIframeError] = useState(false)

  if (iframeError) return <OpenLinkButton href={src} />

  return (
    <div style={RATIO_STYLE}>
      <iframe
        src={src}
        title={t('virtualTour.frameTitle')}
        sandbox={FRAME_SANDBOX}
        allow={FRAME_ALLOW}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={FRAME_STYLE}
        onError={() => setIframeError(true)}
      />
    </div>
  )
}

export const AccommodationVirtualTour = ({ url }: { url: string | null }) => {
  const t = useTranslations('accomodation')

  // Une URL hors liste blanche, y compris déjà enregistrée en base, n'est pas affichée.
  const tour = parseVirtualTour(url)
  if (!tour) return null

  return (
    <div className={styles.section}>
      <h3 className="fr-h4">{t('virtualTour.title')}</h3>
      {tour.type === 'video' ? <VideoPlayer src={tour.src} /> : <TourEmbed src={tour.src} />}
    </div>
  )
}
