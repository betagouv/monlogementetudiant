import Link from 'next/link'
import type { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { NewWindowHint } from '~/components/ui/new-window'
import { TFaqQuestionsAnswers } from '~/schemas/faq/faq-questions-answers'

type TFaqContentsTranslator = Awaited<ReturnType<typeof getTranslations<'faq.contents'>>>

const bold = (chunks: ReactNode) => <span className="fr-text--bold">{chunks}</span>

const externalLink = (href: string) => () => (
  <Link target="_blank" href={href} className="fr-link">
    {href}
    <NewWindowHint />
  </Link>
)

export const getFaqContents = (t: TFaqContentsTranslator): TFaqQuestionsAnswers[] => [
  {
    question: t('housingTypes.question'),
    answer: (
      <>
        <p>{t('housingTypes.intro')}</p>
        <ul>
          <li>
            <p className="fr-m-0">{t.rich('housingTypes.conventionne', { b: bold })}</p>
            <p className={'fr-text--italic'}>{t('housingTypes.conventionneIncludes')}</p>
          </li>
          <li>
            <p>{t.rich('housingTypes.services', { b: bold })}</p>
          </li>
          <li>
            <p>{t.rich('housingTypes.classic', { b: bold })}</p>
          </li>
          <li>
            <p className="fr-m-0">{t.rich('housingTypes.homestay', { b: bold })}</p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: t('typologies.question'),
    answer: (
      <>
        <ul>
          <li>
            <p>{t.rich('typologies.studio', { b: bold })}</p>
          </li>
          <li>
            <p>{t.rich('typologies.t1', { b: bold })}</p>
          </li>
          <li>
            <p className="fr-m-0">{t.rich('typologies.t2t3', { b: bold })}</p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: t('chargesIncluded.question'),
    answer: (
      <>
        <p>{t('chargesIncluded.intro')}</p>
        <ul>
          <li>
            <p>{t('chargesIncluded.commonAreas')}</p>
          </li>
          <li>
            <p>{t('chargesIncluded.water')}</p>
          </li>
        </ul>
        <p className="fr-text--italic fr-m-0">{t('chargesIncluded.warning')}</p>
        <p className={'fr-text--italic'}>
          {t('chargesIncluded.legal')}
          <Link target="_blank" href="https://www.service-public.fr/particuliers/vosdroits/F947" className="fr-link">
            &nbsp;https://www.service-public.fr/particuliers/vosdroits/F947
            <NewWindowHint />
          </Link>
        </p>
      </>
    ),
  },
  {
    question: t('furnished.question'),
    answer: (
      <>
        <ul>
          <li>
            <p>{t.rich('furnished.furnished', { b: bold })}</p>
          </li>
          <li>
            <p className="fr-m-0">{t.rich('furnished.unfurnished', { b: bold })}</p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: t('energyPerformance.question'),
    answer: (
      <>
        <ul>
          <li>
            <p>{t.rich('energyPerformance.dpe', { b: bold })}</p>
          </li>
          <li>
            <p>{t.rich('energyPerformance.ges', { b: bold })}</p>
          </li>
        </ul>
        <p className="fr-text--italic fr-m-0">{t('energyPerformance.note')}</p>
      </>
    ),
  },
  {
    question: t('whereToFind.question'),
    answer: (
      <p className="fr-m-0">
        {t.rich('whereToFind.answer', {
          i: (chunks) => <span className={'fr-text--italic'}>{chunks}</span>,
          link: (chunks) => (
            <Link href="https://monlogementetudiant.beta.gouv.fr" className="fr-link">
              {chunks}
            </Link>
          ),
        })}
      </p>
    ),
  },
  {
    question: t('financialAid.question'),
    answer: (
      <>
        <p>{t('financialAid.cafAids')}</p>
        <p>
          {t.rich('financialAid.moreInfo', {
            cafLink: externalLink(
              'https://www.caf.fr/allocataires/aides-et-demarches/droits-et-prestations/logement/les-aides-personnelles-au-logement',
            ),
            servicePublicLink: externalLink('https://www.service-public.fr/particuliers/vosdroits/N20360'),
          })}
        </p>
        <p>{t('financialAid.localAids')}</p>
        <p>
          {t.rich('financialAid.simulator', {
            link: (chunks) => (
              <Link href="/simuler-mes-aides-au-logement" className="fr-link">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </>
    ),
  },
  {
    question: t('guarantor.question'),
    answer: (
      <>
        <p>{t('guarantor.intro')}</p>
        <ul>
          <li>
            <p>{t.rich('guarantor.visale', { b: bold, link: externalLink('https://www.visale.fr/') })}</p>
          </li>
          <li>
            <p className="fr-m-0">{t.rich('guarantor.private', { b: bold })}</p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: t('documents.question'),
    answer: (
      <>
        <p>{t('documents.intro')}</p>
        <ul>
          <li>
            <p>{t('documents.identity')}</p>
          </li>
          <li>
            <p>{t('documents.studentStatus')}</p>
          </li>
          <li>
            <p>{t('documents.rentReceipts')}</p>
          </li>
          <li>
            <p>{t('documents.income')}</p>
          </li>
          <li>
            <p className="fr-m-0">{t('documents.contract')}</p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: t('beforeSigning.question'),
    answer: (
      <>
        <p>{t('beforeSigning.intro')}</p>
        <ul>
          <li>
            <p>{t('beforeSigning.inventory')}</p>
          </li>
          <li>
            <p>{t('beforeSigning.charges')}</p>
          </li>
          <li>
            <p>{t('beforeSigning.leaseDuration')}</p>
          </li>
          <li>
            <p>{t('beforeSigning.compliance')}</p>
          </li>
          <li>
            <p className="fr-m-0">{t('beforeSigning.solidarityClause')}</p>
          </li>
        </ul>
      </>
    ),
  },
]
