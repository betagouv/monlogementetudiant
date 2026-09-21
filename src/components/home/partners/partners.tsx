import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import etudiantgouv from '~/images/etudiantgouv.svg'
import crous from '~/images/logo-crous.svg'
import messervices from '~/images/messervices.svg'
import monmaster from '~/images/monmaster.svg'
import parcourssup from '~/images/parcourssup.svg'
import styles from './partners.module.css'

export const PartnersSection = async () => {
  const tHome = await getTranslations('home')
  const logos = [
    { src: parcourssup, name: 'ParcoursSup' },
    { src: etudiantgouv, name: 'Etudiant.gouv.fr' },
    { src: crous, name: 'CROUS' },
    { src: messervices, name: 'MesServices.etudiant.gouv.fr' },
    { src: monmaster, name: 'MonMaster' },
  ]

  return (
    <section className="fr-py-md-8w fr-py-4w fr-background-default--grey fr-border-top">
      <div className="fr-container fr-flex fr-direction-column fr-justify-content-center fr-align-items-center fr-flex-gap-4v">
        <span className="fr-text--center">
          {tHome.rich('institutionalPartners.label', { bold: (chunks) => <strong>{chunks}</strong> })}
        </span>
        <div className="fr-flex fr-direction-column fr-direction-sm-row fr-justify-content-space-between">
          {logos.map((logo) => (
            <div key={logo.name} className={styles.partnerLogoItem}>
              <Image
                src={logo.src}
                width={243}
                height={109}
                alt={tHome('logoAlt', { name: logo.name })}
                className={styles.partnerLogoImage}
                quality={100}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
