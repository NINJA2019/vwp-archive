/* ═══ MU-TH-UR 6000 — NOSTROMO TERMINAL ═══
 * V.W.P ARCHIVE ADMIN v2
 *
 * Architecture:
 *   MU.Auth    — login / logout / session token
 *   MU.DB      — CRUD proxy via admin-query.js
 *   MU.Decode  — text decode animation (glyph → character)
 *   MU.UI      — component helpers
 *   MU.Tabs    — tab registry + routing
 *
 * Tabs:
 *   SONGS DATABASE  — full CRUD, search, pagination, inline edit, tag bulk, playlist import
 *   OBSERVER-LINK   — stats, moderation, hourly heatmap, client hash threat
 */

var MU = {};

/* ═══ Constants ═══ */
var MEMBERS = {
  vwp:     { name: 'V.W.P',   color: 'var(--c-vwp)' },
  kafu:    { name: 'KAF',     color: 'var(--c-kafu)' },
  rime:    { name: 'RIM',     color: 'var(--c-rime)' },
  harusar: { name: 'HARU',    color: 'var(--c-harusar)' },
  isekai:  { name: 'JOUCHO',  color: 'var(--c-isekai)' },
  koko:    { name: 'KOKO',    color: 'var(--c-koko)' }
};
var MEMBER_IDS = Object.keys(MEMBERS);
var PAGE_SIZE = 50;

function memberName(m) {
  if (!m) return '?';
  var parts = m.split(' ');
  if (parts.length === 1) return (MEMBERS[m] || {}).name || m.toUpperCase();
  return parts.map(function(s) { return (MEMBERS[s] || {}).name || s.toUpperCase(); }).join('+');
}
function memberColor(m) {
  if (!m) return 'var(--text-xdim)';
  var parts = m.split(' ');
  if (parts.length === 1) return (MEMBERS[m] || {}).color || 'var(--text-xdim)';
  return 'var(--c-vwp)';
}
function daysSince(d) { return d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 999; }
function fmtDate(d) { return d ? d.slice(0, 10).replace(/-/g, '/') : '—'; }
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ═══ Auth ═══ */
MU.Auth = (function() {
  var _token = sessionStorage.getItem('admin_token');
  return {
    async login(password) {
      try {
        var res = await fetch('/.netlify/functions/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password })
        });
        var data = await res.json();
        if (data.ok) {
          _token = data.token;
          sessionStorage.setItem('admin_token', _token);
          return { ok: true };
        }
        return { ok: false, msg: data.msg || 'ACCESS DENIED' };
      } catch (e) {
        return { ok: false, msg: 'NETWORK FAILURE — BRIDGE OFFLINE' };
      }
    },
    logout: function() { _token = null; sessionStorage.removeItem('admin_token'); },
    isAuthed: function() { return !!_token; },
    getToken: function() { return _token; }
  };
})();

/* ═══ DB ═══ */
MU.DB = (function() {
  async function call(body) {
    var token = MU.Auth.getToken();
    if (!token) throw new Error('NO SESSION — RE-LOGIN REQUIRED');
    var res = await fetch('/.netlify/functions/admin-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) {
      var msg = data.error || data.message || JSON.stringify(data);
      throw new Error('HTTP ' + res.status + ': ' + msg);
    }
    return data;
  }
  return {
    query: function(table, params) {
      var p = params || {};
      return call({
        table: table, select: p.select || '*',
        filter: p.filter || '', order: p.order || '',
        limit: p.limit || '', offset: p.offset || ''
      }).then(function(data) {
        if (!Array.isArray(data)) throw new Error(table + ' RETURNED NON-ARRAY');
        return data;
      });
    },
    insert: function(table, data) { return call({ action: 'insert', table: table, data: data }); },
    update: function(table, id, data) { return call({ action: 'update', table: table, id: id, data: data }); },
    remove: function(table, id) { return call({ action: 'delete', table: table, id: id }); },
    youtube: function(videoId) { return call({ action: 'youtube', videoId: videoId }); },
    playlistImport: function(playlistId, member, tags, albumId) {
      return call({ action: 'playlist-import', playlistId: playlistId, member: member, tags: tags || '', album_id: albumId || null });
    }
  };
})();

/* ═══ UI Helpers ═══ */
MU.UI = {
  metric: function(val, label, cls) {
    return '<div class="n-card n-metric"><div class="n-metric-val' +
      (cls ? ' ' + cls : '') + '">' + val + '</div><div class="n-metric-label">' + label + '</div></div>';
  },
  section: function(title, badge) {
    return '<div class="n-section-title">' + title + (badge || '') + '</div>';
  },
  badge: function(text, type) {
    return ' <span class="n-badge' + (type ? ' n-badge-' + type : '') + '">' + text + '</span>';
  },
  loading: function() { return '<div class="n-loading">ACCESSING DATABASE...</div>'; },
  alert: function(msg, type) {
    return '<div class="n-alert' + (type ? ' n-alert-' + type : '') + '">' + msg + '</div>';
  },
  dot: function(color) { return '<span class="n-dot" style="background:' + color + '"></span>'; },
  tag: function(t) { return '<span class="n-tag">' + esc(t) + '</span>'; },
  freshColor: function(d) { return d <= 30 ? 'var(--phosphor)' : d <= 60 ? 'var(--amber)' : 'var(--red)'; },
  hourColor: function(v, m) {
    var p = v / m;
    return p > .6 ? 'var(--amber)' : p > .3 ? 'var(--text-dim)' : 'var(--text-xdim)';
  }
};

/* ═══ Decode Animation ═══ */
MU.Decode = (function() {
  var GLYPHS = '◇◈⊕⊗△▽⬡⬢☉⊙◉▣▤▥▦▧▨▩';
  function decode(el) {
    var text = el.textContent;
    if (!text || text.length > 200) return;
    var chars = text.split('');
    el.textContent = '';
    chars.forEach(function(ch, i) {
      var span = document.createElement('span');
      span.className = 'decode-char';
      span.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      el.appendChild(span);
      setTimeout(function() { span.textContent = ch; }, 30 + i * 15 + Math.random() * 20);
    });
  }
  function decodeAll(container) {
    var els = container.querySelectorAll('[data-decode]');
    els.forEach(function(el) { decode(el); });
  }
  return { decode: decode, decodeAll: decodeAll };
})();

