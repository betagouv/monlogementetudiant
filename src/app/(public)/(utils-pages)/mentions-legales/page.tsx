import { fr } from '@codegouvfr/react-dsfr'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import styles from '../pages.module.css'

export default async function MentionsLegalesPage() {
  const t = await getTranslations('legalMentions')
  const items = [
    {
      description: (
        <>
          Direction générale de l’enseignement supérieur et de l’insertion professionnelle,
          <br />
          Ministère chargé de l’enseignement supérieur et de la recherche.
          <br />1 rue Descartes,
          <br />
          75231 Paris Cedex 05
        </>
      ),
      title: 'Éditeur',
    },
    {
      description: 'Monsieur Olivier Ginez, directeur général',
      title: 'Directeur de publication',
    },
    {
      description: (
        <>
          Le site monlogementetudiant.gouv.fr est hébergé par la société Scalingo SAS, inscrite au RCS (Strasbourg B 808 665 483) et dont
          les serveurs se situent en France.
          <br />
          15 avenue du Rhin
          <br />
          67100 Strasbourg France
          <br />
          Contact :&nbsp;
          <Link href="https://scalingo.com/fr/contact" target="_blank">
            Formulaire de contact Scalingo
          </Link>
        </>
      ),
      title: 'Hébergeur du site',
    },
    {
      title: 'Accessibilité',
      description:
        "La conformité aux normes d'accessibilité numérique est un objectif ultérieur mais nous tâchons de rendre de site accessible à toutes et à tous.",
    },
    {
      title: 'En savoir plus',
      description: (
        <>
          Pour en savoir plus sur la politique d’accessibilité numérique de l’État :&nbsp;
          <Link href="https://accessibilite.numerique.gouv.fr/" target="_blank">
            https://accessibilite.numerique.gouv.fr/
          </Link>
        </>
      ),
    },
    {
      title: 'Sécurité',
      description: (
        <>
          Le site est protégé par un certificat électronique, matérialisé pour la grande majorité des navigateurs par un cadenas. Cette
          protection participe à la confidentialité des échanges. <br />
          En aucun cas, les services associés au site ne seront à l’origine d’envoi de courriels pour demander la saisie d’informations
          personnelles.
        </>
      ),
    },
  ]
  return (
    <div className={fr.cx('fr-container')}>
      <DynamicBreadcrumb margin={false} />
      <div className={styles.borderBottom}>
        <h1>{t('title')}</h1>
        <p>
          Mis à jour le <span className={fr.cx('fr-text--bold')}>30/06/25</span>
        </p>
      </div>
      <div className={fr.cx('fr-py-3w')}>
        <div className={styles.itemsContainer}>
          {items.map((item, index) => (
            <div className={styles.borderBottom} key={index}>
              <h1 className={index !== 0 ? styles.titleMargin : undefined}>{item.title}</h1>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
