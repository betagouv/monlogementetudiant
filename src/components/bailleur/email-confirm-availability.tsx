'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import ButtonsGroup from '@codegouvfr/react-dsfr/ButtonsGroup'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { confirmAvailabilityFromEmail } from '~/app/(public)/disponibilites/confirmer/actions'

const RESIDENCES_HREF = '/bailleur/residences'
const LOGIN_HREF = `/gestionnaire/se-connecter?callbackUrl=${encodeURIComponent(RESIDENCES_HREF)}`

export const EmailConfirmLinkFailure = ({ reason }: { reason: 'invalid' | 'expired' }) => {
  const t = useTranslations('bailleur.emailConfirmAvailability')
  return (
    <>
      <Alert
        severity={reason === 'expired' ? 'warning' : 'error'}
        title={t(reason === 'expired' ? 'expiredTitle' : 'invalidTitle')}
        description={t('loginDescription')}
      />
      <Button className="fr-mt-4w" linkProps={{ href: LOGIN_HREF }}>
        {t('login')}
      </Button>
    </>
  )
}

export const EmailConfirmAvailabilityForm = () => {
  const t = useTranslations('bailleur.emailConfirmAvailability')
  const [state, formAction, isPending] = useActionState(confirmAvailabilityFromEmail, null)

  if (state?.status === 'failure') return <EmailConfirmLinkFailure reason={state.reason} />

  if (state?.status === 'success') {
    const upToDate = state.confirmed === 0
    return (
      <>
        <Alert
          severity={upToDate ? 'info' : 'success'}
          title={upToDate ? t('upToDateTitle') : t('successTitle', { count: state.confirmed })}
          description={
            upToDate
              ? t('upToDateDescription')
              : [t('successDescription'), state.skipped > 0 ? t('skippedDescription', { count: state.skipped }) : null]
                  .filter(Boolean)
                  .join(' ')
          }
        />
        <Button className="fr-mt-4w" priority="secondary" linkProps={{ href: RESIDENCES_HREF }}>
          {t('update')}
        </Button>
      </>
    )
  }

  return (
    <form action={formAction}>
      {state?.status === 'error' && <Alert className="fr-mb-4w" severity="error" small description={t('error')} />}
      <ButtonsGroup
        inlineLayoutWhen="md and up"
        buttons={[
          { children: t('confirm'), iconId: 'ri-check-line', type: 'submit', disabled: isPending },
          { children: t('update'), priority: 'secondary', linkProps: { href: RESIDENCES_HREF } },
        ]}
      />
    </form>
  )
}
