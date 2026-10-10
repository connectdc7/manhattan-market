-- Manhattan Market — Clover API-token connection (run once; safe to re-run)
--
-- When Clover is connected with a store API token (CLOVER_API_TOKEN), the
-- site re-syncs the menu from Clover every few minutes instead of using
-- webhooks. This column remembers when that last happened.
alter table clover_webhook_state add column if not exists last_auto_sync_at timestamptz;
