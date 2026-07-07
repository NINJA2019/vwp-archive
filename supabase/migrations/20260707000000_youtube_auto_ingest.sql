-- ═══════════════════════════════════════════════════════════════
-- Migration: youtube_auto_ingest
-- 2026-07-07
-- ═══════════════════════════════════════════════════════════════

-- ── videos テーブルに新4列を追加 ──

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'pending', 'rejected'));

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'song'
    CHECK (content_type IN ('song', 'live', 'shorts', 'announcement'));

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ;

-- ── インデックス ──

CREATE INDEX IF NOT EXISTS idx_videos_status
  ON videos (status);

CREATE INDEX IF NOT EXISTS idx_videos_content_type
  ON videos (content_type);

-- ── ingest_channels テーブル新規作成 ──

CREATE TABLE IF NOT EXISTS ingest_channels (
  id                      SERIAL PRIMARY KEY,
  member_id               TEXT NOT NULL,
  channel_id              TEXT NOT NULL UNIQUE,
  uploads_playlist_id     TEXT,
  enabled                 BOOLEAN DEFAULT true,
  last_checked_at         TIMESTAMPTZ,
  last_video_published_at TIMESTAMPTZ
);