/* ═══ Tabs ═══ */
MU.Tabs = (function() {
  var registry = {};
  var active = null;
  return {
    register: function(id, cfg) { registry[id] = cfg; },
    mount: function() {
      var nav = document.getElementById('tab-nav');
      var cnt = document.getElementById('tab-content');
      nav.innerHTML = ''; cnt.innerHTML = '';
      var sorted = Object.entries(registry).sort(function(a, b) { return (a[1].order || 0) - (b[1].order || 0); });
      sorted.forEach(function(entry) {
        var id = entry[0], cfg = entry[1];
        var btn = document.createElement('button');
        btn.className = 'tab-btn'; btn.dataset.tab = id;
        btn.textContent = cfg.label;
        btn.addEventListener('click', function() { MU.Tabs.switchTo(id); });
        nav.appendChild(btn);
        var panel = document.createElement('div');
        panel.className = 'tab-panel'; panel.id = 'panel-' + id;
        cnt.appendChild(panel);
      });
      if (sorted.length) this.switchTo(sorted[0][0]);
    },
    switchTo: function(id) {
      if (!registry[id]) return;
      active = id;
      document.querySelectorAll('.tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.tab === id);
      });
      document.querySelectorAll('.tab-panel').forEach(function(p) {
        p.classList.toggle('active', p.id === 'panel-' + id);
      });
      var panel = document.getElementById('panel-' + id);
      panel.innerHTML = MU.UI.loading();
      registry[id].render(panel);
    },
    getActive: function() { return active; }
  };
})();

/* ═══ Modal ═══ */
MU.Modal = {
  open: function(title, contentHtml, opts) {
    opts = opts || {};
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="n-modal-bg"><div class="n-modal">' +
      '<div class="n-modal-title">' + title + '</div>' +
      '<div class="n-modal-body">' + contentHtml + '</div>' +
      (opts.noActions ? '' : '<div class="n-form-actions">' +
        '<button class="n-btn" id="modal-cancel">CANCEL</button>' +
        '<button class="n-btn" id="modal-ok">' + (opts.okLabel || 'CONFIRM') + '</button>' +
      '</div>') +
      '</div></div>';
    var bg = root.querySelector('.n-modal-bg');
    bg.addEventListener('click', function(e) { if (e.target === bg) MU.Modal.close(); });
    if (document.getElementById('modal-cancel')) {
      document.getElementById('modal-cancel').addEventListener('click', MU.Modal.close);
    }
    if (document.getElementById('modal-ok') && opts.onOk) {
      document.getElementById('modal-ok').addEventListener('click', function() { opts.onOk(); });
    }
    return root.querySelector('.n-modal');
  },
  close: function() { document.getElementById('modal-root').innerHTML = ''; }
};

/* ═══════════════════════════════════════
 *   TAB: INCOMING TRANSMISSION
 * ═══════════════════════════════════════ */
