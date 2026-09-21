'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { useStartImpersonation } from '~/hooks/use-impersonation'

type Props = {
  userId: string
  isSelf?: boolean

  compact?: boolean
}

export const ImpersonateUserButton = ({ userId, isSelf = false, compact = false }: Props) => {
  const t = useTranslations('impersonation')
  const { startImpersonation, isPending } = useStartImpersonation()

  const title = isSelf ? t('cannotImpersonateSelf') : t('impersonateHint')
  const disabled = isSelf || isPending
  const onClick = () => startImpersonation(userId)

  if (compact) {
    return (
      <Button
        priority="tertiary no outline"
        size="small"
        iconId="ri-shield-user-line"
        title={title}
        disabled={disabled}
        onClick={onClick}
      />
    )
  }

  return (
    <Button priority="secondary" size="small" iconId="ri-shield-user-line" title={title} disabled={disabled} onClick={onClick}>
      {t('impersonate')}
    </Button>
  )
}
