# Demo stock portraits

32 distinct 128 × 128 JPEG portraits from Random User Generator, downloaded September 15, 2026. These are placeholder photos for fictional members, not photos of the named people. The name-based male/female choices are estimates for the demo and do not set a gender field.

Source documentation: https://randomuser.me/documentation

Source copyright notice: https://randomuser.me/copyright

`assignments.json` records the original image URL and fictional member assignment. The repeatable directory and group seeds use these bundled images. For existing demo data, deploy the assets first, then apply `web/supabase/seed_stock_portraits.sql`; it replaces existing photo paths only on matching demo IDs and first names.
