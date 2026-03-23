-- Migration: Deduplicate cities sharing the same primary INSEE code (insee_codes[1])
-- Before adding a unique constraint, we must merge duplicates.
-- FK dependencies: student_alert.city_id -> territories_city.id

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- For each group of cities sharing the same primary INSEE code,
  -- keep the one with the smallest id (oldest) and merge the others into it.
  FOR rec IN
    SELECT
      insee_codes[1] AS insee_code,
      MIN(id) AS keeper_id,
      ARRAY_AGG(id ORDER BY id) AS all_ids
    FROM territories_city
    WHERE insee_codes[1] IS NOT NULL
    GROUP BY insee_codes[1]
    HAVING COUNT(*) > 1
  LOOP
    -- 1. Reassign student_alert FK references to the keeper city
    UPDATE student_alert
      SET city_id = rec.keeper_id
      WHERE city_id = ANY(rec.all_ids)
        AND city_id != rec.keeper_id;

    -- 2. Merge postal_codes from duplicates into the keeper
    UPDATE territories_city
      SET postal_codes = (
        SELECT ARRAY(
          SELECT DISTINCT unnest(pc)
          FROM (
            SELECT postal_codes AS pc
            FROM territories_city
            WHERE id = ANY(rec.all_ids)
          ) sub
        )
      )
      WHERE id = rec.keeper_id;

    -- 3. Delete the duplicate cities (all except keeper)
    DELETE FROM territories_city
      WHERE id = ANY(rec.all_ids)
        AND id != rec.keeper_id;

    RAISE NOTICE 'Merged % duplicate(s) for INSEE % into city id %',
      array_length(rec.all_ids, 1) - 1, rec.insee_code, rec.keeper_id;
  END LOOP;
END $$;
