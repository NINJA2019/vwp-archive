-- ═══════════════════════════════════════════════════════════════
-- Migration: setlists（ファンのセットリスト集計 → ファン・セレクト）
-- 2026-10-23
-- 1 行 = 1 ブラウザ（client_id）× 1 メンバー。3 曲の video_id を配列で保持。
-- 同一 client_id × member の再登録は upsert で上書き（UNIQUE 制約が on_conflict キー）。
-- 集計は読み取り時に setlist_rankings() で行い、videos.status='published' と JOIN して
-- 非公開になった曲を自動で除外する（憲法2 の延長）。
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.setlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   TEXT NOT NULL,                      -- ブラウザ匿名ID（フロント生成 UUID v4。PIIではない）
  member      TEXT NOT NULL
                CHECK (member IN ('kafu','rime','harusar','isekai','koko','vwp')),
  video_ids   BIGINT[] NOT NULL
                CHECK (array_length(video_ids, 1) = 3
                       AND video_ids[1] <> video_ids[2]
                       AND video_ids[1] <> video_ids[3]
                       AND video_ids[2] <> video_ids[3]),  -- 3 曲・重複なし（Function 側でも検証）
  client_hash TEXT NOT NULL,                      -- IP SHA-256（レート制限用。song_bottles と同じ getClientHash）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(), -- 初回登録（upsert で据え置き）
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(), -- Function が明示的に now を書く
  UNIQUE (client_id, member)
);

CREATE INDEX IF NOT EXISTS idx_setlists_member ON public.setlists (member);
CREATE INDEX IF NOT EXISTS idx_setlists_hash_updated ON public.setlists (client_hash, updated_at);

-- RLS: ingest_channels（2026-07-15）と同じ「ポリシー無し = anon/authenticated 全拒否」。
-- Netlify Function は service role key で透過。
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;

-- ── メンバー別ランキング（上位 p_limit 件 / メンバー） ──
-- 憲法2: videos を status='published' で JOIN し、非公開曲は集計から除外する。
-- タイブレーク: votes DESC → first_at ASC（その曲を含む行の最初の登録時刻 = created_at の最小。更新では動かない）→ video_id ASC
-- published 曲が 0 件のメンバーも submitters を返す（subs LEFT JOIN r。rank NULL 行は Function 側で top から除外）
-- 戻り行数の上限は 6 メンバー × p_limit（既定 50 → 300 行）で PostgREST の 1,000 行キャップ未満（憲法5）。
CREATE OR REPLACE FUNCTION public.setlist_rankings(p_limit INT DEFAULT 50)
RETURNS TABLE (member TEXT, video_id BIGINT, votes BIGINT, rank INT, submitters BIGINT)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  WITH subs AS (
    SELECT s.member, COUNT(*) AS submitters
    FROM public.setlists s GROUP BY s.member
  ),
  v AS (
    SELECT s.member, e.video_id, COUNT(DISTINCT s.id) AS votes, MIN(s.created_at) AS first_at
    FROM public.setlists s
    CROSS JOIN LATERAL unnest(s.video_ids) AS e(video_id)
    JOIN public.videos vd ON vd.id = e.video_id AND vd.status = 'published'
    GROUP BY s.member, e.video_id
  ),
  r AS (
    SELECT v.member, v.video_id, v.votes,
           ROW_NUMBER() OVER (PARTITION BY v.member ORDER BY v.votes DESC, v.first_at ASC, v.video_id ASC) AS rank
    FROM v
  )
  SELECT subs.member, r.video_id, r.votes, r.rank::INT, subs.submitters
  FROM subs LEFT JOIN r ON r.member = subs.member
                       AND r.rank <= LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  ORDER BY subs.member, r.rank;
$$;

-- anon / authenticated からの直接 RPC 呼び出しを閉じる（service key のみ）
REVOKE EXECUTE ON FUNCTION public.setlist_rankings(INT) FROM PUBLIC, anon, authenticated;
