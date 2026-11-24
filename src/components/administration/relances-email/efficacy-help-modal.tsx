'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { EReminderType, REMINDER_TYPE_LABELS } from '~/enums/reminder-email'

const efficacyHelpModal = createModal({ id: 'reminder-efficacy-help-modal', isOpenedByDefault: false })

const DEFINITIONS: { type: EReminderType; effective: string; pending: string; failed: string }[] = [
  {
    type: EReminderType.AVAILABILITY_MONTHLY_RECAP,
    effective: 'le gestionnaire a mis à jour ou confirmé les disponibilités de toutes les résidences citées dans le mois.',
    pending: "le mois n'est pas écoulé et au moins une résidence n'a pas encore été mise à jour.",
    failed: "au moins une résidence n'a pas été mise à jour dans le mois, ou ses disponibilités ont été remises à zéro automatiquement.",
  },
  {
    type: EReminderType.AVAILABILITY_RESET_WARNING,
    effective: 'le gestionnaire a mis à jour ou confirmé les disponibilités de toutes les résidences citées sous 7 jours.',
    pending: "les 7 jours ne sont pas écoulés et au moins une résidence n'a pas encore été mise à jour.",
    failed: "au moins une résidence n'a pas été mise à jour à temps et ses disponibilités ont été remises à zéro automatiquement.",
  },
  {
    type: EReminderType.APPLICATIONS_INACTIVITY_WARNING,
    effective: 'le gestionnaire a répondu sous 7 jours à toutes les candidatures en attente des résidences citées.',
    pending: 'les 7 jours ne sont pas écoulés et des candidatures attendent encore une réponse.',
    failed:
      'des candidatures sont restées sans réponse après 7 jours, ou les candidatures de la résidence ont été suspendues automatiquement.',
  },
]

export const EfficacyHelpModal = () => (
  <>
    <Button
      priority="tertiary no outline"
      size="small"
      iconId="fr-icon-question-line"
      iconPosition="left"
      nativeButtonProps={efficacyHelpModal.buttonProps}
    >
      Comment l&apos;efficacité est-elle calculée ?
    </Button>
    <efficacyHelpModal.Component title="Comment l'efficacité est-elle calculée ?" size="large">
      <p>
        L&apos;efficacité mesure si le gestionnaire a fait ce que la relance lui demandait, pas seulement s&apos;il a ouvert l&apos;e-mail.
      </p>
      {DEFINITIONS.map(({ type, effective, pending, failed }) => (
        <section key={type} className="fr-mb-3w">
          <h2 className="fr-h6 fr-mb-1w">{REMINDER_TYPE_LABELS[type]}</h2>
          <ul className="fr-mb-0">
            <li>
              <strong>Efficace</strong> : {effective}
            </li>
            <li>
              <strong>En cours</strong> : {pending}
            </li>
            <li>
              <strong>En échec</strong> : {failed}
            </li>
          </ul>
        </section>
      ))}
      <p className="fr-mb-0">
        Les autres relances (disponibilités repassées en « non communiquée », suspension automatique) sont de simples notifications : leur
        efficacité n&apos;est pas mesurée et s&apos;affiche « — ». Le taux d&apos;efficacité est calculé sur les relances efficaces et en
        échec, sans compter celles en cours.
      </p>
    </efficacyHelpModal.Component>
  </>
)
