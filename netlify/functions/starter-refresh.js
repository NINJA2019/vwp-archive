// ═══════════════════════════════════════════════════════════════
// starter-refresh.js — スターター曲 自動選曲Function
// 起動: GitHub Actions cron（週1回 日曜JST03:00）+ 手動curl
//       Authorization: Bearer <ADMIN_PASSWORD> 必須（albums-stock-scan.js と同型）
// 選曲ロジック:
//   - published の pure-solo ソング（shorts/live/announcement除外）を対象に
//     メンバーごとに「視聴数トップ2 + 最新シングル1曲」を選出
//   - 最新枠（rank3）はタグに「シングル」を含む曲から選出。
//     トップ2と重複する場合は次の最新シングルを選出。
//     シングル曲がプールに存在しない場合は最新曲（全種）にフォールバック。
//   - YouTube Data API videos.list?part=statistics で視聴数取得（50件単位バッチ）
//   - 現行 is_starter=true セットとの差分のみ PATCH（is_starter / starter_order のみ書き込み）
// 安全弁:
//   - fetchAllRows で全件取得できない（overflow / 非配列 / HTTPエラー）場合は即中止・0書き込み
//   - YouTube API エラー（非OK HTTP または data.error 有）は即中止・0書き込み・502返却
//   - PATCH段階の部分失敗はログ記録して続行（次週の自動更新でself-heal）
// ═══════════════════════════════════════════════════════════════

const { getSupabaseUrl, secretKey, sbHeaders, fetchAllRows } = require('./_shared/supabase');
const { json, methodNotAllowed } = require('./_shared/responses');
const { ytId } = require('./_shared/yt');

// ── 定数 ──

// core.js の NON_SONG_TYPES と同値（NULL/unknown は song 扱い）
const NON_SONG_TYPES = ['shorts', 'live', 'announcement'];

// 選曲対象メンバー: pure-solo のみ（kafu→rime→harusar→isekai→koko の固定順）
// duet（"kafu rime" 等）/ "vwp" / "all" はメンバー厳格一致で自動除外される
const SOLO_MEMBERS = ['kafu', 'rime', 'harusar', 'isekai', 'koko'];

// YouTube Data API: 1リクエストあたりの上限
const YT_BATCH_SIZE = 50;

