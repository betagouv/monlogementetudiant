import { ChangelogList } from './changelog-list'

export const metadata = {
  title: 'Changelog - Administration',
}

export default function ChangelogPage() {
  return (
    <>
      <h1 className="fr-h3 fr-mb-1w">Changelog</h1>
      <p className="fr-text--sm fr-mb-3w">
        Historique des évolutions notables du produit. Les entrées proviennent des fichiers <code>changelog/</code> du dépôt.
      </p>
      <ChangelogList />
    </>
  )
}
