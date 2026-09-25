'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { LiveRegion } from '~/components/ui/live-region'

type GeolocationButtonProps = {
  onClick: () => void
  isLocating: boolean
  iconOnly?: boolean
  className?: string
}

export const GeolocationButton: FC<GeolocationButtonProps> = ({ onClick, isLocating, iconOnly = false, className }) => {
  const t = useTranslations('geolocation')

  const commonProps = {
    type: 'button' as const,
    iconId: 'ri-crosshair-2-line' as const,
    disabled: isLocating,
    onClick,
    className,
    nativeButtonProps: { 'aria-busy': isLocating },
  }

  return (
    <>
      {iconOnly ? (
        <Button {...commonProps} priority="secondary" title={t('buttonLabel')} />
      ) : (
        <Button {...commonProps} priority="tertiary no outline" size="small" iconPosition="left">
          {isLocating ? t('locating') : t('button')}
        </Button>
      )}
      <LiveRegion message={isLocating ? t('locating') : ''} />
    </>
  )
}