MU.Tabs.register('incoming', {
  label: 'INCOMING TRANSMISSION', order: 5,
  render: async function(el) {
    var U = MU.UI;
    var CONTENT_TYPES = ['all', 'song', 'live', 'shorts', 'announcement'];
    try {
      var pending = await MU.DB.query('videos', {
        select: 'id,title,member,date,url,tags,content_type,status,ingested_at,source',
        filter: 'status=eq.pending',
        order: 'ingested_at.desc.nullslast',
        limit: '9999'
      });

      // タブボタンのバッジを件数で更新
      var tabBtn = document.querySelector('.tab-btn[data-tab="incoming"]');
      if (tabBtn) {
        tabBtn.textContent = 'INCOMING TRANSMISSION' + (pending.length > 0 ? ' [' + pending.length + ']' : '');
      }

      var state = { videos: pending, activeType: 'all', selected: new Set() };

      function getFiltered() {
        if (state.activeType === 'all') return state.videos.slice();
        return state.videos.filter(function(v) { return v.content_type === state.activeType; });
      }

      function countByType(type) {
        if (type === 'all') return state.videos.length;
        return state.videos.filter(function(v) { return v.content_type === type; }).length;
      }

      function renderSubTabs() {
        return '<div class="ic-subtabs">' +
          CONTENT_TYPES.map(function(t) {
            var cnt = countByType(t);
            var cls = 'ic-subtab' + (state.activeType === t ? ' active' : '');
            return '<button class="' + cls + '" data-type="' + t + '">' +
              t.toUpperCase() +
              (cnt > 0 ? ' <span class="n-badge">' + cnt + '</span>' : '') +
              '</button>';
          }).join('') +
          '</div>';
      }

      function renderTable() {
        var filtered = getFiltered();
        if (filtered.length === 0) {
          return '<div class="n-note" style="margin-top:16px">QUEUE EMPTY — NO PENDING RECORDS</div>';
        }
        var allChecked = filtered.length > 0 && filtered.every(function(v) { return state.selected.has(v.id); });
        var html =
          '<div class="ic-bulk-bar">' +
          '<label class="ic-check-label"><input type="checkbox" id="ic-select-all"' + (allChecked ? ' checked' : '') + '> SELECT ALL (' + filtered.length + ')</label>' +
          '<div class="n-btn-group">' +
          '<button class="n-btn ic-bulk-publish" ' + (state.selected.size === 0 ? 'disabled' : '') + '>PUBLISH SELECTED (' + state.selected.size + ')</button>' +
          '<button class="n-btn n-btn-red ic-bulk-reject" ' + (state.selected.size === 0 ? 'disabled' : '') + '>REJECT SELECTED</button>' +
          '</div></div>' +
          '<table class="n-table ic-table"><thead><tr>' +
          '<th></th><th>THUMB</th><th>TITLE</th><th>MEMBER</th><th>DATE</th><th>TYPE</th><th>TAGS</th><th></th>' +
          '</tr></thead><tbody>' +
          filtered.map(function(v) {
            var ytId = (v.url || '').match(/(?:v=|youtu\.be\/)([^&?#]+)/);
            ytId = ytId ? ytId[1] : '';
            var thumb = ytId ? 'https://img.youtube.com/vi/' + ytId + '/default.jpg' : '';
            var chk = state.selected.has(v.id) ? ' checked' : '';
            return '<tr data-id="' + v.id + '">' +
              '<td><input type="checkbox" class="ic-row-chk"' + chk + ' data-id="' + v.id + '"></td>' +
              '<td class="ic-thumb-cell">' + (thumb ? '<img src="' + esc(thumb) + '" alt="" class="ic-thumb" loading="lazy">' : '—') + '</td>' +
              '<td class="title-col ic-title">' + esc(v.title || '—') + '</td>' +
              '<td>' +
                '<input class="n-input n-input-sm ic-edit-member" data-id="' + v.id + '" value="' + esc(v.member || '') + '" title="MEMBER">' +
              '</td>' +
              '<td class="mono">' + fmtDate(v.date) + '</td>' +
              '<td>' +
                '<select class="n-select ic-edit-type" data-id="' + v.id + '">' +
                ['song', 'live', 'shorts', 'announcement'].map(function(t) {
                  return '<option value="' + t + '"' + (v.content_type === t ? ' selected' : '') + '>' + t.toUpperCase() + '</option>';
                }).join('') +
                '</select>' +
              '</td>' +
              '<td>' +
                '<input class="n-input n-input-sm ic-edit-tags" data-id="' + v.id + '" value="' + esc(v.tags || '') + '" title="TAGS">' +
              '</td>' +
              '<td class="r"><div class="n-btn-group">' +
                '<button class="n-btn n-btn-sm ic-save" data-id="' + v.id + '">SAVE</button>' +
                '<button class="n-btn n-btn-sm ic-publish" data-id="' + v.id + '">PUBLISH</button>' +
                '<button class="n-btn n-btn-sm n-btn-red ic-reject" data-id="' + v.id + '">REJECT</button>' +
              '</div></td></tr>';
          }).join('') +
          '</tbody></table>';
        return html;
      }

      function fullRender() {
        el.innerHTML =
          '<div class="n-section">' + U.section('INCOMING TRANSMISSION', U.badge(pending.length + ' PENDING', pending.length > 0 ? 'warn' : '')) +
          renderSubTabs() +
          '<div id="ic-table-wrap">' + renderTable() + '</div>' +
          '</div>';
        MU.Decode.decodeAll(el);
        bindEvents();
      }

      function bindEvents() {
        // サブタブ切替
        el.querySelectorAll('.ic-subtab').forEach(function(btn) {
          btn.addEventListener('click', function() {
            state.activeType = btn.dataset.type;
            state.selected.clear();
            document.getElementById('ic-table-wrap').innerHTML = renderTable();
            el.querySelectorAll('.ic-subtab').forEach(function(b) {
              b.classList.toggle('active', b.dataset.type === state.activeType);
            });
            rebindTableEvents();
          });
        });
        rebindTableEvents();
      }

      function rebindTableEvents() {
        // SELECT ALL
        var selectAll = document.getElementById('ic-select-all');
        if (selectAll) {
          selectAll.addEventListener('change', function() {
            var filtered = getFiltered();
            if (selectAll.checked) { filtered.forEach(function(v) { state.selected.add(v.id); }); }
            else { state.selected.clear(); }
            document.getElementById('ic-table-wrap').innerHTML = renderTable();
            rebindTableEvents();
          });
        }

        // 行チェックボックス
        el.querySelectorAll('.ic-row-chk').forEach(function(chk) {
          chk.addEventListener('change', function() {
            var id = parseInt(chk.dataset.id, 10);
            if (chk.checked) state.selected.add(id);
            else state.selected.delete(id);
            // バルクバーの件数だけ更新
            var bulkPublish = document.querySelector('.ic-bulk-publish');
            var bulkReject = document.querySelector('.ic-bulk-reject');
            if (bulkPublish) {
              bulkPublish.textContent = 'PUBLISH SELECTED (' + state.selected.size + ')';
              bulkPublish.disabled = state.selected.size === 0;
            }
            if (bulkReject) bulkReject.disabled = state.selected.size === 0;
          });
        });

        // SAVE（member + tags + content_type の一括保存）
        el.querySelectorAll('.ic-save').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            var id = btn.dataset.id;
            var row = btn.closest('tr');
            var memberVal = row.querySelector('.ic-edit-member').value.trim();
            var tagsVal = row.querySelector('.ic-edit-tags').value.trim();
            var typeVal = row.querySelector('.ic-edit-type').value;
            try {
              await MU.DB.update('videos', id, { member: memberVal, tags: tagsVal, content_type: typeVal });
              // ローカル状態も更新
              var v = state.videos.find(function(x) { return String(x.id) === String(id); });
              if (v) { v.member = memberVal; v.tags = tagsVal; v.content_type = typeVal; }
              btn.textContent = 'SAVED'; btn.disabled = true;
              setTimeout(function() { btn.textContent = 'SAVE'; btn.disabled = false; }, 1500);
            } catch (e) { alert('SAVE FAILED: ' + e.message); }
          });
        });

        // PUBLISH 単体
        el.querySelectorAll('.ic-publish').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            var id = btn.dataset.id;
            if (!confirm('PUBLISH RECORD #' + id + '?')) return;
            try {
              await MU.DB.update('videos', id, { status: 'published' });
              state.videos = state.videos.filter(function(v) { return String(v.id) !== String(id); });
              state.selected.delete(parseInt(id, 10));
              document.getElementById('ic-table-wrap').innerHTML = renderTable();
              rebindTableEvents();
              updateBadge();
            } catch (e) { alert('PUBLISH FAILED: ' + e.message); }
          });
        });

        // REJECT 単体
        el.querySelectorAll('.ic-reject').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            var id = btn.dataset.id;
            if (!confirm('REJECT RECORD #' + id + '?')) return;
            try {
              await MU.DB.update('videos', id, { status: 'rejected' });
              state.videos = state.videos.filter(function(v) { return String(v.id) !== String(id); });
              state.selected.delete(parseInt(id, 10));
              document.getElementById('ic-table-wrap').innerHTML = renderTable();
              rebindTableEvents();
              updateBadge();
            } catch (e) { alert('REJECT FAILED: ' + e.message); }
          });
        });

        // PUBLISH 一括
        var bulkPublishBtn = el.querySelector('.ic-bulk-publish');
        if (bulkPublishBtn) {
          bulkPublishBtn.addEventListener('click', async function() {
            var ids = Array.from(state.selected);
            if (ids.length === 0) return;
            if (!confirm('PUBLISH ' + ids.length + ' RECORDS?')) return;
            try {
              await Promise.all(ids.map(function(id) { return MU.DB.update('videos', id, { status: 'published' }); }));
              state.videos = state.videos.filter(function(v) { return !state.selected.has(v.id); });
              state.selected.clear();
              document.getElementById('ic-table-wrap').innerHTML = renderTable();
              rebindTableEvents();
              updateBadge();
            } catch (e) { alert('BULK PUBLISH FAILED: ' + e.message); }
          });
        }

        // REJECT 一括
        var bulkRejectBtn = el.querySelector('.ic-bulk-reject');
        if (bulkRejectBtn) {
          bulkRejectBtn.addEventListener('click', async function() {
            var ids = Array.from(state.selected);
            if (ids.length === 0) return;
            if (!confirm('REJECT ' + ids.length + ' RECORDS?')) return;
            try {
              await Promise.all(ids.map(function(id) { return MU.DB.update('videos', id, { status: 'rejected' }); }));
              state.videos = state.videos.filter(function(v) { return !state.selected.has(v.id); });
              state.selected.clear();
              document.getElementById('ic-table-wrap').innerHTML = renderTable();
              rebindTableEvents();
              updateBadge();
            } catch (e) { alert('BULK REJECT FAILED: ' + e.message); }
          });
        }
      }

      function updateBadge() {
        var tabBtn = document.querySelector('.tab-btn[data-tab="incoming"]');
        if (tabBtn) {
          tabBtn.textContent = 'INCOMING TRANSMISSION' + (state.videos.length > 0 ? ' [' + state.videos.length + ']' : '');
        }
      }

      fullRender();

    } catch (e) {
      el.innerHTML = U.alert('SYSTEM ERROR: ' + esc(e.message));
    }
  }
});

/* ═══════════════════════════════════════
 *   TAB: SONGS DATABASE
 * ═══════════════════════════════════════ */
