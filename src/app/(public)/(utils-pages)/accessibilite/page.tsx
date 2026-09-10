import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { NewWindowHint } from '~/components/ui/new-window'
import styles from '../pages.module.css'

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('metadata')
  return { title: t('accessibility.title'), description: t('accessibility.description') }
}

export default async function Accessibilite() {
  const breadcrumbT = await getTranslations('breadcrumbs')
  return (
    <div className="fr-container">
      <Breadcrumb
        currentPageLabel={breadcrumbT('accessibilite')}
        homeLinkProps={{ href: '/' }}
        segments={[]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <div className={styles.borderBottom}>
        <h1>Déclaration d’accessibilité</h1>
        <p>
          Établie le <span className="fr-text--bold">10 septembre 2026</span>.
        </p>
      </div>
      <div className="fr-py-3w">
        <p>
          Le Ministère de l’Enseignement supérieur, de la Recherche et de l’Espace s’engage à rendre son service accessible, conformément à
          l’article 47 de la loi n° 2005-102 du 11 février 2005.
        </p>
        <p>
          Cette déclaration d’accessibilité s’applique à <strong>Mon Logement Étudiant</strong> (
          <a href="https://monlogementetudiant.beta.gouv.fr/" className="fr-link">
            https://monlogementetudiant.beta.gouv.fr/
          </a>
          ).
        </p>

        <h2 className="fr-mt-6w fr-mb-2w">État de conformité</h2>
        <p>
          <strong>Mon Logement Étudiant</strong> est <strong>non conforme</strong> avec le{' '}
          <abbr title="Référentiel général d’amélioration de l’accessibilité">RGAA</abbr>. Le site n’a encore pas été audité.
        </p>

        <h2 className="fr-mt-6w fr-mb-2w">Amélioration et contact</h2>
        <p>
          Si vous n’arrivez pas à accéder à un contenu ou à un service, vous pouvez contacter le responsable de Mon Logement Étudiant pour
          être orienté vers une alternative accessible ou obtenir le contenu sous une autre forme.
        </p>
        <ul className="fr-ml-6w">
          <li>
            E-mail&nbsp;:{' '}
            <a href="mailto:contact@monlogementetudiant.beta.gouv.fr" className="fr-link">
              contact@monlogementetudiant.beta.gouv.fr
            </a>
          </li>
        </ul>

        <h2 className="fr-mt-6w fr-mb-2w">Voie de recours</h2>
        <p>
          Cette procédure est à utiliser dans le cas suivant&nbsp;: vous avez signalé au responsable du site internet un défaut
          d’accessibilité qui vous empêche d’accéder à un contenu ou à un des services du portail et vous n’avez pas obtenu de réponse
          satisfaisante.
        </p>
        <p>Vous pouvez&nbsp;:</p>
        <ul className="fr-ml-6w">
          <li>
            Écrire un message au{' '}
            <a href="https://formulaire.defenseurdesdroits.fr/" target="_blank" rel="noopener noreferrer" className="fr-link">
              Défenseur des droits
              <NewWindowHint />
            </a>
          </li>
          <li>
            Contacter{' '}
            <a href="https://www.defenseurdesdroits.fr/saisir/delegues" target="_blank" rel="noopener noreferrer" className="fr-link">
              le délégué du Défenseur des droits dans votre région
              <NewWindowHint />
            </a>
          </li>
          <li>
            Envoyer un courrier par la poste (gratuit, ne pas mettre de timbre)&nbsp;:
            <br />
            Défenseur des droits
            <br />
            Libre réponse 71120 75342 Paris CEDEX 07
          </li>
        </ul>

        <p className="fr-mt-6w">
          Cette déclaration d’accessibilité a été créée le 10 septembre 2026 grâce au{' '}
          <a
            href="https://betagouv.github.io/a11y-generateur-declaration/#create"
            target="_blank"
            rel="noopener noreferrer"
            className="fr-link"
          >
            Générateur de Déclaration d’Accessibilité
            <NewWindowHint />
          </a>
          .
        </p>
      </div>
    </div>
  )
}
