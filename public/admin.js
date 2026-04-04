/* ═══ V.W.P ARCHIVE — ADMIN PANEL ═══
 *
 * Architecture:
 *   Admin.Auth  — login/logout via Netlify Function
 *   Admin.DB    — Supabase REST query abstraction
 *   Admin.UI    — component factory (metric, section, badge, bar, table, etc.)
 *   Admin.Tabs  — tab registry + routing
 *
 * Adding a new tab:
 *   Admin.Tabs.register('id', { label, order, dot, init, render })
 *
 * ═══════════════════════════════════ */

const Admin = {};

/* ═══ Auth ═══ */
Admin.Auth = (() => {
  let _token = sessionStorage.getItem('admin_token');
  let _supabaseUrl = sessionStorage.getItem('admin_supabase_url');

  return {
    async login(password) {
      try {
        const res = await fetch('/.netlify/functions/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.ok) {
          _token = data.token;
          _supabaseUrl = data.supabase_url;
          sessionStorage.setItem('admin_token', _token);
          sessionStorage.setItem('admin_supabase_url', _supabaseUrl);
          return { ok: true };
        }
        return { ok: false, msg: data.msg || 'ACCESS DENIED' };
      } catch (e) {
        return { ok: false, msg: 'NETWORK ERROR — BRIDGE OFFLINE' };
      }
    },
    logout() {
      _token = null;
      _supabaseUrl = null;
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_supabase_url');
    },
    isAuthed() { return !!_token && !!_supabaseUrl; },
    getToken() { return _token; },
    getUrl() { return _supabaseUrl; }
  };
})();

/* ═══ DB ═══ */
Admin.DB = (() => {
  function headers() {
    const t = Admin.Auth.getToken();
    if (!t) throw new Error('No auth token — check SUPABASE_SECRET_KEY env var or re-login');
    return { 'apikey': t, 'Authorization': 'Bearer ' + t };
  }

  async function query(table, params) {
    var p = params || {};
    var select = p.select || '*';
    var filter = p.filter || '';
    var order = p.order || '';
    var limit = p.limit || '';
    var base = Admin.Auth.getUrl();
    if (!base) throw new Error('Supabase URL is not set — check SUPABASE_URL env var');
    var url = base + '/rest/v1/' + table + '?select=' + encodeURIComponent(select);
    if (filter) url += '&' + filter;
    if (order) url += '&order=' + order;
    if (limit) url += '&limit=' + limit;
    var h = headers();
    var res = await fetch(url, { headers: h });
    if (!res.ok) {
      var detail = '';
      try { var b = await res.json(); detail = b.message || b.msg || JSON.stringify(b); } catch(e) { detail = res.statusText; }
      throw new Error('HTTP ' + res.status + ' on ' + table + ': ' + detail);
    }
    var data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error(table + ' returned non-array: ' + JSON.stringify(data).slice(0, 200));
    }
    return data;
  }

  async function rpc(fnName, params) {
    var res = await fetch(Admin.Auth.getUrl() + '/rest/v1/rpc/' + fnName, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
      body: JSON.stringify(params || {})
    });
    if (!res.ok) {
      var detail = '';
      try { var b = await res.json(); detail = b.message || JSON.stringify(b); } catch(e) { detail = res.statusText; }
      throw new Error('RPC ' + fnName + ' HTTP ' + res.status + ': ' + detail);
    }
    return res.json();
  }

  return { query: query, rpc: rpc };
})();

