import { useTranslations } from 'next-intl'
import type { TContactDetail } from '~/schemas/contacts/contact-detail'
import { computeAge } from '~/utils/date-helpers'

const Line = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <li className="fr-flex fr-align-items-center fr-flex-gap-1v">
    <span className={icon} aria-hidden="true" />
    <span>{children}</span>
  </li>
)

export const ContactDetailAbout = ({ contact }: { contact: TContactDetail }) => {
  const t = useTranslations('bailleur.contacts.detail')
  const age = computeAge(contact.studentBirthdate)

  return (
    <>
      <h2 className="fr-h4 fr-mb-3w">{t('aboutTitle')}</h2>

      <ul className="fr-raw-list fr-flex fr-direction-column fr-flex-gap-6v">
        {contact.studentEmail && (
          <Line icon="ri-mail-line">
            <a className="fr-link" href={`mailto:${contact.studentEmail}`}>
              {contact.studentEmail}
            </a>
          </Line>
        )}
        {contact.studentPhone && (
          <Line icon="ri-phone-line">
            <a className="fr-link" href={`tel:${contact.studentPhone}`}>
              {contact.studentPhone}
            </a>
          </Line>
        )}
        {age !== null && <Line icon="ri-calendar-line">{t('age', { count: age })}</Line>}
        {contact.scholarshipStatus === 'yes' && <Line icon="ri-money-euro-circle-line">{t('scholarship')}</Line>}
      </ul>
    </>
  )
}
