# Changelog

Une entrée = un fichier `AAAA-MM-JJ-slug.md` dans ce dossier. Les entrées sont affichées dans
l'espace d'administration (`/administration/changelog`), triées de la plus récente à la plus ancienne.

Format d'une entrée :

```markdown
---
type: nouveaute            # nouveaute | amelioration | correctif | technique
perimetre: parcours-contact # optionnel : recherche-logement | simulateurs | alertes-logement
                            #             | candidatures | parcours-contact | comptes-acces
                            #             | admin-interne | autre
date: 2026-10-04           # date de mise en production (AAAA-MM-JJ)
---
# Titre court
Description en 1-3 phrases, en français, orientée bénéfice utilisateur.
```

Quand créer une entrée, avec quel ton : voir la section **Changelog** de `CLAUDE.md`.
Une entrée malformée (type hors liste, date invalide, corps vide) est ignorée à l'affichage.