// タグ文字列からシングルタグを持つか判定する。
// public/js/core.js の parseTags と同じ規則（スペースまたはカンマ区切り、先頭の '#' を除去）を
// サーバーサイドでインライン実装。フロントエンドモジュールは import しない（サーバー非対応のため）。
// DB の tags 値例: 'シングル', 'シングル アニメ', 'Live シングル', 'ゲーム シングル', '#Covered' 等。
// tags は NULL の場合があるため `|| ''` でガード。
function hasSingleTag(row) {
  const raw = row.tags || '';
  return raw.split(/[ ,]+/).some(s => s.replace(/^#/, '') === 'シングル');
}

// starter_order エンコーディング: (memberIndex+1)*10 + rank
// 例: kafu(0)→11,12,13 / rime(1)→21,22,23 / ... / koko(4)→51,52,53
function encodeStarterOrder(memberIndex, rank) {
  return (memberIndex + 1) * 10 + rank;
}

// ── メインハンドラ ──
exports.handler = async (event) => {
  // (1) POST のみ許可（albums-stock-scan と同型）
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  // (2) 認証ガード（always-HTTP起動のため無条件必須。ingest-youtube の isScheduled パターンは使わない）
  const ADMIN_PW = process.env.ADMIN_PASSWORD;
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!ADMIN_PW || token !== ADMIN_PW) {
    return json(401, { error: '起動には Authorization: Bearer <ADMIN_PASSWORD> が必要です' });
  }

  // (3) 環境変数チェック
  const SUPABASE_URL = getSupabaseUrl();
  const SUPABASE_KEY = secretKey();
  const YT_KEY = process.env.YOUTUBE_API_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY || !YT_KEY) {
    return json(500, { error: '環境変数が不足しています (SUPABASE_URL / SUPABASE_SECRET_KEY / YOUTUBE_API_KEY)' });
  }

  try {
    // ─────────────────────────────────────────────────────────────
    // (4) videos 全件取得（憲法5: fetchAllRows でページングループ）
    //     NO server-side status/content_type filter: is_starter=true な行は
    //     status問わず取得し、差分計算で削除対象に含める必要があるため
    // ─────────────────────────────────────────────────────────────
    const { rows: allRows, overflow } = await fetchAllRows(
      SUPABASE_URL, SUPABASE_KEY,
      'videos?select=id,url,title,date,member,content_type,status,is_starter,starter_order,tags&order=id.asc',
      { throwOnHttpError: true, errSlice: 300 }
    );

    if (overflow) {
      console.error('starter-refresh: videos件数が安全上限(50,000)に到達。dedup不完全のため中止。');
      return json(500, { error: 'videos件数が安全上限(50,000)に到達。0書き込みで中止。', count: allRows.length });
    }
    if (!Array.isArray(allRows)) {
      console.error('starter-refresh: videos取得結果が配列ではありません:', allRows);
      return json(500, { error: 'videos取得結果が配列ではありません' });
    }

    // ─────────────────────────────────────────────────────────────
    // (5) 候補プール（JS側フィルタ）
    //     - status === 'published'
    //     - content_type が NON_SONG_TYPES に含まれない（NULL/unknown は song 扱い）
    //     - member が SOLO_MEMBERS の正確な一致（duet/vwp/all を除外）
    //     - ytId() で YouTube ID が抽出できる行のみ
    // ─────────────────────────────────────────────────────────────
    const pool = [];
    for (const row of allRows) {
      if (row.status !== 'published') continue;
      if (NON_SONG_TYPES.includes(row.content_type)) continue;
      if (!SOLO_MEMBERS.includes(row.member)) continue;
      const vid = ytId(row.url);
      if (!vid) continue;
      pool.push({ ...row, _ytId: vid });
    }

    // ─────────────────────────────────────────────────────────────
    // (6) YouTube Data API videos.list?part=statistics で視聴数取得
    //     50件ずつバッチ発行。APIエラー（非OK HTTP または data.error）は即中止・0書き込み・502
    // ─────────────────────────────────────────────────────────────
    const ytIds = pool.map(r => r._ytId);

    // 重複除去（念のため）
    const uniqueYtIds = [...new Set(ytIds)];

    // ytId → viewCount (Number) マップ。APIレスポンス欠落 or 非数値 → プールから除外
    const viewCountMap = new Map(); // ytId → number

    for (let i = 0; i < uniqueYtIds.length; i += YT_BATCH_SIZE) {
      const batch = uniqueYtIds.slice(i, i + YT_BATCH_SIZE);
      const ytRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(',')}&key=${YT_KEY}`
      );
      if (!ytRes.ok) {
        const errText = await ytRes.text().catch(() => '');
        console.error(`starter-refresh: YouTube API HTTPエラー ${ytRes.status}: ${errText.slice(0, 200)}`);
        return json(502, { error: `YouTube API HTTPエラー: ${ytRes.status}`, detail: errText.slice(0, 200) });
      }
      const data = await ytRes.json();
      if (data.error) {
        console.error('starter-refresh: YouTube API エラー:', data.error);
        return json(502, { error: `YouTube API エラー: ${data.error.message || JSON.stringify(data.error)}` });
      }
      for (const item of (data.items || [])) {
        const vc = Number(item.statistics?.viewCount);
        if (!isNaN(vc)) {
          viewCountMap.set(item.id, vc);
        }
        // statistics欠落 or viewCount 非数値 → マップに入れない（プールから除外）
      }
    }

    // viewCountMapに存在する行のみ最終プールへ（statistics欠落・非数値を除外）
    const eligiblePool = pool.filter(r => viewCountMap.has(r._ytId));

    // ─────────────────────────────────────────────────────────────
    // (7) メンバーごとの選曲
    //     各メンバー: (a) 視聴数トップ2、(b) 最新シングル1曲（rank3）
    //     rank3 はシングルタグ曲を優先。トップ2と重複する場合は次の最新シングル。
    //     シングル曲がゼロ（またはすべてトップ2に消費済み）の場合は最新曲（全種）にフォールバック。
    //     ランク: 1=top-views-1, 2=top-views-2, 3=latest-single
    //     タイブレーク: viewCount降順 → date降順 → id降順
    //                   date タイブレーク: id降順（dateがnullは最古扱い: '' として比較）
    // ─────────────────────────────────────────────────────────────

    // 選曲済み id セット（pure-solo プールはメンバー間disjointだが念のためガード）
    const selectedIdSet = new Set();

    // 結果: { id, member, rank, views, starter_order }
    const newSelected = [];

    for (let mi = 0; mi < SOLO_MEMBERS.length; mi++) {
      const memberId = SOLO_MEMBERS[mi];
      const memberPool = eligiblePool.filter(r => r.member === memberId);

      if (memberPool.length === 0) continue;

      // 視聴数降順ソート（タイブレーク: date降順 → id降順）
      // date が null は最古扱い: '' で比較（''は任意のYYYY-MM-DDより辞書順で小さい）
      const byViews = [...memberPool].sort((a, b) => {
        const va = viewCountMap.get(a._ytId);
        const vb = viewCountMap.get(b._ytId);
        if (vb !== va) return vb - va;
        const da = a.date || '';
        const db = b.date || '';
        if (db !== da) return db > da ? 1 : -1;
        return b.id - a.id;
      });

      // 最新日降順ソート（タイブレーク: id降順）
      const byDate = [...memberPool].sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (db !== da) return db > da ? 1 : -1;
        return b.id - a.id;
      });

      const picked = []; // このメンバーの選曲（最大3曲）

      // (a) トップ2
      for (const row of byViews) {
        if (picked.length >= 2) break;
        if (selectedIdSet.has(row.id)) continue;
        picked.push({ row, rank: picked.length + 1 });
        selectedIdSet.add(row.id);
      }

      // (b) 最新1曲: シングルタグ曲を優先（トップ2と重複なら次の最新シングル）。
      //     シングル曲がプールにない場合は全種から最新1曲にフォールバック（Yuki決定）。
      //     【設計判断】消費済み判定をプール選択前に行う。これにより「シングルが存在するが
      //     すべてトップ2で消費済み」の場合も全種フォールバックとなり、3曲構造を維持する。
      const bySingleDate = byDate.filter(r => hasSingleTag(r) && !selectedIdSet.has(r.id));
      const latestCandidates = bySingleDate.length > 0 ? bySingleDate : byDate;
      for (const row of latestCandidates) {
        if (selectedIdSet.has(row.id)) continue;
        picked.push({ row, rank: 3 });
        selectedIdSet.add(row.id);
        break;
      }

      for (const { row, rank } of picked) {
        const order = encodeStarterOrder(mi, rank);
        newSelected.push({
          id: row.id,
          member: memberId,
          rank,
          views: viewCountMap.get(row._ytId),
          starter_order: order,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // (8) 差分計算（書き込み前に全計算を完了させる — abort safety）
    // ─────────────────────────────────────────────────────────────

    // 現行 is_starter=true の行（status不問・全fetchから収集）
    const currentStarters = allRows.filter(r => r.is_starter === true);
    const currentStarterIds = new Set(currentStarters.map(r => r.id));

    const newSelectedMap = new Map(newSelected.map(s => [s.id, s])); // id → selection

    // 削除対象: 現行 is_starter=true かつ新セットに含まれない
    const removals = currentStarters.filter(r => !newSelectedMap.has(r.id));

    // 追加/順序変更対象: 新セットの中で is_starter が現行と異なる or starter_order が異なる行
    const adds = newSelected.filter(s => {
      const row = allRows.find(r => r.id === s.id);
      if (!row) return true; // 万一rowが見つからない場合は書く
      return !row.is_starter || row.starter_order !== s.starter_order;
    });

    const changed = removals.length + adds.length;

    // ゼロdiff → 0書き込み
    if (changed === 0) {
      return json(200, {
        ok: true,
        selected: newSelected,
        changed: 0,
        removed: 0,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 空選曲ガード: 新セットが0件かつ既存スターターが存在する場合は全消しを回避して中止。
    // YouTube API が HTTP 200 + items:[] を返した場合（quota上限前後の空レスポンス等）に
    // viewCountMap が空 → eligiblePool が空 → newSelected が空 → diff がすべて removal になる。
    // data.error では検出できないため、書き込み直前に明示ガードを置く。
    // ─────────────────────────────────────────────────────────────
    if (newSelected.length === 0 && currentStarters.length > 0) {
      console.error('starter-refresh: 選曲結果が空。既存スターター全消しを回避し中止。');
      return json(500, { error: '選曲結果が空のため中止（0書き込み）', currentStarters: currentStarterIds.size });
    }

    // ─────────────────────────────────────────────────────────────
    // (9) DB書き込み
    //     全計算完了後にのみ書き込む（abort safety）
    //
    // 不変条件: starter_note はいかなるペイロードにも含めない。
    //   ユーザーが手動設定した starter_note は自動更新で上書きしてはならない。
    //   削除PATCHでも null をセットしない（カラムに触れない）。
    //
    // PATCH段階の部分失敗ポリシー: ログ記録して続行する。
    //   次週の自動更新で差分が再計算されself-healするため、即時中止より継続が適切。
    // ─────────────────────────────────────────────────────────────

    let removedCount = 0;
    let patchFailed = false;

    // (9a) 追加/順序変更: per-id PATCH を Promise.all で並列実行（削除より先に実行）
    //      追加→削除の順にすることで、タイムアウト等による中断時でも
    //      公開リストが一時的に空になる窓を最小化する。
    //      starter_note は含めない（上記不変条件）
    const addResults = await Promise.all(
      adds.map(async (s) => {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/videos?id=eq.${s.id}`,
          {
            method: 'PATCH',
            headers: sbHeaders(SUPABASE_KEY, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
            // starter_note は含めない（不変条件: ユーザーが設定したnoteを自動更新で消してはならない）
            body: JSON.stringify({ is_starter: true, starter_order: s.starter_order }),
          }
        );
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          // PATCH段階の部分失敗: ログ記録して続行（次週self-heal）
          console.error(`starter-refresh: 追加PATCH失敗 id=${s.id}: ${res.status} ${text.slice(0, 200)}`);
          return false;
        }
        return true;
      })
    );

    const addedCount = addResults.filter(Boolean).length;
    if (addedCount < adds.length) patchFailed = true;

    // (9b) 削除: 1つのグループPATCH（id=in.(...)）で一括処理（追加の後に実行）
    //      starter_note は含めない（上記不変条件）
    if (removals.length > 0) {
      const removalIds = removals.map(r => r.id).sort((a, b) => a - b); // 決定論的順序
      const remRes = await fetch(
        `${SUPABASE_URL}/rest/v1/videos?id=in.(${removalIds.join(',')})`,
        {
          method: 'PATCH',
          headers: sbHeaders(SUPABASE_KEY, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          // starter_note は含めない（不変条件: ユーザーが設定したnoteを自動更新で消してはならない）
          body: JSON.stringify({ is_starter: false, starter_order: null }),
        }
      );
      if (!remRes.ok) {
        const text = await remRes.text().catch(() => '');
        // PATCH段階の部分失敗: ログ記録して続行（次週self-heal）
        console.error(`starter-refresh: 削除PATCH失敗 ids=${removalIds}: ${remRes.status} ${text.slice(0, 200)}`);
        patchFailed = true;
      } else {
        removedCount = removalIds.length;
      }
    }

    // PATCH部分失敗: ok:false + 500 を返す（GitHub Actionsの ok!=true チェックで可視化）
    // 書き込み自体は続行済み（continue-and-self-heal ポリシー）。次週自動更新でself-heal。
    if (patchFailed) {
      return json(500, {
        ok: false,
        error: 'PATCH部分失敗（次週自動更新でself-heal）',
        selected: newSelected,
        changed: removedCount + addedCount,
        removed: removedCount,
      });
    }

    return json(200, {
      ok: true,
      selected: newSelected,
      changed: removedCount + addedCount,
      removed: removedCount,
    });

  } catch (e) {
    console.error('starter-refresh fatal error:', e);
    return json(500, { error: e.message });
  }
};
