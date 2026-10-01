CREATE OR REPLACE FUNCTION pg_temp.relation_of(target text) RETURNS regclass LANGUAGE plpgsql AS $body$
DECLARE
  relation regclass := to_regclass(format('%I', target));
BEGIN
  IF relation IS NULL THEN
    RAISE EXCEPTION 'Table "%" is missing', target;
  END IF;
  RETURN relation;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.free_name(taken text[], base text) RETURNS text LANGUAGE plpgsql AS $body$
DECLARE
  candidate text := left(base, 63);
  counter integer := 0;
BEGIN
  WHILE candidate = ANY (taken) LOOP
    counter := counter + 1;
    candidate := left(base, 62 - length(counter::text)) || '_' || counter;
  END LOOP;
  RETURN candidate;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.column_names(target text) RETURNS text[] LANGUAGE sql AS $body$
  SELECT coalesce(array_agg(attname::text), '{}') FROM pg_attribute
  WHERE attrelid = pg_temp.relation_of(target) AND attnum > 0 AND NOT attisdropped
$body$;

CREATE OR REPLACE FUNCTION pg_temp.relation_names() RETURNS text[] LANGUAGE sql AS $body$
  SELECT coalesce(array_agg(relname::text), '{}') FROM pg_class WHERE relnamespace = current_schema()::regnamespace
$body$;

CREATE OR REPLACE FUNCTION pg_temp.column_number(target text, source text) RETURNS smallint LANGUAGE plpgsql AS $body$
DECLARE
  number smallint;
BEGIN
  SELECT attnum INTO number FROM pg_attribute
  WHERE attrelid = pg_temp.relation_of(target) AND attname = source AND NOT attisdropped;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Column "%"."%" is missing', target, source;
  END IF;
  RETURN number;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.detach_column(target text, source text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  relation regclass := pg_temp.relation_of(target);
  number smallint := pg_temp.column_number(target, source);
  entry record;
BEGIN
  FOR entry IN SELECT conname FROM pg_constraint WHERE conrelid = relation AND contype <> 'n' AND number = ANY (conkey) LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target, entry.conname);
  END LOOP;
  FOR entry IN
    SELECT index_class.relname FROM pg_index JOIN pg_class index_class ON index_class.oid = pg_index.indexrelid
    WHERE pg_index.indrelid = relation AND number = ANY (pg_index.indkey::smallint[])
  LOOP
    EXECUTE format('DROP INDEX %I', entry.relname);
  END LOOP;
  SELECT attidentity::text AS identity, attgenerated::text AS generated, atthasdef AS defaulted INTO entry
  FROM pg_attribute WHERE attrelid = relation AND attnum = number;
  IF entry.identity <> '' THEN
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP IDENTITY', target, source);
  ELSIF entry.generated <> '' THEN
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP EXPRESSION', target, source);
  ELSIF entry.defaulted THEN
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', target, source);
  END IF;
  EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', target, source);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.backup_column(target text, source text, base text) RETURNS void LANGUAGE plpgsql AS $body$
