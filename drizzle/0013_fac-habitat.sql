-- Custom SQL migration file, put your code below! ---- Migration: Update FAC HABITAT accommodations from CSV
-- Updates: external_url, residence_type, target_audience, equipment booleans
-- Matching: by name (case-insensitive, unaccent) on FAC HABITAT owner

DO $$
DECLARE
  fac_habitat_owner_id BIGINT;
  updated_count INT;
  unmatched_row RECORD;
BEGIN
  SELECT id INTO fac_habitat_owner_id FROM account_owner WHERE LOWER(name) = LOWER('FAC HABITAT');
  IF fac_habitat_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner FAC HABITAT not found';
  END IF;

  CREATE TEMP TABLE tmp_fac_habitat_update (
    name TEXT,
    residence_type VARCHAR(100),
    target_audience VARCHAR(100),
    external_url VARCHAR(255),
    common_areas BOOLEAN,
    bike_storage BOOLEAN,
    secure_access BOOLEAN,
    desk BOOLEAN,
    cooking_plates BOOLEAN,
    microwave BOOLEAN,
    refrigerator BOOLEAN,
    wifi BOOLEAN
  );

  INSERT INTO tmp_fac_habitat_update VALUES
    ('Abelard', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-93-abelard?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Abelha', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-83-residence-etudiante-abelha-nice?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Adelaïde', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-108-adelaide?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Alice Guy', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-114-alice-guy?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('André Malraux', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-1-residence-etudiante-andre-malraux-avignon?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Athénée', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-105-athenee?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Auguste Rodin', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-28-auguste-rodin?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Belle Isle', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-46-belle-isle?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Bon Temps', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-95-bon-temps?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Carmagnole', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-96-carmagnole?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Cesaria Evora', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-35-cesaria-evora?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Chauvelles', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-92-chauvelles?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Claude Gilli', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-126-claude-gilli?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Claude Monet', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-39-claude-monet?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Colombier', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-97-colombier?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Compas', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-99-compas?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('De la Salle', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-61-residence-etudiante-de-la-salle-nantes?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Dionysos', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-29-dionysos?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Ecrivains', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-91-ecrivains?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Edouard Depreux', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-47-edouard-depreux?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Edouard Martel', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-76-edouard-martel?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Emergence', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-85-residence-etudiante-emergence-bois-colombes?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Erwin Guldner', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-80-residence-etudiante-erwin-guldner-sceaux?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Estérel I', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-2-esterel-i?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Esterel II', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-3-esterel-ii?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Flavia', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-119-flavia?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Fourmont', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-111-fourmont?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('François HUBER', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-125-francois-huber?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Gainsbourg', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-112-gainsbourg?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Gaspard Monge', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-113-gaspard-monge?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Georges Mathé', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-45-georges-mathe?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Gondoles', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-98-gondoles?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Gustave Doré', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-70-residence-etudiante-gustave-dore-strasbourg?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Hérodote', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-42-herodote?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Hortense Wild', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-116-hortense-wild?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Internationale Saint-Serge', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-63-residence-etudiante-internationale-saint-serge-angers?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Jean Jaurès', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-54-jean-jaures?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Julie Victoire Daubié', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-81-residence-etudiante-julie-victoire-daubie-malakoff?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('La Belle Otéro', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-120-la-belle-otero?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('La Boétie', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-36-la-boetie?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('La Guillotière', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-66-residence-etudiante-la-guillotiere-lyon?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('La Maison des Etudiants', 'residence-etudiante', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-5-la-maison-des-etudiants?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('L''Alchimiste', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-41-l-alchimiste?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('L''Arche', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-48-l-arche?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Lavoisier', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-24-lavoisier?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le 29', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-75-residence-etudiante-le-29-lyon?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Castel Rive', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-59-castel-rive-rennes?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Coquibus', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-21-le-coquibus?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Grand Bleu', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-87-residence-etudiante-le-grand-bleu-beausoleil?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Parc', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-86-residence-etudiante-le-parc-loos?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Parc II', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-89-residence-etudiante-le-parc-ii-loos?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Ribay', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-64-le-ribay?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, FALSE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Scribe', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-19-le-scribe?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Studio', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-55-le-studio?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Val de Sénart', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-25-le-val-de-senart?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Van Gogh', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-7-le-van-gogh?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Vélasquez', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-8-le-velasquez?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Le Vieux Port', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-9-residence-etudiante-le-vieux-port-marseille?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Léo Ferré', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-100-leo-ferre?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Les Hauts Bois', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-38-les-hauts-bois?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Les jardins de la tour', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-65-residence-etudiante-les-jardins-de-la-tour-nantes?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Les Magnolias', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-11-les-magnolias?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Les Sévillanes', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-12-residence-etudiante-les-sevillanes-nimes?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Les Trois Arpents', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-27-les-trois-arpents?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('L''Europe', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-32-l-europe?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('L''Orée du Campus', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-79-residence-etudiante-l-oree-du-campus-loos?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Lucie Aubrac', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-78-lucie-aubrac?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Madeleine Guitty', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-121-madeleine-guitty?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Magellan', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-77-magellan?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Maison de l''Etudiant', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-13-maison-de-l-etudiant?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Maison des Etudiants du Rhône', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-106-maison-des-etudiants-du-rhone?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Malausséna', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-14-malaussena?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Marcel Pagnol', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-33-marcel-pagnol?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Marne', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-101-marne?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Maximilien Perret', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-110-maximilien-perret?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('MIS pour étudiants', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-56-mis-pour-etudiants?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('MIS pour jeunes actifs', 'residence-sociale-jeunes-actifs', 'mixte-etudiants-jeunes-actifs', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-58-mis-pour-jeunes-actifs?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Nelson Mandela', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-30-nelson-mandela?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Norbert Ségard', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-15-norbert-segard?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Orrion', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-62-residence-etudiante-orrion-nantes?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Pablo Picasso', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-26-pablo-picasso?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Parc Avenue', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-49-parc-avenue?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Paul Cézanne', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-31-paul-cezanne?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Pertinax', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-16-pertinax?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE),
    ('Philosophia', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-57-philosophia?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Picasso', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-102-picasso?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Pierre Ringenbach', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-82-residence-etudiante-pierre-ringenbach-sceaux?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Pyramide', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-103-pyramide?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Quai de la Loire', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-73-quai-de-la-loire?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('Rabelais', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-107-rabelais?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Reine Jeanne', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-17-reine-jeanne?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('René Magnac', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-18-residence-etudiante-rene-magnac-marseille?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Renée Vivien', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-124-renee-vivien?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Saint-Exupéry', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-94-saint-exupery?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Saint-Jérôme', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.fac-habitat.com/fr/residences-etudiantes/id-127-saint-jerome?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Sens', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-84-residence-etudiante-sens-marseille?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Simone de Beauvoir', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-23-simone-de-beauvoir?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Thibaud de Champagne', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-34-thibaud-de-champagne?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Thomas Edison', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-43-thomas-edison?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Val de Bièvre', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-53-val-de-bievre?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Valabre', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-109-valabre?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Van Gogh', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-104-van-gogh?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Viva Cita', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-68-viva-cita?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('Viva Cita 2', 'residence-universitaire-conventionnee', 'etudiants', 'https://www.Fac-Habitat.com/fr/residences-etudiantes/id-69-viva-cita-2?utm_source=monlogementetudiant&utm_medium=site&utm_term=&utm_content=&utm_campaign=residences', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE);

  -- Update accommodations matching by name on FAC HABITAT owner
  UPDATE accommodation_accommodation a
  SET
    external_url = COALESCE(t.external_url, a.external_url),
    residence_type = COALESCE(t.residence_type, a.residence_type),
    target_audience = COALESCE(t.target_audience, a.target_audience),
    common_areas = COALESCE(t.common_areas, a.common_areas),
    bike_storage = COALESCE(t.bike_storage, a.bike_storage),
    secure_access = COALESCE(t.secure_access, a.secure_access),
    desk = COALESCE(t.desk, a.desk),
    cooking_plates = COALESCE(t.cooking_plates, a.cooking_plates),
    microwave = COALESCE(t.microwave, a.microwave),
    refrigerator = COALESCE(t.refrigerator, a.refrigerator),
    wifi = COALESCE(t.wifi, a.wifi),
    updated_at = NOW()
  FROM tmp_fac_habitat_update t
  WHERE a.owner_id = fac_habitat_owner_id
    AND LOWER(TRIM(unaccent(a.name))) = LOWER(TRIM(unaccent(t.name)));

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '% accommodations updated', updated_count;

  -- Report unmatched CSV rows
  FOR unmatched_row IN
    SELECT t.name FROM tmp_fac_habitat_update t
    WHERE NOT EXISTS (
      SELECT 1 FROM accommodation_accommodation a
      WHERE a.owner_id = fac_habitat_owner_id
        AND LOWER(TRIM(unaccent(a.name))) = LOWER(TRIM(unaccent(t.name)))
    )
  LOOP
    RAISE NOTICE 'Unmatched: %', unmatched_row.name;
  END LOOP;

  DROP TABLE tmp_fac_habitat_update;

  -- Set available = true on all FAC HABITAT accommodations
  UPDATE accommodation_accommodation
  SET available = TRUE, updated_at = NOW()
  WHERE owner_id = fac_habitat_owner_id;

END $$;