/* ═══ UI ═══ */
Admin.UI = {
  metric: function(v, l, opts) {
    var o = opts || {};
    var c = o.status ? ' ' + o.status : '';
    return '<div class="adm-card adm-metric"><div class="adm-metric-val' + c + '">' + v +
      '</div><div class="adm-metric-label">' + l + '</div>' +
      (o.sub ? '<div class="adm-metric-sub">' + o.sub + '</div>' : '') + '</div>';
  },
  section: function(t, b) { return '<div class="adm-section-title">' + t + (b || '') + '</div>'; },
  badge: function(t, y) { return '<span class="adm-badge adm-badge-' + (y || 'accent') + '">' + t + '</span>'; },
  bar: function(p, c) {
    return '<div class="adm-bar"><div class="adm-bar-fill" style="width:' + p +
      '%;background:' + (c || 'var(--ok)') + ';opacity:.6"></div></div>';
  },
  status: function(t, y) {
    var colors = { matched: 'var(--ok)', fallback: 'var(--danger)', waiting: 'var(--warn)', expired: 'var(--admin-text-dim)' };
    return '<span style="color:' + (colors[y] || 'var(--admin-text-dim)') + ';font-size:11px">' + t + '</span>';
  },
  dot: function(c) { return '<span class="adm-dot" style="background:' + c + '"></span>'; },
  alert: function(t, y) { return '<div class="adm-alert adm-alert-' + (y || 'danger') + '">' + t + '</div>'; },
  note: function(t) { return '<div class="adm-note">' + t + '</div>'; },
  freshColor: function(d) { return d <= 30 ? 'var(--ok)' : d <= 60 ? 'var(--warn)' : 'var(--danger)'; },
  hourColor: function(v, m) { var p = v / m; return p > .6 ? 'var(--warn)' : p > .3 ? 'var(--admin-text-sub)' : 'var(--admin-text-dim)'; },
  loading: function() { return '<div class="adm-loading">LOADING DATA...</div>'; },
  esc: function(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
};

/* ═══ Tabs ═══ */
Admin.Tabs = (() => {
  var R = {};
  var A = null;
  var nav = function() { return document.getElementById('tab-nav'); };
  var cnt = function() { return document.getElementById('tab-content'); };

  return {
    register: function(id, cfg) { R[id] = Object.assign({}, cfg, { _init: false }); },
    mount: function() {
      var n = nav(), c = cnt();
      n.innerHTML = ''; c.innerHTML = '';
      var s = Object.entries(R).sort(function(a, b) { return (a[1].order || 0) - (b[1].order || 0); });
      s.forEach(function(entry) {
        var id = entry[0], cfg = entry[1];
        var b = document.createElement('button');
        b.className = 'tab-btn'; b.dataset.tab = id;
        b.innerHTML = cfg.label + '<span class="tab-dot' + (cfg.dot ? ' visible' : '') + '"></span>';
        b.addEventListener('click', function() { Admin.Tabs.switchTo(id); });
        n.appendChild(b);
        var p = document.createElement('div');
        p.className = 'tab-panel'; p.id = 'panel-' + id;
        c.appendChild(p);
      });
      if (s.length) this.switchTo(s[0][0]);
    },
    switchTo: function(id) {
      if (!R[id]) return;
      A = id;
      nav().querySelectorAll('.tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.tab === id);
      });
      document.querySelectorAll('.tab-panel').forEach(function(p) {
        p.classList.toggle('active', p.id === 'panel-' + id);
      });
      var cfg = R[id], p = document.getElementById('panel-' + id);
      p.innerHTML = Admin.UI.loading();
      cfg.render(p);
      if (!cfg._init && cfg.init) { cfg.init(p); cfg._init = true; }
    }
  };
})();

/* ═══ Member helpers ═══ */
var MEMBER_COLORS = {
  vwp: 'var(--c-vwp)', kafu: 'var(--c-kafu)', rime: 'var(--c-rime)',
  harusar: 'var(--c-harusar)', isekai: 'var(--c-isekai)', koko: 'var(--c-koko)'
};
var MEMBER_NAMES = {
  vwp: 'V.W.P', kafu: 'KAF', rime: 'RIM',
  harusar: 'HARU', isekai: 'JOUCHO', koko: 'KOKO'
};

function memberColor(m) {
  if (!m) return 'var(--admin-text-dim)';
  var solo = m.split(' ');
  if (solo.length === 1) return MEMBER_COLORS[m] || 'var(--admin-text-dim)';
  return 'var(--c-vwp)';
}

function memberName(m) {
  if (!m) return '?';
  var solo = m.split(' ');
  if (solo.length === 1) return MEMBER_NAMES[m] || m.toUpperCase();
  return solo.map(function(s) { return MEMBER_NAMES[s] || s.toUpperCase(); }).join('+');
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  var d = new Date(dateStr);
  var now = new Date();
  return Math.floor((now - d) / 86400000);
}

function fmtDate(d) {
  if (!d) return '—';
  return d.slice(0, 10).replace(/-/g, '/');
}