MU.Tabs.register('songs', {
  label: 'SONGS DATABASE', order: 10,
  render: async function(el) {
    var U = MU.UI;
    try {
      // Fetch data
      var results = await Promise.all([
        MU.DB.query('videos', { select: 'id', limit: '9999' }),
        MU.DB.query('videos', { select: 'id', filter: 'album_id=is.null', limit: '9999' }),
        MU.DB.query('albums', { select: 'id,name', limit: '999' }),
        MU.DB.query('videos', {
          select: 'id,title,member,date,url,tags,note,spotify_url,album_id',
          order: 'date.desc.nullslast', limit: '9999'
        })
      ]);
      var totalRows = results[0];
      var unlinkedRows = results[1];
      var albumRows = results[2];
      var allVideos = results[3];

      // Duplicate count
      var urlMap = {};
      allVideos.forEach(function(v) { urlMap[v.url] = (urlMap[v.url] || 0) + 1; });
      var dupCount = Object.values(urlMap).filter(function(c) { return c > 1; }).length;

      // Freshness per member
      var freshness = [];
      var seen = {};
      allVideos.forEach(function(v) {
        if (!v.member || v.member.indexOf(' ') !== -1 || seen[v.member]) return;
        seen[v.member] = true;
        var d = daysSince(v.date);
        freshness.push({ member: v.member, title: v.title, date: v.date, days: d });
      });
      freshness.sort(function(a, b) { return a.days - b.days; });
      var staleMembers = freshness.filter(function(f) { return f.days > 60; });

      // Album map for display
      var albumMap = {};
      albumRows.forEach(function(a) { albumMap[a.id] = a.name; });

      // ── Render stats ──
      var statsHtml =
        '<div class="n-section">' + U.section('QUICK STATS') +
        '<div class="n-grid n-g4">' +
          U.metric(totalRows.length.toLocaleString(), 'TOTAL SONGS') +
          U.metric(unlinkedRows.length.toLocaleString(), 'UNLINKED', unlinkedRows.length > 50 ? 'warn' : '') +
          U.metric(dupCount.toLocaleString(), 'DUPLICATES', dupCount > 0 ? 'err' : '') +
          U.metric(albumRows.length.toLocaleString(), 'ALBUMS') +
        '</div></div>' +

        '<div class="n-section">' + U.section('CONTENT FRESHNESS', U.badge('LIVE')) +
        '<div class="n-card n-card-wide">' +
        freshness.map(function(f) {
          var c = memberColor(f.member);
          return '<div class="n-fresh-row">' + U.dot(c) +
            '<span style="width:56px;font-size:11px;color:' + c + '">' + memberName(f.member) + '</span>' +
            '<span style="flex:1;font-size:10px;color:var(--text-dim)">' + esc(f.title) + ' — ' + fmtDate(f.date) + '</span>' +
            '<span style="font-size:11px;color:' + U.freshColor(f.days) + '">' + f.days + 'D</span></div>';
        }).join('') +
        (staleMembers.length ? U.alert(staleMembers.map(function(m) { return memberName(m.member); }).join(', ') + ' — 60D+ SINCE LAST UPDATE', 'warn') : '') +
        '</div></div>';

      // ── Table state ──
      var state = {
        videos: allVideos,
        filtered: allVideos.slice(),
        page: 0,
        search: '',
        sortCol: 'date',
        sortAsc: false,
        memberFilter: '',
        albums: albumRows,
        albumMap: albumMap
      };

      // ── Toolbar ──
      var toolbarHtml =
        '<div class="n-section">' + U.section('SONG TABLE', U.badge(allVideos.length + ' RECORDS')) +
        '<div class="n-toolbar">' +
          '<input class="n-input" id="song-search" placeholder="SEARCH TITLE / URL...">' +
          '<select class="n-select" id="song-member-filter"><option value="">ALL MEMBERS</option>' +
          MEMBER_IDS.map(function(m) { return '<option value="' + m + '">' + memberName(m) + '</option>'; }).join('') +
          '</select>' +
          '<button class="n-btn" id="song-add-btn">+ ADD RECORD</button>' +
          '<button class="n-btn n-btn-amber" id="song-import-btn">PLAYLIST IMPORT</button>' +
        '</div>' +
        '<div id="song-table-wrap"></div>' +
        '<div class="n-pagination" id="song-pagination"></div>' +
        '</div>';

      el.innerHTML = statsHtml + toolbarHtml;
      MU.Decode.decodeAll(el);

      // ── Table rendering ──
      function applyFilters() {
        var q = state.search.toLowerCase();
        state.filtered = state.videos.filter(function(v) {
          if (state.memberFilter && v.member !== state.memberFilter && (!v.member || v.member.indexOf(state.memberFilter) === -1)) return false;
          if (q && (v.title || '').toLowerCase().indexOf(q) === -1 && (v.url || '').toLowerCase().indexOf(q) === -1 && (v.tags || '').toLowerCase().indexOf(q) === -1) return false;
          return true;
        });
        // Sort
        state.filtered.sort(function(a, b) {
          var av = a[state.sortCol] || '', bv = b[state.sortCol] || '';
          if (av < bv) return state.sortAsc ? -1 : 1;
          if (av > bv) return state.sortAsc ? 1 : -1;
          return 0;
        });
        state.page = 0;
        renderTable();
      }

      function renderTable() {
        var start = state.page * PAGE_SIZE;
        var pageData = state.filtered.slice(start, start + PAGE_SIZE);
        var totalPages = Math.ceil(state.filtered.length / PAGE_SIZE) || 1;

        var cols = [
          { key: 'title', label: 'TITLE', sort: true },
          { key: 'member', label: 'MEMBER', sort: true },
          { key: 'date', label: 'DATE', sort: true },
          { key: 'tags', label: 'TAGS', sort: false },
          { key: '_actions', label: '', sort: false }
        ];

        var thead = '<tr>' + cols.map(function(c) {
          var cls = c.sort ? ' sortable' : '';
          if (c.key === state.sortCol) cls += ' sorted' + (state.sortAsc ? ' asc' : '');
          return '<th class="' + cls + '" data-sort="' + (c.sort ? c.key : '') + '">' + c.label + '</th>';
        }).join('') + '</tr>';

        var tbody = pageData.map(function(v) {
          var tags = (v.tags || '').split(/[ ,]+/).filter(Boolean).map(function(t) { return MU.UI.tag(t); }).join('');
          var mc = memberColor(v.member);
          return '<tr data-id="' + v.id + '">' +
            '<td class="title-col">' + esc(v.title || '—') + '</td>' +
            '<td style="color:' + mc + '">' + memberName(v.member) + '</td>' +
            '<td class="mono">' + fmtDate(v.date) + '</td>' +
            '<td>' + tags + '</td>' +
            '<td class="r"><div class="n-btn-group">' +
              '<button class="n-btn n-btn-sm song-edit" data-id="' + v.id + '">EDIT</button>' +
              '<button class="n-btn n-btn-sm n-btn-red song-del" data-id="' + v.id + '">DEL</button>' +
            '</div></td></tr>';
        }).join('');

        document.getElementById('song-table-wrap').innerHTML =
          '<table class="n-table"><thead>' + thead + '</thead><tbody>' +
          (tbody || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-xdim)">NO RECORDS FOUND</td></tr>') +
          '</tbody></table>';

        document.getElementById('song-pagination').innerHTML =
          '<span>' + state.filtered.length + ' RECORDS — PAGE ' + (state.page + 1) + '/' + totalPages + '</span>' +
          '<div class="n-btn-group">' +
            '<button class="n-btn n-btn-sm" id="page-prev"' + (state.page === 0 ? ' disabled' : '') + '>&lt; PREV</button>' +
            '<button class="n-btn n-btn-sm" id="page-next"' + (state.page >= totalPages - 1 ? ' disabled' : '') + '>NEXT &gt;</button>' +
          '</div>';

        // Sort handlers
        document.querySelectorAll('#song-table-wrap th[data-sort]').forEach(function(th) {
          if (!th.dataset.sort) return;
          th.addEventListener('click', function() {
            if (state.sortCol === th.dataset.sort) { state.sortAsc = !state.sortAsc; }
            else { state.sortCol = th.dataset.sort; state.sortAsc = true; }
            applyFilters();
          });
        });

        // Pagination
        var prevBtn = document.getElementById('page-prev');
        var nextBtn = document.getElementById('page-next');
        if (prevBtn) prevBtn.addEventListener('click', function() { if (state.page > 0) { state.page--; renderTable(); } });
        if (nextBtn) nextBtn.addEventListener('click', function() { state.page++; renderTable(); });

        // Edit/Delete handlers
        document.querySelectorAll('.song-edit').forEach(function(btn) {
          btn.addEventListener('click', function() { openEditModal(btn.dataset.id); });
        });
        document.querySelectorAll('.song-del').forEach(function(btn) {
          btn.addEventListener('click', function() { confirmDelete(btn.dataset.id); });
        });
      }

      // Search + filter events
      var searchTimer;
      document.getElementById('song-search').addEventListener('input', function(e) {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function() { state.search = e.target.value; applyFilters(); }, 200);
      });
      document.getElementById('song-member-filter').addEventListener('change', function(e) {
        state.memberFilter = e.target.value; applyFilters();
      });

      applyFilters();

      // ── Add record ──
      document.getElementById('song-add-btn').addEventListener('click', function() {
        var html =
          '<div class="n-form-row"><div class="n-form-label">YOUTUBE URL OR VIDEO ID</div>' +
          '<input class="n-input" id="add-url" placeholder="https://youtube.com/watch?v=..."></div>' +
          '<button class="n-btn n-btn-sm" id="add-fetch" style="margin-bottom:12px">FETCH METADATA</button>' +
          '<div id="add-fetched"></div>' +
          '<div class="n-form-row"><div class="n-form-label">TITLE</div><input class="n-input" id="add-title"></div>' +
          '<div class="n-form-row"><div class="n-form-label">DATE (YYYY-MM-DD)</div><input class="n-input" id="add-date"></div>' +
          '<div class="n-form-row"><div class="n-form-label">MEMBER</div>' +
          '<select class="n-select" id="add-member" style="width:100%">' +
          MEMBER_IDS.map(function(m) { return '<option value="' + m + '">' + memberName(m) + '</option>'; }).join('') +
          '<option value="vwp">V.W.P (GROUP)</option></select></div>' +
          '<div class="n-form-row"><div class="n-form-label">TAGS (SPACE-SEP)</div><input class="n-input" id="add-tags"></div>' +
          '<div class="n-form-row"><div class="n-form-label">NOTE</div><input class="n-input" id="add-note"></div>' +
          '<div class="n-form-row"><div class="n-form-label">ALBUM</div>' +
          '<select class="n-select" id="add-album" style="width:100%"><option value="">NONE</option>' +
          state.albums.map(function(a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('') +
          '</select></div>';

        var modal = MU.Modal.open('ADD NEW RECORD', html, {
          okLabel: 'INSERT',
          onOk: async function() {
            var url = document.getElementById('add-url').value.trim();
            var title = document.getElementById('add-title').value.trim();
            var member = document.getElementById('add-member').value;
            if (!url || !title || !member) { alert('URL, TITLE, AND MEMBER REQUIRED'); return; }
            // Normalize URL
            var vidMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            if (vidMatch) url = 'https://www.youtube.com/watch?v=' + vidMatch[1];

            try {
              await MU.DB.insert('videos', {
                url: url,
                title: title,
                date: document.getElementById('add-date').value.trim() || null,
                member: member,
                tags: document.getElementById('add-tags').value.trim(),
                note: document.getElementById('add-note').value.trim(),
                album_id: document.getElementById('add-album').value || null,
                spotify_url: null
              });
              MU.Modal.close();
              MU.Tabs.switchTo('songs');
            } catch (e) {
              alert('INSERT FAILED: ' + e.message);
            }
          }
        });

        // Fetch metadata
        document.getElementById('add-fetch').addEventListener('click', async function() {
          var urlVal = document.getElementById('add-url').value.trim();
          var vidMatch = urlVal.match(/(?:v=|youtu\.be\/|^)([a-zA-Z0-9_-]{11})(?:$|&)/);
          if (!vidMatch) { document.getElementById('add-fetched').innerHTML = MU.UI.alert('INVALID VIDEO ID'); return; }
          document.getElementById('add-fetched').innerHTML = '<div class="n-loading">QUERYING YOUTUBE API...</div>';
          try {
            var meta = await MU.DB.youtube(vidMatch[1]);
            document.getElementById('add-title').value = meta.title || '';
            document.getElementById('add-date').value = meta.date || '';
            if (!document.getElementById('add-url').value.match(/youtube\.com|youtu\.be/)) {
              document.getElementById('add-url').value = 'https://www.youtube.com/watch?v=' + vidMatch[1];
            }
            document.getElementById('add-fetched').innerHTML = MU.UI.alert('METADATA LOADED: ' + esc(meta.title), 'ok');
          } catch (e) {
            document.getElementById('add-fetched').innerHTML = MU.UI.alert('FETCH FAILED: ' + e.message);
          }
        });
      });

      // ── Edit modal ──
      function openEditModal(id) {
        var video = state.videos.find(function(v) { return String(v.id) === String(id); });
        if (!video) return;
        var html =
          '<div class="n-form-row"><div class="n-form-label">TITLE</div><input class="n-input" id="edit-title" value="' + esc(video.title || '') + '"></div>' +
          '<div class="n-form-row"><div class="n-form-label">DATE (YYYY-MM-DD)</div><input class="n-input" id="edit-date" value="' + esc(video.date || '') + '"></div>' +
          '<div class="n-form-row"><div class="n-form-label">MEMBER</div>' +
          '<select class="n-select" id="edit-member" style="width:100%">' +
          MEMBER_IDS.map(function(m) {
            return '<option value="' + m + '"' + (video.member === m ? ' selected' : '') + '>' + memberName(m) + '</option>';
          }).join('') + '</select></div>' +
          '<div class="n-form-row"><div class="n-form-label">TAGS (SPACE-SEP)</div><input class="n-input" id="edit-tags" value="' + esc(video.tags || '') + '"></div>' +
          '<div class="n-form-row"><div class="n-form-label">NOTE</div><input class="n-input" id="edit-note" value="' + esc(video.note || '') + '"></div>' +
          '<div class="n-form-row"><div class="n-form-label">SPOTIFY URL</div><input class="n-input" id="edit-spotify" value="' + esc(video.spotify_url || '') + '" style="text-transform:none"></div>' +
          '<div class="n-form-row"><div class="n-form-label">ALBUM</div>' +
          '<select class="n-select" id="edit-album" style="width:100%"><option value="">NONE</option>' +
          state.albums.map(function(a) {
            return '<option value="' + a.id + '"' + (String(video.album_id) === String(a.id) ? ' selected' : '') + '>' + esc(a.name) + '</option>';
          }).join('') + '</select></div>' +
          '<div class="n-form-row"><div class="n-form-label">URL</div>' +
          '<div style="font-size:10px;color:var(--text-xdim);word-break:break-all">' + esc(video.url || '') + '</div></div>';

        MU.Modal.open('EDIT RECORD #' + id, html, {
          okLabel: 'SAVE',
          onOk: async function() {
            try {
              await MU.DB.update('videos', id, {
                title: document.getElementById('edit-title').value.trim(),
                date: document.getElementById('edit-date').value.trim() || null,
                member: document.getElementById('edit-member').value,
                tags: document.getElementById('edit-tags').value.trim(),
                note: document.getElementById('edit-note').value.trim(),
                spotify_url: document.getElementById('edit-spotify').value.trim() || null,
                album_id: document.getElementById('edit-album').value || null
              });
              MU.Modal.close();
              MU.Tabs.switchTo('songs');
            } catch (e) {
              alert('UPDATE FAILED: ' + e.message);
            }
          }
        });
      }

      // ── Delete confirm ──
      function confirmDelete(id) {
        var video = state.videos.find(function(v) { return String(v.id) === String(id); });
        if (!video) return;
        MU.Modal.open('CONFIRM DELETION', MU.UI.alert('PURGE RECORD #' + id + ': ' + esc(video.title || '?') + '?', 'warn'), {
          okLabel: 'PURGE',
          onOk: async function() {
            try {
              await MU.DB.remove('videos', id);
              MU.Modal.close();
              MU.Tabs.switchTo('songs');
            } catch (e) {
              alert('DELETE FAILED: ' + e.message);
            }
          }
        });
      }

      // ── Playlist import ──
      document.getElementById('song-import-btn').addEventListener('click', function() {
        var html =
          '<div class="n-form-row"><div class="n-form-label">YOUTUBE PLAYLIST ID</div>' +
          '<input class="n-input" id="import-playlist" placeholder="PL..."></div>' +
          '<div class="n-form-row"><div class="n-form-label">MEMBER</div>' +
          '<select class="n-select" id="import-member" style="width:100%">' +
          MEMBER_IDS.map(function(m) { return '<option value="' + m + '">' + memberName(m) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="n-form-row"><div class="n-form-label">TAGS (SPACE-SEP, OPTIONAL)</div>' +
          '<input class="n-input" id="import-tags"></div>' +
          '<div class="n-form-row"><div class="n-form-label">ALBUM (OPTIONAL)</div>' +
          '<select class="n-select" id="import-album" style="width:100%"><option value="">NONE</option>' +
          state.albums.map(function(a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('') +
          '</select></div>' +
          '<div id="import-result"></div>';

        MU.Modal.open('PLAYLIST IMPORT', html, {
          okLabel: 'IMPORT',
          onOk: async function() {
            var plId = document.getElementById('import-playlist').value.trim();
            var member = document.getElementById('import-member').value;
            var tags = document.getElementById('import-tags').value.trim();
            var albumId = document.getElementById('import-album').value;
            if (!plId) { alert('PLAYLIST ID REQUIRED'); return; }
            document.getElementById('import-result').innerHTML = '<div class="n-loading">IMPORTING... THIS MAY TAKE A MOMENT</div>';
            try {
              var result = await MU.DB.playlistImport(plId, member, tags, albumId);
              document.getElementById('import-result').innerHTML =
                MU.UI.alert('COMPLETE — TOTAL: ' + result.total + ' / INSERTED: ' + result.inserted + ' / SKIPPED: ' + result.skipped, 'ok');
              // Disable OK button to prevent double import
              var okBtn = document.getElementById('modal-ok');
              if (okBtn) { okBtn.disabled = true; okBtn.textContent = 'DONE'; }
            } catch (e) {
              document.getElementById('import-result').innerHTML = MU.UI.alert('IMPORT FAILED: ' + e.message);
            }
          }
        });
      });

    } catch (e) {
      el.innerHTML = MU.UI.alert('SYSTEM ERROR: ' + esc(e.message));
    }
  }
});

/* ═══════════════════════════════════════
 *   TAB: OBSERVER-LINK
 * ═══════════════════════════════════════ */
MU.Tabs.register('ol', {
  label: 'OBSERVER-LINK', order: 20,
  render: async function(el) {
    var U = MU.UI;
    try {
      var results = await Promise.all([
        MU.DB.query('song_bottles', { select: 'id,status,video_id,created_at,client_hash,message', limit: '9999' }),
        MU.DB.query('song_bottles', {
          select: 'id,status,video_id,matched_with,fallback_video_id,created_at,client_hash,message',
          order: 'created_at.desc', limit: '50'
        }),
        MU.DB.query('videos', { select: 'id,title,member', limit: '9999' })
      ]);
      var allBottles = results[0];
      var recentBottles = results[1];
      var allVideos = results[2];

      // Video lookup
      var vidMap = {};
      allVideos.forEach(function(v) { vidMap[v.id] = v; });

      // Status counts
      var sc = { waiting: 0, matched: 0, fallback: 0, expired: 0 };
      allBottles.forEach(function(b) { sc[b.status] = (sc[b.status] || 0) + 1; });

      // Member breakdown
      var memberOL = {};
      allBottles.forEach(function(b) {
        var v = vidMap[b.video_id];
        if (!v || !v.member) return;
        v.member.split(' ').forEach(function(m) {
          if (!memberOL[m]) memberOL[m] = { sent: 0, matched: 0, fallback: 0 };
          memberOL[m].sent++;
          if (b.status === 'matched') memberOL[m].matched++;
          if (b.status === 'fallback') memberOL[m].fallback++;
        });
      });
      var memArr = Object.keys(memberOL).map(function(m) {
        var d = memberOL[m];
        return { id: m, waiting: d.sent - d.matched - d.fallback, matched: d.matched, fallback: d.fallback, total: d.sent };
      }).sort(function(a, b) { return b.total - a.total; });
      var maxMem = Math.max.apply(null, memArr.map(function(m) { return m.total; }).concat([1]));

      // Hourly distribution (JST)
      var hourly = new Array(24).fill(0);
      allBottles.forEach(function(b) {
        if (!b.created_at) return;
        var h = (new Date(b.created_at).getUTCHours() + 9) % 24;
        hourly[h]++;
      });
      var maxH = Math.max.apply(null, hourly.concat([1]));
      var peakH = hourly.indexOf(maxH);
      var totalB = hourly.reduce(function(a, b) { return a + b; }, 0);
      var evShare = totalB ? Math.round(hourly.slice(18, 24).reduce(function(a, b) { return a + b; }, 0) / totalB * 100) : 0;

      // Client hash frequency (threat detection)
      var hashCount = {};
      allBottles.forEach(function(b) {
        if (b.client_hash) hashCount[b.client_hash] = (hashCount[b.client_hash] || 0) + 1;
      });
      var suspectHashes = Object.entries(hashCount)
        .filter(function(e) { return e[1] >= 10; })
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 10);

      // ── Render ──
      var statsHtml =
        '<div class="n-section">' + U.section('BOTTLE POOL') +
        '<div class="n-grid n-g4">' +
          U.metric(sc.waiting, 'WAITING', 'warn') +
          U.metric(sc.matched, 'MATCHED') +
          U.metric(sc.fallback, 'FALLBACK', 'err') +
          U.metric(sc.expired || 0, 'EXPIRED') +
        '</div></div>';

      var memberHtml =
        '<div class="n-section">' + U.section('MEMBER BREAKDOWN') +
        '<div class="n-card n-card-wide">' +
        memArr.map(function(m) {
          var c = memberColor(m.id);
          return '<div class="n-fresh-row">' + U.dot(c) +
            '<span style="width:52px;font-size:11px;color:' + c + '">' + memberName(m.id) + '</span>' +
            '<div class="n-sbar" style="flex:1;display:flex;gap:1px;height:16px;overflow:hidden">' +
              '<div style="flex:' + m.waiting + ';background:' + c + ';opacity:.55;height:100%"></div>' +
              '<div style="flex:' + m.matched + ';background:var(--phosphor);opacity:.45;height:100%"></div>' +
              '<div style="flex:' + m.fallback + ';background:var(--red);opacity:.35;height:100%"></div>' +
            '</div>' +
            '<span style="font-size:11px;width:28px;text-align:right">' + m.total + '</span></div>';
        }).join('') +
        '</div></div>';

      var hourlyHtml =
        '<div class="n-section">' + U.section('HOURLY DISTRIBUTION (JST)', U.badge('PEAK: ' + peakH + ':00', 'warn')) +
        '<div class="n-card n-card-wide">' +
        '<div class="n-grid n-g3" style="margin-bottom:12px">' +
          U.metric(peakH + ':00', 'PEAK HOUR') +
          U.metric(evShare + '%', '18-24 SHARE') +
          U.metric(allBottles.length, 'TOTAL BOTTLES') +
        '</div>' +
        '<div class="n-hours">' + hourly.map(function(v) {
          return '<div class="n-hour-bar" style="height:' + (v / maxH * 100) + '%;background:' +
            U.hourColor(v, maxH) + ';opacity:' + (v / maxH * .6 + .2) + '"></div>';
        }).join('') + '</div>' +
        '<div class="n-hour-labels">' + hourly.map(function(_, i) {
          return '<span>' + (i % 3 === 0 ? i : '') + '</span>';
        }).join('') + '</div></div></div>';

      // Recent bottles with moderation
      var recentHtml =
        '<div class="n-section">' + U.section('RECENT EXCHANGES') +
        '<div class="n-card n-card-wide"><table class="n-table"><thead><tr>' +
          '<th>TIME</th><th>STATUS</th><th>SONG</th><th>MSG</th><th>HASH</th><th></th>' +
        '</tr></thead><tbody>' +
        recentBottles.map(function(b) {
          var sentV = vidMap[b.video_id];
          var time = b.created_at ? new Date(b.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '—';
          var hash = (b.client_hash || '').slice(0, 6);
          var statusCls = b.status === 'matched' ? 'n-status-ok' : b.status === 'fallback' ? 'n-status-err' : b.status === 'waiting' ? 'n-status-warn' : 'n-status-dim';
          var msg = b.message ? esc(b.message).slice(0, 30) : '<span style="color:var(--text-xdim)">—</span>';
          return '<tr data-bottle-id="' + b.id + '">' +
            '<td class="mono">' + time + '</td>' +
            '<td><span class="n-status ' + statusCls + '">' + (b.status || '?').toUpperCase() + '</span></td>' +
            '<td class="title-col">' + (sentV ? esc(sentV.title) : '?') + '</td>' +
            '<td>' + msg + '</td>' +
            '<td class="mono">' + hash + '</td>' +
            '<td class="r"><div class="n-btn-group">' +
              (b.message ? '<button class="n-btn n-btn-sm n-btn-amber ol-null-msg" data-id="' + b.id + '">NULL MSG</button>' : '') +
              '<button class="n-btn n-btn-sm n-btn-red ol-purge" data-id="' + b.id + '">PURGE</button>' +
            '</div></td></tr>';
        }).join('') +
        '</tbody></table></div></div>';

      // Client hash threat table
      var threatHtml = '';
      if (suspectHashes.length) {
        threatHtml =
          '<div class="n-section">' + U.section('CLIENT HASH THREAT DETECTION', U.badge('ANOMALY', 'err')) +
          '<div class="n-card n-card-wide"><table class="n-table"><thead><tr>' +
            '<th>HASH</th><th>COUNT</th><th>THREAT LEVEL</th><th></th>' +
          '</tr></thead><tbody>' +
          suspectHashes.map(function(entry) {
            var h = entry[0], cnt = entry[1];
            var level = cnt >= 50 ? 'CRITICAL' : cnt >= 20 ? 'HIGH' : 'ELEVATED';
            var cls = cnt >= 50 ? 'n-status-err' : cnt >= 20 ? 'n-status-warn' : 'n-status-dim';
            return '<tr>' +
              '<td class="mono">' + h.slice(0, 12) + '...</td>' +
              '<td>' + cnt + '</td>' +
              '<td><span class="n-status ' + cls + '">' + level + '</span></td>' +
              '<td class="r"><button class="n-btn n-btn-sm n-btn-red ol-ban-hash" data-hash="' + esc(h) + '">BAN</button></td></tr>';
          }).join('') +
          '</tbody></table></div></div>';
      }

      el.innerHTML = statsHtml + memberHtml + hourlyHtml + recentHtml + threatHtml;
      MU.Decode.decodeAll(el);

      // ── Moderation handlers ──
      // NULL MSG — clear message field
      el.querySelectorAll('.ol-null-msg').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var id = btn.dataset.id;
          if (!confirm('NULL MESSAGE ON BOTTLE #' + id + '?')) return;
          try {
            await MU.DB.update('song_bottles', id, { message: null });
            btn.textContent = 'DONE';
            btn.disabled = true;
          } catch (e) { alert('FAILED: ' + e.message); }
        });
      });

      // PURGE — delete bottle
      el.querySelectorAll('.ol-purge').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var id = btn.dataset.id;
          if (!confirm('PURGE BOTTLE #' + id + '? THIS CANNOT BE UNDONE.')) return;
          try {
            await MU.DB.remove('song_bottles', id);
            var row = btn.closest('tr');
            if (row) row.remove();
          } catch (e) { alert('FAILED: ' + e.message); }
        });
      });

      // BAN hash — placeholder (would need a ban_list table or similar)
      el.querySelectorAll('.ol-ban-hash').forEach(function(btn) {
        btn.addEventListener('click', function() {
          alert('BAN SYSTEM NOT YET IMPLEMENTED.\nHASH: ' + btn.dataset.hash + '\nManually add to ban list in Supabase.');
        });
      });

    } catch (e) {
      el.innerHTML = U.alert('SYSTEM ERROR: ' + esc(e.message));
    }
  }
});