BEGIN
  PERFORM pg_temp.detach_column(target, source);
  EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', target, source, pg_temp.free_name(pg_temp.column_names(target), base));
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.copy_column(target text, source text, base text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  number smallint := pg_temp.column_number(target, source);
  copy text := pg_temp.free_name(pg_temp.column_names(target), base);
BEGIN
  EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', target, copy, (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = pg_temp.relation_of(target) AND attnum = number));
  EXECUTE format('UPDATE %I SET %I = %I', target, copy, source);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.backup_table(target text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  relation regclass := pg_temp.relation_of(target);
  entry record;
BEGIN
  FOR entry IN SELECT conrelid::regclass AS owner, conname FROM pg_constraint WHERE contype <> 'n' AND (confrelid = relation OR conrelid = relation) LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', entry.owner, entry.conname);
  END LOOP;
  FOR entry IN SELECT index_class.relname FROM pg_index JOIN pg_class index_class ON index_class.oid = pg_index.indexrelid WHERE pg_index.indrelid = relation LOOP
    EXECUTE format('DROP INDEX %I', entry.relname);
  END LOOP;
  EXECUTE format('ALTER TABLE %I RENAME TO %I', target, pg_temp.free_name(pg_temp.relation_names(), '$OLD_' || target));
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.copy_table(target text) RETURNS void LANGUAGE plpgsql AS $body$
BEGIN
  EXECUTE format('CREATE TABLE %I AS TABLE %I', pg_temp.free_name(pg_temp.relation_names(), '$OLD_' || target), target);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.drop_checks(target text, source text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  number smallint := pg_temp.column_number(target, source);
  entry record;
BEGIN
  FOR entry IN SELECT conname FROM pg_constraint WHERE conrelid = pg_temp.relation_of(target) AND contype = 'c' AND conkey = ARRAY[number] LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target, entry.conname);
  END LOOP;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.has_column(target text, source text) RETURNS boolean LANGUAGE sql AS $body$
  SELECT source = ANY (pg_temp.column_names(target))
$body$;

CREATE OR REPLACE FUNCTION pg_temp.add_missing_column(target text, source text, statements text[]) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  statement text;
BEGIN
  IF NOT pg_temp.has_column(target, source) THEN
    FOREACH statement IN ARRAY statements LOOP
      EXECUTE statement;
    END LOOP;
  END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.list_elements(stored text, target text, source text) RETURNS text[] LANGUAGE plpgsql AS $body$
BEGIN
  IF stored IS NULL OR stored = '' THEN
    RETURN '{}';
  ELSIF left(stored, 1) = '[' THEN
    RETURN ARRAY(SELECT json_array_elements_text(stored::json));
  ELSIF left(stored, 1) = '{' THEN
    RETURN stored::text[];
  END IF;
  RAISE EXCEPTION 'Column "%"."%" holds %, which is not a stored list', target, source, stored;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.convert_text_list(target text, source text, list_type text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  number smallint := pg_temp.column_number(target, source);
BEGIN
  IF (SELECT atttypid FROM pg_attribute WHERE attrelid = pg_temp.relation_of(target) AND attnum = number) = 'text'::regtype THEN
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', target, source);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE %s USING pg_temp.list_elements(%I, %L, %L)::%s', target, source, list_type, source, target, source, list_type);
  END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.convert_document(target text, source text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  stored regtype := (SELECT atttypid FROM pg_attribute WHERE attrelid = pg_temp.relation_of(target) AND attnum = pg_temp.column_number(target, source));
BEGIN
  IF stored = 'jsonb'::regtype THEN
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', target, source);
  IF stored = 'text'::regtype THEN
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE jsonb USING CASE WHEN %I = '''' THEN ''[]''::jsonb ELSE %I::jsonb END', target, source, source, source);
  ELSE
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE jsonb USING to_jsonb(%I)', target, source, source);
  END IF;
  EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT ''[]''', target, source);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.drop_stray_unique_indexes(target text, prefix text, kept text[]) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  entry record;
BEGIN
  FOR entry IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema() AND tablename = target AND starts_with(indexname, prefix) AND NOT (indexname = ANY (kept))
  LOOP
    EXECUTE format('DROP INDEX %I', entry.indexname);
  END LOOP;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.defer_foreign_keys() RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  entry record;
BEGIN
  FOR entry IN
    SELECT conname, conrelid::regclass AS relation FROM pg_constraint
    WHERE contype = 'f' AND NOT condeferrable AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
  LOOP
    EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE', entry.relation, entry.conname);
  END LOOP;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.replace_checks(target text, source text, clause text) RETURNS void LANGUAGE plpgsql AS $body$
BEGIN
  PERFORM pg_temp.drop_checks(target, source);
  EXECUTE format('ALTER TABLE %I ADD %s NOT VALID', target, clause);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.convert_reference_list(element text, key text, junction text, owner_column text, element_column text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  filled boolean;
BEGIN
  IF pg_temp.has_column(element, key) THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', junction) INTO filled;
    IF filled THEN
      RAISE EXCEPTION 'Both "%"."%" and "%" hold the list, so it cannot be converted', element, key, junction;
    END IF;
    EXECUTE format('INSERT INTO %I (%I, %I) SELECT %I, "id" FROM %I WHERE %I IS NOT NULL AND %I <> '''' ORDER BY "id"', junction, owner_column, element_column, key, element, key, key);
    PERFORM pg_temp.backup_column(element, key, '$OLD_' || key);
  END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.require_unique(target text, keys text[], predicate text) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  key_list text := (SELECT string_agg(format('%I', key), ', ') FROM unnest(keys) AS key);
  value_list text := (SELECT string_agg(format('%I::text', key), ', ') FROM unnest(keys) AS key);
  duplicated bigint;
  examples text;
BEGIN
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %I%s GROUP BY %s HAVING count(*) > 1) duplicates', target, predicate, key_list) INTO duplicated;
  IF duplicated > 0 THEN
    EXECUTE format('SELECT string_agg(example, ''; '') FROM (SELECT concat_ws('', '', %s) AS example FROM %I%s GROUP BY %s HAVING count(*) > 1 ORDER BY 1 LIMIT 5) duplicates', value_list, target, predicate, key_list) INTO examples;
    RAISE EXCEPTION 'The unique rule on "%" (%) cannot take effect: % value(s) are held by more than one row, for example: %. Make these rows distinct, then run npm run migrate again. The database was not changed.', target, array_to_string(keys, ', '), duplicated, examples;
  END IF;
END
$body$;