/* ═══ Tab: SONGS ═══ */
Admin.Tabs.register('songs', {
  label: 'SONGS', order: 10,
  async render(el) {
    var U = Admin.UI;
    try {
      var [totalRows, unlinkedRows, dupRows, albumRows, allVideos] = await Promise.all([
        Admin.DB.query('videos', { select: 'id' }),
        Admin.DB.query('videos', { select: 'id', filter: 'album_id=is.null' }),
        Admin.DB.query('videos', { select: 'url', order: 'url' }),
        Admin.DB.query('albums', { select: 'id' }),
        Admin.DB.query('videos', { select: 'id,title,member,date,url', order: 'date.desc', limit: '1000' })
      ]);
      var totalCount = totalRows.length;
      var unlinkedCount = unlinkedRows.length;
      var albumCount = albumRows.length;

      // Count duplicates
      var urlMap = {};
      dupRows.forEach(function(r) { urlMap[r.url] = (urlMap[r.url] || 0) + 1; });
      var dupCount = Object.values(urlMap).filter(function(c) { return c > 1; }).length;

      // Freshness per solo member
      var freshness = [];
      var seenMember = {};
      allVideos.forEach(function(v) {
        if (!v.member || v.member.indexOf(' ') !== -1) return;
        if (seenMember[v.member]) return;
        seenMember[v.member] = true;
        freshness.push({
          member: v.member, title: v.title, date: v.date,
          days: daysSince(v.date), color: memberColor(v.member)
        });
      });
      freshness.sort(function(a, b) { return a.days - b.days; });
      var stale = freshness.filter(function(f) { return f.days > 60; });

      el.innerHTML =
        '<div class="adm-section">' + U.section('Quick stats') +
        '<div class="adm-grid adm-grid-4">' +
        U.metric(totalCount.toLocaleString(), 'Total songs') +
        U.metric(unlinkedCount.toLocaleString(), 'Unlinked albums', { status: unlinkedCount > 50 ? 'warn' : '' }) +
        U.metric(dupCount.toLocaleString(), 'Duplicate URLs', { status: dupCount > 0 ? 'danger' : '' }) +
        U.metric(albumCount.toLocaleString(), 'Albums') +
        '</div></div>' +

        '<div class="adm-section">' + U.section('Content freshness', U.badge('live', 'info')) +
        '<div class="adm-card adm-card-wide">' +
        freshness.map(function(f) {
          return '<div class="adm-fresh-row">' + U.dot(f.color) +
            '<span style="width:56px;font-family:var(--f-ui);font-size:12px;font-weight:600;color:' + f.color + '">' +
            memberName(f.member) + '</span>' +
            '<span style="flex:1;font-size:11px;color:var(--admin-text-sub)">' +
            U.esc(f.title) + ' — ' + fmtDate(f.date) + '</span>' +
            '<span style="font-family:var(--f-ui);font-size:12px;font-weight:600;color:' +
            U.freshColor(f.days) + '">' + f.days + 'd ago</span></div>';
        }).join('') +
        (stale.length ? U.alert(stale.map(function(m) { return memberName(m.member); }).join(', ') + ' — 60d+ since last update') : '') +
        '</div></div>';
    } catch (e) {
      el.innerHTML = U.alert('Failed to load song data: ' + U.esc(e.message));
    }
  }
});

