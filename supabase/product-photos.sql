-- Manhattan Market — free product photos by barcode (run once; safe to re-run)
--
-- barcode: the UPC/EAN from Clover's item "code", filled in by Clover sync.
-- photo_lookup_at: when the site last looked this barcode up in the Open
-- Food Facts databases (so items with no photo there aren't re-checked
-- every few minutes). See lib/photo-lookup.ts.
alter table products add column if not exists barcode text;
alter table products add column if not exists photo_lookup_at timestamptz;
create index if not exists products_photo_lookup_idx
  on products (stock desc)
  where image_url = '' and barcode is not null and photo_lookup_at is null;
