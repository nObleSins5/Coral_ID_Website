-- =============================================================================
-- Supabase layer — Drop the community color-sample pipeline (23_drop_element_color_samples.sql)
-- =============================================================================
-- Incremental migration for an already-live project: reverses
-- 21_element_color_samples.sql. Removed from sql/reef-platform-schema.sql
-- directly (the source of truth for fresh installs no longer defines this
-- table at all).
--
-- Product decision 2026-07-12: canonical color data comes from web research
-- and moderator/maintainer entry only, not crowdsourced pixel-sampling —
-- some corals have specks/rainbows a novice can easily mis-sample, and
-- there's no expert gate on the ΔE auto-confirm path this table supported.
-- The color-sampling UI moves to /identify as a personal, ephemeral
-- comparison tool that stores nothing (see web/components/photo-color-sampler.tsx).
-- Idempotent.
-- =============================================================================

DROP TABLE IF EXISTS element_color_samples;

DELETE FROM app_settings WHERE key = 'color_sample_delta_e_threshold';