/* ═══ Tab: OBSERVER-LINK ═══ */
Admin.Tabs.register('ol', {
  label: 'OBSERVER-LINK', order: 20, dot: true,
  async render(el) {
    var U = Admin.UI;
    try {
      var [allBottles, recentBottles, allVideos] = await Promise.all([
        Admin.DB.query('song_bottles', { select: 'id,status,video_id,created_at,client_hash' }),
        Admin.DB.query('song_bottles', {
          select: 'id,status,video_id,matched_with,fallback_video_id,created_at,client_hash',
          order: 'created_at.desc', limit: '10'
        }),
        Admin.DB.query('videos', { select: 'id,title,member' })
      ]);

      // Video lookup map
      var vidMap = {};
      allVideos.forEach(function(v) { vidMap[v.id] = v; });

      // Status counts
      var statusCounts = { waiting: 0, matched: 0, fallback: 0, expired: 0 };
      allBottles.forEach(function(b) { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });

      // Member OL breakdown
      var memberOL = {};
      allBottles.forEach(function(b) {
        var v = vidMap[b.video_id];
        if (!v || !v.member) return;
        var members = v.member.split(' ');
        members.forEach(function(m) {
          if (!memberOL[m]) memberOL[m] = { sent: 0, matched: 0, fallback: 0 };
          memberOL[m].sent++;
          if (b.status === 'matched') memberOL[m].matched++;
          if (b.status === 'fallback') memberOL[m].fallback++;
        });
      });
      var memArr = Object.keys(memberOL).map(function(m) {
        var d = memberOL[m];
        var w = d.sent - d.matched - d.fallback;
        return { id: m, name: memberName(m), color: memberColor(m), waiting: w, matched: d.matched, fallback: d.fallback, total: d.sent };
      }).sort(function(a, b) { return b.total - a.total; });
      var mxM = Math.max.apply(null, memArr.map(function(m) { return m.total; }).concat([1]));

      // Hourly distribution (JST = UTC+9)
      var hourly = new Array(24).fill(0);
      allBottles.forEach(function(b) {
        if (!b.created_at) return;
        var d = new Date(b.created_at);
        var jstH = (d.getUTCHours() + 9) % 24;
        hourly[jstH]++;
      });
      var mxH = Math.max.apply(null, hourly.concat([1]));
      var pk = hourly.indexOf(mxH);
      var total = hourly.reduce(function(a, b) { return a + b; }, 0);
      var evShare = total ? Math.round(hourly.slice(18, 24).reduce(function(a, b) { return a + b; }, 0) / total * 100) : 0;

      // Recent exchanges table
      var recentHtml = recentBottles.map(function(b) {
        var sentV = vidMap[b.video_id];
        var time = b.created_at ? new Date(b.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '—';
        var hash = (b.client_hash || '').slice(0, 4);
        return '<tr><td class="mono">' + time + '</td>' +
          '<td>' + U.status(b.status, b.status) + '</td>' +
          '<td class="title">' + (sentV ? U.esc(sentV.title) : '?') + '</td>' +
          '<td class="mono">' + hash + '...</td></tr>';
      }).join('');

      el.innerHTML =
        '<div class="adm-section">' + U.section('Bottle pool', U.badge('Supabase', 'accent')) +
        '<div class="adm-grid adm-grid-4">' +
        U.metric(statusCounts.waiting, 'Waiting', { status: 'warn' }) +
        U.metric(statusCounts.matched, 'Matched', { status: 'ok' }) +
        U.metric(statusCounts.fallback, 'Fallback', { status: 'danger' }) +
        U.metric(statusCounts.expired || 0, 'Expired 7d+') +
        '</div></div>' +

        '<div class="adm-section">' + U.section('Member breakdown', U.badge('live', 'info')) +
        '<div class="adm-card adm-card-wide">' +
        memArr.map(function(m) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--admin-border)">' +
            U.dot(m.color) +
            '<span style="width:52px;font-family:var(--f-ui);font-size:12px;font-weight:600;color:' + m.color + '">' + m.name + '</span>' +
            '<div class="adm-sbar" style="flex:1">' +
            '<div style="flex:' + m.waiting + ';background:' + m.color + ';opacity:.55;height:100%"></div>' +
            '<div style="flex:' + m.matched + ';background:var(--ok);opacity:.45;height:100%"></div>' +
            '<div style="flex:' + m.fallback + ';background:var(--danger);opacity:.35;height:100%"></div></div>' +
            '<span style="font-family:var(--f-ui);font-size:12px;font-weight:600;width:24px;text-align:right">' + m.total + '</span></div>';
        }).join('') +
        '</div></div>' +

        '<div class="adm-section">' + U.section('Hourly (JST)', U.badge('Peak: ' + pk + ':00', 'warn')) +
        '<div class="adm-card adm-card-wide">' +
        '<div class="adm-grid adm-grid-3" style="margin-bottom:12px">' +
        U.metric(pk + ':00', 'Most active') +
        U.metric(evShare + '%', '18-24 share') +
        U.metric(allBottles.length, 'Total bottles') +
        '</div>' +
        '<div class="adm-hours">' + hourly.map(function(v) {
          return '<div class="adm-hour-bar" style="height:' + (v / mxH * 100) + '%;background:' +
            U.hourColor(v, mxH) + ';opacity:' + (v / mxH * .6 + .2) + '"></div>';
        }).join('') + '</div>' +
        '<div class="adm-hour-labels">' + hourly.map(function(_, i) {
          return '<span>' + (i % 3 === 0 ? i : '') + '</span>';
        }).join('') + '</div></div></div>' +

        '<div class="adm-section">' + U.section('Recent exchanges') +
        '<div class="adm-card adm-card-wide"><table class="adm-table">' +
        '<thead><tr><th>Time</th><th>Status</th><th>Sent</th><th>Hash</th></tr></thead>' +
        '<tbody>' + recentHtml + '</tbody></table></div></div>';
    } catch (e) {
      el.innerHTML = U.alert('Failed to load OL data: ' + U.esc(e.message));
    }
  }
});

