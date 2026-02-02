'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { FC } from 'react'
import { type AidResult } from './aid-calculator'
import styles from './aid-card.module.css'

const AID_LOGOS: Record<string, string> = {
  'caf-aides-logement': '/images/caf.svg',
  visale: '/images/visale.svg',
  'mobili-jeune': '/images/al.svg',
  'loca-pass': '/images/al.svg',
  'crous-mobilite': '/images/logo-crous.svg',
}

const AID_LINKS: Record<string, string> = {
  'caf-aides-logement':
    'https://www.caf.fr/allocataires/aides-et-demarches/droits-et-prestations/logement/les-aides-personnelles-au-logement',
  visale: 'https://www.visale.fr/',
  'mobili-jeune': 'https://mobilijeune.actionlogement.fr/eligibilite',
  'loca-pass': 'https://www.actionlogement.fr/l-avance-loca-pass',
  'crous-mobilite': 'https://www.etudiant.gouv.fr/fr/aides-specifiques-702',
}

const POTENTIALLY_ELIGIBLE_AIDS = ['caf-aides-logement', 'mobili-jeune']

interface AidCardProps {
  aid: AidResult
}

export const AidCard: FC<AidCardProps> = ({ aid }) => {
  const logo = AID_LOGOS[aid.id]
  const link = AID_LINKS[aid.id]
  const isPotentiallyEligible = POTENTIALLY_ELIGIBLE_AIDS.includes(aid.id)

  return (
    <div className={clsx('fr-p-3w fr-flex fr-direction-column fr-border', styles.card)}>
      <div className="fr-flex fr-justify-content-space-between fr-align-items-start">
        <div className={styles.content}>
          <h3 className={clsx('fr-text--lg fr-mb-1v', styles.title)}>{aid.name}</h3>
          {aid.isEligible ? (
            <p className={clsx('fr-flex fr-align-items-center fr-mb-0', styles.eligibleText)}>
              <span className="ri-thumb-up-line" aria-hidden="true" />
              {isPotentiallyEligible ? 'Vous êtes potentiellement éligible' : 'Vous êtes éligible'}
            </p>
          ) : (
            <p className={clsx('fr-flex fr-align-items-center fr-mb-0', styles.ineligibleText)}>
              <span className="ri-thumb-down-line" aria-hidden="true" />
              {aid.ineligibilityReason}
            </p>
          )}
        </div>
        {logo && (
          <div className={styles.logoContainer}>
            <Image src={logo} alt="" width={48} height={48} className={styles.logo} />
          </div>
        )}
      </div>

      {aid.isEligible && aid.warningMessage && (
        <div className={clsx('fr-flex fr-align-items-start fr-flex-gap-2v fr-p-2v', styles.warningBox)}>
          <span className="ri-alert-line" aria-hidden="true" />
          <span className="fr-text--sm fr-mb-0">{aid.warningMessage}</span>
        </div>
      )}

      <p className={clsx('fr-text--sm fr-mb-0', styles.description)}>{aid.description}</p>

      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mt-1w">
        {aid.isEligible && aid.amountLabel ? (
          <div className={clsx('fr-px-2v fr-py-1v', styles.amountBadge)}>
            <span className={styles.amountLabel}>{aid.amountLabel}</span>
          </div>
        ) : (
          <div />
        )}
        {link && (
          <Button
            size="small"
            priority="secondary"
            iconId="ri-external-link-line"
            iconPosition="right"
            linkProps={{ href: link, target: '_blank', rel: 'noopener noreferrer' }}
          >
            {aid.isEligible ? "Demander l'aide" : 'En savoir plus'}
          </Button>
        )}
      </div>
    </div>
  )
}
