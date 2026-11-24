import { RecettesList } from './recettes-list'

export const metadata = {
  title: 'Recettes - Administration',
}

export default function RecettesPage() {
  return (
    <>
      <h1 className="fr-h3 fr-mb-1w">Recettes</h1>
      <p className="fr-text--sm fr-mb-3w">
        Vidéos des parcours critiques rejoués automatiquement sur l'environnement de production (tests smoke). Chaque recette correspond à
        un passage complet de la suite.
      </p>
      <RecettesList />
    </>
  )
}