/* ═══ Tab: GA4 ═══ */
Admin.Tabs.register('ga4', {
  label: 'GA4', order: 30,
  render: function(el) {
    el.innerHTML =
      '<div class="adm-section">' + Admin.UI.section('Google Analytics') +
      Admin.UI.note('GA4 integration is not yet configured. Visit the <a href="https://analytics.google.com" target="_blank" rel="noopener" style="color:var(--info)">Google Analytics dashboard</a> for traffic data.') +
      '</div>';
  }
});

/* ═══ Tab: HEALTH ═══ */
Admin.Tabs.register('health', {
  label: 'HEALTH', order: 40,
  async render(el) {
    var U = Admin.UI;
    try {
      var [songRows, bottleRows, freshVideos] = await Promise.all([
        Admin.DB.query('videos', { select: 'id' }),
        Admin.DB.query('song_bottles', { select: 'id' }),
        Admin.DB.query('videos', { select: 'id,title,member,date', order: 'date.desc', limit: '500' })
      ]);
      var songCount = songRows.length;
      var bottleCount = bottleRows.length;

      // Freshness per solo member
      var freshness = [];
      var seenMember = {};
      freshVideos.forEach(function(v) {
        if (!v.member || v.member.indexOf(' ') !== -1) return;
        if (seenMember[v.member]) return;
        seenMember[v.member] = true;
        freshness.push({
          member: v.member, title: v.title, date: v.date,
          days: daysSince(v.date), color: memberColor(v.member)
        });
      });
      freshness.sort(function(a, b) { return a.days - b.days; });
      var stale = freshness.filter(function(f) { return f.days > 60; });

      el.innerHTML =
        '<div class="adm-section">' + U.section('Database') +
        '<div class="adm-grid adm-grid-2">' +
        '<div class="adm-card"><div style="font-weight:500;font-size:12px;margin-bottom:4px">Videos</div>' +
        '<div style="font-family:var(--f-ui);font-size:18px;font-weight:700">' + songCount.toLocaleString() +
        ' <span style="font-size:12px;color:var(--admin-text-dim);font-weight:300">records</span></div></div>' +
        '<div class="adm-card"><div style="font-weight:500;font-size:12px;margin-bottom:4px">Bottles</div>' +
        '<div style="font-family:var(--f-ui);font-size:18px;font-weight:700">' + bottleCount.toLocaleString() +
        ' <span style="font-size:12px;color:var(--admin-text-dim);font-weight:300">records</span></div></div>' +
        '</div></div>' +

        '<div class="adm-section">' + U.section('Content freshness', U.badge('live', 'info')) +
        '<div class="adm-card adm-card-wide">' +
        freshness.map(function(f) {
          return '<div class="adm-fresh-row">' + U.dot(f.color) +
            '<span style="width:56px;font-family:var(--f-ui);font-size:12px;font-weight:600;color:' + f.color + '">' +
            memberName(f.member) + '</span>' +
            '<span style="flex:1;font-size:11px;color:var(--admin-text-sub)">' +
            U.esc(f.title) + ' — ' + fmtDate(f.date) + '</span>' +
            '<span style="font-family:var(--f-ui);font-size:12px;font-weight:600;color:' +
            U.freshColor(f.days) + '">' + f.days + 'd ago</span></div>';
        }).join('') +
        (stale.length ? U.alert(stale.map(function(m) { return memberName(m.member); }).join(', ') + ' — 60d+ since last update') : '') +
        '</div></div>' +

        U.note('Netlify usage (functions/bandwidth) is available in the <a href="https://app.netlify.com" target="_blank" rel="noopener" style="color:var(--info)">Netlify dashboard</a>. Supabase usage is in the <a href="https://supabase.com/dashboard" target="_blank" rel="noopener" style="color:var(--info)">Supabase dashboard</a>.');
    } catch (e) {
      el.innerHTML = U.alert('Failed to load health data: ' + U.esc(e.message));
    }
  }
});

