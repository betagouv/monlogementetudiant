# MLE CLI

Outils en ligne de commande pour le projet Mon Logement Etudiant.

```bash
pnpm cli <command>
```

## Commandes

### `migrate`

Applique les migrations Drizzle.

### `migrate-users`

Migre les utilisateurs Django vers better-auth.

### `import-backup`

Importe un backup Scalingo dans la base locale.

```bash
pnpm cli import-backup <file>
```

### `import <type>`

Import de données depuis différentes sources.

Types disponibles : `arpej-ibail`, `crous`, `csv`, `fac-habitat`, `initiall`

```bash
pnpm cli import csv --file data.csv
pnpm cli import crous
```

### `sync <type>`

Synchronisation de données.

Types disponibles : `cities`, `rents`, `students`, `stats`

```bash
pnpm cli sync cities
```

### `upload-images <dir>`

Upload des images depuis un dossier local vers S3 (un sous-dossier = un groupe).

```bash
pnpm cli upload-images ./images --name acm-habitat
```

### `healthcheck`

Vérifie la cohérence des résidences publiées : présence du `city_id`, validité des slugs, construction des URLs.

```bash
pnpm cli healthcheck
pnpm cli healthcheck --verbose
pnpm cli healthcheck --fetch
pnpm cli healthcheck --fetch --base-url https://monlogementetudiant.beta.gouv.fr
```

Options :

| Option | Description |
|--------|-------------|
| `--verbose` | Affiche le détail de chaque résidence |
| `--fetch` | Teste les URLs en HTTP (nécessite le serveur Next.js) |
| `--base-url <url>` | URL de base pour les tests HTTP (défaut : `http://localhost:3000`) |

Le process exit avec le code `1` si des erreurs sont détectées (city_id manquant, slug absent, URL en 404, etc.).
