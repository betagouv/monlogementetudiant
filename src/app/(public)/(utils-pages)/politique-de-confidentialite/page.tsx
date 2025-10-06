import { fr } from '@codegouvfr/react-dsfr'
import { Table } from '@codegouvfr/react-dsfr/Table'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import styles from '../pages.module.css'

export default function PolitiqueDeConfidentialite() {
  return (
    <div className={fr.cx('fr-container')}>
      <DynamicBreadcrumb margin={false} />
      <div className={styles.borderBottom}>
        <h1>Politique de confidentialité</h1>
        <p>
          Mis à jour le <span className={fr.cx('fr-text--bold')}>30/06/25</span>
        </p>
      </div>
      <div className={fr.cx('fr-py-3w')}>
        <div className={styles.content}>
          <p>
            La plateforme <strong>« MonLogementEtudiant »</strong> s'engage au respect des dispositions en vigueur relatives à la protection
            des données à caractère personnel. La présente politique de confidentialité peut être sujette à modification, notamment en
            raison des évolutions législatives et réglementaires.
          </p>
          <p>
            Le responsable de traitement des données est la Direction générale de l'enseignement supérieur et de l'insertion professionnelle
            (DGESIP), représentée par Monsieur Olivier Ginez.
          </p>

          <h2 className={fr.cx('fr-mt-6w', 'fr-mb-2w')}>Pourquoi nous traitons les données ?</h2>
          <p>
            La plateforme recueille différentes informations pour accomplir sa mission. Celle-ci se résume à faciliter l'accès au logement
            des étudiants. Elle effectue des traitements de données à caractère personnel pour :
          </p>
          <ul className={fr.cx('fr-ml-6w')}>
            <li>Envoyer des courriels aux personnes concernées qui souhaitent suivre les actualités ;</li>
            <li>Effectuer des simulations ;</li>
            <li>Permettre aux personnes concernées de contacter la Plateforme.</li>
          </ul>

          <h2 className={fr.cx('fr-mt-6w', 'fr-mb-2w')}>Quelles données traitons nous ?</h2>
          <p>Les données à caractère personnel collectées par la plateforme sont :</p>
          <ul className={fr.cx('fr-ml-6w')}>
            <li>
              <strong>Les données de localisation :</strong> Elles sont collectées afin de proposer des services personnalisés relativement
              aux lieux de recherche ;
            </li>
            <li>
              <strong>Les courriels :</strong> Ces données sont utiles pour contacter les individus en cas de besoin et envoyer des
              Newsletters ;
            </li>
            <li>
              <strong>Les données techniques :</strong> Elles permettent d'offrir un affichage et un fonctionnement optimal des sites ainsi
              que d'établir les statistiques.
            </li>
          </ul>

          <h2 className={fr.cx('fr-mt-6w', 'fr-mb-2w')}>Sur quelle base traitons-nous vos données ?</h2>
          <p>Les traitements sont justifiés car :</p>
          <ul className={fr.cx('fr-ml-6w')}>
            <li>
              Pour les simulations : l'exécution de la mission d'intérêt public (faciliter l'accès au logement des étudiants) relève de
              l'exercice d'une autorité publique
            </li>
            <li>
              Pour l'envoi de courriels et les données techniques : l'intérêt légitime poursuivi par le responsable de traitement autorise
              la collecte des informations nécessaires dans ce sens.
            </li>
          </ul>

          <h2 className={fr.cx('fr-mt-6w', 'fr-mb-2w')}>Quels sont vos droits ?</h2>
          <p>
            Conformément aux dispositions du RGPD et de la loi informatique et libertés, les utilisateurs de la plateforme&nbsp;
            <strong>MonLogementEtudiant</strong> disposent des droits suivants :
          </p>
          <ul className={fr.cx('fr-ml-6w')}>
            <li>Droit à l'information ;</li>
            <li>Droit d'accès ;</li>
            <li>Droit d'effacement ;</li>
            <li>Droit d'opposition et droit de limitation.</li>
          </ul>
          <p>
            Il est toutefois rappelé que l'exercice de ces droits n'est pas absolu, et peut être limité pour des motifs d'intérêts légitime
            ou légaux. Concernant les newsletters, un lien de désinscription accompagne les courriels. En cas d'insatisfaction, en réponse à
            l'un de ces droits, ou en cas de contestation sur l'usage des données, vous avez la possibilité d'adresser les demandes au :
          </p>
          <ul className={fr.cx('fr-ml-6w', 'fr-mb-2w')}>
            <li>
              DPO :&nbsp;
              <a href="mailto:clara@monlogementetudiant.beta.gouv.fr" className={fr.cx('fr-link')}>
                clara@monlogementetudiant.beta.gouv.fr
              </a>
            </li>
            <li>
              À la CNIL :&nbsp;
              <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer" className={fr.cx('fr-link')}>
                https://www.cnil.fr/fr/plaintes
              </a>
            </li>
          </ul>
          <p>
            Pour vous aider dans votre démarche, vous trouverez un modèle de courrier élaboré par la CNIL ici :&nbsp;
            <a
              href="https://www.cnil.fr/fr/modele/courrier/exercer-son-droit-dacces"
              target="_blank"
              rel="noopener noreferrer"
              className={fr.cx('fr-link')}
            >
              https://www.cnil.fr/fr/modele/courrier/exercer-son-droit-dacces
            </a>
          </p>

          <h2 className={fr.cx('fr-mt-6w', 'fr-mb-2w')}>Combien de temps conservons-nous les données ?</h2>
          <Table
            noCaption
            fixed
            headers={['Catégories de données', 'Durée de la conservation']}
            data={[
              ['Données relatives à la géolocalisation', 'Deux mois à partir de la collecte'],
              [
                <>
                  Données relatives au contact
                  <ul className={fr.cx('fr-ml-2w', 'fr-mb-0')}>
                    <li>courriel</li>
                    <li>Newsletter</li>
                  </ul>
                </>,
                '1 an à compter de la réception de la demande ou de la réception de la demande de suppression',
              ],
              ['', "Jusqu'à la demande de retrait à la newsletter"],
              [
                <>
                  Données techniques
                  <br />
                  Cookies et autres
                </>,
                '13 mois',
              ],
            ]}
            className={fr.cx('fr-mb-4w')}
          />

          <h2 className={fr.cx('fr-mt-6w', 'fr-mb-2w')}>Quels sont nos sous-traitants ?</h2>
          <p>
            Les membres de l'équipe de la Plateforme <strong>"MonLogementEtudiant"</strong> ont accès aux données. Hormis ceux-ci, les
            personnes suivantes auront accès aux données :
          </p>
          <Table
            noCaption
            fixed
            headers={['Partenaire', 'Pays destinataire', 'Traitement réalisé', 'Garanties']}
            data={[
              [
                'Scalingo',
                'France',
                'Hébergeur',
                <a
                  href="https://scalingo.com/fr/contrat-gestion-traitements-donnees-personnelles"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={fr.cx('fr-link')}
                >
                  https://scalingo.com/fr/contrat-gestion-traitements-donnees-personnelles
                </a>,
              ],
              [
                'Brevo',
                'France',
                'Emailing',
                <a
                  href="https://www.brevo.com/fr/legal/privacypolicy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={fr.cx('fr-link')}
                >
                  https://www.brevo.com/fr/legal/privacypolicy/
                </a>,
              ],
            ]}
            className={fr.cx('fr-mb-4w')}
          />
          <p>
            Ces accès sont strictement encadrés et juridiquement justifiés. Les données leur sont communiquées au regard de leurs rôles de
            sous-traitants.
          </p>

          <h2 className={fr.cx('fr-mt-6w', 'fr-mb-2w')}>Quelles mesures de sécurité mettons-nous en place ?</h2>
          <p>
            Diverses mesures de sécurité sont prises afin de garantir la sécurité et la confidentialité des données. En plus des techniques
            de contrôle, la plateforme <strong>« MonLogementEtudiant »</strong> utilise le protocole « HyperText Transfer Protocol Secure »,
            plus connu sous l'abréviation HTTPS littéralement « protocole de transfert hypertexte sécurisé ». De manière théorique, ce
            protocole garantit la confidentialité et l'intégrité des données envoyées par l'utilisateur. Les mesures de sécurité définies
            sont les suivantes :
          </p>
          <ul className={fr.cx('fr-ml-6w', 'fr-mb-2w')}>
            <li>Stockage des données en base de données ;</li>
            <li>Cloisonnement des données ;</li>
            <li>Mesures de traçabilité ;</li>
            <li>Surveillance ;</li>
            <li>Protection des réseaux ;</li>
            <li>Sauvegarde ;</li>
            <li>Mesures restrictives limitant l'accès physique aux données à caractère personnel.</li>
          </ul>

          <h2 className={fr.cx('fr-mt-6w', 'fr-mb-2w')}>Cookies</h2>
          <p>
            Un cookie est un fichier déposé sur le terminal lors de la visite d'un site. Il a pour but de collecter des informations
            relatives à votre navigation et de vous adresser des services adaptés à votre terminal (ordinateur, mobile ou tablette). En
            application de l'article 5(3) de la directive 2002/58/CE transposée à l'article 82 de la loi n°78-17 du 6 janvier 1978 relative
            à l'informatique, aux fichiers et aux libertés, les traceurs ou cookies suivent deux régimes distincts.
          </p>
          <p>
            Les cookies n'étant pas strictement nécessaires au service ou n'ayant pas pour finalité exclusive de faciliter la communication
            par voie électronique doivent être consentis par l'utilisateur. Ce consentement de la personne concernée pour une ou plusieurs
            finalités spécifiques constitue une base légale au sens du RGPD et doit être entendu au sens de l'article 6-a du Règlement (UE)
            2016/679 du Parlement européen et du Conseil du 27 avril 2016 relatif à la protection des personnes physiques à l'égard du
            traitement des données à caractère personnel et à la libre circulation de ces données.
          </p>
          <p>
            Certains cookies sont strictement nécessaires au service ou ayant pour finalité exclusive de faciliter la communication par voie
            électronique et sont dispensés de consentement préalable au titre de l'article 82 de la loi n°78-17 du 6 janvier 1978. Des
            cookies relatifs aux statistiques publiques et anonymes sont également déposés. À tout moment, vous pouvez refuser l'utilisation
            des cookies et désactiver le dépôt sur votre ordinateur en utilisant la fonction dédiée de votre navigateur (fonction disponible
            notamment sur Microsoft Internet Explorer 11, Google Chrome, Mozilla Firefox, Apple Safari et Opera).
          </p>
          <p>
            La plateforme utilise également la solution de mesure d'audience Matomo en l'ayant configuré en mode « exempté », conformément
            aux recommandations de la CNIL. Elle ne nécessite donc pas le consentement des personnes concernées.
          </p>
        </div>
      </div>
    </div>
  )
}
