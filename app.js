(function () {
  'use strict';

  const STORAGE_KEY = 'ha2009_director_state_v1';

  // In-memory catalog of all 613 hymns
  let HYMNS = [];
  let HYMN_BY_NUM = new Map();

  // UI & Filter State
  let currentView = 'view-search';
  let filterFavoritesOnly = false;
  let filterInListOnly = false;
  let currentReaderHymnNum = 1;
  let searchRenderLimit = 80;
  let dialerDigits = '';

  // Persistent User State (saved in localStorage)
  let state = loadState();

  function getDefaultState() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      theme: 'dark',
      fontSize: 22,
      repeatChorus: true,
      favorites: [1, 61, 538],
      activePlaylistId: 'pl-default',
      playlists: [
        {
          id: 'pl-default',
          name: 'Alabanza Sábado',
          date: today,
          items: [
            { n: 1, note: '1° Himno de Apertura', stanzas: [] },
            { n: 61, note: '2° Himno de Adoración', stanzas: [] },
            { n: 538, note: '3° Himno Inicial Culto', stanzas: [] }
          ]
        }
      ]
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultState();
      const parsed = JSON.parse(raw);
      const def = getDefaultState();
      return {
        theme: parsed.theme || def.theme,
        fontSize: Number(parsed.fontSize) || def.fontSize,
        repeatChorus: typeof parsed.repeatChorus === 'boolean' ? parsed.repeatChorus : def.repeatChorus,
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : def.favorites,
        activePlaylistId: parsed.activePlaylistId || (parsed.playlists?.[0]?.id ?? def.activePlaylistId),
        playlists: Array.isArray(parsed.playlists) && parsed.playlists.length > 0 ? parsed.playlists : def.playlists
      };
    } catch (e) {
      return getDefaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error guardando estado local:', e);
    }
    updateGlobalBadges();
  }

  function getActivePlaylist() {
    let pl = state.playlists.find((p) => p.id === state.activePlaylistId);
    if (!pl) {
      pl = state.playlists[0];
      state.activePlaylistId = pl.id;
    }
    return pl;
  }

  // Normalize string (strip accents, punctuation, lowercase) for flexible search
  function normalizeText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¡!¿?.,;:()"'«»—\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Highlight matching words without breaking accents in original text
  function highlightText(originalText, queryWords) {
    if (!queryWords || queryWords.length === 0) return escapeHtml(originalText);
    const escaped = escapeHtml(originalText);
    // Build accent-tolerant regex for each query word
    const charMap = {
      a: '[aáä]',
      e: '[eéë]',
      i: '[iíï]',
      o: '[oóö]',
      u: '[uúü]',
      n: '[nñ]'
    };
    const patterns = queryWords
      .filter((w) => w.length >= 2)
      .map((w) =>
        w
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .split('')
          .map((ch) => charMap[ch] || ch)
          .join('')
      );
    if (patterns.length === 0) return escaped;
    try {
      const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
      return escaped.replace(regex, '<mark>$1</mark>');
    } catch (e) {
      return escaped;
    }
  }

  // Initialize Hymns Catalog
  async function loadHymnsData() {
    let rawData = window.HIMNOS_DATA;
    if (!Array.isArray(rawData) || rawData.length === 0) {
      const resp = await fetch('./himnos.json');
      rawData = await resp.json();
    }

    HYMNS = rawData.map((h) => {
      const allLines = [];
      if (h.c) allLines.push(h.c);
      for (const st of h.s || []) {
        allLines.push(st.t);
      }
      const fullLyrics = allLines.join('\n');
      return {
        ...h,
        normTitle: normalizeText(h.t),
        normLyrics: normalizeText(fullLyrics),
        fullLyrics
      };
    });

    HYMN_BY_NUM.clear();
    for (const h of HYMNS) {
      HYMN_BY_NUM.set(h.n, h);
    }

    populateCategorySelect();
    applyThemeAndFont();
    updateGlobalBadges();
    renderSearchResults();
    renderPlaylistView();
    renderReaderView(currentReaderHymnNum);
    renderShareView();
    checkUrlImportParam();
  }

  function populateCategorySelect() {
    const select = document.getElementById('category-filter');
    const categories = [];
    const seen = new Set();
    for (const h of HYMNS) {
      if (h.cat && !seen.has(h.cat)) {
        seen.add(h.cat);
        categories.push(h.cat);
      }
    }
    for (const cat of categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    }
  }

  function applyThemeAndFont() {
    document.documentElement.setAttribute('data-theme', state.theme);
    document.documentElement.style.setProperty('--lyric-size', `${state.fontSize}px`);
    const themeIcon = document.getElementById('theme-icon');
    const metaTheme = document.getElementById('meta-theme-color');
    if (state.theme === 'light') {
      themeIcon.textContent = '🌙';
      if (metaTheme) metaTheme.setAttribute('content', '#f8f6f0');
    } else {
      themeIcon.textContent = '☀️';
      if (metaTheme) metaTheme.setAttribute('content', '#0b1120');
    }
    const repeatBtn = document.getElementById('btn-repeat-chorus');
    if (repeatBtn) {
      repeatBtn.classList.toggle('active', !!state.repeatChorus);
    }
  }

  function updateGlobalBadges() {
    const pl = getActivePlaylist();
    const count = pl.items.length;
    const badge = document.getElementById('nav-list-badge');
    if (badge) {
      if (count > 0) {
        badge.style.display = 'flex';
        badge.textContent = String(count);
      } else {
        badge.style.display = 'none';
      }
    }
    const subtitle = document.getElementById('active-list-subtitle');
    if (subtitle) {
      subtitle.textContent = `${pl.name} (${count} himno${count === 1 ? '' : 's'})`;
    }
    const indicator = document.getElementById('active-list-indicator');
    if (indicator) {
      indicator.textContent = `Lista activa: ${pl.name}`;
    }
  }

  // Switch active view tab
  function switchView(targetId) {
    currentView = targetId;
    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === targetId);
    });
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-target') === targetId);
    });

    if (targetId === 'view-search') {
      renderSearchResults();
    } else if (targetId === 'view-list') {
      renderPlaylistView();
    } else if (targetId === 'view-reader') {
      renderReaderView(currentReaderHymnNum);
    } else if (targetId === 'view-share') {
      renderShareView();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ==================== VIEW 1: SEARCH & BROWSE HYMNS ====================
  function getMatchingSnippet(hymn, queryWords) {
    if (!queryWords || queryWords.length === 0) return '';
    const lines = hymn.fullLyrics.split('\n');
    for (const line of lines) {
      const normLine = normalizeText(line);
      if (queryWords.some((w) => w.length >= 2 && normLine.includes(w))) {
        return highlightText(line.trim(), queryWords);
      }
    }
    return '';
  }

  function renderSearchResults() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('btn-clear-search');
    const category = document.getElementById('category-filter').value;
    const rawQuery = (input.value || '').trim();
    clearBtn.style.display = rawQuery ? 'flex' : 'none';

    const pl = getActivePlaylist();
    const inListSet = new Set(pl.items.map((item) => item.n));
    const favSet = new Set(state.favorites);

    const cleanNumQuery = rawQuery.replace(/^#/, '').trim();
    const isNumericOnly = /^\d+$/.test(cleanNumQuery);
    const normQuery = normalizeText(rawQuery);
    const queryWords = normQuery ? normQuery.split(' ').filter(Boolean) : [];

    let filtered = HYMNS.filter((h) => {
      if (category && h.cat !== category) return false;
      if (filterFavoritesOnly && !favSet.has(h.n)) return false;
      if (filterInListOnly && !inListSet.has(h.n)) return false;

      if (!rawQuery) return true;

      if (isNumericOnly) {
        return String(h.n).includes(cleanNumQuery);
      }

      // Check if query matches number + text or all query words in title or lyrics
      const numStr = String(h.n);
      return queryWords.every(
        (word) =>
          numStr === word ||
          h.normTitle.includes(word) ||
          h.normLyrics.includes(word)
      );
    });

    // Sort results by relevance when searching
    if (rawQuery) {
      filtered.sort((a, b) => {
        if (isNumericOnly) {
          const exactA = String(a.n) === cleanNumQuery ? 0 : 1;
          const exactB = String(b.n) === cleanNumQuery ? 0 : 1;
          if (exactA !== exactB) return exactA - exactB;
          const startsA = String(a.n).startsWith(cleanNumQuery) ? 0 : 1;
          const startsB = String(b.n).startsWith(cleanNumQuery) ? 0 : 1;
          if (startsA !== startsB) return startsA - startsB;
          return a.n - b.n;
        }
        // Title match prioritized over lyric-only match
        const titleMatchA = queryWords.every((w) => a.normTitle.includes(w)) ? 0 : 1;
        const titleMatchB = queryWords.every((w) => b.normTitle.includes(w)) ? 0 : 1;
        if (titleMatchA !== titleMatchB) return titleMatchA - titleMatchB;
        return a.n - b.n;
      });
    }

    const countEl = document.getElementById('results-count');
    countEl.textContent =
      filtered.length === 613
        ? '613 himnos disponibles offline'
        : `${filtered.length} himno${filtered.length === 1 ? '' : 's'} encontrado${filtered.length === 1 ? '' : 's'}`;

    const container = document.getElementById('hymn-results-list');
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔎</div>
          <p><strong>No se encontraron himnos</strong></p>
          <p style="font-size:0.84rem;margin-top:4px">Prueba buscando por otro número (1–613) o una frase de la letra.</p>
        </div>
      `;
      return;
    }

    const visibleItems = filtered.slice(0, searchRenderLimit);
    const fragment = document.createDocumentFragment();

    for (const h of visibleItems) {
      const isInList = inListSet.has(h.n);
      const isFav = favSet.has(h.n);
      const card = document.createElement('div');
      card.className = 'hymn-card';

      const highlightedTitle =
        !isNumericOnly && queryWords.length > 0
          ? highlightText(h.t, queryWords)
          : escapeHtml(h.t);

      let snippetHtml = '';
      if (!isNumericOnly && queryWords.length > 0) {
        const snippet = getMatchingSnippet(h, queryWords);
        if (snippet) {
          snippetHtml = `<div class="hymn-snippet">“${snippet}”</div>`;
        }
      }

      card.innerHTML = `
        <div class="hymn-card-left" data-open-hymn="${h.n}">
          <div class="hymn-num-badge">#${h.n}</div>
          <div class="hymn-info">
            <div class="hymn-title">${highlightedTitle} ${isFav ? '<span style="color:var(--accent)">★</span>' : ''}</div>
            <div class="hymn-sub">
              <span>${escapeHtml(h.cat)}</span>
              ${h.b ? `<span>· 📖 ${escapeHtml(h.b)}</span>` : ''}
            </div>
            ${snippetHtml}
          </div>
        </div>
        <div class="hymn-card-actions">
          <button type="button" class="add-list-btn ${isInList ? 'in-list' : ''}" data-toggle-list="${h.n}">
            ${isInList ? '✓ En lista' : '+ Lista'}
          </button>
        </div>
      `;
      fragment.appendChild(card);
    }

    if (filtered.length > searchRenderLimit) {
      const moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'btn-secondary';
      moreBtn.style.marginTop = '8px';
      moreBtn.textContent = `Mostrar más himnos (${filtered.length - searchRenderLimit} restantes)...`;
      moreBtn.addEventListener('click', () => {
        searchRenderLimit += 150;
        renderSearchResults();
      });
      fragment.appendChild(moreBtn);
    }

    container.appendChild(fragment);
  }

  // Toggle hymn in active playlist
  function toggleHymnInActivePlaylist(hymnNum) {
    const pl = getActivePlaylist();
    const idx = pl.items.findIndex((it) => it.n === hymnNum);
    const hymn = HYMN_BY_NUM.get(hymnNum);
    if (idx >= 0) {
      pl.items.splice(idx, 1);
      saveState();
      showToast(`Quitado #${hymnNum} de "${pl.name}"`);
    } else {
      pl.items.push({
        n: hymnNum,
        note: '',
        stanzas: []
      });
      saveState();
      showToast(`Agregado #${hymnNum} (${hymn ? hymn.t : ''}) a "${pl.name}"`);
    }
    if (currentView === 'view-search') renderSearchResults();
    if (currentView === 'view-list') renderPlaylistView();
    if (currentView === 'view-reader') renderReaderView(currentReaderHymnNum);
    if (currentView === 'view-share') renderShareView();
  }

  // ==================== VIEW 2: MI LISTA DE ALABANZA ====================
  function renderPlaylistView() {
    const pl = getActivePlaylist();
    const select = document.getElementById('playlist-select');
    select.innerHTML = '';
    for (const p of state.playlists) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.items.length})`;
      if (p.id === pl.id) opt.selected = true;
      select.appendChild(opt);
    }

    document.getElementById('playlist-name-input').value = pl.name || '';
    document.getElementById('playlist-date-input').value = pl.date || '';

    const container = document.getElementById('playlist-items-container');
    container.innerHTML = '';

    if (pl.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎵</div>
          <p><strong>Tu lista "${escapeHtml(pl.name)}" está vacía</strong></p>
          <p style="font-size:0.84rem;margin-top:6px">Ve a la pestaña <strong>Himnario</strong> o usa el botón <strong>#123</strong> para elegir los himnos de tu próxima alabanza.</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    pl.items.forEach((item, index) => {
      const hymn = HYMN_BY_NUM.get(item.n);
      if (!hymn) return;

      const el = document.createElement('div');
      el.className = 'playlist-item';

      const selectedStanzas = Array.isArray(item.stanzas) ? item.stanzas : [];
      const stanzaButtonsHtml = (hymn.s || [])
        .map((st) => {
          const isSelected = selectedStanzas.length === 0 || selectedStanzas.includes(st.n);
          return `<button type="button" class="stanza-pill ${isSelected ? 'selected' : ''}" data-item-idx="${index}" data-stanza-num="${st.n}" title="Activar/omitir estrofa ${st.n}">${st.n}</button>`;
        })
        .join('');

      el.innerHTML = `
        <div class="playlist-item-top">
          <div class="hymn-card-left" data-open-pulpit-hymn="${hymn.n}" style="cursor:pointer;align-items:center">
            <span class="order-pill">${index + 1}</span>
            <div class="hymn-num-badge">#${hymn.n}</div>
            <div class="hymn-info">
              <div class="hymn-title">${escapeHtml(hymn.t)}</div>
              <div class="hymn-sub">
                <span>${hymn.s.length} estrofa${hymn.s.length === 1 ? '' : 's'}${hymn.c ? ' + Coro' : ''}</span>
                ${hymn.b ? `<span>· 📖 ${escapeHtml(hymn.b)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="playlist-item-controls">
            <button type="button" class="mini-btn" data-move-up="${index}" ${index === 0 ? 'disabled style="opacity:0.35"' : ''} title="Subir">↑</button>
            <button type="button" class="mini-btn" data-move-down="${index}" ${index === pl.items.length - 1 ? 'disabled style="opacity:0.35"' : ''} title="Bajar">↓</button>
            <button type="button" class="mini-btn danger" data-remove-idx="${index}" title="Quitar de la lista">✕</button>
          </div>
        </div>
        <div class="playlist-item-config">
          <input
            type="text"
            class="note-input"
            data-note-idx="${index}"
            placeholder="Nota (ej. 1° Himno Inicial, Tono Sol, Ofrenda...)"
            value="${escapeHtml(item.note || '')}"
          />
          <div class="stanza-toggles">
            <span class="stanza-toggles-label">Estrofas:</span>
            ${stanzaButtonsHtml}
          </div>
        </div>
      `;
      fragment.appendChild(el);
    });

    container.appendChild(fragment);
  }

  // ==================== VIEW 3: MODO PÚLPITO / READER ====================
  function renderReaderView(hymnNum) {
    const hymn = HYMN_BY_NUM.get(Number(hymnNum)) || HYMN_BY_NUM.get(1);
    if (!hymn) return;
    currentReaderHymnNum = hymn.n;

    const pl = getActivePlaylist();
    const playlistIdx = pl.items.findIndex((it) => it.n === hymn.n);
    const playlistItem = playlistIdx >= 0 ? pl.items[playlistIdx] : null;

    // Render top active playlist quick bar
    const pulpitBar = document.getElementById('pulpit-playlist-bar');
    const pulpitTitle = document.getElementById('pulpit-list-title');
    const pulpitCounter = document.getElementById('pulpit-step-counter');
    const pillsContainer = document.getElementById('pulpit-pills-container');

    if (pl.items.length > 0) {
      pulpitBar.style.display = 'block';
      pulpitTitle.textContent = `🎵 ${pl.name}`;
      pulpitCounter.textContent =
        playlistIdx >= 0
          ? `Himno ${playlistIdx + 1} de ${pl.items.length}`
          : `${pl.items.length} en tu lista`;

      pillsContainer.innerHTML = pl.items
        .map((it, idx) => {
          const h = HYMN_BY_NUM.get(it.n);
          const activeClass = it.n === hymn.n ? 'active' : '';
          return `<button type="button" class="pulpit-pill ${activeClass}" data-pulpit-jump="${it.n}">
            ${idx + 1}. #${it.n} ${escapeHtml(h ? h.t.slice(0, 18) : '')}
          </button>`;
        })
        .join('');
    } else {
      pulpitBar.style.display = 'none';
    }

    // Header info
    document.getElementById('reader-hymn-num').textContent = `Himno #${hymn.n}`;
    document.getElementById('reader-hymn-cat').textContent = hymn.cat || '';
    document.getElementById('reader-hymn-title').textContent = hymn.t;
    document.getElementById('reader-hymn-bible').textContent = hymn.b ? `📖 ${hymn.b}` : '';

    // Favorite & In-List buttons
    const isFav = state.favorites.includes(hymn.n);
    const favBtn = document.getElementById('btn-reader-fav');
    favBtn.textContent = isFav ? '★' : '☆';
    favBtn.style.color = isFav ? 'var(--accent)' : 'var(--text-primary)';

    const listBtn = document.getElementById('btn-reader-toggle-list');
    listBtn.className = `add-list-btn ${playlistItem ? 'in-list' : ''}`;
    listBtn.textContent = playlistItem ? '✓ En lista' : '+ Lista';

    // Director Note Banner
    const noteBanner = document.getElementById('reader-director-note');
    const selectedStanzas =
      playlistItem && Array.isArray(playlistItem.stanzas) ? playlistItem.stanzas : [];
    const noteParts = [];
    if (playlistItem && playlistItem.note) {
      noteParts.push(`📌 ${playlistItem.note}`);
    }
    if (selectedStanzas.length > 0 && selectedStanzas.length < hymn.s.length) {
      noteParts.push(`🎤 Cantar estrofas: ${selectedStanzas.join(', ')}`);
    }
    if (noteParts.length > 0) {
      noteBanner.style.display = 'block';
      noteBanner.textContent = noteParts.join('  ·  ');
    } else {
      noteBanner.style.display = 'none';
    }

    // Render Stanzas and Chorus
    const lyricsBody = document.getElementById('reader-lyrics-body');
    lyricsBody.innerHTML = '';

    hymn.s.forEach((st, idx) => {
      const isOmitted = selectedStanzas.length > 0 && !selectedStanzas.includes(st.n);
      const stanzaEl = document.createElement('div');
      stanzaEl.className = `stanza-block ${isOmitted ? 'omitted' : ''}`;
      stanzaEl.innerHTML = `
        <div class="stanza-header">
          <span class="stanza-label">Estrofa ${st.n}</span>
          ${isOmitted ? '<span class="stanza-omitted-tag">Omitida en lista</span>' : ''}
        </div>
        <div class="lyric-lines">${escapeHtml(st.t)}</div>
      `;
      lyricsBody.appendChild(stanzaEl);

      // Show chorus either after 1st stanza (traditional) or after every stanza (Pulpit helper)
      const shouldShowChorus =
        hymn.c && (state.repeatChorus ? !isOmitted : idx === 0);
      if (shouldShowChorus) {
        const chorusEl = document.createElement('div');
        chorusEl.className = 'chorus-block';
        chorusEl.innerHTML = `
          <div class="chorus-label">Coro</div>
          <div class="lyric-lines">${escapeHtml(hymn.c)}</div>
        `;
        lyricsBody.appendChild(chorusEl);
      }
    });

    // Update Prev / Next Navigation Buttons
    const prevBtn = document.getElementById('btn-prev-hymn');
    const nextBtn = document.getElementById('btn-next-hymn');

    if (playlistIdx >= 0 && pl.items.length > 1) {
      const prevItem = pl.items[(playlistIdx - 1 + pl.items.length) % pl.items.length];
      const nextItem = pl.items[(playlistIdx + 1) % pl.items.length];
      prevBtn.textContent = `◀ Ant. en lista (#${prevItem.n})`;
      nextBtn.textContent = `Sig. en lista (#${nextItem.n}) ▶`;
    } else {
      const prevNum = hymn.n > 1 ? hymn.n - 1 : 613;
      const nextNum = hymn.n < 613 ? hymn.n + 1 : 1;
      prevBtn.textContent = `◀ Himno #${prevNum}`;
      nextBtn.textContent = `Himno #${nextNum} ▶`;
    }
  }

  function navigateReaderRelative(direction) {
    const pl = getActivePlaylist();
    const playlistIdx = pl.items.findIndex((it) => it.n === currentReaderHymnNum);
    if (playlistIdx >= 0 && pl.items.length > 1) {
      const nextIdx = (playlistIdx + direction + pl.items.length) % pl.items.length;
      renderReaderView(pl.items[nextIdx].n);
    } else {
      let nextNum = currentReaderHymnNum + direction;
      if (nextNum < 1) nextNum = 613;
      if (nextNum > 613) nextNum = 1;
      renderReaderView(nextNum);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== VIEW 4: EXPORT & IMPORT PLAYLIST ====================
  function encodePlaylistCode(pl) {
    const payload = {
      v: 1,
      n: pl.name || 'Alabanza',
      d: pl.date || '',
      i: pl.items.map((it) => {
        const entry = { n: it.n };
        if (it.note) entry.m = it.note;
        if (Array.isArray(it.stanzas) && it.stanzas.length > 0) entry.s = it.stanzas;
        return entry;
      })
    };
    const jsonStr = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(jsonStr)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `HA09:${b64}`;
  }

  function buildShareableMessage(pl) {
    const code = encodePlaylistCode(pl);
    const datePart = pl.date ? ` (${pl.date})` : '';
    const lines = [
      `🎵 *LISTA DE ALABANZA: ${pl.name}${datePart}*`,
      `📖 _Himnario Adventista 2009_`,
      ``
    ];

    if (pl.items.length === 0) {
      lines.push(`(Sin himnos seleccionados)`);
    } else {
      pl.items.forEach((it, idx) => {
        const h = HYMN_BY_NUM.get(it.n);
        const title = h ? h.t : `Himno #${it.n}`;
        const extras = [];
        if (it.note) extras.push(it.note);
        if (Array.isArray(it.stanzas) && it.stanzas.length > 0) {
          extras.push(`Estrofas: ${it.stanzas.join(',')}`);
        }
        const extraStr = extras.length > 0 ? ` — _${extras.join(' | ')}_` : '';
        lines.push(`${idx + 1}. *#${it.n}* - ${title}${extraStr}`);
      });
    }

    lines.push(``);
    lines.push(`📲 *Código para importar en la App:*`);
    lines.push(code);

    // If hosted on http/https, include direct 1-click import link
    if (window.location.protocol.startsWith('http')) {
      const baseUrl = window.location.origin + window.location.pathname;
      lines.push(``);
      lines.push(`🔗 *Abrir directo:* ${baseUrl}?import=${encodeURIComponent(code)}`);
    }

    return lines.join('\n');
  }

  function renderShareView() {
    const pl = getActivePlaylist();
    const preview = document.getElementById('export-text-preview');
    if (preview) {
      preview.value = buildShareableMessage(pl);
    }
  }

  function parseImportedPlaylist(rawInput) {
    if (!rawInput || !rawInput.trim()) {
      throw new Error('Pega primero el mensaje o código de la lista.');
    }
    const text = rawInput.trim();

    // 1. Check if it contains HA09:<base64> code (even inside a WhatsApp message or URL)
    const codeMatch = text.match(/HA09:([A-Za-z0-9\-_]+)/);
    if (codeMatch) {
      let b64 = codeMatch[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      const jsonStr = decodeURIComponent(escape(atob(b64)));
      const data = JSON.parse(jsonStr);
      if (data && Array.isArray(data.i)) {
        return {
          name: data.n || 'Lista Importada',
          date: data.d || new Date().toISOString().slice(0, 10),
          items: data.i
            .map((entry) => ({
              n: Number(entry.n),
              note: entry.m || '',
              stanzas: Array.isArray(entry.s) ? entry.s.map(Number) : []
            }))
            .filter((it) => HYMN_BY_NUM.has(it.n))
        };
      }
    }

    // 2. Check if it's JSON (from .json export)
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.items)) {
          return {
            name: parsed.name || 'Lista Importada',
            date: parsed.date || new Date().toISOString().slice(0, 10),
            items: parsed.items
              .map((it) => ({
                n: Number(it.n || it.number),
                note: it.note || '',
                stanzas: Array.isArray(it.stanzas) ? it.stanzas.map(Number) : []
              }))
              .filter((it) => HYMN_BY_NUM.has(it.n))
          };
        }
      } catch (e) {
        // Continue to fallback number parser
      }
    }

    // 3. Fallback: Extract hymn numbers from plain text / WhatsApp message (e.g. "#14, #105, #312" or "14, 105, 312")
    const numMatches = text.match(/\b([1-9]\d{0,2})\b/g);
    if (numMatches) {
      const validNums = [];
      const seen = new Set();
      for (const m of numMatches) {
        const n = Number(m);
        if (n >= 1 && n <= 613 && !seen.has(n)) {
          seen.add(n);
          validNums.push({ n, note: '', stanzas: [] });
        }
      }
      if (validNums.length > 0) {
        return {
          name: 'Lista Importada',
          date: new Date().toISOString().slice(0, 10),
          items: validNums
        };
      }
    }

    throw new Error('No se encontraron himnos válidos (1–613) ni un código HA09 en el texto.');
  }

  function applyImportedPlaylist(imported, mode) {
    if (!imported || !Array.isArray(imported.items) || imported.items.length === 0) {
      throw new Error('La lista importada no contiene himnos válidos.');
    }

    if (mode === 'replace') {
      const pl = getActivePlaylist();
      pl.name = imported.name || pl.name;
      pl.date = imported.date || pl.date;
      pl.items = imported.items;
    } else {
      const newId = 'pl-' + Date.now();
      state.playlists.unshift({
        id: newId,
        name: imported.name || 'Lista Recibida',
        date: imported.date || new Date().toISOString().slice(0, 10),
        items: imported.items
      });
      state.activePlaylistId = newId;
    }

    saveState();
    renderPlaylistView();
    renderSearchResults();
    renderShareView();
    switchView('view-list');
    showToast(`¡Lista "${imported.name}" importada (${imported.items.length} himnos)!`);
  }

  function checkUrlImportParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const importParam = params.get('import');
      if (importParam) {
        const imported = parseImportedPlaylist(importParam);
        // Clean URL parameter without reloading
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        applyImportedPlaylist(imported, 'new');
      }
    } catch (e) {
      console.warn('No se pudo importar desde URL:', e);
    }
  }

  // ==================== QUICK NUMBER DIALER (#1 - #613) ====================
  function updateDialerPreview() {
    const numEl = document.getElementById('dialer-number');
    const titleEl = document.getElementById('dialer-preview-title');
    if (!dialerDigits) {
      numEl.textContent = '#_';
      titleEl.textContent = 'Digita un número del 1 al 613';
      return;
    }
    const n = Number(dialerDigits);
    numEl.textContent = `#${n}`;
    const hymn = HYMN_BY_NUM.get(n);
    if (hymn) {
      titleEl.textContent = hymn.t;
      titleEl.style.color = 'var(--accent)';
    } else {
      titleEl.textContent = 'Número fuera de rango (1–613)';
      titleEl.style.color = 'var(--danger)';
    }
  }

  // ==================== TOAST HELPER ====================
  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  // ==================== EVENT LISTENERS ====================
  function bindEvents() {
    // Bottom Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-target');
        if (target) switchView(target);
      });
    });

    // Brand header clicks back to search
    document.getElementById('brand-home').addEventListener('click', () => {
      switchView('view-search');
    });

    // Theme toggle
    document.getElementById('btn-toggle-theme').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyThemeAndFont();
      saveState();
      showToast(state.theme === 'light' ? 'Modo Claro activado' : 'Modo Oscuro activado');
    });

    // Search input & filters
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
      searchRenderLimit = 80;
      renderSearchResults();
    });

    document.getElementById('btn-clear-search').addEventListener('click', () => {
      searchInput.value = '';
      searchRenderLimit = 80;
      renderSearchResults();
      searchInput.focus();
    });

    document.getElementById('category-filter').addEventListener('change', () => {
      searchRenderLimit = 80;
      renderSearchResults();
    });

    const favFilterBtn = document.getElementById('btn-filter-favs');
    favFilterBtn.addEventListener('click', () => {
      filterFavoritesOnly = !filterFavoritesOnly;
      favFilterBtn.classList.toggle('active', filterFavoritesOnly);
      renderSearchResults();
    });

    const inListFilterBtn = document.getElementById('btn-filter-inlist');
    inListFilterBtn.addEventListener('click', () => {
      filterInListOnly = !filterInListOnly;
      inListFilterBtn.classList.toggle('active', filterInListOnly);
      renderSearchResults();
    });

    // Delegated clicks on Hymn Search Results
    document.getElementById('hymn-results-list').addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-toggle-list]');
      if (toggleBtn) {
        e.stopPropagation();
        const num = Number(toggleBtn.getAttribute('data-toggle-list'));
        toggleHymnInActivePlaylist(num);
        return;
      }
      const openArea = e.target.closest('[data-open-hymn]');
      if (openArea) {
        const num = Number(openArea.getAttribute('data-open-hymn'));
        renderReaderView(num);
        switchView('view-reader');
      }
    });

    // Playlist Management ("Mi Lista")
    document.getElementById('playlist-select').addEventListener('change', (e) => {
      state.activePlaylistId = e.target.value;
      saveState();
      renderPlaylistView();
      renderSearchResults();
    });

    document.getElementById('btn-new-playlist').addEventListener('click', () => {
      const today = new Date().toISOString().slice(0, 10);
      const newId = 'pl-' + Date.now();
      const count = state.playlists.length + 1;
      state.playlists.unshift({
        id: newId,
        name: `Alabanza #${count}`,
        date: today,
        items: []
      });
      state.activePlaylistId = newId;
      saveState();
      renderPlaylistView();
      showToast('Nueva lista creada');
      document.getElementById('playlist-name-input').focus();
    });

    document.getElementById('btn-delete-playlist').addEventListener('click', () => {
      if (state.playlists.length <= 1) {
        const pl = getActivePlaylist();
        pl.items = [];
        saveState();
        renderPlaylistView();
        showToast('Se vaciaron los himnos de la lista');
        return;
      }
      const pl = getActivePlaylist();
      state.playlists = state.playlists.filter((p) => p.id !== pl.id);
      state.activePlaylistId = state.playlists[0].id;
      saveState();
      renderPlaylistView();
      showToast(`Lista "${pl.name}" eliminada`);
    });

    document.getElementById('playlist-name-input').addEventListener('input', (e) => {
      const pl = getActivePlaylist();
      pl.name = e.target.value;
      saveState();
      const select = document.getElementById('playlist-select');
      const opt = select.querySelector(`option[value="${pl.id}"]`);
      if (opt) opt.textContent = `${pl.name || 'Sin nombre'} (${pl.items.length})`;
    });

    document.getElementById('playlist-date-input').addEventListener('change', (e) => {
      const pl = getActivePlaylist();
      pl.date = e.target.value;
      saveState();
    });

    document.getElementById('btn-start-pulpit').addEventListener('click', () => {
      const pl = getActivePlaylist();
      if (pl.items.length > 0) {
        renderReaderView(pl.items[0].n);
      }
      switchView('view-reader');
    });

    document.getElementById('btn-go-share').addEventListener('click', () => {
      switchView('view-share');
    });

    document.getElementById('btn-add-more-hymns').addEventListener('click', () => {
      switchView('view-search');
      document.getElementById('search-input').focus();
    });

    // Delegated actions inside Playlist Items container
    const playlistContainer = document.getElementById('playlist-items-container');
    playlistContainer.addEventListener('click', (e) => {
      const pl = getActivePlaylist();

      const openPulpit = e.target.closest('[data-open-pulpit-hymn]');
      if (openPulpit) {
        const num = Number(openPulpit.getAttribute('data-open-pulpit-hymn'));
        renderReaderView(num);
        switchView('view-reader');
        return;
      }

      const upBtn = e.target.closest('[data-move-up]');
      if (upBtn) {
        const idx = Number(upBtn.getAttribute('data-move-up'));
        if (idx > 0) {
          const tmp = pl.items[idx - 1];
          pl.items[idx - 1] = pl.items[idx];
          pl.items[idx] = tmp;
          saveState();
          renderPlaylistView();
        }
        return;
      }

      const downBtn = e.target.closest('[data-move-down]');
      if (downBtn) {
        const idx = Number(downBtn.getAttribute('data-move-down'));
        if (idx < pl.items.length - 1) {
          const tmp = pl.items[idx + 1];
          pl.items[idx + 1] = pl.items[idx];
          pl.items[idx] = tmp;
          saveState();
          renderPlaylistView();
        }
        return;
      }

      const removeBtn = e.target.closest('[data-remove-idx]');
      if (removeBtn) {
        const idx = Number(removeBtn.getAttribute('data-remove-idx'));
        const removed = pl.items.splice(idx, 1)[0];
        saveState();
        renderPlaylistView();
        if (removed) showToast(`Himno #${removed.n} quitado de la lista`);
        return;
      }

      const stanzaBtn = e.target.closest('[data-stanza-num]');
      if (stanzaBtn) {
        const itemIdx = Number(stanzaBtn.getAttribute('data-item-idx'));
        const stNum = Number(stanzaBtn.getAttribute('data-stanza-num'));
        const item = pl.items[itemIdx];
        const hymn = HYMN_BY_NUM.get(item.n);
        if (!item || !hymn) return;

        const allStanzaNums = hymn.s.map((s) => s.n);
        let current =
          Array.isArray(item.stanzas) && item.stanzas.length > 0
            ? [...item.stanzas]
            : [...allStanzaNums];

        if (current.includes(stNum)) {
          if (current.length > 1) {
            current = current.filter((n) => n !== stNum);
          }
        } else {
          current.push(stNum);
          current.sort((a, b) => a - b);
        }

        // If all stanzas are selected, store empty array [] for compactness
        item.stanzas = current.length === allStanzaNums.length ? [] : current;
        saveState();
        renderPlaylistView();
      }
    });

    playlistContainer.addEventListener('input', (e) => {
      const noteInput = e.target.closest('[data-note-idx]');
      if (noteInput) {
        const idx = Number(noteInput.getAttribute('data-note-idx'));
        const pl = getActivePlaylist();
        if (pl.items[idx]) {
          pl.items[idx].note = noteInput.value;
          saveState();
        }
      }
    });

    // Reader / Modo Púlpito Controls
    document.getElementById('pulpit-pills-container').addEventListener('click', (e) => {
      const pill = e.target.closest('[data-pulpit-jump]');
      if (pill) {
        const num = Number(pill.getAttribute('data-pulpit-jump'));
        renderReaderView(num);
      }
    });

    document.getElementById('btn-font-dec').addEventListener('click', () => {
      state.fontSize = Math.max(15, state.fontSize - 2);
      applyThemeAndFont();
      saveState();
    });

    document.getElementById('btn-font-inc').addEventListener('click', () => {
      state.fontSize = Math.min(36, state.fontSize + 2);
      applyThemeAndFont();
      saveState();
    });

    document.getElementById('btn-repeat-chorus').addEventListener('click', () => {
      state.repeatChorus = !state.repeatChorus;
      applyThemeAndFont();
      saveState();
      renderReaderView(currentReaderHymnNum);
      showToast(
        state.repeatChorus
          ? 'Coro repetido tras cada estrofa'
          : 'Coro mostrado solo una vez'
      );
    });

    document.getElementById('btn-reader-fav').addEventListener('click', () => {
      const idx = state.favorites.indexOf(currentReaderHymnNum);
      if (idx >= 0) {
        state.favorites.splice(idx, 1);
        showToast(`Quitado #${currentReaderHymnNum} de Favoritos`);
      } else {
        state.favorites.push(currentReaderHymnNum);
        showToast(`Agregado #${currentReaderHymnNum} a Favoritos ★`);
      }
      saveState();
      renderReaderView(currentReaderHymnNum);
    });

    document.getElementById('btn-reader-toggle-list').addEventListener('click', () => {
      toggleHymnInActivePlaylist(currentReaderHymnNum);
    });

    document.getElementById('btn-prev-hymn').addEventListener('click', () => {
      navigateReaderRelative(-1);
    });

    document.getElementById('btn-next-hymn').addEventListener('click', () => {
      navigateReaderRelative(1);
    });

    // Horizontal swipe gesture in Modo Púlpito to switch between playlist hymns
    let touchStartX = 0;
    let touchStartY = 0;
    const readerCard = document.getElementById('reader-card');
    readerCard.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    readerCard.addEventListener(
      'touchend',
      (e) => {
        if (e.changedTouches.length === 1) {
          const dx = e.changedTouches[0].clientX - touchStartX;
          const dy = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.8) {
            if (dx < 0) {
              navigateReaderRelative(1);
            } else {
              navigateReaderRelative(-1);
            }
          }
        }
      },
      { passive: true }
    );

    // Share / Export & Import View Actions
    document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
      const msg = buildShareableMessage(getActivePlaylist());
      const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    });

    document.getElementById('btn-copy-export').addEventListener('click', async () => {
      const msg = buildShareableMessage(getActivePlaylist());
      try {
        await navigator.clipboard.writeText(msg);
        showToast('¡Lista y código copiados al portapapeles!');
      } catch (e) {
        const area = document.getElementById('export-text-preview');
        area.select();
        document.execCommand('copy');
        showToast('¡Texto copiado!');
      }
    });

    document.getElementById('btn-native-share').addEventListener('click', async () => {
      const pl = getActivePlaylist();
      const msg = buildShareableMessage(pl);
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Lista de Alabanza: ${pl.name}`,
            text: msg
          });
        } catch (err) {
          // User cancelled share sheet
        }
      } else {
        await navigator.clipboard.writeText(msg);
        showToast('Copiado al portapapeles');
      }
    });

    document.getElementById('btn-download-json').addEventListener('click', () => {
      const pl = getActivePlaylist();
      const blob = new Blob([JSON.stringify(pl, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (pl.name || 'alabanza').replace(/[^a-z0-9_-]/gi, '_');
      a.href = url;
      a.download = `himnos_${safeName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Archivo .json descargado');
    });

    document.getElementById('btn-process-import').addEventListener('click', () => {
      const input = document.getElementById('import-text-input');
      const modeEl = document.querySelector('input[name="import-mode"]:checked');
      const mode = modeEl ? modeEl.value : 'new';
      try {
        const imported = parseImportedPlaylist(input.value);
        input.value = '';
        applyImportedPlaylist(imported, mode);
      } catch (err) {
        showToast(err.message || 'Código inválido');
      }
    });

    document.getElementById('btn-paste-clipboard').addEventListener('click', async () => {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          document.getElementById('import-text-input').value = clipText;
          showToast('Texto pegado. Toca "Importar Lista Ahora".');
        } else {
          showToast('El portapapeles está vacío');
        }
      } catch (e) {
        showToast('Mantén presionado el cuadro de texto y elige "Pegar"');
      }
    });

    document.getElementById('input-import-file').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = parseImportedPlaylist(String(reader.result || ''));
          const modeEl = document.querySelector('input[name="import-mode"]:checked');
          applyImportedPlaylist(imported, modeEl ? modeEl.value : 'new');
        } catch (err) {
          showToast(err.message || 'No se pudo leer el archivo .json');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Quick Number Dialer Modal (#123)
    const dialerBackdrop = document.getElementById('dialer-modal-backdrop');
    document.getElementById('btn-open-dialer').addEventListener('click', () => {
      dialerDigits = '';
      updateDialerPreview();
      dialerBackdrop.classList.add('open');
    });

    document.getElementById('btn-close-dialer').addEventListener('click', () => {
      dialerBackdrop.classList.remove('open');
    });

    dialerBackdrop.addEventListener('click', (e) => {
      if (e.target === dialerBackdrop) dialerBackdrop.classList.remove('open');
    });

    document.querySelectorAll('.dial-key').forEach((key) => {
      key.addEventListener('click', () => {
        const digit = key.getAttribute('data-digit');
        const action = key.getAttribute('data-action');
        if (digit !== null) {
          if (dialerDigits.length < 3) {
            const candidate = Number(dialerDigits + digit);
            if (candidate >= 1 && candidate <= 613) {
              dialerDigits += digit;
            } else if (dialerDigits.length === 0 && digit !== '0') {
              dialerDigits = digit;
            }
          }
        } else if (action === 'clear') {
          dialerDigits = '';
        } else if (action === 'back') {
          dialerDigits = dialerDigits.slice(0, -1);
        }
        updateDialerPreview();
      });
    });

    document.getElementById('btn-dialer-open').addEventListener('click', () => {
      const n = Number(dialerDigits);
      if (HYMN_BY_NUM.has(n)) {
        dialerBackdrop.classList.remove('open');
        renderReaderView(n);
        switchView('view-reader');
      } else {
        showToast('Ingresa un número del 1 al 613');
      }
    });

    document.getElementById('btn-dialer-add').addEventListener('click', () => {
      const n = Number(dialerDigits);
      if (HYMN_BY_NUM.has(n)) {
        toggleHymnInActivePlaylist(n);
        dialerBackdrop.classList.remove('open');
      } else {
        showToast('Ingresa un número del 1 al 613');
      }
    });
  }

  // Register Service Worker for offline PWA support
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  // Bootstrap application
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    registerServiceWorker();
    loadHymnsData();
  });
})();
