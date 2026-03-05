import Button from '@codegouvfr/react-dsfr/Button'

export const AdminNavigation = () => {
  return (
    <>
      <div className="fr-border-bottom fr-p-3w">
        <Button iconPosition="left" iconId="fr-icon-arrow-left-line" priority="tertiary no outline" linkProps={{ href: '/' }}>
          Retour a l'accueil
        </Button>
      </div>
      <div className="fr-flex fr-direction-column fr-flex-gap-2v fr-p-3w">
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="fr-icon-dashboard-3-line"
          linkProps={{ href: '/administration/tableau-de-bord' }}
        >
          Tableau de bord
        </Button>
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="fr-icon-user-line"
          linkProps={{ href: '/administration/utilisateurs' }}
        >
          Utilisateurs
        </Button>
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="fr-icon-school-line"
          linkProps={{ href: '/administration/utilisateurs?role=user' }}
        >
          Comptes etudiants
        </Button>
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="fr-icon-building-line"
          linkProps={{ href: '/administration/bailleurs' }}
        >
          Comptes bailleurs
        </Button>
        <Button
          priority="tertiary no outline"
          iconPosition="left"
          iconId="fr-icon-line-chart-line"
          linkProps={{ href: '/administration/tableau-de-bord' }}
        >
          Statistiques
        </Button>
      </div>
    </>
  )
}
