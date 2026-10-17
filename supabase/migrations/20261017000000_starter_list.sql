-- ═══════════════════════════════════════════════════════════════
-- Migration: starter_list
-- 2026-10-17
-- ═══════════════════════════════════════════════════════════════

-- ── videos テーブルにスターターリスト用3列を追加 ──

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS is_starter BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS starter_order INT;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS starter_note TEXT;

-- ── インデックス ──

CREATE INDEX IF NOT EXISTS idx_videos_starter
  ON videos (starter_order) WHERE is_starter;
