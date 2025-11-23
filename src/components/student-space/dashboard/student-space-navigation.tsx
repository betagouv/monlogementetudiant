import Button from '@codegouvfr/react-dsfr/Button'

export const StudentSpaceNavigation = () => {
  return (
    <>
      <div className="fr-border-bottom fr-p-3w">
        <Button iconPosition="left" iconId="fr-icon-arrow-left-line" priority="tertiary no outline">
          Retour à l'accueil
        </Button>
      </div>
      <div className="fr-flex fr-direction-column fr-flex-gap-2v fr-p-3w">
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="fr-icon-user-line"
          linkProps={{ href: '/mon-espace/tableau-de-bord' }}
        >
          Tableau de bord
        </Button>
        <Button priority="tertiary no outline" iconPosition="left" iconId="ri-todo-line" linkProps={{ href: '/mon-espace/to-do' }}>
          To-do list
        </Button>
        {/* <Button priority="tertiary no outline" iconPosition="left" iconId="ri-money-euro-circle-line">
          Aides au logement
        </Button> */}
        <Button priority="tertiary no outline" iconPosition="left" iconId="ri-heart-line" linkProps={{ href: '/mon-espace/favoris' }}>
          Favoris
        </Button>
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="ri-notification-3-line"
          linkProps={{ href: '/mon-espace/alertes' }}
        >
          Alertes logements
        </Button>
      </div>
    </>
  )
}
