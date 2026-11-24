'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { TReceptionManager } from '~/schemas/contacts/contact-reception-settings'
import { MAX_APPLICANT_AGE } from '~/utils/applicant-age'
import { buildHref } from '~/utils/preserve-query-params'
import { ManagerCombobox } from './manager-combobox'

type Props = {
  accommodationId: number
  ownerId: number
  hasGestionnaires: boolean
  managers: TReceptionManager[]
  onManagersChange: (managers: TReceptionManager[]) => void
  managersError?: string
  acceptWaitingList: boolean
  onAcceptWaitingListChange: (checked: boolean) => void
  rejectsOverMaxAge: boolean
  onRejectsOverMaxAgeChange: (checked: boolean) => void
}

export const ResidenceReceptionTab = ({
  accommodationId,
  ownerId,
  hasGestionnaires,
  managers,
  onManagersChange,
  managersError,
  acceptWaitingList,
  onAcceptWaitingListChange,
  rejectsOverMaxAge,
  onRejectsOverMaxAgeChange,
}: Props) => {
  const t = useTranslations('bailleur.contacts.receptionSettings')
  const searchParams = useSearchParams()

  return (
    <>
      {hasGestionnaires ? (
        <ManagerCombobox
          id={`gestionnaires-${accommodationId}`}
          ownerId={ownerId}
          value={managers}
          onChange={onManagersChange}
          error={managersError}
        />
      ) : (
        <Alert
          severity="info"
          small
          description={
            <>
              <p className="fr-mb-2w">{t('noGestionnaire')}</p>
              <Button
                size="small"
                priority="secondary"
                iconId="ri-add-line"
                linkProps={{ href: buildHref('/bailleur/utilisateurs', searchParams) }}
              >
                {t('addUser')}
              </Button>
            </>
          }
        />
      )}

      <hr className="fr-mt-4w fr-pb-4w" />

      <ToggleSwitch
        label={t('waitingListLabel')}
        helperText={t('waitingListHint')}
        inputTitle={t('waitingListLabel')}
        checked={acceptWaitingList}
        onChange={onAcceptWaitingListChange}
        showCheckedHint={false}
        labelPosition="left"
      />

      <hr className="fr-mt-3w fr-pb-3w" />

      <ToggleSwitch
        label={t('rejectsOverMaxAgeLabel', { age: MAX_APPLICANT_AGE })}
        helperText={t('rejectsOverMaxAgeHint')}
        inputTitle={t('rejectsOverMaxAgeLabel', { age: MAX_APPLICANT_AGE })}
        checked={rejectsOverMaxAge}
        onChange={onRejectsOverMaxAgeChange}
        showCheckedHint={false}
        labelPosition="left"
      />
    </>
  )
}