/* ═══════════════════════════════════════
 *   Background Grid (Auth Gate)
 * ═══════════════════════════════════════ */
(function() {
  var c = document.getElementById('grid-bg');
  if (!c) return;
  var ctx = c.getContext('2d');
  var W, H, t = 0;
  function resize() {
    var d = devicePixelRatio || 1;
    W = c.width = innerWidth * d; H = c.height = innerHeight * d;
    c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
    ctx.scale(d, d);
  }
  resize(); addEventListener('resize', resize);

  var nodes = [], sp = 60;
  for (var x = sp; x < innerWidth; x += sp)
    for (var y = sp; y < innerHeight; y += sp)
      if (Math.random() < .3) nodes.push({ x: x, y: y, life: Math.random() * Math.PI * 2, speed: .3 + Math.random() * .5 });
  var edges = [];
  nodes.forEach(function(a, i) {
    nodes.forEach(function(b, j) {
      if (j <= i) return;
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < sp * 1.8 && Math.random() < .4) edges.push([i, j]);
    });
  });

  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight); t += .008;
    edges.forEach(function(e) {
      var a = nodes[e[0]], b = nodes[e[1]], p = (Math.sin(t * a.speed + a.life) + 1) / 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      if (Math.random() < .5) { ctx.lineTo(b.x, a.y); ctx.lineTo(b.x, b.y); }
      else { ctx.lineTo(a.x, b.y); ctx.lineTo(b.x, b.y); }
      ctx.strokeStyle = 'rgba(51,255,102,' + (.015 + p * .02) + ')'; ctx.lineWidth = .5; ctx.stroke();
    });
    nodes.forEach(function(n) {
      var p = (Math.sin(t * n.speed + n.life) + 1) / 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(51,255,102,' + (.04 + p * .08) + ')'; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ═══════════════════════════════════════
 *   Boot Log + Auth Flow
 * ═══════════════════════════════════════ */
var BootLog = (function() {
  var el = document.getElementById('status-log');
  var lines = [
    { text: 'MU-TH-UR 6000 — INITIALIZING', delay: 300 },
    { text: 'CORE SYSTEMS: <span class="ok">ONLINE</span>', delay: 500 },
    { text: 'ARCHIVE DATABASE: CONNECTING...', delay: 400 },
    { text: 'LINK SUBSYSTEM: STANDBY', delay: 350 },
    { text: 'NETWORK RELAY: <span class="warn">DEGRADED</span> — FALLBACK ACTIVE', delay: 500 },
    { text: 'AWAITING AUTHORIZATION <span class="blink">_</span>', delay: 300 }
  ];
  var idx = 0;
  function next() {
    if (idx >= lines.length) {
      document.getElementById('auth-area').classList.add('visible');
      setTimeout(function() { document.getElementById('auth-input').focus(); }, 200);
      return;
    }
    var d = document.createElement('div'); d.className = 'log-line'; d.innerHTML = lines[idx].text;
    el.appendChild(d);
    requestAnimationFrame(function() { d.classList.add('visible'); });
    idx++; setTimeout(next, lines[idx - 1].delay);
  }
  return { start: function() { idx = 0; el.innerHTML = ''; setTimeout(next, 500); } };
})();

(function() {
  var gate = document.getElementById('auth-gate'),
    input = document.getElementById('auth-input'),
    errEl = document.getElementById('auth-err'),
    shell = document.getElementById('admin-shell'),
    bootSeq = document.getElementById('boot-seq'),
    bootText = document.getElementById('boot-text'),
    bootBar = document.getElementById('boot-bar'),
    terminal = document.getElementById('terminal');

  if (MU.Auth.isAuthed()) {
    gate.style.display = 'none';
    shell.classList.add('active');
    document.body.style.overflow = 'auto';
    MU.Tabs.mount();
  } else {
    BootLog.start();
  }

  input.addEventListener('keydown', async function(e) {
    if (e.key !== 'Enter') return;
    var res = await MU.Auth.login(input.value);
    if (res.ok) {
      errEl.textContent = '';
      gate.style.transition = 'opacity .5s'; gate.style.opacity = '0';
      setTimeout(function() {
        gate.style.display = 'none'; bootSeq.classList.add('active');
        var phases = [
          { text: 'CLEARANCE ACCEPTED', pct: 10 },
          { text: 'DECRYPTING ARCHIVE INDEX...', pct: 25 },
          { text: 'LOADING OBSERVATION DATABASE...', pct: 50 },
          { text: 'INTERFACE 2037 — MOUNTING...', pct: 70 },
          { text: 'MU-TH-UR ONLINE', pct: 90 },
          { text: 'SYSTEM READY', pct: 100 }
        ];
        var i = 0;
        function next() {
          if (i >= phases.length) {
            setTimeout(function() {
              bootSeq.style.transition = 'opacity .4s'; bootSeq.style.opacity = '0';
              setTimeout(function() {
                bootSeq.classList.remove('active');
                shell.classList.add('active');
                document.body.style.overflow = 'auto';
                MU.Tabs.mount();
              }, 400);
            }, 400);
            return;
          }
          bootText.textContent = phases[i].text;
          bootBar.style.width = phases[i].pct + '%';
          i++; setTimeout(next, 250 + Math.random() * 200);
        }
        next();
      }, 500);
    } else {
      terminal.classList.add('glitch');
      setTimeout(function() { terminal.classList.remove('glitch'); }, 300);
      errEl.textContent = res.msg; input.value = ''; input.focus();
    }
  });

  document.getElementById('logout-btn').addEventListener('click', function() {
    MU.Auth.logout();
    shell.classList.remove('active');
    document.body.style.overflow = 'hidden';
    gate.style.display = 'flex'; gate.style.opacity = '1';
    input.value = ''; errEl.textContent = '';
    document.getElementById('status-log').innerHTML = '';
    document.getElementById('auth-area').classList.remove('visible');
    BootLog.start();
  });
})();
