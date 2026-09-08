'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

/**
 * Astérisque rouge signalant un champ obligatoire. Le caractère est masqué aux technologies
 * d'assistance et doublé d'une mention textuelle : seul, il ne signale rien (RGAA 11.10).
 * Les champs concernés doivent en outre porter `required` ou `aria-required`.
 */
export const RequiredMark = () => {
  const t = useTranslations('accessibility')

  return (
    <>
      <span className="fr-text--bold fr-text-default--error" aria-hidden="true">
        &nbsp;*
      </span>
      <span className="fr-sr-only"> {t('required')}</span>
    </>
  )
}

/** Libellé de champ obligatoire : le texte du label, suivi de l'astérisque. */
export const RequiredLabel = ({ children }: { children: ReactNode }) => (
  <>
    {children}
    <RequiredMark />
  </>
)

/** Mention à placer en tête de formulaire, comme l'exige la convention de l'astérisque. */
export const RequiredFieldsNotice = () => {
  const t = useTranslations('accessibility')

  return <p className="fr-hint-text fr-mb-2w">{t('requiredFieldsNotice')}</p>
}
