import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { Table } from '@codegouvfr/react-dsfr/Table'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { NewWindowHint } from '~/components/ui/new-window'
import styles from '../pages.module.css'

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('metadata')
  return { title: t('privacyPolicy.title'), description: t('privacyPolicy.description') }
}

export default async function PolitiqueDeConfidentialite() {
  const breadcrumbT = await getTranslations('breadcrumbs')
  return (
    <div className="fr-container">
      <Breadcrumb
        currentPageLabel={breadcrumbT('privacyPolicy')}
        homeLinkProps={{ href: '/' }}
        segments={[]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <div className={styles.borderBottom}>
        <h1>Politique de confidentialité</h1>
        <p>
          Mis à jour le <span className="fr-text--bold">25/08/26</span>
        </p>
      </div>
      <div className="fr-py-3w">
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

          <h2 className="fr-mt-6w fr-mb-2w">Pourquoi nous traitons les données ?</h2>
          <p>
            La plateforme recueille différentes informations pour accomplir sa mission. Celle-ci se résume à faciliter l'accès au logement
            des étudiants. Elle effectue des traitements de données à caractère personnel pour :
          </p>
          <ul className="fr-ml-6w">
            <li>Envoyer des courriels aux personnes concernées qui souhaitent suivre les actualités ;</li>
            <li>Effectuer des simulations ;</li>
            <li>Permettre aux personnes concernées de contacter la Plateforme ;</li>
            <li>
              Permettre aux étudiants de transmettre leurs coordonnées aux gestionnaires ayant accepté d'en recevoir pour les recontacter.
            </li>
          </ul>

          <h2 className="fr-mt-6w fr-mb-2w">Quelles données traitons nous ?</h2>
          <p>Les données à caractère personnel collectées par la plateforme sont :</p>
          <ul className="fr-ml-6w">
            <li>
              <strong>Les données de localisation :</strong> Elles sont collectées afin de proposer des services personnalisés relativement
              aux lieux de recherche ;
            </li>
            <li>
              <strong>Les courriels :</strong> Ces données sont utiles pour contacter les individus en cas de besoin et envoyer des
              Newsletters ;
            </li>
            <li>
              <strong>Les numéros de téléphone :</strong> Ces données permettent aux étudiants de les transmettre aux gestionnaires pour
              être recontactés ;
            </li>
            <li>
              <strong>Le statut de boursier :</strong> Elles sont collectées à des fins d'analyses interne et pour être transmise aux
              gestionnaires lorsque l'étudiant demande d'être recontacté pour une résidence.
            </li>
            <li>
              <strong>Le nom, prénom et date de naissance :</strong> Elles ne servent que pour être transmises aux gestionnaires lorsque
              l'étudiant demande d'être recontacté pour une résidence.
            </li>
            <li>
              <strong>L'alternance, l'établissement et l'année d'études :</strong> Elles ne servent qu'à être transmises aux gestionnaires
              lorsque l'étudiant demande à être recontacté pour une résidence. Dans la demande de contact, elles sont effacées 30 jours
              après son dépôt.
            </li>
            <li>
              <strong>Les données techniques :</strong> Elles permettent d'offrir un affichage et un fonctionnement optimal des sites ainsi
              que d'établir les statistiques.
            </li>
            <li>
              <strong>Les données issues de DossierFacile :</strong> Lorsqu'un étudiant choisit de connecter son compte DossierFacile pour
              candidater à une résidence, la plateforme reçoit son identité, le statut de son dossier de location, la liste de ses pièces
              justificatives et de celles de ses garants, ainsi que des liens d'accès à ces pièces. Les pièces elles-mêmes restent hébergées
              par DossierFacile : la plateforme n'en conserve que des métadonnées et des liens, et les documents consultés portent le
              filigrane « Documents exclusivement destinés à la location immobilière ».
            </li>
          </ul>
          <p>
            La connexion à DossierFacile est <strong>facultative</strong>. Les gestionnaires n'accèdent aux pièces d'un candidat que si son
            dossier a été validé par DossierFacile ; si le dossier redevient incomplet, est remis en instruction ou est refusé, l'accès leur
            est retiré immédiatement. L'étudiant peut déconnecter son compte DossierFacile à tout moment depuis son espace personnel, ce qui
            retire ses candidatures et met fin à l'accès des gestionnaires.
          </p>

          <h2 className="fr-mt-6w fr-mb-2w">Sur quelle base traitons-nous vos données ?</h2>
          <p>Les traitements sont justifiés car :</p>
          <ul className="fr-ml-6w">
            <li>
              Pour les simulations : l'exécution de la mission d'intérêt public (faciliter l'accès au logement des étudiants) relève de
              l'exercice d'une autorité publique
            </li>
            <li>
              Pour l'envoi de courriels et les données techniques : l'intérêt légitime poursuivi par le responsable de traitement autorise
              la collecte des informations nécessaires dans ce sens.
            </li>
            <li>Pour des analyses interne d'usage.</li>
            <li>Pour transmettre les coordonnées des étudiants faisant la demande d'être recontacté aux gestionnaires concernés.</li>
            <li>
              Pour les données issues de DossierFacile : le consentement de la personne concernée (article 6.1.a du RGPD), donné lors de la
              connexion du compte DossierFacile et révocable à tout moment depuis l'espace personnel.
            </li>
          </ul>

          <h2 className="fr-mt-6w fr-mb-2w">Quels sont vos droits ?</h2>
          <p>
            Conformément aux dispositions du RGPD et de la loi informatique et libertés, les utilisateurs de la plateforme&nbsp;
            <strong>MonLogementEtudiant</strong> disposent des droits suivants :
          </p>
          <ul className="fr-ml-6w">
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
          <ul className="fr-ml-6w fr-mb-2w">
            <li>
              DPO :&nbsp;
              <a href="mailto:dpo@monlogementetudiant.beta.gouv.fr" className="fr-link">
                dpo@monlogementetudiant.beta.gouv.fr
              </a>
            </li>
            <li>
              À la CNIL :&nbsp;
              <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer" className="fr-link">
                https://www.cnil.fr/fr/plaintes
                <NewWindowHint />
              </a>
            </li>
          </ul>
          <p>
            Pour vous aider dans votre démarche, vous trouverez un modèle de courrier élaboré par la CNIL ici :&nbsp;
            <a
              href="https://www.cnil.fr/fr/modele/courrier/exercer-son-droit-dacces"
              target="_blank"
              rel="noopener noreferrer"
              className="fr-link"
            >
              https://www.cnil.fr/fr/modele/courrier/exercer-son-droit-dacces
              <NewWindowHint />
            </a>
          </p>

          <h2 className="fr-mt-6w fr-mb-2w">Combien de temps conservons-nous les données ?</h2>
          <Table
            noCaption
            fixed
            headers={['Catégories de données', 'Durée de la conservation']}
            data={[
              ['Données relatives à la géolocalisation', 'Deux mois à partir de la collecte'],
              [
                <>
                  Données relatives au contact
                  <ul className="fr-ml-2w fr-mb-0">
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
              [
                <>
                  Données issues de DossierFacile Connect
                  <ul className="fr-ml-2w fr-mb-0">
                    <li>identité et statut du dossier</li>
                    <li>pièces justificatives et liens d'accès</li>
                  </ul>
                </>,
                '30 jours à compter de la dernière candidature, puis effacement des pièces, des liens et du dossier locataire',
              ],
            ]}
            className="fr-mb-4w"
          />

          <h2 className="fr-mt-6w fr-mb-2w">Quels sont nos sous-traitants ?</h2>
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
                  className="fr-link"
                >
                  https://scalingo.com/fr/contrat-gestion-traitements-donnees-personnelles
                  <NewWindowHint />
                </a>,
              ],
              [
                'Brevo',
                'France',
                'Emailing',
                <a href="https://www.brevo.com/fr/legal/privacypolicy/" target="_blank" rel="noopener noreferrer" className="fr-link">
                  https://www.brevo.com/fr/legal/privacypolicy/
                  <NewWindowHint />
                </a>,
              ],
              [
                'DossierFacile',
                'France',
                "Dossier de location numérique de l'État",
                <a
                  href="https://www.dossierfacile.logement.gouv.fr/politique-de-confidentialite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fr-link"
                >
                  https://www.dossierfacile.logement.gouv.fr/politique-de-confidentialite
                  <NewWindowHint />
                </a>,
              ],
            ]}
            className="fr-mb-4w"
          />
          <p>
            Ces accès sont strictement encadrés et juridiquement justifiés. Les données leur sont communiquées au regard de leurs rôles de
            sous-traitants.
          </p>

          <h2 className="fr-mt-6w fr-mb-2w">Quelles mesures de sécurité mettons-nous en place ?</h2>
          <p>
            Diverses mesures de sécurité sont prises afin de garantir la sécurité et la confidentialité des données. En plus des techniques
            de contrôle, la plateforme <strong>« MonLogementEtudiant »</strong> utilise le protocole « HyperText Transfer Protocol Secure »,
            plus connu sous l'abréviation HTTPS littéralement « protocole de transfert hypertexte sécurisé ». De manière théorique, ce
            protocole garantit la confidentialité et l'intégrité des données envoyées par l'utilisateur. Les mesures de sécurité définies
            sont les suivantes :
          </p>
          <ul className="fr-ml-6w fr-mb-2w">
            <li>Stockage des données en base de données ;</li>
            <li>Cloisonnement des données ;</li>
            <li>Mesures de traçabilité ;</li>
            <li>Surveillance ;</li>
            <li>Protection des réseaux ;</li>
            <li>Sauvegarde ;</li>
            <li>Mesures restrictives limitant l'accès physique aux données à caractère personnel.</li>
          </ul>

          <h2 className="fr-mt-6w fr-mb-2w">Cookies</h2>
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