/* ═══ Background circuit grid ═══ */
(function() {
  var c = document.getElementById('grid-bg'), ctx = c.getContext('2d');
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
      if (Math.random() < .35) nodes.push({ x: x, y: y, life: Math.random() * Math.PI * 2, speed: .3 + Math.random() * .5 });
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
      ctx.strokeStyle = 'rgba(74,234,220,' + (.015 + p * .02) + ')'; ctx.lineWidth = .5; ctx.stroke();
    });
    nodes.forEach(function(n) {
      var p = (Math.sin(t * n.speed + n.life) + 1) / 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(74,234,220,' + (.04 + p * .08) + ')'; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ═══ Glyph rotation ═══ */
(function() {
  var sets = [
    '\u27C1 \u22B9 \u25C7 \u27D0 \u2295 \u25CE \u27E1 \u229B',
    '\u25B3 \u25C9 \u2B21 \u2298 \u25BD \u25C8 \u2B22 \u2297',
    '\u27D0 \u22B9 \u27E1 \u25C7 \u2295 \u27C1 \u25CE \u229B'
  ];
  var el = document.getElementById('glyphs'), i = 0;
  function cycle() { el.textContent = sets[i % sets.length]; i++; }
  cycle(); setInterval(cycle, 4000);
})();

/* ═══ Boot log ═══ */
var BootLog = (function() {
  var el = document.getElementById('status-log');
  var lines = [
    { text: 'SYSTEM DORMANT \u2014 INITIATING WAKE SEQUENCE', delay: 300 },
    { text: 'SCANNING ARCHIVE INTEGRITY......... <span class="ok">OK</span>', delay: 600 },
    { text: 'OBSERVATION DATABASE: CONNECTING...', delay: 400 },
    { text: 'LINK SUBSYSTEM: STANDBY', delay: 350 },
    { text: 'NETWORK BRIDGE: <span class="warn">DEGRADED</span> \u2014 FALLBACK ACTIVE', delay: 500 },
    { text: 'AWAITING OPERATOR CLEARANCE <span class="blink">_</span>', delay: 300 }
  ];
  var idx = 0;
  function next() {
    if (idx >= lines.length) {
      document.getElementById('auth-area').classList.add('visible');
      setTimeout(function() { document.getElementById('auth-input').focus(); }, 200);
      return;
    }
    var d = document.createElement('div'); d.className = 'log-line'; d.innerHTML = lines[idx].text;
    el.appendChild(d); requestAnimationFrame(function() { d.classList.add('visible'); });
    idx++; setTimeout(next, lines[idx - 1].delay);
  }
  return { start: function() { idx = 0; el.innerHTML = ''; setTimeout(next, 500); } };
})();

/* ═══ Boot sequence ═══ */
(function() {
  var gate = document.getElementById('auth-gate'),
    input = document.getElementById('auth-input'),
    errEl = document.getElementById('auth-err'),
    shell = document.getElementById('admin-shell'),
    bootSeq = document.getElementById('boot-seq'),
    bootText = document.getElementById('boot-text'),
    bootBar = document.getElementById('boot-bar'),
    terminal = document.getElementById('terminal');

  // Auto-login if session exists
  if (Admin.Auth.isAuthed()) {
    gate.style.display = 'none';
    shell.style.display = 'flex';
    document.body.style.background = 'var(--admin-bg)';
    Admin.Tabs.mount();
  } else {
    BootLog.start();
  }

  input.addEventListener('keydown', async function(e) {
    if (e.key !== 'Enter') return;
    var res = await Admin.Auth.login(input.value);
    if (res.ok) {
      errEl.textContent = '';
      gate.style.transition = 'opacity .5s'; gate.style.opacity = '0';
      setTimeout(function() {
        gate.style.display = 'none'; bootSeq.classList.add('active');
        var phases = [
          { text: 'CLEARANCE ACCEPTED', pct: 10 },
          { text: 'DECRYPTING ARCHIVE INDEX...', pct: 25 },
          { text: 'LOADING OBSERVATION DATABASE...', pct: 50 },
          { text: 'INITIALIZING LINK SUBSYSTEM...', pct: 70 },
          { text: 'MOUNTING ADMIN INTERFACE...', pct: 90 },
          { text: 'SYSTEM ONLINE', pct: 100 }
        ];
        var i = 0;
        function next() {
          if (i >= phases.length) {
            setTimeout(function() {
              bootSeq.style.transition = 'opacity .4s'; bootSeq.style.opacity = '0';
              setTimeout(function() {
                bootSeq.classList.remove('active');
                shell.style.display = 'flex';
                document.body.style.background = 'var(--admin-bg)';
                Admin.Tabs.mount();
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
    Admin.Auth.logout();
    shell.style.display = 'none';
    document.body.style.background = 'var(--crt-bg)';
    document.body.style.overflow = 'hidden';
    gate.style.display = 'flex'; gate.style.opacity = '1';
    input.value = ''; errEl.textContent = '';
    document.getElementById('status-log').innerHTML = '';
    document.getElementById('auth-area').classList.remove('visible');
    BootLog.start();
  });
})();
