-- Security advisor対応 (2026-07-15) — 適用済み（apply_migration: enable_rls_ingest_channels_and_fix_search_path）
-- 1) ingest_channels: RLS有効化（ポリシー無し = anon/authenticated 全拒否）
--    Netlify Functions は service role key 使用のため RLS を透過、動作影響なし
ALTER TABLE public.ingest_channels ENABLE ROW LEVEL SECURITY;

-- 2) prevent_fallback_status_change: search_path 固定（WARN: function_search_path_mutable）
--    関数本体は NEW/OLD のみ参照でテーブル参照なし。ロジック不変（憲法6遵守）
ALTER FUNCTION public.prevent_fallback_status_change() SET search_path = '';
