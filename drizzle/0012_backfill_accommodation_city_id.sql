-- Migration: Backfill city_id for accommodations that didn't match by exact name in 0011
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Pass 1: Case-insensitive name match (handles "NANCY" -> "Nancy", etc.)
UPDATE accommodation_accommodation a
  SET city_id = c.id
  FROM territories_city c
  WHERE a.city_id IS NULL
    AND LOWER(UNACCENT(TRIM(a.city))) = LOWER(UNACCENT(c.name));

-- Pass 2: Normalized name match — strip dashes/apostrophes/spaces
-- (handles "AIX EN PROVENCE" -> "Aix-en-Provence", "Saint Denis" -> "Saint-Denis")
UPDATE accommodation_accommodation a
  SET city_id = c.id
  FROM territories_city c
  WHERE a.city_id IS NULL
    AND LOWER(UNACCENT(REGEXP_REPLACE(a.city, '[-'' ]', ' ', 'g')))
      = LOWER(UNACCENT(REGEXP_REPLACE(c.name, '[-'' ]', ' ', 'g')));

-- Pass 3: Composite names "X - Y" — match second part (more specific)
-- (handles "Nantes - Orvault" -> "Orvault")
UPDATE accommodation_accommodation a
  SET city_id = c.id
  FROM territories_city c
  WHERE a.city_id IS NULL
    AND a.city LIKE '% - %'
    AND LOWER(UNACCENT(c.name)) = LOWER(UNACCENT(TRIM(SPLIT_PART(a.city, ' - ', 2))));

-- Pass 4: Composite names "X-Y" — match second part in same department
-- (handles "Rennes-Bruz" -> "Bruz", "Nantes-Carquefou" -> "Carquefou")
UPDATE accommodation_accommodation a
  SET city_id = c.id
  FROM territories_city c
  WHERE a.city_id IS NULL
    AND a.city LIKE '%-%'
    AND LOWER(UNACCENT(c.name)) = LOWER(UNACCENT(TRIM(SPLIT_PART(a.city, '-', 2))))
    AND c.department_id = (
      SELECT d.id FROM territories_department d
      WHERE d.code = LEFT(a.postal_code, 2)
      LIMIT 1
    );

-- Pass 5: Composite names — fallback to first part in same department
UPDATE accommodation_accommodation a
  SET city_id = c.id
  FROM territories_city c
  WHERE a.city_id IS NULL
    AND a.city LIKE '%-%'
    AND LOWER(UNACCENT(c.name)) = LOWER(UNACCENT(TRIM(SPLIT_PART(a.city, '-', 1))))
    AND c.department_id = (
      SELECT d.id FROM territories_department d
      WHERE d.code = LEFT(a.postal_code, 2)
      LIMIT 1
    );

-- Pass 6: Match by postal code — LAST RESORT only for remaining NULLs
-- (postal codes can cover multiple communes, so name match is always preferred)
UPDATE accommodation_accommodation a
  SET city_id = c.id
  FROM territories_city c
  WHERE a.city_id IS NULL
    AND a.postal_code = ANY(c.postal_codes);

-- Pass 7: Manual fixes for known edge cases (CEDEX codes, typos, DOM-TOM)
UPDATE accommodation_accommodation
  SET city_id = (SELECT id FROM territories_city WHERE LOWER(name) = 'aix-en-provence' LIMIT 1)
  WHERE city_id IS NULL AND LOWER(city) LIKE 'aix%en%provence%';

UPDATE accommodation_accommodation
  SET city_id = (SELECT id FROM territories_city WHERE LOWER(name) = 'cergy' LIMIT 1)
  WHERE city_id IS NULL AND LOWER(city) LIKE 'cergy%';

UPDATE accommodation_accommodation
  SET city_id = (SELECT id FROM territories_city WHERE LOWER(name) = 'champagne-au-mont-d''or' LIMIT 1)
  WHERE city_id IS NULL AND LOWER(city) LIKE 'champagne%mont%or%';

UPDATE accommodation_accommodation
  SET city_id = (SELECT id FROM territories_city WHERE LOWER(name) = 'maisons-laffitte' LIMIT 1)
  WHERE city_id IS NULL AND LOWER(city) LIKE 'maison%laffitte%';

UPDATE accommodation_accommodation
  SET city_id = (SELECT id FROM territories_city WHERE LOWER(name) = 'pointe-à-pitre' LIMIT 1)
  WHERE city_id IS NULL AND LOWER(city) LIKE 'pointe%pitre%';

UPDATE accommodation_accommodation
  SET city_id = (SELECT id FROM territories_city WHERE LOWER(name) LIKE 'saint-martin-d''h%' LIMIT 1)
  WHERE city_id IS NULL AND LOWER(city) LIKE 'saint-martin d heres%';

UPDATE accommodation_accommodation
  SET city_id = (SELECT id FROM territories_city WHERE LOWER(name) LIKE 'sch%lcher%' LIMIT 1)
  WHERE city_id IS NULL AND LOWER(city) LIKE 'sch%lcher%';

-- Final: Normalize accommodation.city to match city.name (source of truth)
UPDATE accommodation_accommodation a
  SET city = c.name
  FROM territories_city c
  WHERE a.city_id = c.id
    AND a.city != c.name;
