-- Manhattan Market — storefront aisles (run once; safe to re-run)
--
-- Lets staff choose which "aisle" (Snacks & Candy, Drinks, …) each
-- category is grouped under on the Order page. Empty = the site picks one
-- from the category's name (see lib/aisles.ts). Uses the categories
-- table's existing policies, so nothing else changes.
alter table categories add column if not exists group_name text;
