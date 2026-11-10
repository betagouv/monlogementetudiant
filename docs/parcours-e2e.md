# Parcours couverts par les tests e2e

## Accès aux espaces connectés — 5 scénarios

- refuse l'espace étudiant à un visiteur non connecté
- ouvre l'espace étudiant à un étudiant connecté
- redirige un visiteur non connecté de l'espace gestionnaire vers la connexion
- refuse l'espace gestionnaire à un étudiant
- ouvre l'espace gestionnaire à un bailleur connecté

## Confirmer ses disponibilités — 2 scénarios

- confirme en un clic les résidences relancées
- redirige un gestionnaire non connecté vers la connexion en conservant la page

## Créer une résidence — 2 scénarios

- signale les champs obligatoires manquants
- crée une résidence et la retrouve dans la liste

## Mettre à jour ses disponibilités depuis la liste des résidences — 3 scénarios

- enregistre les disponibilités d’une résidence
- propose de confirmer toutes les résidences en une fois
- ne confirme que la résidence modifiée si le gestionnaire le choisit

## Publier et dépublier une résidence — 1 scénario

- retire la résidence de la recherche puis l’y remet

## Enquête flash boursiers — 5 scénarios

- invite à répondre, garde le brouillon et ne relance plus une fois complétée
- ne propose plus l’enquête à un bailleur qui l’a complétée, mais la laisse modifiable
- enregistre la saisie en brouillon quand on quitte par le menu
- n’efface pas la réponse saisie entre-temps dans un autre onglet
- liste les réponses côté administration et propose l’export

## Connexion étudiant — 3 scénarios

- connecte l'étudiant et l'amène sur son espace
- refuse un mot de passe incorrect
- signale un compte dont l'email n'est pas confirmé

## Être recontacté par le gestionnaire — 2 scénarios

- transmet les coordonnées pré-remplies d’un étudiant connecté
- ne propose pas d'être recontacté quand le gestionnaire ne reçoit pas de contacts

## Espace étudiant — 2 scénarios

- marque une priorité comme terminée puis la remet à faire
- met à jour ses informations personnelles

## Favoris — 2 scénarios

- invite un visiteur non connecté à se connecter
- ajoute puis retire une résidence des favoris

## Fiche d'une résidence — 5 scénarios

- présente la résidence, ses prix et ses logements
- ouvre l'offre du gestionnaire dans un nouvel onglet
- propose d’appeler la résidence
- signale une résidence complète
- revient à la recherche de la ville depuis le fil d'Ariane

## Recherche de logement par ville — 14 scénarios

- affiche les résidences de la ville et exclut les autres
- ouvre la fiche d'une résidence depuis la liste
- trouve une ville via la barre de recherche avec autocomplétion
- filtre les résidences par budget maximum
- affiche le message « aucun résultat » pour une ville sans résidence
- masque les résidences complètes via le switch « Logements disponibles »
- filtre les résidences proposant de la colocation
- filtre les résidences adaptées PMR
- sépare les résidences Crous des autres résidences
- pagine la liste au-delà de douze résidences
- élargit la recherche autour d'une ville voisine sans résidence
- redirige un nom de ville vers son slug en conservant les filtres
- affiche la page 404 pour une résidence inconnue
- conserve les filtres après rechargement de la page

## Simulateur d'aides au logement — 3 scénarios

- bloque le passage à l’étape suivante tant que le profil est incomplet
- explique en français que le statut est obligatoire
- estime les aides d'un étudiant sans garant

## Simulateur de budget — 1 scénario

- calcule le solde mensuel à partir des revenus et des dépenses

## Menu de l'espace étudiant — 2 scénarios

- regroupe les entrées sous « Ma recherche » et « Préparer mon installation », repliées par défaut
- navigue vers les pages des rubriques depuis le menu

## Encart disponibilité de la fiche résidence — 6 scénarios

- affiche les disponibilités, le téléphone et les actions
- propose de créer une alerte quand il n'y a aucune disponibilité
- signale le dépôt de dossier possible en plus de l'alerte quand la résidence est complète
- signale le dépôt de dossier possible quand les disponibilités ne sont pas renseignées
- reste sobre quand les disponibilités ne sont pas communiquées
- met en avant « Être recontacté » devant la consultation de l'offre
