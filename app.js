(function () {
  'use strict';

  const STORAGE_KEY = 'ha2009_director_state_v2';
  const LEGACY_KEY = 'ha2009_director_state_v1';

  const SERVICE_LISTS = [
    { id: 'pl-servicio', name: 'Servicio', label: '🎤 Servicio', btnLabel: 'Servicio' },
    { id: 'pl-culto', name: 'Culto', label: '⛪ Culto', btnLabel: 'Culto' },
    { id: 'pl-escuela', name: 'Escuela Sabática', label: '📘 Escuela Sabática', btnLabel: 'Escuela' },
    { id: 'pl-santacena', name: 'Santa Cena', label: '🍷 Santa Cena', btnLabel: 'Santa Cena' }
  ];

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
  let exportScope = 'active'; // 'active' | 'all'

  // Persistent User State (saved in localStorage)
  let state = loadState();

  function getDefaultState() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      theme: 'dark',
      fontSize: 22,
      repeatChorus: true,
      favorites: [1, 61, 538],
      activePlaylistId: 'pl-servicio',
      flyerTheme: 'royal-gold',
      flyerChurch: '',
      flyerDirector: '',
      playlists: [
        {
          id: 'pl-servicio',
          name: 'Servicio',
          date: today,
          items: [
            { n: 1, note: '1° Himno Servicio de Canto', stanzas: [] },
            { n: 61, note: '2° Himno Servicio de Canto', stanzas: [] }
          ]
        },
        {
          id: 'pl-culto',
          name: 'Culto',
          date: today,
          items: [
            { n: 22, note: 'Entrada de Oficiantes', stanzas: [] },
            { n: 1, note: 'Apertura', stanzas: [] },
            { n: 522, note: 'Recogida de Diezmos', stanzas: [] },
            { n: 37, note: 'Clausura', stanzas: [] }
          ]
        },
        {
          id: 'pl-escuela',
          name: 'Escuela Sabática',
          date: today,
          items: [
            { n: 534, note: 'Apertura Escuela Sabática', stanzas: [] },
            { n: 538, note: 'Himno del Sábado', stanzas: [] }
          ]
        },
        {
          id: 'pl-santacena',
          name: 'Santa Cena',
          date: today,
          items: [
            { n: 582, note: 'Rito de Humildad', stanzas: [] },
            { n: 583, note: 'Cena del Señor', stanzas: [] },
            { n: 586, note: 'Clausura Santa Cena', stanzas: [] }
          ]
        }
      ]
    };
  }

  function ensureThreeFixedPlaylists(playlists, today) {
    const map = new Map();
    if (Array.isArray(playlists)) {
      for (const p of playlists) {
        if (p && p.id) map.set(p.id, p);
      }
      // Migrate legacy default playlist to pl-culto if present
      if (!map.has('pl-culto') && playlists.length > 0) {
        map.set('pl-culto', {
          ...playlists[0],
          id: 'pl-culto',
          name: 'Culto'
        });
      }
    }
    return SERVICE_LISTS.map((svc) => {
      const existing = map.get(svc.id);
      return {
        id: svc.id,
        name: svc.name,
        date: (existing && existing.date) || today,
        items: existing && Array.isArray(existing.items) ? existing.items : []
      };
    });
  }

  function loadState() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return getDefaultState();
      const parsed = JSON.parse(raw);
      const def = getDefaultState();
      const playlists = ensureThreeFixedPlaylists(parsed.playlists, today);
      const validIds = new Set(SERVICE_LISTS.map((s) => s.id));
      const activeId = validIds.has(parsed.activePlaylistId) ? parsed.activePlaylistId : 'pl-culto';
      return {
        theme: parsed.theme || def.theme,
        fontSize: Number(parsed.fontSize) || def.fontSize,
        repeatChorus: typeof parsed.repeatChorus === 'boolean' ? parsed.repeatChorus : def.repeatChorus,
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : def.favorites,
        activePlaylistId: activeId,
        flyerTheme: parsed.flyerTheme || def.flyerTheme,
        flyerChurch: typeof parsed.flyerChurch === 'string' ? parsed.flyerChurch : def.flyerChurch,
        flyerDirector: typeof parsed.flyerDirector === 'string' ? parsed.flyerDirector : def.flyerDirector,
        playlists
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

  function getPlaylistById(playlistId) {
    return (
      state.playlists.find((p) => p.id === playlistId) ||
      state.playlists[0]
    );
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
    const pl = getActivePlaylist();
    if (pl.items.length > 0) {
      currentReaderHymnNum = pl.items[0].n;
    }
    renderReaderView(currentReaderHymnNum);
    renderShareView();
    checkUrlImportParam();
  }

  function populateCategorySelect() {
    const select = document.getElementById('category-filter');
    const categories = [];
    const seen = new Set([
      'Entrada de Oficiantes',
      'Recogida de Diezmos',
      'Apertura',
      'Clausura',
      'Doxología',
      'Santa Cena'
    ]);
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
    const plServicio = getPlaylistById('pl-servicio');
    const plCulto = getPlaylistById('pl-culto');
    const plEscuela = getPlaylistById('pl-escuela');
    const plSantaCena = getPlaylistById('pl-santacena');
    const totalCount =
      plServicio.items.length +
      plCulto.items.length +
      plEscuela.items.length +
      plSantaCena.items.length;

    const badge = document.getElementById('nav-list-badge');
    if (badge) {
      if (totalCount > 0) {
        badge.style.display = 'flex';
        badge.textContent = String(totalCount);
      } else {
        badge.style.display = 'none';
      }
    }

    const activePl = getActivePlaylist();
    const subtitle = document.getElementById('active-list-subtitle');
    if (subtitle) {
      subtitle.textContent = `Servicio (${plServicio.items.length}) · Culto (${plCulto.items.length}) · Escuela (${plEscuela.items.length}) · Sta. Cena (${plSantaCena.items.length})`;
    }
    const indicator = document.getElementById('active-list-indicator');
    if (indicator) {
      indicator.textContent = `Activa: ${activePl.name}`;
    }

    // Update counts on the 4 Service Tabs in Mi Lista & Modo Púlpito
    const setTabCount = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setTabCount('tab-count-list-servicio', `${plServicio.items.length} himno${plServicio.items.length === 1 ? '' : 's'}`);
    setTabCount('tab-count-list-culto', `${plCulto.items.length} himno${plCulto.items.length === 1 ? '' : 's'}`);
    setTabCount('tab-count-list-escuela', `${plEscuela.items.length} himno${plEscuela.items.length === 1 ? '' : 's'}`);
    setTabCount('tab-count-list-santacena', `${plSantaCena.items.length} himno${plSantaCena.items.length === 1 ? '' : 's'}`);

    setTabCount('tab-count-pulpit-servicio', `${plServicio.items.length} himno${plServicio.items.length === 1 ? '' : 's'}`);
    setTabCount('tab-count-pulpit-culto', `${plCulto.items.length} himno${plCulto.items.length === 1 ? '' : 's'}`);
    setTabCount('tab-count-pulpit-escuela', `${plEscuela.items.length} himno${plEscuela.items.length === 1 ? '' : 's'}`);
    setTabCount('tab-count-pulpit-santacena', `${plSantaCena.items.length} himno${plSantaCena.items.length === 1 ? '' : 's'}`);

    // Highlight active service tab across views
    document.querySelectorAll('[data-service-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-service-tab') === state.activePlaylistId);
    });
    document.querySelectorAll('[data-pulpit-service-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-pulpit-service-tab') === state.activePlaylistId);
    });
    document.querySelectorAll('[data-export-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-export-tab') === state.activePlaylistId);
    });
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

  function switchServiceTab(playlistId, jumpToFirstInReader) {
    state.activePlaylistId = playlistId;
    saveState();
    const pl = getActivePlaylist();
    if (jumpToFirstInReader && pl.items.length > 0) {
      currentReaderHymnNum = pl.items[0].n;
    }
    if (currentView === 'view-list') renderPlaylistView();
    if (currentView === 'view-reader') renderReaderView(currentReaderHymnNum);
    if (currentView === 'view-search') renderSearchResults();
    if (currentView === 'view-share') renderShareView();
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

    const btnOficiantes = document.getElementById('btn-filter-oficiantes');
    const btnDiezmos = document.getElementById('btn-filter-diezmos');
    const btnApertura = document.getElementById('btn-filter-apertura');
    const btnClausura = document.getElementById('btn-filter-clausura');
    if (btnOficiantes) btnOficiantes.classList.toggle('active', category === 'TAG:oficiantes');
    if (btnDiezmos) btnDiezmos.classList.toggle('active', category === 'TAG:diezmos');
    if (btnApertura) btnApertura.classList.toggle('active', category === 'TAG:apertura');
    if (btnClausura) btnClausura.classList.toggle('active', category === 'TAG:clausura');

    const servicioSet = new Set(getPlaylistById('pl-servicio').items.map((it) => it.n));
    const cultoSet = new Set(getPlaylistById('pl-culto').items.map((it) => it.n));
    const escuelaSet = new Set(getPlaylistById('pl-escuela').items.map((it) => it.n));
    const santaCenaSet = new Set(getPlaylistById('pl-santacena').items.map((it) => it.n));
    const favSet = new Set(state.favorites);

    const cleanNumQuery = rawQuery.replace(/^#/, '').trim();
    const isNumericOnly = /^\d+$/.test(cleanNumQuery);
    const normQuery = normalizeText(rawQuery);
    const queryWords = normQuery ? normQuery.split(' ').filter(Boolean) : [];

    let filtered = HYMNS.filter((h) => {
      if (category && category.startsWith('TAG:')) {
        const tag = category.slice(4);
        if (!Array.isArray(h.tags) || !h.tags.includes(tag)) return false;
      } else if (category && h.cat !== category) {
        return false;
      }
      if (filterFavoritesOnly && !favSet.has(h.n)) return false;
      if (
        filterInListOnly &&
        !servicioSet.has(h.n) &&
        !cultoSet.has(h.n) &&
        !escuelaSet.has(h.n) &&
        !santaCenaSet.has(h.n)
      ) {
        return false;
      }

      if (!rawQuery) return true;

      if (isNumericOnly) {
        return String(h.n).includes(cleanNumQuery);
      }

      const numStr = String(h.n);
      return queryWords.every(
        (word) =>
          numStr === word ||
          h.normTitle.includes(word) ||
          h.normLyrics.includes(word)
      );
    });

    // Sort results by relevance when searching or filtering by special themes
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
        const titleMatchA = queryWords.every((w) => a.normTitle.includes(w)) ? 0 : 1;
        const titleMatchB = queryWords.every((w) => b.normTitle.includes(w)) ? 0 : 1;
        if (titleMatchA !== titleMatchB) return titleMatchA - titleMatchB;
        return a.n - b.n;
      });
    } else if (category === 'TAG:oficiantes') {
      filtered.sort((a, b) => {
        const primA = a.cat === 'Entrada de Oficiantes' ? 0 : 1;
        const primB = b.cat === 'Entrada de Oficiantes' ? 0 : 1;
        if (primA !== primB) return primA - primB;
        return a.n - b.n;
      });
    } else if (category === 'TAG:diezmos') {
      filtered.sort((a, b) => {
        const primA = a.cat === 'Recogida de Diezmos' ? 0 : 1;
        const primB = b.cat === 'Recogida de Diezmos' ? 0 : 1;
        if (primA !== primB) return primA - primB;
        return a.n - b.n;
      });
    } else if (category === 'TAG:apertura') {
      filtered.sort((a, b) => {
        const primA = a.cat === 'Apertura' ? 0 : 1;
        const primB = b.cat === 'Apertura' ? 0 : 1;
        if (primA !== primB) return primA - primB;
        return a.n - b.n;
      });
    } else if (category === 'TAG:clausura') {
      filtered.sort((a, b) => {
        const primA = a.cat === 'Clausura' ? 0 : 1;
        const primB = b.cat === 'Clausura' ? 0 : 1;
        if (primA !== primB) return primA - primB;
        return a.n - b.n;
      });
    } else if (category === 'TAG:santacena') {
      filtered.sort((a, b) => {
        const primA = a.cat === 'Santa Cena' ? 0 : 1;
        const primB = b.cat === 'Santa Cena' ? 0 : 1;
        if (primA !== primB) return primA - primB;
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
      const inServicio = servicioSet.has(h.n);
      const inCulto = cultoSet.has(h.n);
      const inEscuela = escuelaSet.has(h.n);
      const inSantaCena = santaCenaSet.has(h.n);
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
          <button type="button" class="add-list-btn ${inServicio ? 'in-list' : ''}" data-toggle-hymn="${h.n}" data-target-list="pl-servicio">
            ${inServicio ? '✓ Servicio' : '+ Servicio'}
          </button>
          <button type="button" class="add-list-btn ${inCulto ? 'in-list' : ''}" data-toggle-hymn="${h.n}" data-target-list="pl-culto">
            ${inCulto ? '✓ Culto' : '+ Culto'}
          </button>
          <button type="button" class="add-list-btn ${inEscuela ? 'in-list' : ''}" data-toggle-hymn="${h.n}" data-target-list="pl-escuela">
            ${inEscuela ? '✓ Escuela' : '+ Escuela'}
          </button>
          <button type="button" class="add-list-btn ${inSantaCena ? 'in-list' : ''}" data-toggle-hymn="${h.n}" data-target-list="pl-santacena">
            ${inSantaCena ? '✓ Santa Cena' : '+ Santa Cena'}
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

  // Toggle hymn in a specific playlist ('pl-culto' | 'pl-escuela' | 'pl-santacena')
  function toggleHymnInPlaylist(hymnNum, targetPlaylistId) {
    const pl = getPlaylistById(targetPlaylistId || state.activePlaylistId);
    state.activePlaylistId = pl.id;
    const idx = pl.items.findIndex((it) => it.n === hymnNum);
    const hymn = HYMN_BY_NUM.get(hymnNum);
    if (idx >= 0) {
      pl.items.splice(idx, 1);
      saveState();
      showToast(`Quitado #${hymnNum} de ${pl.name}`);
    } else {
      const category = document.getElementById('category-filter')?.value || '';
      let defaultNote = '';
      if (category === 'TAG:oficiantes' || (hymn && hymn.cat === 'Entrada de Oficiantes')) {
        defaultNote = 'Entrada de Oficiantes';
      } else if (category === 'TAG:diezmos' || (hymn && hymn.cat === 'Recogida de Diezmos')) {
        defaultNote = 'Recogida de Diezmos';
      } else if (category === 'TAG:apertura' || (hymn && hymn.cat === 'Apertura')) {
        defaultNote = 'Apertura';
      } else if (category === 'TAG:clausura' || (hymn && hymn.cat === 'Clausura')) {
        defaultNote = 'Clausura';
      } else if (category === 'TAG:doxologia' || (hymn && hymn.cat === 'Doxología')) {
        defaultNote = 'Doxología';
      } else if (category === 'TAG:santacena' || (hymn && hymn.cat === 'Santa Cena')) {
        defaultNote = 'Santa Cena';
      }
      pl.items.push({
        n: hymnNum,
        note: defaultNote,
        stanzas: []
      });
      saveState();
      showToast(`Agregado #${hymnNum} a ${pl.name}`);
    }
    if (currentView === 'view-search') renderSearchResults();
    if (currentView === 'view-list') renderPlaylistView();
    if (currentView === 'view-reader') renderReaderView(currentReaderHymnNum);
    if (currentView === 'view-share') renderShareView();
    updateDialerPreview();
  }

  // ==================== VIEW 2: MIS LISTAS (CULTO | ESCUELA | SANTA CENA) ====================
  function renderPlaylistView() {
    updateGlobalBadges();
    const pl = getActivePlaylist();

    const nameInput = document.getElementById('playlist-name-input');
    if (nameInput) nameInput.value = `Lista de ${pl.name}`;

    const dateInput = document.getElementById('playlist-date-input');
    if (dateInput) dateInput.value = pl.date || '';

    const container = document.getElementById('playlist-items-container');
    container.innerHTML = '';

    if (pl.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎵</div>
          <p><strong>Tu lista de "${escapeHtml(pl.name)}" está vacía</strong></p>
          <p style="font-size:0.84rem;margin-top:6px">Ve a <strong>Himnario</strong> y toca el botón <strong>+ ${escapeHtml(pl.name === 'Escuela Sabática' ? 'Escuela' : pl.name)}</strong> en los himnos que elijas.</p>
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
                <span>${escapeHtml(hymn.cat)}</span>
                <span>· ${hymn.s.length} estrofa${hymn.s.length === 1 ? '' : 's'}${hymn.c ? ' + Coro' : ''}</span>
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
            placeholder="Momento / Nota (ej. Apertura, Entrada Oficiantes, Diezmos, Tono Sol...)"
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
    updateGlobalBadges();
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
      pulpitTitle.textContent = `🎵 Lista de ${pl.name}`;
      pulpitCounter.textContent =
        playlistIdx >= 0
          ? `Himno ${playlistIdx + 1} de ${pl.items.length}`
          : `${pl.items.length} en ${pl.name}`;

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
      pulpitBar.style.display = 'block';
      pulpitTitle.textContent = `🎵 Lista de ${pl.name}`;
      pulpitCounter.textContent = 'Vacía';
      pillsContainer.innerHTML = `<span style="font-size:0.8rem;color:var(--text-muted)">Aún no hay himnos en ${escapeHtml(pl.name)}. Usa los botones de abajo para agregar.</span>`;
    }

    // Header info
    document.getElementById('reader-hymn-num').textContent = `Himno #${hymn.n}`;
    document.getElementById('reader-hymn-cat').textContent = hymn.cat || '';
    document.getElementById('reader-hymn-title').textContent = hymn.t;
    document.getElementById('reader-hymn-bible').textContent = hymn.b ? `📖 ${hymn.b}` : '';

    // Favorite & 4 List buttons (+ Servicio, + Culto, + Escuela, + Santa Cena)
    const isFav = state.favorites.includes(hymn.n);
    const favBtn = document.getElementById('btn-reader-fav');
    favBtn.textContent = isFav ? '★' : '☆';
    favBtn.style.color = isFav ? 'var(--accent)' : 'var(--text-primary)';

    const inServicio = getPlaylistById('pl-servicio').items.some((it) => it.n === hymn.n);
    const inCulto = getPlaylistById('pl-culto').items.some((it) => it.n === hymn.n);
    const inEscuela = getPlaylistById('pl-escuela').items.some((it) => it.n === hymn.n);
    const inSantaCena = getPlaylistById('pl-santacena').items.some((it) => it.n === hymn.n);

    const btnServicio = document.getElementById('btn-reader-toggle-servicio');
    const btnCulto = document.getElementById('btn-reader-toggle-culto');
    const btnEscuela = document.getElementById('btn-reader-toggle-escuela');
    const btnSantaCena = document.getElementById('btn-reader-toggle-santacena');

    if (btnServicio) {
      btnServicio.className = `add-list-btn ${inServicio ? 'in-list' : ''}`;
      btnServicio.textContent = inServicio ? '✓ Servicio' : '+ Servicio';
    }
    if (btnCulto) {
      btnCulto.className = `add-list-btn ${inCulto ? 'in-list' : ''}`;
      btnCulto.textContent = inCulto ? '✓ Culto' : '+ Culto';
    }
    if (btnEscuela) {
      btnEscuela.className = `add-list-btn ${inEscuela ? 'in-list' : ''}`;
      btnEscuela.textContent = inEscuela ? '✓ Escuela' : '+ Escuela';
    }
    if (btnSantaCena) {
      btnSantaCena.className = `add-list-btn ${inSantaCena ? 'in-list' : ''}`;
      btnSantaCena.textContent = inSantaCena ? '✓ Santa Cena' : '+ Santa Cena';
    }

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
      prevBtn.textContent = `◀ Ant. en ${pl.name} (#${prevItem.n})`;
      nextBtn.textContent = `Sig. en ${pl.name} (#${nextItem.n}) ▶`;
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
  function encodeExportCode() {
    if (exportScope === 'all') {
      const payload = {
        v: 2,
        multi: true,
        lists: state.playlists.map((pl) => ({
          id: pl.id,
          n: pl.name,
          d: pl.date || '',
          i: pl.items.map((it) => {
            const entry = { n: it.n };
            if (it.note) entry.m = it.note;
            if (Array.isArray(it.stanzas) && it.stanzas.length > 0) entry.s = it.stanzas;
            return entry;
          })
        }))
      };
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return `HA09:${b64}`;
    }

    const pl = getActivePlaylist();
    const payload = {
      v: 2,
      id: pl.id,
      n: pl.name || 'Culto',
      d: pl.date || '',
      i: pl.items.map((it) => {
        const entry = { n: it.n };
        if (it.note) entry.m = it.note;
        if (Array.isArray(it.stanzas) && it.stanzas.length > 0) entry.s = it.stanzas;
        return entry;
      })
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `HA09:${b64}`;
  }

  function formatSingleListLines(pl, lines) {
    const icon =
      pl.id === 'pl-servicio'
        ? '🎤'
        : pl.id === 'pl-escuela'
        ? '📘'
        : pl.id === 'pl-santacena'
        ? '🍷'
        : '⛪';
    const datePart = pl.date ? ` (${pl.date})` : '';
    lines.push(`${icon} *${pl.name.toUpperCase()}${datePart}*`);
    if (pl.items.length === 0) {
      lines.push(`_(Sin himnos seleccionados)_`);
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
  }

  function buildShareableMessage() {
    const code = encodeExportCode();
    const lines = [`🎵 *PROGRAMA DE ALABANZA · HIMNARIO 2009*`, ``];

    if (exportScope === 'all') {
      state.playlists.forEach((pl, idx) => {
        if (idx > 0) lines.push(``);
        formatSingleListLines(pl, lines);
      });
    } else {
      formatSingleListLines(getActivePlaylist(), lines);
    }

    lines.push(``);
    lines.push(`📲 *Código para importar en la App:*`);
    lines.push(code);

    if (window.location.protocol.startsWith('http')) {
      const baseUrl = window.location.origin + window.location.pathname;
      lines.push(``);
      lines.push(`🔗 *Abrir e importar directo:* ${baseUrl}?import=${encodeURIComponent(code)}`);
    }

    return lines.join('\n');
  }

  const FLYER_THEMES = {
    'royal-gold': {
      bgStops: ['#070c18', '#101d3b', '#080e1e'],
      glowTop: 'rgba(245, 158, 11, 0.20)',
      glowBottom: 'rgba(59, 130, 246, 0.14)',
      frameOuter: 'rgba(245, 158, 11, 0.55)',
      frameInner: 'rgba(245, 158, 11, 0.22)',
      accent: '#f59e0b',
      accentLight: '#fde047',
      accentDark: '#b45309',
      badgeText: '#091022',
      cardBg: 'rgba(20, 31, 58, 0.88)',
      cardBorder: 'rgba(245, 158, 11, 0.28)',
      sectionBg: 'rgba(245, 158, 11, 0.14)',
      notePillBg: 'rgba(245, 158, 11, 0.18)',
      notePillBorder: 'rgba(245, 158, 11, 0.45)',
      notePillText: '#fde047',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8'
    },
    'classic-ivory': {
      bgStops: ['#fdfbf7', '#f5efe2', '#eae0cc'],
      glowTop: 'rgba(180, 83, 9, 0.11)',
      glowBottom: 'rgba(146, 64, 14, 0.08)',
      frameOuter: 'rgba(180, 83, 9, 0.50)',
      frameInner: 'rgba(180, 83, 9, 0.22)',
      accent: '#b45309',
      accentLight: '#d97706',
      accentDark: '#78350f',
      badgeText: '#ffffff',
      cardBg: 'rgba(255, 255, 255, 0.92)',
      cardBorder: 'rgba(180, 83, 9, 0.25)',
      sectionBg: 'rgba(180, 83, 9, 0.11)',
      notePillBg: 'rgba(180, 83, 9, 0.12)',
      notePillBorder: 'rgba(180, 83, 9, 0.35)',
      notePillText: '#92400e',
      textPrimary: '#0f172a',
      textSecondary: '#334155',
      textMuted: '#64748b'
    },
    'celestial-blue': {
      bgStops: ['#07132c', '#122b60', '#091838'],
      glowTop: 'rgba(56, 189, 248, 0.20)',
      glowBottom: 'rgba(245, 158, 11, 0.12)',
      frameOuter: 'rgba(56, 189, 248, 0.55)',
      frameInner: 'rgba(56, 189, 248, 0.22)',
      accent: '#38bdf8',
      accentLight: '#bae6fd',
      accentDark: '#0284c7',
      badgeText: '#07132c',
      cardBg: 'rgba(15, 36, 80, 0.86)',
      cardBorder: 'rgba(56, 189, 248, 0.30)',
      sectionBg: 'rgba(56, 189, 248, 0.14)',
      notePillBg: 'rgba(56, 189, 248, 0.16)',
      notePillBorder: 'rgba(56, 189, 248, 0.42)',
      notePillText: '#bae6fd',
      textPrimary: '#f8fafc',
      textSecondary: '#e0f2fe',
      textMuted: '#93c5fd'
    },
    'solemn-emerald': {
      bgStops: ['#041d17', '#08372b', '#05231b'],
      glowTop: 'rgba(251, 191, 36, 0.18)',
      glowBottom: 'rgba(16, 185, 129, 0.14)',
      frameOuter: 'rgba(251, 191, 36, 0.52)',
      frameInner: 'rgba(251, 191, 36, 0.22)',
      accent: '#fbbf24',
      accentLight: '#fef08a',
      accentDark: '#b45309',
      badgeText: '#041d17',
      cardBg: 'rgba(8, 49, 39, 0.86)',
      cardBorder: 'rgba(251, 191, 36, 0.28)',
      sectionBg: 'rgba(251, 191, 36, 0.13)',
      notePillBg: 'rgba(251, 191, 36, 0.16)',
      notePillBorder: 'rgba(251, 191, 36, 0.42)',
      notePillText: '#fef08a',
      textPrimary: '#f8fafc',
      textSecondary: '#d1fae5',
      textMuted: '#6ee7b7'
    }
  };

  function formatDisplayDate(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = isoDateStr.split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return isoDateStr;
    try {
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const formatted = dateObj.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      return formatted.toUpperCase();
    } catch (e) {
      return isoDateStr;
    }
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines = [];
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = current + ' ' + words[i];
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
    return lines;
  }

  function drawFlyerEmblem(ctx, cx, cy, palette) {
    ctx.save();
    // Outer soft halo
    const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, 68);
    halo.addColorStop(0, palette.glowTop);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 68, 0, Math.PI * 2);
    ctx.fill();

    // Emblem circle
    ctx.fillStyle = palette.cardBg;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = palette.frameInner;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 41, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle Cross at top
    ctx.strokeStyle = palette.accentLight;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 30);
    ctx.lineTo(cx, cy - 14);
    ctx.moveTo(cx - 6, cy - 24);
    ctx.lineTo(cx + 6, cy - 24);
    ctx.stroke();

    // Open Hymnal Book
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy - 6);
    ctx.quadraticCurveTo(cx - 12, cy - 11, cx, cy - 3);
    ctx.quadraticCurveTo(cx + 12, cy - 11, cx + 24, cy - 6);
    ctx.lineTo(cx + 24, cy + 20);
    ctx.quadraticCurveTo(cx + 12, cy + 15, cx, cy + 23);
    ctx.quadraticCurveTo(cx - 12, cy + 15, cx - 24, cy + 20);
    ctx.closePath();
    ctx.stroke();

    // Spine
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx, cy + 23);
    ctx.stroke();

    // Page lines
    ctx.strokeStyle = palette.textPrimary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 17, cy + 2);
    ctx.lineTo(cx - 6, cy + 4);
    ctx.moveTo(cx - 17, cy + 9);
    ctx.lineTo(cx - 6, cy + 11);
    ctx.moveTo(cx + 6, cy + 4);
    ctx.lineTo(cx + 17, cy + 2);
    ctx.moveTo(cx + 6, cy + 11);
    ctx.lineTo(cx + 17, cy + 9);
    ctx.stroke();

    ctx.restore();
  }

  function drawOrnamentalDivider(ctx, cx, y, halfWidth, palette) {
    ctx.save();
    const gradLeft = ctx.createLinearGradient(cx - halfWidth, y, cx - 18, y);
    gradLeft.addColorStop(0, 'rgba(0,0,0,0)');
    gradLeft.addColorStop(1, palette.accent);
    ctx.strokeStyle = gradLeft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - halfWidth, y);
    ctx.lineTo(cx - 18, y);
    ctx.stroke();

    const gradRight = ctx.createLinearGradient(cx + 18, y, cx + halfWidth, y);
    gradRight.addColorStop(0, palette.accent);
    gradRight.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = gradRight;
    ctx.beginPath();
    ctx.moveTo(cx + 18, y);
    ctx.lineTo(cx + halfWidth, y);
    ctx.stroke();

    // Center diamond
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(cx, y - 7);
    ctx.lineTo(cx + 7, y);
    ctx.lineTo(cx, y + 7);
    ctx.lineTo(cx - 7, y);
    ctx.closePath();
    ctx.fill();

    // Side mini dots
    ctx.beginPath();
    ctx.arc(cx - 16, y, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 16, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function renderFlyerCanvas() {
    const canvas = document.getElementById('flyer-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const palette = FLYER_THEMES[state.flyerTheme] || FLYER_THEMES['royal-gold'];
    const W = 1080;
    const fontStack = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif';

    const churchText = (state.flyerChurch || '').trim() || 'HIMNARIO ADVENTISTA 2009';
    const directorText = (state.flyerDirector || '').trim();

    // Determine lists to render
    const activePl = getActivePlaylist();
    let listsToRender = [];
    if (exportScope === 'all') {
      const nonEmpty = state.playlists.filter((p) => p.items.length > 0);
      listsToRender = nonEmpty.length > 0 ? nonEmpty : [activePl];
    } else {
      listsToRender = [activePl];
    }

    const isMulti = exportScope === 'all' && listsToRender.length > 1;

    // Pre-calculate item layouts and total height
    const cardX = 86;
    const cardW = W - cardX * 2; // 908px
    const textLeftOffset = 178; // Inside card for title & meta
    const textMaxW = cardW - textLeftOffset - 36;

    const preparedSections = listsToRender.map((pl) => {
      const preparedItems = pl.items.map((item, idx) => {
        const hymn = HYMN_BY_NUM.get(item.n);
        const titleStr = hymn ? hymn.t : `Himno #${item.n}`;
        ctx.font = `800 ${isMulti ? 30 : 34}px ${fontStack}`;
        const titleLines = wrapCanvasText(ctx, titleStr, textMaxW);

        const noteStr = (item.note || '').trim();
        const catStr = hymn && hymn.cat ? hymn.cat : '';
        const bibleStr = hymn && hymn.b ? `📖 ${hymn.b}` : '';
        const hasCustomStanzas =
          Array.isArray(item.stanzas) &&
          item.stanzas.length > 0 &&
          (!hymn || item.stanzas.length < hymn.s.length);
        const stanzaStr = hasCustomStanzas
          ? `🎤 Estrofas: ${item.stanzas.join(', ')}`
          : hymn && hymn.s
          ? `${hymn.s.length} estrofa${hymn.s.length === 1 ? '' : 's'}${hymn.c ? ' + Coro' : ''}`
          : '';

        const metaParts = [catStr, bibleStr, stanzaStr].filter(Boolean);
        const metaLine = metaParts.join('   ·   ');

        let cardH = isMulti ? 124 : 144;
        if (noteStr) cardH += 38;
        if (titleLines.length > 1) cardH += (titleLines.length - 1) * (isMulti ? 36 : 40);

        return {
          order: idx + 1,
          num: item.n,
          noteStr,
          titleLines,
          metaLine,
          hasCustomStanzas,
          cardH
        };
      });

      return {
        id: pl.id,
        name: pl.name,
        date: pl.date,
        items: preparedItems
      };
    });

    // Compute total Y height needed
    let cursorY = 395; // Start of body after header
    for (const sec of preparedSections) {
      if (isMulti) {
        cursorY += 72; // Section header banner
      }
      if (sec.items.length === 0) {
        cursorY += 160;
      } else {
        for (const it of sec.items) {
          cursorY += it.cardH + (isMulti ? 18 : 22);
        }
      }
      if (isMulti) {
        cursorY += 22; // Extra gap between sections
      }
    }

    if (directorText) {
      cursorY += 74;
    }
    const footerHeight = 175;
    const totalH = Math.max(1350, cursorY + footerHeight);

    canvas.width = W;
    canvas.height = totalH;

    // 1. Draw Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, totalH);
    bgGrad.addColorStop(0, palette.bgStops[0]);
    bgGrad.addColorStop(0.5, palette.bgStops[1]);
    bgGrad.addColorStop(1, palette.bgStops[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, totalH);

    // 2. Ambient Glows
    const topGlow = ctx.createRadialGradient(W / 2, 160, 20, W / 2, 160, 560);
    topGlow.addColorStop(0, palette.glowTop);
    topGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, 750);

    const botGlow = ctx.createRadialGradient(W / 2, totalH - 180, 20, W / 2, totalH - 180, 520);
    botGlow.addColorStop(0, palette.glowBottom);
    botGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = botGlow;
    ctx.fillRect(0, totalH - 700, W, 700);

    // 3. Double Ornamental Border Frame
    ctx.save();
    ctx.strokeStyle = palette.frameOuter;
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, 34, 34, W - 68, totalH - 68, 36);
    ctx.stroke();

    ctx.strokeStyle = palette.frameInner;
    ctx.lineWidth = 1.2;
    drawRoundedRect(ctx, 48, 48, W - 96, totalH - 96, 26);
    ctx.stroke();

    // Corner diamond accents
    const corners = [
      [54, 54],
      [W - 54, 54],
      [54, totalH - 54],
      [W - 54, totalH - 54]
    ];
    ctx.fillStyle = palette.accent;
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 6, cy);
      ctx.lineTo(cx, cy + 6);
      ctx.lineTo(cx - 6, cy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 4. Header Emblem & Titles
    drawFlyerEmblem(ctx, W / 2, 126, palette);

    // Church / Top Tag
    ctx.save();
    ctx.fillStyle = palette.accent;
    ctx.font = `800 22px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText(churchText.toUpperCase(), W / 2, 214);
    ctx.restore();

    // Main Program Title
    let mainTitle = 'PROGRAMA DE ALABANZA';
    if (!isMulti) {
      const singleId = preparedSections[0].id;
      if (singleId === 'pl-servicio') mainTitle = 'SERVICIO DE CANTO';
      else if (singleId === 'pl-culto') mainTitle = 'CULTO DE ADORACIÓN';
      else if (singleId === 'pl-escuela') mainTitle = 'ESCUELA SABÁTICA';
      else if (singleId === 'pl-santacena') mainTitle = 'SANTA CENA';
    }

    ctx.save();
    ctx.fillStyle = palette.textPrimary;
    ctx.font = `900 54px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(mainTitle, W / 2, 276);
    ctx.restore();

    // Date Pill
    const primaryDateStr = formatDisplayDate(preparedSections[0]?.date || activePl.date);
    if (primaryDateStr) {
      ctx.save();
      ctx.font = `700 22px ${fontStack}`;
      const dateText = `📅  ${primaryDateStr}`;
      const pillW = Math.min(cardW, ctx.measureText(dateText).width + 56);
      const pillX = (W - pillW) / 2;
      const pillY = 298;
      const pillH = 44;

      ctx.fillStyle = palette.sectionBg;
      ctx.strokeStyle = palette.cardBorder;
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 22);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = palette.textSecondary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dateText, W / 2, pillY + pillH / 2 + 1);
      ctx.restore();
    }

    drawOrnamentalDivider(ctx, W / 2, 368, 360, palette);

    // 5. Render Sections & Hymn Cards
    let y = 398;

    // Center vertically if few items so the flyer looks balanced
    const contentSpan = cursorY - 395;
    const availableSpan = totalH - 395 - footerHeight - (directorText ? 74 : 0);
    if (contentSpan < availableSpan - 40) {
      y += Math.floor((availableSpan - contentSpan) * 0.32);
    }

    for (const sec of preparedSections) {
      if (isMulti) {
        const secIcon =
          sec.id === 'pl-servicio'
            ? '🎤'
            : sec.id === 'pl-escuela'
            ? '📘'
            : sec.id === 'pl-santacena'
            ? '🍷'
            : '⛪';
        ctx.save();
        ctx.fillStyle = palette.sectionBg;
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, cardX, y, cardW, 56, 16);
        ctx.fill();
        ctx.stroke();

        // Left accent bar
        ctx.fillStyle = palette.accent;
        drawRoundedRect(ctx, cardX, y, 10, 56, 5);
        ctx.fill();

        ctx.fillStyle = palette.accentLight;
        ctx.font = `800 26px ${fontStack}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${secIcon}  ${sec.name.toUpperCase()}`, cardX + 28, y + 29);

        ctx.fillStyle = palette.textMuted;
        ctx.font = `700 21px ${fontStack}`;
        ctx.textAlign = 'right';
        ctx.fillText(
          `${sec.items.length} himno${sec.items.length === 1 ? '' : 's'}`,
          cardX + cardW - 24,
          y + 29
        );
        ctx.restore();
        y += 72;
      }

      if (sec.items.length === 0) {
        ctx.save();
        ctx.fillStyle = palette.cardBg;
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, cardX, y, cardW, 130, 22);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = palette.textMuted;
        ctx.font = `700 26px ${fontStack}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Agrega himnos a esta lista para verlos en el flyer', W / 2, y + 65);
        ctx.restore();
        y += 150;
      } else {
        for (const it of sec.items) {
          ctx.save();
          // Card shadow & background
          ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 6;
          ctx.fillStyle = palette.cardBg;
          drawRoundedRect(ctx, cardX, y, cardW, it.cardH, 24);
          ctx.fill();

          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = palette.cardBorder;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Left Number Badge Box
          const badgeW = 126;
          const badgeH = it.cardH - 32;
          const badgeX = cardX + 20;
          const badgeY = y + 16;

          const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
          badgeGrad.addColorStop(0, palette.accent);
          badgeGrad.addColorStop(1, palette.accentDark);
          ctx.fillStyle = badgeGrad;
          drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18);
          ctx.fill();

          // Order label inside top of badge ("1° HIMNO")
          ctx.fillStyle = palette.badgeText;
          ctx.globalAlpha = 0.78;
          ctx.font = `800 17px ${fontStack}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(`${it.order}° HIMNO`, badgeX + badgeW / 2, badgeY + badgeH / 2 - 14);

          // Hymn Number ("#22")
          ctx.globalAlpha = 1;
          ctx.font = `900 ${String(it.num).length >= 3 ? 38 : 42}px ${fontStack}`;
          ctx.fillText(`#${it.num}`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 26);

          // Right content area
          const contentX = cardX + textLeftOffset;
          let innerY = y + 24;

          // Moment / Director Note Pill (if present)
          if (it.noteStr) {
            ctx.font = `800 20px ${fontStack}`;
            const noteUpper = `✦  ${it.noteStr.toUpperCase()}`;
            const noteW = Math.min(textMaxW, ctx.measureText(noteUpper).width + 28);
            ctx.fillStyle = palette.notePillBg;
            ctx.strokeStyle = palette.notePillBorder;
            ctx.lineWidth = 1.2;
            drawRoundedRect(ctx, contentX, innerY - 4, noteW, 32, 10);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = palette.notePillText;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(noteUpper, contentX + 14, innerY + 12, textMaxW - 24);
            innerY += 40;
          } else {
            innerY += 6;
          }

          // Hymn Title Lines
          ctx.fillStyle = palette.textPrimary;
          ctx.font = `800 ${isMulti ? 30 : 34}px ${fontStack}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const lineH = isMulti ? 36 : 40;
          for (const line of it.titleLines) {
            ctx.fillText(line, contentX, innerY);
            innerY += lineH;
          }

          // Metadata Line (Category, Bible Ref, Stanzas)
          if (it.metaLine) {
            ctx.fillStyle = it.hasCustomStanzas ? palette.accentLight : palette.textSecondary;
            ctx.font = `600 21px ${fontStack}`;
            ctx.fillText(it.metaLine, contentX, innerY + 6, textMaxW);
          }

          ctx.restore();
          y += it.cardH + (isMulti ? 18 : 22);
        }
      }

      if (isMulti) {
        y += 18;
      }
    }

    // 6. Optional Director / Custom Footer Pill
    if (directorText) {
      ctx.save();
      ctx.font = `700 24px ${fontStack}`;
      const dirLabel = `🎵  ${directorText}`;
      const dirW = Math.min(cardW, ctx.measureText(dirLabel).width + 56);
      const dirX = (W - dirW) / 2;
      const dirY = totalH - footerHeight - 58;

      ctx.fillStyle = palette.cardBg;
      ctx.strokeStyle = palette.frameOuter;
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, dirX, dirY, dirW, 48, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = palette.accentLight;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dirLabel, W / 2, dirY + 25);
      ctx.restore();
    }

    // 7. Footer Verse & Signature
    const footerTopY = totalH - footerHeight + 12;
    drawOrnamentalDivider(ctx, W / 2, footerTopY, 340, palette);

    ctx.save();
    ctx.fillStyle = palette.textSecondary;
    ctx.font = `italic 600 22px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      '“Cantad a Jehová cántico nuevo; cantad a Jehová, toda la tierra.” — Salmos 96:1',
      W / 2,
      footerTopY + 46
    );

    ctx.fillStyle = palette.accent;
    ctx.font = `800 19px ${fontStack}`;
    ctx.letterSpacing = '2px';
    ctx.fillText('DIRECTOR DE CANTO  ·  HIMNARIO ADVENTISTA 2009', W / 2, footerTopY + 86);
    ctx.restore();
  }

  function getFlyerFilename() {
    const pl = getActivePlaylist();
    const scopeName =
      exportScope === 'all'
        ? 'programa_alabanza'
        : (pl.name || 'lista').toLowerCase().replace(/[^a-z0-9]+/gi, '_');
    const dateSuffix = pl.date ? `_${pl.date}` : '';
    return `flyer_${scopeName}${dateSuffix}.png`;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la imagen.'));
      }, 'image/png');
    });
  }

  async function downloadFlyerImage() {
    renderFlyerCanvas();
    const canvas = document.getElementById('flyer-canvas');
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFlyerFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('¡Flyer descargado en alta calidad!');
    } catch (e) {
      showToast('Error al descargar la imagen');
    }
  }

  async function shareFlyerImage() {
    renderFlyerCanvas();
    const canvas = document.getElementById('flyer-canvas');
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas);
      const filename = getFlyerFilename();
      const file = new File([blob], filename, { type: 'image/png' });
      const pl = getActivePlaylist();
      const shareTitle =
        exportScope === 'all' ? 'Programa de Alabanza' : `Lista de ${pl.name} · Himnario 2009`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: `🎵 ${shareTitle}`,
          files: [file]
        });
        return;
      }
      // Fallback: download the image if browser doesn't support native file sharing
      await downloadFlyerImage();
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        await downloadFlyerImage();
      }
    }
  }

  async function copyFlyerImage() {
    renderFlyerCanvas();
    const canvas = document.getElementById('flyer-canvas');
    if (!canvas) return;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blob = await canvasToBlob(canvas);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('¡Imagen copiada! Ya puedes pegarla en WhatsApp');
        return;
      }
      await downloadFlyerImage();
    } catch (e) {
      await downloadFlyerImage();
    }
  }

  function renderShareView() {
    updateGlobalBadges();
    document.querySelectorAll('.export-single-tab-selector').forEach((el) => {
      el.style.display = exportScope === 'all' ? 'none' : 'grid';
    });
    document.querySelectorAll('[data-export-scope]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-export-scope') === exportScope);
    });
    document.querySelectorAll('[data-flyer-theme]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-flyer-theme') === state.flyerTheme);
    });

    const churchInput = document.getElementById('flyer-church-input');
    if (churchInput && document.activeElement !== churchInput) {
      churchInput.value = state.flyerChurch || '';
    }
    const directorInput = document.getElementById('flyer-director-input');
    if (directorInput && document.activeElement !== directorInput) {
      directorInput.value = state.flyerDirector || '';
    }

    const preview = document.getElementById('export-text-preview');
    if (preview) {
      preview.value = buildShareableMessage();
    }

    renderFlyerCanvas();
  }

  function parseImportedData(rawInput) {
    if (!rawInput || !rawInput.trim()) {
      throw new Error('Pega primero el mensaje o código de la lista.');
    }
    const text = rawInput.trim();

    // 1. Check HA09:<base64> code
    const codeMatch = text.match(/HA09:([A-Za-z0-9\-_]+)/);
    if (codeMatch) {
      let b64 = codeMatch[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      const jsonStr = decodeURIComponent(escape(atob(b64)));
      const data = JSON.parse(jsonStr);

      if (data && data.multi && Array.isArray(data.lists)) {
        return {
          multi: true,
          lists: data.lists.map((l) => ({
            id: l.id,
            name: l.n,
            date: l.d || new Date().toISOString().slice(0, 10),
            items: (l.i || [])
              .map((entry) => ({
                n: Number(entry.n),
                note: entry.m || '',
                stanzas: Array.isArray(entry.s) ? entry.s.map(Number) : []
              }))
              .filter((it) => HYMN_BY_NUM.has(it.n))
          }))
        };
      }

      if (data && Array.isArray(data.i)) {
        return {
          multi: false,
          id: data.id || null,
          name: data.n || 'Culto',
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

    // 2. Check JSON file or object
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.playlists)) {
          return {
            multi: true,
            lists: parsed.playlists
          };
        }
        if (Array.isArray(parsed.items)) {
          return {
            multi: false,
            id: parsed.id || null,
            name: parsed.name || 'Culto',
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
        // Fallback to plain numbers
      }
    }

    // 3. Fallback: Extract hymn numbers from plain text
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
          multi: false,
          id: null,
          name: 'Lista Importada',
          date: new Date().toISOString().slice(0, 10),
          items: validNums
        };
      }
    }

    throw new Error('No se encontraron himnos válidos (1–613) ni un código HA09.');
  }

  function applyImportedData(imported, targetOverride) {
    if (imported.multi && Array.isArray(imported.lists)) {
      let totalHymns = 0;
      for (const l of imported.lists) {
        const target = state.playlists.find((p) => p.id === l.id || p.name.toLowerCase() === (l.name || '').toLowerCase());
        if (target && Array.isArray(l.items)) {
          target.items = l.items;
          if (l.date) target.date = l.date;
          totalHymns += l.items.length;
        }
      }
      saveState();
      renderPlaylistView();
      renderSearchResults();
      renderShareView();
      switchView('view-list');
      showToast(`¡Se importaron las listas (${totalHymns} himnos en total)!`);
      return;
    }

    let destId = state.activePlaylistId;
    if (targetOverride && targetOverride !== 'auto') {
      destId = targetOverride;
    } else if (imported.id && state.playlists.some((p) => p.id === imported.id)) {
      destId = imported.id;
    } else if (imported.name) {
      const normName = normalizeText(imported.name);
      if (normName.includes('servicio')) destId = 'pl-servicio';
      else if (normName.includes('escuela')) destId = 'pl-escuela';
      else if (normName.includes('santa') || normName.includes('cena')) destId = 'pl-santacena';
      else if (normName.includes('culto')) destId = 'pl-culto';
    }

    const pl = getPlaylistById(destId);
    pl.items = imported.items || [];
    if (imported.date) pl.date = imported.date;
    state.activePlaylistId = pl.id;

    saveState();
    renderPlaylistView();
    renderSearchResults();
    renderShareView();
    switchView('view-list');
    showToast(`¡Lista importada en "${pl.name}" (${pl.items.length} himnos)!`);
  }

  function checkUrlImportParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const importParam = params.get('import');
      if (importParam) {
        const imported = parseImportedData(importParam);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        applyImportedData(imported, 'auto');
      }
    } catch (e) {
      console.warn('No se pudo importar desde URL:', e);
    }
  }

  // ==================== QUICK NUMBER DIALER (#1 - #613) ====================
  function updateDialerPreview() {
    const numEl = document.getElementById('dialer-number');
    const titleEl = document.getElementById('dialer-preview-title');
    const n = Number(dialerDigits);
    const hymn = dialerDigits ? HYMN_BY_NUM.get(n) : null;

    document.querySelectorAll('[data-dialer-add]').forEach((btn) => {
      const listId = btn.getAttribute('data-dialer-add');
      const pl = getPlaylistById(listId);
      const shortName =
        listId === 'pl-servicio'
          ? 'Servicio'
          : listId === 'pl-escuela'
          ? 'Escuela'
          : listId === 'pl-santacena'
          ? 'Santa Cena'
          : 'Culto';
      const inList = hymn && pl.items.some((it) => it.n === hymn.n);
      btn.className = `add-list-btn ${inList ? 'in-list' : ''}`;
      btn.textContent = inList ? `✓ ${shortName}` : `+ ${shortName}`;
    });

    if (!dialerDigits) {
      numEl.textContent = '#_';
      titleEl.textContent = 'Digita un número del 1 al 613';
      titleEl.style.color = 'var(--text-secondary)';
      return;
    }
    numEl.textContent = `#${n}`;
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

    // 3 Service Tabs in Mi Lista
    document.querySelectorAll('[data-service-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-service-tab');
        if (tabId) switchServiceTab(tabId, false);
      });
    });

    // 3 Service Tabs in Modo Púlpito
    document.querySelectorAll('[data-pulpit-service-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-pulpit-service-tab');
        if (tabId) switchServiceTab(tabId, true);
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

    const catSelect = document.getElementById('category-filter');
    catSelect.addEventListener('change', () => {
      searchRenderLimit = 80;
      renderSearchResults();
    });

    const btnOficiantes = document.getElementById('btn-filter-oficiantes');
    if (btnOficiantes) {
      btnOficiantes.addEventListener('click', () => {
        catSelect.value = catSelect.value === 'TAG:oficiantes' ? '' : 'TAG:oficiantes';
        searchRenderLimit = 80;
        renderSearchResults();
      });
    }

    const btnDiezmos = document.getElementById('btn-filter-diezmos');
    if (btnDiezmos) {
      btnDiezmos.addEventListener('click', () => {
        catSelect.value = catSelect.value === 'TAG:diezmos' ? '' : 'TAG:diezmos';
        searchRenderLimit = 80;
        renderSearchResults();
      });
    }

    const btnApertura = document.getElementById('btn-filter-apertura');
    if (btnApertura) {
      btnApertura.addEventListener('click', () => {
        catSelect.value = catSelect.value === 'TAG:apertura' ? '' : 'TAG:apertura';
        searchRenderLimit = 80;
        renderSearchResults();
      });
    }

    const btnClausura = document.getElementById('btn-filter-clausura');
    if (btnClausura) {
      btnClausura.addEventListener('click', () => {
        catSelect.value = catSelect.value === 'TAG:clausura' ? '' : 'TAG:clausura';
        searchRenderLimit = 80;
        renderSearchResults();
      });
    }

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

    // Delegated clicks on Hymn Search Results (+ Culto | + Escuela | + Santa Cena)
    document.getElementById('hymn-results-list').addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-toggle-hymn]');
      if (toggleBtn) {
        e.stopPropagation();
        const num = Number(toggleBtn.getAttribute('data-toggle-hymn'));
        const targetList = toggleBtn.getAttribute('data-target-list');
        toggleHymnInPlaylist(num, targetList);
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
    document.getElementById('playlist-date-input').addEventListener('change', (e) => {
      const pl = getActivePlaylist();
      pl.date = e.target.value;
      saveState();
    });

    document.getElementById('btn-clear-playlist').addEventListener('click', () => {
      const pl = getActivePlaylist();
      pl.items = [];
      saveState();
      renderPlaylistView();
      showToast(`Se vació la lista de ${pl.name}`);
    });

    document.getElementById('btn-start-pulpit').addEventListener('click', () => {
      const pl = getActivePlaylist();
      if (pl.items.length > 0) {
        renderReaderView(pl.items[0].n);
      }
      switchView('view-reader');
    });

    const btnGoFlyer = document.getElementById('btn-go-flyer');
    if (btnGoFlyer) {
      btnGoFlyer.addEventListener('click', () => {
        switchView('view-share');
        const flyerCard = document.getElementById('flyer-section-card');
        if (flyerCard) {
          flyerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

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
        if (removed) showToast(`Himno #${removed.n} quitado de ${pl.name}`);
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

    document.querySelectorAll('[data-reader-list]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const listId = btn.getAttribute('data-reader-list');
        toggleHymnInPlaylist(currentReaderHymnNum, listId);
      });
    });

    document.getElementById('btn-prev-hymn').addEventListener('click', () => {
      navigateReaderRelative(-1);
    });

    document.getElementById('btn-next-hymn').addEventListener('click', () => {
      navigateReaderRelative(1);
    });

    // Horizontal swipe gesture in Modo Púlpito
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
    document.querySelectorAll('[data-export-scope]').forEach((btn) => {
      btn.addEventListener('click', () => {
        exportScope = btn.getAttribute('data-export-scope') || 'active';
        renderShareView();
      });
    });

    document.querySelectorAll('[data-export-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-export-tab');
        if (tabId) {
          state.activePlaylistId = tabId;
          saveState();
          renderShareView();
        }
      });
    });

    document.querySelectorAll('[data-flyer-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const themeKey = btn.getAttribute('data-flyer-theme');
        if (themeKey && FLYER_THEMES[themeKey]) {
          state.flyerTheme = themeKey;
          saveState();
          renderShareView();
        }
      });
    });

    const churchInput = document.getElementById('flyer-church-input');
    if (churchInput) {
      churchInput.addEventListener('input', () => {
        state.flyerChurch = churchInput.value;
        saveState();
        renderFlyerCanvas();
      });
    }

    const directorInput = document.getElementById('flyer-director-input');
    if (directorInput) {
      directorInput.addEventListener('input', () => {
        state.flyerDirector = directorInput.value;
        saveState();
        renderFlyerCanvas();
      });
    }

    document.getElementById('btn-share-flyer')?.addEventListener('click', () => {
      shareFlyerImage();
    });

    document.getElementById('btn-download-flyer')?.addEventListener('click', () => {
      downloadFlyerImage();
    });

    document.getElementById('btn-copy-flyer')?.addEventListener('click', () => {
      copyFlyerImage();
    });

    document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
      const msg = buildShareableMessage();
      const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    });

    document.getElementById('btn-copy-export').addEventListener('click', async () => {
      const msg = buildShareableMessage();
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
      const msg = buildShareableMessage();
      if (navigator.share) {
        try {
          await navigator.share({
            title: exportScope === 'all' ? 'Programa Completo de Alabanza' : `Lista de ${pl.name}`,
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
      const dataToExport =
        exportScope === 'all' ? { playlists: state.playlists } : getActivePlaylist();
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName =
        exportScope === 'all'
          ? 'programa_completo'
          : (getActivePlaylist().name || 'alabanza').replace(/[^a-z0-9_-]/gi, '_');
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
      const targetSelect = document.getElementById('import-target-select');
      const targetOverride = targetSelect ? targetSelect.value : 'auto';
      try {
        const imported = parseImportedData(input.value);
        input.value = '';
        applyImportedData(imported, targetOverride);
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
          const imported = parseImportedData(String(reader.result || ''));
          const targetSelect = document.getElementById('import-target-select');
          applyImportedData(imported, targetSelect ? targetSelect.value : 'auto');
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

    document.querySelectorAll('[data-dialer-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(dialerDigits);
        const listId = btn.getAttribute('data-dialer-add');
        if (HYMN_BY_NUM.has(n)) {
          toggleHymnInPlaylist(n, listId);
        } else {
          showToast('Ingresa un número del 1 al 613');
        }
      });
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
