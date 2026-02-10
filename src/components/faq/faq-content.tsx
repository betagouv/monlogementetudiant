import Link from 'next/link'
import { TFaqQuestionsAnswers } from '~/schemas/faq/faq-questions-answers'

export const FAQ_CONTENTS: TFaqQuestionsAnswers[] = [
  {
    question: 'Quels types de logements sont accessibles aux étudiants ?',
    answer: (
      <>
        <p>Plusieurs options s'offrent à vous :</p>
        <ul>
          <li>
            <p className="fr-m-0">
              <span className="fr-text--bold">Résidences universitaires conventionnées ou à vocation sociale</span>&nbsp;: réservées aux
              étudiants, elles proposent des loyers encadrés, souvent inférieurs aux prix du marché. L’accès est priorisé pour les étudiants
              aux revenus modestes (ex. : boursiers du Crous).
            </p>
            <p className={'fr-text--italic'}>
              Inclut : résidences Crous, logements sociaux gérés directement par les organismes HLM ou bien par des associations.
            </p>
          </li>
          <li>
            <p>
              <span className="fr-text--bold">Résidences services étudiantes</span> également réservées aux étudiants, mais avec des loyers
              non encadrés aujourd’hui. À l’avenir, une offre de résidences-services à loyers intermédiaires (entre les loyers du parc
              locatif social et les loyers du marché locatif libre) se développera.
            </p>
          </li>
          <li>
            <p>
              <span className="fr-text--bold">Location classique</span>&nbsp;: logement indépendant loué auprès d’un particulier ou via une
              agence.
            </p>
          </li>
          <li>
            <p className="fr-m-0">
              <span className="fr-text--bold">Logement chez l’habitant ou intergénérationnel</span>&nbsp;: chambre louée dans un logement
              occupé, souvent avec des loyers réduits.
            </p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: 'Comment comprendre les typologies de logement (T1, T2, studio, etc.) ?',
    answer: (
      <>
        <ul>
          <li>
            <p>
              <span className="fr-text--bold">Studio</span>&nbsp;: une seule pièce à vivre avec une pièce d’eau (salle de bain/WC).
            </p>
          </li>
          <li>
            <p>
              <span className="fr-text--bold">T1</span>&nbsp;: une pièce à vivre + une cuisine séparée + salle de bain/WC.
            </p>
          </li>
          <li>
            <p className="fr-m-0">
              <span className="fr-text--bold">T2, T3...</span>&nbsp;: chaque chiffre supplémentaire correspond à une pièce en plus (ex. : un
              T2 comprend un salon et une chambre).
            </p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: 'Que signifie “loyer charges comprises” ?',
    answer: (
      <>
        <p>Si une annonce indique "cc" (charges comprises), cela signifie que certaines charges sont incluses dans le loyer, comme :</p>
        <ul>
          <li>
            <p>L'entretien des parties communes </p>
          </li>
          <li>
            <p>L'eau froide/chaude, voir l'électricité</p>
          </li>
        </ul>
        <p className="fr-text--italic fr-m-0">⚠️ Vérifiez toujours précisément ce que couvrent les charges avant de signer.</p>
        <p className={'fr-text--italic'}>
          Attention ! Le contrat de location et les quittances doivent toujours bien distinguer le montant du loyer (qui peut être encadré
          s’il s’agit de logements locatifs sociaux ou intermédiaires) et le montant des charges locatives récupérables dont la liste
          limitative est définie par décret. Vous pouvez trouver ces informations sur
          <Link
            target="_blank"
            href="https://www.service-public.fr/particuliers/vosdroits/F947"
            className="fr-link"
            aria-label="service-public.fr, droits F947 (nouvel onglet)"
          >
            &nbsp;https://www.service-public.fr/particuliers/vosdroits/F947
          </Link>
        </p>
      </>
    ),
  },
  {
    question: 'Quelle est la différence entre un logement meublé et non meublé ?',
    answer: (
      <>
        <ul>
          <li>
            <p>
              <span className="fr-text--bold">Meublé</span>&nbsp;: contient un équipement minimum (lit, plaques de cuisson, frigo, etc.).
              Les loyers sont généralement plus élevés.
            </p>
          </li>
          <li>
            <p className="fr-m-0">
              <span className="fr-text--bold">Non meublé</span>&nbsp;: vide ou partiellement équipé, avec un bail souvent plus long (3 ans
              contre 1 an pour un meublé).
            </p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: 'Qu’est-ce que le DPE et le GES ? Pourquoi est-ce important ?',
    answer: (
      <>
        <ul>
          <li>
            <p>
              <span className="fr-text--bold">DPE (Diagnostic de performance énergétique)</span>&nbsp;: indique la consommation énergétique
              du logement (note de A à G).
            </p>
          </li>
          <li>
            <p>
              <span className="fr-text--bold">GES (Gaz à effet de serre) </span>&nbsp;: mesure les émissions liées à l’énergie utilisée.
            </p>
          </li>
        </ul>
        <p className="fr-text--italic fr-m-0">
          👉 Un logement mal noté (E ou F : les logements en G sont interdits à la location depuis janvier 2025, sauf dérogations
          particulières) peut être mal isolé, coûteux à chauffer et inconfortable en été.
        </p>
      </>
    ),
  },
  {
    question: 'Où puis-je trouver ce type de logement étudiant ?',
    answer: (
      <p className="fr-m-0">
        Les résidences universitaires conventionnées et autres logements sociaux sont listés dans la section{' '}
        <span className={'fr-text--italic'}>"Trouver un logement étudiant"</span>
        &nbsp;sur&nbsp;
        <Link href="https://monlogementetudiant.beta.gouv.fr" className="fr-link">
          monlogementetudiant.beta.gouv.fr
        </Link>
      </p>
    ),
  },
  {
    question: 'Quelles aides financières puis-je obtenir pour payer mon loyer ?',
    answer: (
      <>
        <p>Les aides personnelles au logement de la CAF peuvent vous aider à payer votre loyer.</p>
        <p>
          Pour trouver plus d’informations vous pouvez aller sur&nbsp;
          <Link
            target="_blank"
            href="https://www.caf.fr/allocataires/aides-et-demarches/droits-et-prestations/logement/les-aides-personnelles-au-logement"
            className="fr-link"
            aria-label="caf.fr, aides personnelles au logement (nouvel onglet)"
          >
            https://www.caf.fr/allocataires/aides-et-demarches/droits-et-prestations/logement/les-aides-personnelles-au-logement
          </Link>
          &nbsp;et&nbsp;
          <Link
            target="_blank"
            href="https://www.service-public.fr/particuliers/vosdroits/N20360"
            className="fr-link"
            aria-label="service-public.fr, droits N20360 (nouvel onglet)"
          >
            https://www.service-public.fr/particuliers/vosdroits/N20360
          </Link>
        </p>
        <p>D'autres aides peuvent exister (aides locales).</p>
        <p>
          Vous pouvez les tester sur notre simulateur:{' '}
          <Link href="/simuler-mes-aides-au-logement" className="fr-link">
            Simuler mes aides au logement
          </Link>
        </p>
      </>
    ),
  },
  {
    question: 'Ai-je besoin d’un garant pour louer un logement ?',
    answer: (
      <>
        <p>
          Oui, la majorité des bailleurs exigent un garant : une personne (souvent un parent) qui s’engage à payer le loyer si vous ne le
          pouvez pas. Si vous n'en avez pas, vous pouvez faire appel à :
        </p>
        <ul>
          <li>
            <p>
              <span className="fr-text--bold">La grantie Visale</span>&nbsp;(gratuite et publique)&nbsp;
              <Link target="_blank" href="https://www.visale.fr/" className="fr-link" aria-label="visale.fr (nouvel onglet)">
                https://www.visale.fr/
              </Link>
            </p>
          </li>
          <li>
            <p className="fr-m-0">
              <span className="fr-text--bold">Des garanties privées payantes</span>&nbsp;: proposées par certaines plateformes de location.
            </p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: 'Quels documents dois-je fournir pour constituer un dossier de location ?',
    answer: (
      <>
        <p>Un dossier type comprend généralement :</p>
        <ul>
          <li>
            <p>Une pièce d'identité</p>
          </li>
          <li>
            <p>
              Un justificatif de situation étudiante (certificat de scolarité) uniquement pour les logements étudiants (résidences
              universitaires, résidences-services dédiées, pas dans le parc locatif libre)
            </p>
          </li>
          <li>
            <p>Les trois dernières quittances de loyer ou une attestation d’hébergement</p>
          </li>
          <li>
            <p>Un justificatif de ressources (ou ceux du garant)</p>
          </li>
          <li>
            <p className="fr-m-0">Le contrat de travail ou une attestation de bourse, si applicable</p>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: 'Que dois-je vérifier avant de signer un bail ?',
    answer: (
      <>
        <p>Avant de vous engager, pensez à vérifier :</p>
        <ul>
          <li>
            <p>L'état des lieux d'entrée</p>
          </li>
          <li>
            <p>Ce que couvrent exactement les charges</p>
          </li>
          <li>
            <p>La durée du bail et les modalités de résiliation</p>
          </li>
          <li>
            <p>La conformité du logement (surface minimale, équipements obligatoires pour un meublé, etc.)</p>
          </li>
          <li>
            <p className="fr-m-0">L’existence d’une clause de solidarité si vous êtes en colocation</p>
          </li>
        </ul>
      </>
    ),
  },
]
