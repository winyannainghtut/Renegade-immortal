(function () {
  "use strict";

  /* ─────────────────────────────────────────────────────────────
     CONSTANTS & CONFIGURATION
  ───────────────────────────────────────────────────────────── */
  const repoScope = (() => {
    const first = window.location.pathname.split("/").filter(Boolean)[0];
    return first || "local";
  })();

  const SETTINGS_KEY = `novel_reader_settings_${repoScope}_v2`;
  const LAST_CHAPTER_KEY = `novel_reader_last_chapter_${repoScope}_v2`;
  const PROGRESS_KEY = `novel_reader_scroll_progress_${repoScope}_v2`;
  const BOOKMARKS_KEY = `novel_reader_bookmarks_${repoScope}_v2`;
  const OFFLINE_CHAPTERS_KEY = `novel_reader_offline_chapters_${repoScope}_v2`;

  /* Legacy keys for migration */
  const LEGACY_SETTINGS_KEY = "novel_reader_settings_v1";
  const LEGACY_LAST_KEY = "novel_reader_last_chapter_v1";
  const LEGACY_PROGRESS_KEY = "novel_reader_scroll_progress_v1";

  const SYSTEM_THEME_QUERY = window.matchMedia("(prefers-color-scheme: dark)");
  const MOBILE_QUERY = window.matchMedia("(max-width: 979px)");
  const FONT_SIZE_MIN = 14;
  const FONT_SIZE_MAX = 32;
  const FONT_SIZE_STEP = 1;
  const SEARCH_DEBOUNCE_MS = 120;
  const SCROLL_SHOW_THRESHOLD = 280;
  const OFFLINE_WINDOW = 100;
  const OFFLINE_SW_URL = "./sw.js";
  const OFFLINE_SHELL_URLS = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.json",
    "./app-manifest.json",
    OFFLINE_SW_URL,
  ];

  const VALID_THEMES = new Set([
    "system",
    "light",
    "dark",
    "amoled",
    "sepia",
    "burmese-art",
    "night-blue",
  ]);

  const defaultSettings = {
    theme: "system",
    font: "serif",
    fontSize: 19,
    lineHeight: 1.75,
    width: 780,
    source: "all",
  };

  const fontMap = {
    serif: "'Source Serif 4', Georgia, serif",
    friendly: "'Atkinson Hyperlegible', 'Segoe UI', sans-serif",
    classic: "'Alegreya', Georgia, serif",
    modern: "'Outfit', 'Segoe UI', sans-serif",
    myanmarSerif:
      "'Noto Serif Myanmar', 'Padauk', 'Myanmar Text', 'Pyidaungsu', 'Noto Sans Myanmar', serif",
    myanmarSans:
      "'Noto Sans Myanmar', 'Padauk', 'Myanmar Text', 'Pyidaungsu', 'Atkinson Hyperlegible', sans-serif",
    myanmarPadauk:
      "'Padauk', 'Noto Sans Myanmar', 'Myanmar Text', 'Pyidaungsu', sans-serif",
  };

  /* Source filter special values */
  const FILTER_ALL = "all";
  const FILTER_BOOKMARK = "__bookmarks__";
  const FILTER_OFFLINE = "__offline__";

  /* ─────────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────────── */
  const state = {
    /* Library */
    entries: [],
    entriesById: new Map(),
    entriesBySource: new Map(),
    filteredEntries: [],
    chapterButtonById: new Map(),
    activeChapterButtonId: null,
    currentId: null,

    /* Settings */
    settings: sanitizeSettings(
      readJSONWithLegacy(SETTINGS_KEY, LEGACY_SETTINGS_KEY, defaultSettings),
    ),

    /* Progress { [chapterId]: { scroll: number } } */
    progress: readProgress(),

    /* Bookmarks: Set<chapterId> */
    bookmarks: loadBookmarks(),

    /* Offline chapters: Set<chapterId> */
    offlineChapters: loadOfflineChapters(),

    /* UI state */
    isLoadingChapter: false,
    settingsOpen: false,
    chromeVisible: true,
    readProgress: 0,
    lastContentScrollTop: 0,
    scrollToTopVisible: false,
    scrollButtonRaf: null,
    pendingScrollTop: 0,

    /* Timers */
    saveTimer: null,
    searchRenderTimer: null,

    /* Fetch */
    requestSequence: 0,
    activeFetchController: null,

    /* Gestures */
    pressState: null,
    pageSwipeState: null,
    pullState: null,
    ignoreNextChapterClickUntil: 0,

    /* Detail sheet */
    detailChapterId: null,

    /* Offline download */
    offlineSupported: false,
    offlineCaching: false,
    offlineReady: false,
    offlineCachedCount: 0,
    offlineTotalCount: 0,
    offlineTargetCount: 0,
    offlineError: "",
    swRegistration: null,
  };

  /* ─────────────────────────────────────────────────────────────
     ELEMENT REFS
  ───────────────────────────────────────────────────────────── */
  const els = {
    appShell: q("appShell"),
    sidebar: q("sidebar"),
    closeSidebarBtn: q("closeSidebarBtn"),
    openSidebarBtn: q("openSidebarBtn"),
    sidebarScrim: q("sidebarScrim"),
    scrollToTopBtn: q("scrollToTopBtn"),
    chapterList: q("chapterList"),
    sourceFilter: q("sourceFilter"),
    libraryMeta: q("libraryMeta"),
    searchInput: q("searchInput"),
    prevBtn: q("prevBtn"),
    nextBtn: q("nextBtn"),
    toggleSettingsBtn: q("toggleSettingsBtn"),
    settingsPanel: q("settingsPanel"),
    toolbar: q("toolbar"),
    themeSelect: q("themeSelect"),
    fontSelect: q("fontSelect"),
    decreaseFontSizeBtn: q("decreaseFontSizeBtn"),
    fontSizeRange: q("fontSizeRange"),
    increaseFontSizeBtn: q("increaseFontSizeBtn"),
    fontSizeValue: q("fontSizeValue"),
    lineHeightRange: q("lineHeightRange"),
    lineHeightValue: q("lineHeightValue"),
    widthRange: q("widthRange"),
    widthValue: q("widthValue"),
    offlineCacheBtn: q("offlineCacheBtn"),
    offlineStatus: q("offlineStatus"),
    chapterTitle: q("chapterTitle"),
    chapterInfo: q("chapterInfo"),
    chapterMetaBadges: q("chapterMetaBadges"),
    content: q("content"),
    contentStage: q("contentStage"),
    readerPanel: q("readerPanel"),
    ambientGlow: q("ambientGlow"),
    readProgressFill: q("readProgressFill"),
    bottomNav: q("bottomNav"),
    navLibraryBtn: q("navLibraryBtn"),
    navPrevBtn: q("navPrevBtn"),
    navNextBtn: q("navNextBtn"),
    navBookmarkBtn: q("navBookmarkBtn"),
    controlCenterBtn: q("controlCenterBtn"),
    readerViewport: q("readerViewport"),
    bookDetailSheet: q("bookDetailSheet"),
    bookDetailTitle: q("bookDetailTitle"),
    bookDetailPath: q("bookDetailPath"),
    bookDetailSource: q("bookDetailSource"),
    bookDetailExcerpt: q("bookDetailExcerpt"),
    openFromDetailBtn: q("openFromDetailBtn"),
    detailBookmarkBtn: q("detailBookmarkBtn"),
    closeBookDetailBtn: q("closeBookDetailBtn"),
    bookmarkBtn: q("bookmarkBtn"),
    statCompletedNum: q("statCompletedNum"),
    statInProgressNum: q("statInProgressNum"),
    statTotalNum: q("statTotalNum"),
    dlToast: q("dlToast"),
    dlToastLabel: q("dlToastLabel"),
    dlToastBar: q("dlToastBar"),
    dlToastDetail: q("dlToastDetail"),
    dlToastClose: q("dlToastClose"),
    themeColorMeta: document.getElementById("themeColorMeta"),
  };

  function q(id) {
    return document.getElementById(id);
  }

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */
  init();

  async function init() {
    bindEvents();
    initOfflineMode();
    hydrateSettingsControls();
    applyVisualSettings();
    setSettingsOpen(false);
    syncResponsiveState();
    applyProgressBar(0);
    state.lastContentScrollTop = 0;
    await loadManifest();
  }

  /* ─────────────────────────────────────────────────────────────
     EVENT BINDING
  ───────────────────────────────────────────────────────────── */
  function bindEvents() {
    /* Search */
    els.searchInput.addEventListener("input", scheduleChapterListRender);

    /* Chapter list */
    els.chapterList.addEventListener("click", handleChapterListClick);
    els.chapterList.addEventListener(
      "pointerdown",
      handleChapterListPointerStart,
    );
    els.chapterList.addEventListener(
      "pointermove",
      handleChapterListPointerMove,
    );
    els.chapterList.addEventListener("pointerup", handleChapterListPointerEnd);
    els.chapterList.addEventListener(
      "pointercancel",
      handleChapterListPointerEnd,
    );
    els.chapterList.addEventListener(
      "pointerleave",
      handleChapterListPointerEnd,
    );

    /* Navigation */
    els.prevBtn.addEventListener("click", () => moveToSibling(-1));
    els.nextBtn.addEventListener("click", () => moveToSibling(1));
    on(els.navLibraryBtn, "click", () => setSidebarOpen(true));
    on(els.navPrevBtn, "click", () => moveToSibling(-1));
    on(els.navNextBtn, "click", () => moveToSibling(1));
    on(els.controlCenterBtn, "click", () =>
      setSettingsOpen(!state.settingsOpen),
    );

    /* Sidebar */
    els.openSidebarBtn.addEventListener("click", () => setSidebarOpen(true));
    els.closeSidebarBtn.addEventListener("click", () => setSidebarOpen(false));
    els.sidebarScrim.addEventListener("click", () => setSidebarOpen(false));

    /* Settings panel toggle */
    els.toggleSettingsBtn.addEventListener("click", () =>
      setSettingsOpen(!state.settingsOpen),
    );

    /* Click outside settings to close */
    document.addEventListener("click", (e) => {
      if (!state.settingsOpen) return;
      if (els.toolbar && els.toolbar.contains(e.target)) return;
      setSettingsOpen(false);
    });

    if (els.settingsPanel) {
      els.settingsPanel.addEventListener("pointerdown", (e) =>
        e.stopPropagation(),
      );
      els.settingsPanel.addEventListener("click", (e) => e.stopPropagation());
    }

    /* Theme & font */
    els.themeSelect.addEventListener("change", () => {
      state.settings.theme = normalizeTheme(els.themeSelect.value);
      saveSettings();
      applyTheme();
    });

    els.fontSelect.addEventListener("change", () => {
      state.settings.font = normalizeFont(els.fontSelect.value);
      saveSettings();
      applyTypography();
    });

    /* Font size */
    const onFontSizeInput = () => setFontSize(els.fontSizeRange.value);
    els.fontSizeRange.addEventListener("input", onFontSizeInput);
    els.fontSizeRange.addEventListener("change", onFontSizeInput);

    on(els.decreaseFontSizeBtn, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFontSize(Number(state.settings.fontSize) - FONT_SIZE_STEP);
    });
    on(els.increaseFontSizeBtn, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFontSize(Number(state.settings.fontSize) + FONT_SIZE_STEP);
    });

    /* Line height & width */
    els.lineHeightRange.addEventListener("input", () => {
      state.settings.lineHeight = clamp(
        Number(els.lineHeightRange.value),
        1.35,
        2.2,
      );
      applyTypography();
      saveSettings();
    });
    els.widthRange.addEventListener("input", () => {
      state.settings.width = clamp(Number(els.widthRange.value), 560, 1080);
      applyTypography();
      saveSettings();
    });

    /* Offline cache */
    on(els.offlineCacheBtn, "click", () => startOfflineDownload());

    /* Scroll to top */
    on(els.scrollToTopBtn, "click", scrollToTop);

    /* Bookmarks */
    on(els.bookmarkBtn, "click", () => toggleBookmarkForCurrent());
    on(els.navBookmarkBtn, "click", () => toggleBookmarkForCurrent());

    /* Detail sheet */
    on(els.openFromDetailBtn, "click", () => {
      const id = state.detailChapterId;
      if (!id) return;
      closeBookDetailSheet();
      openChapter(id, { closeSidebarOnMobile: true });
    });
    on(els.detailBookmarkBtn, "click", () => {
      const id = state.detailChapterId;
      if (!id) return;
      toggleBookmark(id);
      updateDetailBookmarkBtn(id);
    });
    on(els.closeBookDetailBtn, "click", closeBookDetailSheet);
    if (els.bookDetailSheet) {
      els.bookDetailSheet.addEventListener("click", (e) => {
        if (e.target === els.bookDetailSheet) closeBookDetailSheet();
      });
    }

    /* Download toast close */
    on(els.dlToastClose, "click", () => hideToast());

    /* Keyboard */
    document.addEventListener("keydown", handleGlobalKeydown);

    /* Scroll */
    els.contentStage.addEventListener("scroll", handleReaderScroll, {
      passive: true,
    });
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    /* Content link clicks */
    els.content.addEventListener("click", handleContentLinkClick);

    /* Reader surface tap (immersive toggle) */
    if (els.readerViewport) {
      els.readerViewport.addEventListener("click", handleReaderSurfaceTap);
    }

    /* Online/offline */
    window.addEventListener("online", () => updateOfflineUI());
    window.addEventListener("offline", () => updateOfflineUI());

    /* Save on unload */
    window.addEventListener("beforeunload", () => {
      persistCurrentProgress();
      flushProgressSave();
    });

    /* Responsive */
    addMediaQueryListener(SYSTEM_THEME_QUERY, () => {
      if (state.settings.theme === "system") applyTheme();
    });
    addMediaQueryListener(MOBILE_QUERY, syncResponsiveState);

    /* Gestures */
    bindReaderGestures();
    bindRippleOnButtons();
  }

  function on(el, event, handler) {
    if (el) el.addEventListener(event, handler);
  }

  /* ─────────────────────────────────────────────────────────────
     KEYBOARD
  ───────────────────────────────────────────────────────────── */
  function handleGlobalKeydown(e) {
    if (e.key === "Escape") {
      if (isBookDetailOpen()) {
        closeBookDetailSheet();
        return;
      }
      if (isSidebarOpen()) {
        setSidebarOpen(false);
        return;
      }
      if (state.settingsOpen) {
        setSettingsOpen(false);
        return;
      }
    }

    if (isTypingTarget(e.target)) return;

    if (e.key === "ArrowLeft") moveToSibling(-1);
    if (e.key === "ArrowRight") moveToSibling(1);
    if (e.key === "b" || e.key === "B") toggleBookmarkForCurrent();
  }

  function isTypingTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    return Boolean(
      target.closest("input, textarea, select, [contenteditable='true']"),
    );
  }

  /* ─────────────────────────────────────────────────────────────
     SIDEBAR
  ───────────────────────────────────────────────────────────── */
  function setSidebarOpen(open) {
    const shouldOpen = Boolean(open);
    els.appShell.classList.toggle("sidebar-visible", shouldOpen);
    document.body.classList.toggle("sidebar-open", shouldOpen);
    if (shouldOpen) setChromeVisible(true);
  }

  function isSidebarOpen() {
    return els.appShell.classList.contains("sidebar-visible");
  }

  /* ─────────────────────────────────────────────────────────────
     SETTINGS PANEL
  ───────────────────────────────────────────────────────────── */
  function setSettingsOpen(open) {
    state.settingsOpen = Boolean(open);
    if (state.settingsOpen) {
      setChromeVisible(true);
      updateStats();
    }
    if (els.settingsPanel) els.settingsPanel.hidden = !state.settingsOpen;

    const expanded = state.settingsOpen ? "true" : "false";
    const label = state.settingsOpen ? "Close settings" : "Open settings";
    setAriaExpanded(els.toggleSettingsBtn, expanded, label);
    setAriaExpanded(els.controlCenterBtn, expanded, label);
  }

  function setAriaExpanded(el, value, label) {
    if (!el) return;
    el.setAttribute("aria-expanded", value);
    el.setAttribute("aria-label", label);
    el.title = label;
  }

  /* ─────────────────────────────────────────────────────────────
     CHROME VISIBILITY (immersive mode)
  ───────────────────────────────────────────────────────────── */
  function setChromeVisible(visible) {
    const next = Boolean(visible);
    state.chromeVisible = next;
    if (els.appShell) {
      els.appShell.classList.toggle("reader-chrome-hidden", !next);
    }
    if (!next && state.settingsOpen) setSettingsOpen(false);
  }

  function handleReaderSurfaceTap(e) {
    if (!(e.target instanceof Element)) return;
    if (isBookDetailOpen()) return;
    if (
      e.target.closest(
        "a, button, input, textarea, select, label, summary, [role='button']",
      )
    )
      return;
    const selection = window.getSelection
      ? String(window.getSelection() || "").trim()
      : "";
    if (selection) return;
    setChromeVisible(!state.chromeVisible);
  }

  function syncResponsiveState() {
    state.lastContentScrollTop = Math.max(
      0,
      els.contentStage ? els.contentStage.scrollTop : 0,
    );
    /* Always show chrome on first load; mobile auto-hide kicks in only after scrolling */
    if (!isSidebarOpen() && !state.settingsOpen && !isBookDetailOpen()) {
      setChromeVisible(true);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     OFFLINE / SERVICE WORKER
  ───────────────────────────────────────────────────────────── */
  function initOfflineMode() {
    state.offlineSupported = supportsOfflineMode();
    updateOfflineUI();
    if (!state.offlineSupported) return;

    navigator.serviceWorker.addEventListener(
      "message",
      handleServiceWorkerMessage,
    );
    navigator.serviceWorker
      .register(OFFLINE_SW_URL, { updateViaCache: "none" })
      .then((reg) => {
        state.swRegistration = reg;
        reg.update().catch(() => {});
        updateOfflineUI();
      })
      .catch((err) => {
        state.offlineError = String(err && err.message ? err.message : err);
        updateOfflineUI();
      });
  }

  function supportsOfflineMode() {
    if (!("serviceWorker" in navigator)) return false;
    if (window.isSecureContext) return true;
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }

  async function startOfflineDownload() {
    if (!state.offlineSupported || state.offlineCaching) return;

    const payload = buildOfflineDownloadList();
    if (!payload.urls.length || payload.chapterCount <= 0) {
      state.offlineError = "No chapters indexed yet.";
      updateOfflineUI();
      return;
    }

    state.offlineCaching = true;
    state.offlineReady = false;
    state.offlineError = "";
    state.offlineCachedCount = 0;
    state.offlineTotalCount = payload.urls.length;
    state.offlineTargetCount = payload.chapterCount;

    showToast(`Downloading ${payload.chapterCount} episodes…`, 0);
    updateOfflineUI();

    try {
      await postMessageToSW({ type: "CACHE_URLS", urls: payload.urls });
    } catch (err) {
      state.offlineCaching = false;
      state.offlineError = String(err && err.message ? err.message : err);
      updateOfflineUI();
      hideToast();
    }
  }

  function buildOfflineDownloadList() {
    const urls = new Set(OFFLINE_SHELL_URLS);
    const targets = getOfflineTargetEntries();
    for (const entry of targets) {
      if (entry && entry.path) urls.add(toReaderPath(entry.path));
    }
    return { urls: [...urls], chapterCount: targets.length };
  }

  function getOfflineTargetEntries() {
    if (!state.entries.length) return [];
    let start = 0;
    if (state.currentId) {
      const idx = state.entries.findIndex((e) => e.id === state.currentId);
      if (idx >= 0) start = idx;
    }
    return state.entries.slice(start, start + OFFLINE_WINDOW);
  }

  async function postMessageToSW(payload) {
    if (!state.offlineSupported) throw new Error("Offline mode not supported.");
    const reg = state.swRegistration || (await navigator.serviceWorker.ready);
    state.swRegistration = reg;
    const target = reg.active || reg.waiting || reg.installing;
    if (!target)
      throw new Error("Service worker not ready. Reload and try again.");
    target.postMessage(payload);
  }

  function handleServiceWorkerMessage(e) {
    const data = e && e.data && typeof e.data === "object" ? e.data : null;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "OFFLINE_PROGRESS") {
      state.offlineCaching = true;
      state.offlineReady = false;
      state.offlineCachedCount = clamp(
        Number(data.done),
        0,
        Number.MAX_SAFE_INTEGER,
      );
      state.offlineTotalCount = clamp(
        Number(data.total),
        0,
        Number.MAX_SAFE_INTEGER,
      );
      state.offlineError = "";
      const pct =
        state.offlineTotalCount > 0
          ? Math.round(
              (state.offlineCachedCount / state.offlineTotalCount) * 100,
            )
          : 0;
      showToast(
        `Caching ${state.offlineCachedCount}/${state.offlineTotalCount} files`,
        pct,
        `${state.offlineTargetCount} episodes · ${pct}% complete`,
      );
      updateOfflineUI();
      return;
    }

    if (data.type === "OFFLINE_COMPLETE") {
      state.offlineCaching = false;
      state.offlineReady = true;
      state.offlineCachedCount = clamp(
        Number(data.cached),
        0,
        Number.MAX_SAFE_INTEGER,
      );
      state.offlineTotalCount = clamp(
        Number(data.total),
        0,
        Number.MAX_SAFE_INTEGER,
      );
      state.offlineError = "";

      /* Track which chapters are now offline */
      const targets = getOfflineTargetEntries();
      for (const entry of targets) state.offlineChapters.add(entry.id);
      saveOfflineChapters();

      showToast(
        "Download complete!",
        100,
        `${state.offlineTargetCount} episodes cached`,
      );
      window.setTimeout(hideToast, 3000);

      updateOfflineUI();
      renderChapterList(); /* re-render to show offline indicators */
      return;
    }

    if (data.type === "OFFLINE_ERROR") {
      state.offlineCaching = false;
      state.offlineReady = false;
      state.offlineError =
        asNonEmpty(data.message) || "Offline caching failed.";
      updateOfflineUI();
      hideToast();
    }
  }

  function updateOfflineUI() {
    if (!els.offlineCacheBtn || !els.offlineStatus) return;

    if (!state.offlineSupported) {
      els.offlineCacheBtn.disabled = true;
      els.offlineCacheBtn.textContent = "Offline unavailable";
      els.offlineStatus.textContent = "Needs HTTPS or localhost.";
      return;
    }

    if (state.offlineError) {
      els.offlineCacheBtn.disabled = false;
      els.offlineCacheBtn.textContent = "Retry offline download";
      els.offlineStatus.textContent = state.offlineError;
      return;
    }

    if (state.offlineCaching) {
      const done = Math.max(0, state.offlineCachedCount);
      const total = Math.max(done, state.offlineTotalCount);
      els.offlineCacheBtn.disabled = true;
      els.offlineCacheBtn.textContent = "Downloading…";
      els.offlineStatus.textContent =
        total > 0 ? `Caching ${done}/${total} files` : "Preparing…";
      return;
    }

    if (state.offlineReady) {
      els.offlineCacheBtn.disabled = false;
      els.offlineCacheBtn.textContent = "Refresh offline cache";
      els.offlineStatus.textContent =
        `${state.offlineTargetCount} episodes cached` +
        (navigator.onLine ? "" : " (offline)");
      return;
    }

    els.offlineCacheBtn.disabled = !state.entries.length;
    els.offlineCacheBtn.textContent = "Download next 100 episodes";
    els.offlineStatus.textContent = state.entries.length
      ? "Cache current + next 99 episodes for offline reading."
      : "Load chapter index first.";
  }

  /* ─────────────────────────────────────────────────────────────
     TOAST (download progress)
  ───────────────────────────────────────────────────────────── */
  function showToast(label, percent, detail) {
    if (!els.dlToast) return;
    els.dlToast.hidden = false;
    els.dlToastLabel.textContent = label || "";
    els.dlToastDetail.textContent = detail || "";
    els.dlToastBar.style.width = `${clamp(Number(percent) || 0, 0, 100)}%`;
  }

  function hideToast() {
    if (!els.dlToast) return;
    els.dlToast.hidden = true;
  }

  /* ─────────────────────────────────────────────────────────────
     MANIFEST LOADING
  ───────────────────────────────────────────────────────────── */
  async function loadManifest() {
    try {
      const res = await fetch("./manifest.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Unable to load manifest (${res.status})`);

      const payload = await res.json();
      const rawEntries = extractManifestEntries(payload);
      if (!rawEntries) {
        throw new Error("Chapter index format is invalid. Regenerate manifest.");
      }

      state.entries = normalizeEntries(rawEntries);
      if (!state.entries.length && rawEntries.length > 0) {
        throw new Error("Chapter index entries are invalid. Regenerate manifest.");
      }
      state.entriesById = new Map(state.entries.map((e) => [e.id, e]));
      state.entriesBySource = buildEntriesBySource(state.entries);

      normalizeSourceSetting();
      renderSourceFilter();
      renderChapterList();
      updateOfflineUI();
      updateStats();

      if (!state.entries.length) {
        if (els.chapterInfo)
          els.chapterInfo.textContent = "No markdown files indexed.";
        return;
      }

      const lastChapter =
        getStorageItem(LAST_CHAPTER_KEY) || getStorageItem(LEGACY_LAST_KEY);
      const defaultFirst = state.entries[0].id;
      const initial = state.entriesById.has(lastChapter)
        ? lastChapter
        : defaultFirst;

      if (initial)
        await openChapter(initial, {
          closeSidebarOnMobile: false,
          useSavedPosition: true,
        });
    } catch (err) {
      if (els.libraryMeta)
        els.libraryMeta.textContent = "Failed to load chapter index";
      if (els.chapterInfo)
        els.chapterInfo.textContent = String(err.message || err);
      renderChapterContent(
        '<p class="empty-state">Run <code>python3 reader/generate_manifest.py</code> then reload.</p>',
        { useSavedPosition: false },
      );
    }
  }

  /* ─────────────────────────────────────────────────────────────
     ENTRY NORMALIZATION
  ───────────────────────────────────────────────────────────── */
  function extractManifestEntries(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return null;
    if (Array.isArray(payload.entries)) return payload.entries;
    if (Array.isArray(payload.chapters)) return payload.chapters;
    if (Array.isArray(payload.items)) return payload.items;
    return null;
  }
  function normalizeEntries(raw) {
    if (!Array.isArray(raw)) return [];
    const result = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const id =
        asNonEmpty(entry.id) ||
        asNonEmpty(entry.path) ||
        asNonEmpty(entry.file);
      const path =
        asNonEmpty(entry.path) ||
        asNonEmpty(entry.file) ||
        asNonEmpty(entry.url) ||
        id;
      if (!id || !path) continue;

      const sourceLabel =
        asNonEmpty(entry.sourceLabel) || asNonEmpty(entry.source) || "Library";
      const group = asNonEmpty(entry.group) || asNonEmpty(entry.folder) || "";
      const title =
        asNonEmpty(entry.title) || asNonEmpty(entry.name) || titleFromPath(path);

      result.push({
        id,
        path,
        sourceLabel,
        group,
        title,
        groupLabel: `${sourceLabel} / ${group || "root"}`,
        searchText: `${title} ${path} ${group}`.toLowerCase(),
      });
    }
    return result;
  }

  function buildEntriesBySource(entries) {
    const map = new Map();
    for (const entry of entries) {
      const list = map.get(entry.sourceLabel);
      if (list) list.push(entry);
      else map.set(entry.sourceLabel, [entry]);
    }
    return map;
  }

  function titleFromPath(path) {
    const stem = path.split("/").pop() || path;
    return stem.replace(/\.md$/i, "").replace(/[_-]+/g, " ").trim() || path;
  }

  function asNonEmpty(v) {
    if (typeof v !== "string") return "";
    return v.trim();
  }

  /* ─────────────────────────────────────────────────────────────
     SOURCE FILTER
  ───────────────────────────────────────────────────────────── */
  function normalizeSourceSetting() {
    const sources = new Set(state.entries.map((e) => e.sourceLabel));
    const s = state.settings.source;
    if (s === FILTER_BOOKMARK && state.bookmarks.size === 0) {
      state.settings.source = FILTER_ALL;
      saveSettings();
      return;
    }
    if (s === FILTER_OFFLINE && state.offlineChapters.size === 0) {
      state.settings.source = FILTER_ALL;
      saveSettings();
      return;
    }
    if (
      s !== FILTER_ALL &&
      s !== FILTER_BOOKMARK &&
      s !== FILTER_OFFLINE &&
      !sources.has(s)
    ) {
      state.settings.source = FILTER_ALL;
      saveSettings();
    }
  }

  function renderSourceFilter() {
    const sources = [...new Set(state.entries.map((e) => e.sourceLabel))];
    const current = state.settings.source;
    const fragment = document.createDocumentFragment();

    /* All */
    fragment.appendChild(
      buildFilterChip(
        "All",
        FILTER_ALL,
        current === FILTER_ALL,
        bookIcon(false),
      ),
    );

    /* Per-source */
    for (const src of sources) {
      fragment.appendChild(buildFilterChip(src, src, current === src));
    }

    /* Bookmarks */
    fragment.appendChild(
      buildFilterChip(
        "Bookmarks",
        FILTER_BOOKMARK,
        current === FILTER_BOOKMARK,
        bookmarkIcon(),
      ),
    );

    /* Available Offline */
    fragment.appendChild(
      buildFilterChip(
        "Offline",
        FILTER_OFFLINE,
        current === FILTER_OFFLINE,
        offlineIcon(),
      ),
    );

    els.sourceFilter.replaceChildren(fragment);
  }

  function buildFilterChip(label, value, active, iconEl) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `filter-chip${active ? " active" : ""}`;
    btn.setAttribute("aria-pressed", active ? "true" : "false");

    if (iconEl) {
      if (typeof iconEl.setAttribute === "function") {
        iconEl.setAttribute("class", "filter-chip-icon");
      } else {
        iconEl.className = "filter-chip-icon";
      }
      btn.appendChild(iconEl);
    }

    btn.appendChild(document.createTextNode(label));

    btn.addEventListener("click", () => {
      state.settings.source = value;
      saveSettings();
      renderSourceFilter();
      renderChapterList();
      ensureCurrentChapterInSource();
    });
    return btn;
  }

  /* Small SVG factories for filter chips */
  function bookmarkIcon() {
    const svg = svgEl("0 0 24 24");
    svg.innerHTML =
      '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    return svg;
  }
  function offlineIcon() {
    const svg = svgEl("0 0 24 24");
    svg.innerHTML =
      '<path d="M12 3v13M5 14l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    return svg;
  }
  function bookIcon() {
    const svg = svgEl("0 0 24 24");
    svg.innerHTML =
      '<rect x="3" y="4" width="18" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="13" width="18" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>';
    return svg;
  }
  function svgEl(viewBox) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", viewBox);
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  /* ─────────────────────────────────────────────────────────────
     CHAPTER LIST RENDERING
  ───────────────────────────────────────────────────────────── */
  function scheduleChapterListRender() {
    if (state.searchRenderTimer) clearTimeout(state.searchRenderTimer);
    state.searchRenderTimer = window.setTimeout(() => {
      state.searchRenderTimer = null;
      renderChapterList();
    }, SEARCH_DEBOUNCE_MS);
  }

  function renderChapterList() {
    if (state.searchRenderTimer) {
      clearTimeout(state.searchRenderTimer);
      state.searchRenderTimer = null;
    }

    const query = els.searchInput.value.trim().toLowerCase();
    const filter = state.settings.source;

    /* Resolve base entries for the current source filter */
    let baseEntries;
    if (filter === FILTER_ALL) {
      baseEntries = state.entries;
    } else if (filter === FILTER_BOOKMARK) {
      baseEntries = state.entries.filter((e) => state.bookmarks.has(e.id));
    } else if (filter === FILTER_OFFLINE) {
      baseEntries = state.entries.filter((e) =>
        state.offlineChapters.has(e.id),
      );
    } else {
      baseEntries = state.entriesBySource.get(filter) || [];
    }

    const filtered = query
      ? baseEntries.filter((e) => e.searchText.includes(query))
      : baseEntries;

    state.filteredEntries = filtered;

    const fragment = document.createDocumentFragment();
    const chapterButtonById = new Map();
    state.activeChapterButtonId = null;

    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.className = "chapter-group-header";
      empty.textContent =
        filter === FILTER_BOOKMARK
          ? "No bookmarks yet — tap the bookmark button while reading."
          : filter === FILTER_OFFLINE
            ? "No chapters cached offline yet."
            : "No chapters match this search.";
      fragment.appendChild(empty);
      els.chapterList.replaceChildren(fragment);
      state.chapterButtonById = chapterButtonById;
      updateLibraryMeta();
      updateNavButtons();
      return;
    }

    let lastGroupKey = "";
    for (const entry of filtered) {
      const groupKey = entry.groupLabel;

      if (groupKey !== lastGroupKey) {
        const groupLi = document.createElement("li");
        groupLi.setAttribute("role", "presentation");
        const groupHead = document.createElement("div");
        groupHead.className = "chapter-group-header";
        groupHead.textContent = groupKey;
        groupLi.appendChild(groupHead);
        fragment.appendChild(groupLi);
        lastGroupKey = groupKey;
      }

      const rowLi = document.createElement("li");
      rowLi.className = "chapter-row";
      rowLi.setAttribute("role", "presentation");

      const btn = document.createElement("button");
      const isActive = entry.id === state.currentId;
      btn.type = "button";
      btn.className = `chapter-item${isActive ? " active" : ""}`;
      btn.dataset.chapterId = entry.id;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive) state.activeChapterButtonId = entry.id;

      /* Header row: title + badges */
      const header = document.createElement("div");
      header.className = "chapter-item-header";

      const titleDiv = document.createElement("div");
      titleDiv.className = "chapter-title";
      titleDiv.textContent = entry.title;

      const badges = document.createElement("div");
      badges.className = "chapter-badges";

      /* Bookmark dot */
      if (state.bookmarks.has(entry.id)) {
        const dot = document.createElement("span");
        dot.className = "bookmark-dot";
        dot.title = "Bookmarked";
        badges.appendChild(dot);
      }

      /* Offline dot */
      if (state.offlineChapters.has(entry.id)) {
        const dot = document.createElement("span");
        dot.className = "offline-dot";
        dot.title = "Available offline";
        badges.appendChild(dot);
      }

      /* Read status dot */
      const status = getReadStatus(entry.id);
      const statusDot = document.createElement("span");
      statusDot.className = `status-dot ${status}`;
      statusDot.title = statusLabel(status);
      badges.appendChild(statusDot);

      header.appendChild(titleDiv);
      header.appendChild(badges);

      /* Path */
      const pathDiv = document.createElement("div");
      pathDiv.className = "chapter-path";
      pathDiv.textContent = entry.path;

      /* Progress strip */
      const strip = document.createElement("div");
      strip.className = "chapter-progress-strip";
      const fill = document.createElement("div");
      fill.className = "chapter-progress-fill";
      fill.style.width = `${getProgressPercent(entry.id)}%`;
      strip.appendChild(fill);

      btn.appendChild(header);
      btn.appendChild(pathDiv);
      btn.appendChild(strip);

      rowLi.appendChild(btn);
      fragment.appendChild(rowLi);
      chapterButtonById.set(entry.id, btn);
    }

    state.chapterButtonById = chapterButtonById;
    els.chapterList.replaceChildren(fragment);
    updateLibraryMeta();
    updateNavButtons();
  }

  function getProgressPercent(chapterId) {
    const snap = state.progress[chapterId];
    if (!snap) return 0;
    /* We store scroll position; use a rough 0-100 mapping based on ratio if available */
    if (snap && typeof snap === "object" && typeof snap.ratio === "number") {
      return clamp(Math.round(snap.ratio * 100), 0, 100);
    }
    /* Can't know max scroll without rendering; return 0 or a stored percent */
    if (snap && typeof snap === "object" && typeof snap.percent === "number") {
      return clamp(Math.round(snap.percent), 0, 100);
    }
    return 0;
  }

  function getReadStatus(chapterId) {
    const pct = getProgressPercent(chapterId);
    if (pct >= 90) return "completed";
    if (pct > 2) return "in-progress";
    return "unread";
  }

  function statusLabel(status) {
    if (status === "completed") return "Completed";
    if (status === "in-progress") return "In progress";
    return "Unread";
  }

  function updateLibraryMeta() {
    const total = state.entries.length;
    const visible = state.filteredEntries.length;
    if (!total) {
      els.libraryMeta.textContent = "No chapters indexed";
      return;
    }
    if (visible === total) {
      els.libraryMeta.textContent = `${total.toLocaleString()} chapters`;
    } else {
      els.libraryMeta.textContent = `${visible.toLocaleString()} of ${total.toLocaleString()} chapters`;
    }
  }

  function ensureCurrentChapterInSource() {
    if (!state.currentId) return;
    const filter = state.settings.source;
    if (filter === FILTER_ALL) return;

    const current = state.entriesById.get(state.currentId);
    if (filter === FILTER_BOOKMARK) {
      if (state.bookmarks.has(state.currentId)) return;
    } else if (filter === FILTER_OFFLINE) {
      if (state.offlineChapters.has(state.currentId)) return;
    } else {
      if (current && current.sourceLabel === filter) return;
    }

    const firstVisible = state.filteredEntries[0];
    if (firstVisible)
      openChapter(firstVisible.id, { closeSidebarOnMobile: false });
  }

  function setActiveChapterInList(chapterId) {
    if (
      state.activeChapterButtonId &&
      state.activeChapterButtonId !== chapterId
    ) {
      const prev = state.chapterButtonById.get(state.activeChapterButtonId);
      if (prev) {
        prev.classList.remove("active");
        prev.setAttribute("aria-selected", "false");
      }
    }
    const next = state.chapterButtonById.get(chapterId);
    if (!next) {
      state.activeChapterButtonId = null;
      return;
    }
    next.classList.add("active");
    next.setAttribute("aria-selected", "true");
    state.activeChapterButtonId = chapterId;
  }

  /* ─────────────────────────────────────────────────────────────
     CHAPTER LIST INTERACTIONS
  ───────────────────────────────────────────────────────────── */
  function handleChapterListClick(e) {
    if (Date.now() < state.ignoreNextChapterClickUntil) {
      e.preventDefault();
      closeBookDetailSheet();
      return;
    }
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest("button.chapter-item[data-chapter-id]");
    if (!btn) return;
    const id = btn.dataset.chapterId;
    if (!id) return;
    openChapter(id, { closeSidebarOnMobile: true });
  }

  /* ─────────────────────────────────────────────────────────────
     OPEN CHAPTER
  ───────────────────────────────────────────────────────────── */
  async function openChapter(chapterId, options = {}) {
    if (isBookDetailOpen()) closeBookDetailSheet();

    const entry = state.entriesById.get(chapterId);
    if (!entry) return;

    const closeMobile = Boolean(options.closeSidebarOnMobile);
    const useSavedPos = options.useSavedPosition !== false;

    persistCurrentProgress();
    flushProgressSave();

    state.currentId = chapterId;
    setStorageItem(LAST_CHAPTER_KEY, chapterId);

    setActiveChapterInList(chapterId);
    scrollActiveChapterIntoView();
    setChapterMeta(entry, "Loading…");
    animateReaderTransition();
    setChapterLoading(true);
    els.content.innerHTML = '<p class="empty-state">Loading chapter…</p>';

    updateBookmarkButton(chapterId);

    if (state.activeFetchController) state.activeFetchController.abort();

    const requestId = ++state.requestSequence;
    const controller = new AbortController();
    state.activeFetchController = controller;

    try {
      const res = await fetch(toReaderPath(entry.path), {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok)
        throw new Error(`Could not open ${entry.path} (${res.status})`);

      const markdown = await res.text();
      if (!isActiveRequest(requestId, chapterId)) return;

      const html = renderMarkdownToSafeHtml(markdown, entry.path);
      renderChapterContent(html, { useSavedPosition: useSavedPos });
      setChapterMeta(entry, "");
      updateChapterMetaBadges(chapterId);

      if (closeMobile) setSidebarOpen(false);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      if (!isActiveRequest(requestId, chapterId)) return;
      const msg = String(err.message || err);
      setChapterMeta(entry, msg);
      renderChapterContent(`<p class="empty-state">${escapeHtml(msg)}</p>`, {
        useSavedPosition: false,
      });
    } finally {
      if (requestId === state.requestSequence) {
        state.activeFetchController = null;
        setChapterLoading(false);
      }
    }
  }

  function isActiveRequest(requestId, chapterId) {
    return requestId === state.requestSequence && chapterId === state.currentId;
  }

  function scrollActiveChapterIntoView() {
    requestAnimationFrame(() => {
      const active = els.chapterList.querySelector(".chapter-item.active");
      if (active)
        active.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  /* ─────────────────────────────────────────────────────────────
     CHAPTER CONTENT RENDERING
  ───────────────────────────────────────────────────────────── */
  function renderChapterContent(html, options = {}) {
    const useSavedPosition = Boolean(options.useSavedPosition);
    const output =
      html ||
      '<p class="empty-state">Pick any markdown file to start reading.</p>';

    els.content.classList.remove("reader-transition-enter");
    void els.content.offsetWidth;
    els.content.classList.add("reader-transition-enter");
    els.content.innerHTML = output;

    requestAnimationFrame(() => {
      applyProgressGlow(0);
      if (
        useSavedPosition &&
        state.currentId &&
        restoreChapterProgress(state.currentId)
      ) {
        scheduleScrollToTopButtonUpdate(els.contentStage.scrollTop);
        updateReadProgressFromScroll();
        applyProgressGlow(state.readProgress / 100);
        return;
      }
      els.contentStage.scrollTop = 0;
      if (state.currentId) {
        setChapterProgress(state.currentId, 0, 0, 0);
        scheduleProgressSave();
      }
      updateReadProgressFromScroll();
      scheduleScrollToTopButtonUpdate(0);
    });
  }

  function renderMarkdownToSafeHtml(markdown, chapterPath) {
    let rendered;
    try {
      if (window.marked && typeof window.marked.parse === "function") {
        rendered = window.marked.parse(markdown, {
          mangle: false,
          headerIds: true,
        });
      } else {
        rendered = `<pre>${escapeHtml(markdown)}</pre>`;
      }
    } catch (_) {
      rendered = `<pre>${escapeHtml(markdown)}</pre>`;
    }

    const sanitized = sanitizeHtml(rendered);
    return rewriteChapterLinks(sanitized, chapterPath);
  }

  function sanitizeHtml(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
      return window.DOMPurify.sanitize(html);
    }
    return html;
  }

  function rewriteChapterLinks(html, chapterPath) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;

    const targets = [
      { selector: "a[href]", attribute: "href" },
      { selector: "img[src]", attribute: "src" },
      { selector: "source[src]", attribute: "src" },
      { selector: "video[src]", attribute: "src" },
      { selector: "audio[src]", attribute: "src" },
    ];

    for (const { selector, attribute } of targets) {
      for (const el of tpl.content.querySelectorAll(selector)) {
        const raw = el.getAttribute(attribute);
        const resolved = resolveRelativeAssetUrl(chapterPath, raw);
        if (!resolved) continue;
        el.setAttribute(attribute, resolved.href);
        if (el.tagName === "A" && resolved.chapterId) {
          el.dataset.chapterId = resolved.chapterId;
        }
      }
    }

    return tpl.innerHTML;
  }

  function resolveRelativeAssetUrl(chapterPath, rawValue) {
    if (typeof rawValue !== "string") return null;
    const value = rawValue.trim();
    if (!value || value.startsWith("#")) return null;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null;
    if (value.startsWith("/")) return null;

    const resolved = resolveRelativePath(chapterPath, value);
    if (!resolved || !resolved.path) return null;

    const href = `${toReaderPath(resolved.path)}${resolved.suffix}`;
    const isMarkdown = /\.md$/i.test(resolved.path);
    const chapterId =
      isMarkdown && state.entriesById.has(resolved.path) ? resolved.path : null;

    return { href, chapterId };
  }

  function resolveRelativePath(baseFilePath, relativePath) {
    try {
      const parts = baseFilePath.split("/");
      parts.pop();
      const baseDir = parts.join("/");
      const baseUrl = new URL(
        `https://reader.local/${baseDir ? `${baseDir}/` : ""}`,
      );
      const resUrl = new URL(relativePath, baseUrl);
      const normPath = resUrl.pathname
        .replace(/^\/+/, "")
        .split("/")
        .map((s) => {
          try {
            return decodeURIComponent(s);
          } catch (_) {
            return s;
          }
        })
        .join("/");
      return { path: normPath, suffix: `${resUrl.search}${resUrl.hash}` };
    } catch (_) {
      return null;
    }
  }

  function handleContentLinkClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[data-chapter-id]");
    if (!anchor) return;
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = anchor.dataset.chapterId;
    if (!id) return;
    e.preventDefault();
    openChapter(id, { closeSidebarOnMobile: true });
  }

  /* ─────────────────────────────────────────────────────────────
     CHAPTER META / HEADER
  ───────────────────────────────────────────────────────────── */
  function setChapterMeta(entry, detail) {
    els.chapterTitle.textContent = entry ? entry.title : "Select a chapter";
    if (els.chapterInfo) els.chapterInfo.textContent = detail || "";
  }

  function setChapterLoading(loading) {
    state.isLoadingChapter = Boolean(loading);
    updateNavButtons();
  }

  function updateChapterMetaBadges(chapterId) {
    if (!els.chapterMetaBadges) return;
    const status = getReadStatus(chapterId);
    const isBookmarked = state.bookmarks.has(chapterId);

    els.chapterMetaBadges.innerHTML = "";

    if (isBookmarked) {
      const badge = document.createElement("span");
      badge.className = "status-badge";
      badge.style.color = "var(--bookmark-active)";
      badge.style.borderColor = "var(--bookmark-active)";
      badge.style.background =
        "color-mix(in srgb, var(--bookmark-active) 12%, transparent)";
      badge.textContent = "Bookmarked";
      els.chapterMetaBadges.appendChild(badge);
    }

    if (status !== "unread") {
      const badge = document.createElement("span");
      badge.className = `status-badge ${status}`;
      badge.textContent = statusLabel(status);
      els.chapterMetaBadges.appendChild(badge);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     NAVIGATION
  ───────────────────────────────────────────────────────────── */
  function moveToSibling(direction) {
    if (!state.currentId) return;
    const navEntries = getNavigationEntries();
    if (!navEntries.length) return;
    const idx = navEntries.findIndex((e) => e.id === state.currentId);
    if (idx < 0) return;
    const next = navEntries[idx + direction];
    if (next) openChapter(next.id, { closeSidebarOnMobile: false });
  }

  function getNavigationEntries() {
    const filter = state.settings.source;
    if (filter === FILTER_ALL) return state.entries;
    if (filter === FILTER_BOOKMARK)
      return state.entries.filter((e) => state.bookmarks.has(e.id));
    if (filter === FILTER_OFFLINE)
      return state.entries.filter((e) => state.offlineChapters.has(e.id));
    return state.entriesBySource.get(filter) || state.entries;
  }

  function updateNavButtons() {
    const disabled = !state.currentId || state.isLoadingChapter;
    if (disabled) {
      [els.prevBtn, els.nextBtn, els.navPrevBtn, els.navNextBtn].forEach(
        (b) => {
          if (b) b.disabled = true;
        },
      );
      return;
    }

    const navEntries = getNavigationEntries();
    const idx = navEntries.findIndex((e) => e.id === state.currentId);

    const prevDisabled = idx <= 0;
    const nextDisabled = idx < 0 || idx >= navEntries.length - 1;

    [els.prevBtn, els.navPrevBtn].forEach((b) => {
      if (b) b.disabled = prevDisabled;
    });
    [els.nextBtn, els.navNextBtn].forEach((b) => {
      if (b) b.disabled = nextDisabled;
    });
  }

  /* ─────────────────────────────────────────────────────────────
     BOOKMARKS
  ───────────────────────────────────────────────────────────── */
  function loadBookmarks() {
    try {
      const raw = getStorageItem(BOOKMARKS_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveBookmarks() {
    setStorageItem(BOOKMARKS_KEY, JSON.stringify([...state.bookmarks]));
  }

  function toggleBookmarkForCurrent() {
    if (!state.currentId) return;
    toggleBookmark(state.currentId);
    updateBookmarkButton(state.currentId);
    updateChapterMetaBadges(state.currentId);
    /* Update the list row if visible */
    const btn = state.chapterButtonById.get(state.currentId);
    if (btn) refreshChapterItemBadges(state.currentId, btn);
    updateStats();
  }

  function toggleBookmark(chapterId) {
    if (state.bookmarks.has(chapterId)) {
      state.bookmarks.delete(chapterId);
    } else {
      state.bookmarks.add(chapterId);
    }
    saveBookmarks();

    /* If current filter is Bookmarks, re-render the list */
    if (state.settings.source === FILTER_BOOKMARK) renderChapterList();
  }

  function updateBookmarkButton(chapterId) {
    const isBookmarked = state.bookmarks.has(chapterId);
    [els.bookmarkBtn, els.navBookmarkBtn].forEach((btn) => {
      if (!btn) return;
      btn.setAttribute("aria-pressed", isBookmarked ? "true" : "false");
      btn.title = isBookmarked ? "Remove bookmark" : "Bookmark this chapter";
      btn.setAttribute("aria-label", btn.title);
    });
  }

  function updateDetailBookmarkBtn(chapterId) {
    if (!els.detailBookmarkBtn) return;
    const isBookmarked = state.bookmarks.has(chapterId);
    els.detailBookmarkBtn.setAttribute(
      "aria-pressed",
      isBookmarked ? "true" : "false",
    );
    els.detailBookmarkBtn.textContent = isBookmarked
      ? "Remove bookmark"
      : "Bookmark";
  }

  function refreshChapterItemBadges(chapterId, btn) {
    /* Remove & re-add badge container */
    const oldBadges = btn.querySelector(".chapter-badges");
    if (oldBadges) oldBadges.remove();

    const badges = document.createElement("div");
    badges.className = "chapter-badges";

    if (state.bookmarks.has(chapterId)) {
      const d = document.createElement("span");
      d.className = "bookmark-dot";
      d.title = "Bookmarked";
      badges.appendChild(d);
    }
    if (state.offlineChapters.has(chapterId)) {
      const d = document.createElement("span");
      d.className = "offline-dot";
      d.title = "Available offline";
      badges.appendChild(d);
    }
    const status = getReadStatus(chapterId);
    const d = document.createElement("span");
    d.className = `status-dot ${status}`;
    d.title = statusLabel(status);
    badges.appendChild(d);

    const header = btn.querySelector(".chapter-item-header");
    if (header) header.appendChild(badges);
  }

  /* ─────────────────────────────────────────────────────────────
     READING STATS
  ───────────────────────────────────────────────────────────── */
  function updateStats() {
    if (!els.statCompletedNum || !els.statInProgressNum || !els.statTotalNum)
      return;

    const total = state.entries.length;
    let completed = 0;
    let inProgress = 0;

    for (const entry of state.entries) {
      const s = getReadStatus(entry.id);
      if (s === "completed") completed++;
      if (s === "in-progress") inProgress++;
    }

    els.statCompletedNum.textContent = completed.toLocaleString();
    els.statInProgressNum.textContent = inProgress.toLocaleString();
    els.statTotalNum.textContent = total.toLocaleString();
  }

  /* ─────────────────────────────────────────────────────────────
     SETTINGS: HYDRATE & APPLY
  ───────────────────────────────────────────────────────────── */
  function hydrateSettingsControls() {
    const s = sanitizeSettings(state.settings);
    state.settings = s;

    els.themeSelect.value = s.theme;
    els.fontSelect.value = s.font;
    els.fontSizeRange.value = String(s.fontSize);
    els.lineHeightRange.value = String(s.lineHeight);
    els.widthRange.value = String(s.width);
  }

  function applyVisualSettings() {
    applyTheme();
    applyTypography();
  }

  /* ─────────────────────────────────────────────────────────────
     THEMES
  ───────────────────────────────────────────────────────────── */
  function applyTheme() {
    const theme = state.settings.theme;
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", resolved);
    updateThemeColor(resolved);
    updateReaderSurface(resolved);
  }

  function resolveTheme(theme) {
    if (theme === "system") {
      return SYSTEM_THEME_QUERY.matches ? "dark" : "light";
    }
    return VALID_THEMES.has(theme) ? theme : "light";
  }

  function updateThemeColor(resolved) {
    const themeColors = {
      light: "#f4efe4",
      dark: "#19140f",
      amoled: "#000000",
      sepia: "#f5ead0",
      "burmese-art": "#1a0a2e",
      "night-blue": "#0d1b2a",
    };
    const color = themeColors[resolved] || themeColors.light;
    if (els.themeColorMeta) els.themeColorMeta.content = color;
    try {
      const existing = document.querySelector(
        'meta[name="theme-color"]:not(#themeColorMeta)',
      );
      if (existing) existing.remove();
    } catch (_) {}
  }

  function updateReaderSurface(resolved) {
    const root = document.documentElement;
    const isDark = ["dark", "amoled", "burmese-art", "night-blue"].includes(
      resolved,
    );

    /* Reset to CSS defaults first — only override inline if needed */
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-soft");
    root.style.removeProperty("--accent-a");
    root.style.removeProperty("--accent-b");
    root.style.removeProperty("--accent-c");
    root.style.removeProperty("--neon");

    if (els.ambientGlow) {
      if (isDark) {
        els.ambientGlow.style.background =
          "radial-gradient(700px 700px at 15% 15%, color-mix(in srgb, var(--accent-b) 16%, transparent), transparent 60%)";
        els.ambientGlow.style.opacity = "0.44";
      } else {
        els.ambientGlow.style.background =
          "radial-gradient(700px 700px at 15% 15%, color-mix(in srgb, var(--accent-a) 12%, transparent), transparent 62%)";
        els.ambientGlow.style.opacity = "0.52";
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     TYPOGRAPHY
  ───────────────────────────────────────────────────────────── */
  function normalizeFontSize(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return FONT_SIZE_MIN;
    const stepped = Math.round(n / FONT_SIZE_STEP) * FONT_SIZE_STEP;
    return clamp(stepped, FONT_SIZE_MIN, FONT_SIZE_MAX);
  }

  function setFontSize(value) {
    state.settings.fontSize = normalizeFontSize(value);
    applyTypography();
    saveSettings();
  }

  function applyTypography() {
    const fontSize = normalizeFontSize(state.settings.fontSize);
    const lineHeight = clamp(Number(state.settings.lineHeight), 1.35, 2.2);
    const width = clamp(Number(state.settings.width), 560, 1080);
    const fontFamily = fontMap[state.settings.font] || fontMap.serif;

    state.settings.fontSize = fontSize;

    const root = document.documentElement;
    root.style.setProperty("--reader-font-size", `${fontSize}px`);
    root.style.setProperty("--reader-line-height", `${lineHeight}`);
    root.style.setProperty("--reader-width", `${width}px`);
    root.style.setProperty("--reader-font", fontFamily);

    els.fontSizeRange.value = String(fontSize);
    els.fontSizeValue.textContent = `${fontSize}px`;
    els.lineHeightValue.textContent = lineHeight.toFixed(2);
    els.widthValue.textContent = `${width}px`;

    updateFontSizeButtons(fontSize);
  }

  function updateFontSizeButtons(fontSize) {
    if (els.decreaseFontSizeBtn)
      els.decreaseFontSizeBtn.disabled = fontSize <= FONT_SIZE_MIN;
    if (els.increaseFontSizeBtn)
      els.increaseFontSizeBtn.disabled = fontSize >= FONT_SIZE_MAX;
  }

  function normalizeTheme(value) {
    return VALID_THEMES.has(value) ? value : defaultSettings.theme;
  }

  function normalizeFont(value) {
    return Object.prototype.hasOwnProperty.call(fontMap, value)
      ? value
      : defaultSettings.font;
  }

  function sanitizeSettings(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    return {
      theme: normalizeTheme(src.theme),
      font: normalizeFont(src.font),
      fontSize: normalizeFontSize(src.fontSize),
      lineHeight: clamp(Number(src.lineHeight), 1.35, 2.2),
      width: clamp(Number(src.width), 560, 1080),
      source: asNonEmpty(src.source) || FILTER_ALL,
    };
  }

  function saveSettings() {
    state.settings = sanitizeSettings(state.settings);
    setStorageItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }

  /* ─────────────────────────────────────────────────────────────
     SCROLL / PROGRESS
  ───────────────────────────────────────────────────────────── */
  function handleReaderScroll() {
    const scrollTop = els.contentStage.scrollTop;

    if (state.currentId) {
      const maxTop = Math.max(
        0,
        els.contentStage.scrollHeight - els.contentStage.clientHeight,
      );
      const ratio = maxTop > 0 ? scrollTop / maxTop : 0;
      const pct = ratio * 100;
      setChapterProgress(state.currentId, scrollTop, ratio, pct);
      scheduleProgressSave();
      updateReadProgressFromScroll();

      /* Update progress strip in list */
      const btn = state.chapterButtonById.get(state.currentId);
      if (btn) {
        const fill = btn.querySelector(".chapter-progress-fill");
        if (fill) fill.style.width = `${clamp(Math.round(pct), 0, 100)}%`;
      }
    }

    scheduleScrollToTopButtonUpdate(Math.max(scrollTop, getWindowScrollTop()));
    handleMobileChromeAutoHide(scrollTop);
  }

  function handleWindowScroll() {
    scheduleScrollToTopButtonUpdate(
      Math.max(getWindowScrollTop(), els.contentStage.scrollTop),
    );
  }

  function handleMobileChromeAutoHide(scrollTop) {
    if (!MOBILE_QUERY.matches) {
      state.lastContentScrollTop = Math.max(0, Number(scrollTop) || 0);
      return;
    }

    const current = Math.max(0, Number(scrollTop) || 0);
    const previous = Math.max(0, Number(state.lastContentScrollTop) || 0);
    state.lastContentScrollTop = current;

    if (isSidebarOpen() || state.settingsOpen || isBookDetailOpen()) {
      if (!state.chromeVisible) setChromeVisible(true);
      return;
    }

    if (current <= 18) {
      if (!state.chromeVisible) setChromeVisible(true);
      return;
    }

    const delta = current - previous;
    if (Math.abs(delta) < 7) return;

    if (delta > 0 && state.chromeVisible) setChromeVisible(false);
    if (delta < 0 && !state.chromeVisible) setChromeVisible(true);
  }

  function updateReadProgressFromScroll() {
    if (!state.currentId) {
      applyProgressBar(0);
      return;
    }
    const max = Math.max(
      0,
      els.contentStage.scrollHeight - els.contentStage.clientHeight,
    );
    if (max === 0) {
      applyProgressBar(0);
      return;
    }
    const pct = (els.contentStage.scrollTop / max) * 100;
    applyProgressBar(pct);
  }

  function applyProgressBar(pct) {
    const value = clamp(Number(pct), 0, 100);
    state.readProgress = value;
    if (els.readProgressFill) els.readProgressFill.style.width = `${value}%`;
    applyProgressGlow(value / 100);
  }

  function applyProgressGlow(ratio) {
    if (els.ambientGlow) {
      els.ambientGlow.style.opacity = `${0.18 + clamp(ratio, 0, 1) * 0.28}`;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     PROGRESS STORAGE
  ───────────────────────────────────────────────────────────── */
  function setChapterProgress(chapterId, scroll, ratio, percent) {
    const s = Math.max(0, Number(scroll) || 0);
    const r = clamp(Number(ratio) || 0, 0, 1);
    const p = clamp(Number(percent) || 0, 0, 100);
    const existing = state.progress[chapterId];
    if (existing && typeof existing === "object") {
      existing.scroll = s;
      existing.ratio = r;
      existing.percent = p;
    } else {
      state.progress[chapterId] = { scroll: s, ratio: r, percent: p };
    }
  }

  function getChapterProgress(chapterId) {
    const raw = state.progress[chapterId];
    if (raw && typeof raw === "object") {
      return {
        scroll: Math.max(0, Number(raw.scroll) || 0),
        ratio: clamp(Number(raw.ratio) || 0, 0, 1),
        percent: clamp(Number(raw.percent) || 0, 0, 100),
      };
    }
    /* Legacy: plain number */
    const legacyScroll = Math.max(0, Number(raw) || 0);
    return { scroll: legacyScroll, ratio: 0, percent: 0 };
  }

  function restoreChapterProgress(chapterId) {
    const snap = getChapterProgress(chapterId);
    const maxTop = Math.max(
      0,
      els.contentStage.scrollHeight - els.contentStage.clientHeight,
    );
    const top = clamp(snap.scroll, 0, maxTop);
    els.contentStage.scrollTop = top;
    return top > 0;
  }

  function persistCurrentProgress() {
    if (!state.currentId) return;
    const maxTop = Math.max(
      0,
      els.contentStage.scrollHeight - els.contentStage.clientHeight,
    );
    const scroll = Math.max(0, els.contentStage.scrollTop);
    const ratio = maxTop > 0 ? scroll / maxTop : 0;
    setChapterProgress(state.currentId, scroll, ratio, ratio * 100);
    scheduleProgressSave();
  }

  function scheduleProgressSave() {
    if (state.saveTimer) return;
    state.saveTimer = window.setTimeout(() => {
      state.saveTimer = null;
      setStorageItem(PROGRESS_KEY, JSON.stringify(state.progress));
    }, 400);
  }

  function flushProgressSave() {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    setStorageItem(PROGRESS_KEY, JSON.stringify(state.progress));
  }

  function readProgress() {
    const raw = readJSONWithLegacy(PROGRESS_KEY, LEGACY_PROGRESS_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  /* ─────────────────────────────────────────────────────────────
     OFFLINE CHAPTERS STORAGE
  ───────────────────────────────────────────────────────────── */
  function loadOfflineChapters() {
    try {
      const raw = getStorageItem(OFFLINE_CHAPTERS_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveOfflineChapters() {
    setStorageItem(
      OFFLINE_CHAPTERS_KEY,
      JSON.stringify([...state.offlineChapters]),
    );
  }

  /* ─────────────────────────────────────────────────────────────
     SCROLL-TO-TOP BUTTON
  ───────────────────────────────────────────────────────────── */
  function scheduleScrollToTopButtonUpdate(scrollTop) {
    state.pendingScrollTop = Math.max(0, Number(scrollTop) || 0);
    if (state.scrollButtonRaf !== null) return;
    state.scrollButtonRaf = requestAnimationFrame(() => {
      state.scrollButtonRaf = null;
      updateScrollToTopButton(state.pendingScrollTop);
    });
  }

  function updateScrollToTopButton(scrollTop) {
    if (!els.scrollToTopBtn) return;
    const shouldShow = scrollTop > SCROLL_SHOW_THRESHOLD;
    if (shouldShow === state.scrollToTopVisible) return;
    state.scrollToTopVisible = shouldShow;
    els.scrollToTopBtn.classList.toggle("is-hidden", !shouldShow);
  }

  function scrollToTop() {
    try {
      els.contentStage.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_) {
      els.contentStage.scrollTop = 0;
    }
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_) {
      window.scrollTo(0, 0);
    }
    if (state.scrollButtonRaf !== null) {
      cancelAnimationFrame(state.scrollButtonRaf);
      state.scrollButtonRaf = null;
    }
    state.pendingScrollTop = 0;
    updateScrollToTopButton(0);
    if (MOBILE_QUERY.matches && !state.chromeVisible) setChromeVisible(true);
  }

  function getWindowScrollTop() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  /* ─────────────────────────────────────────────────────────────
     DETAIL SHEET
  ───────────────────────────────────────────────────────────── */
  function isBookDetailOpen() {
    return Boolean(
      els.bookDetailSheet && els.bookDetailSheet.dataset.open === "true",
    );
  }

  function openBookDetailSheet(chapterId) {
    const entry = state.entriesById.get(chapterId);
    if (!entry || !els.bookDetailSheet) return;

    state.detailChapterId = chapterId;
    if (els.bookDetailTitle) els.bookDetailTitle.textContent = entry.title;
    if (els.bookDetailPath) els.bookDetailPath.textContent = entry.path;
    if (els.bookDetailSource)
      els.bookDetailSource.textContent = `${entry.sourceLabel} / ${entry.group || "root"}`;
    if (els.bookDetailExcerpt)
      els.bookDetailExcerpt.textContent = makeEntryExcerpt(entry);

    updateDetailBookmarkBtn(chapterId);
    els.bookDetailSheet.setAttribute("data-open", "true");
    els.bookDetailSheet.removeAttribute("hidden");
    cancelLongPress();
  }

  function closeBookDetailSheet() {
    if (!els.bookDetailSheet) return;
    state.detailChapterId = null;
    els.bookDetailSheet.removeAttribute("data-open");
    els.bookDetailSheet.dataset.open = "false";
  }

  function makeEntryExcerpt(entry) {
    return `Open ${entry.title} to start reading. Source: ${entry.sourceLabel}. Location: ${entry.path.replace(/\.md$/i, "").replace(/[_-]+/g, " ")}.`;
  }

  function openSearchPanel() {
    setSidebarOpen(true);
    requestAnimationFrame(() => {
      if (els.searchInput) {
        try {
          els.searchInput.focus({ preventScroll: true });
        } catch (_) {
          els.searchInput.focus();
        }
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     READER GESTURES
  ───────────────────────────────────────────────────────────── */
  function bindReaderGestures() {
    bindEdgeSwipeNavigation();
    bindPullDownSearch();
  }

  function animateReaderTransition() {
    if (!els.content) return;
    els.content.classList.remove("reader-transition-enter");
    void els.content.offsetWidth;
    els.content.classList.add("reader-transition-enter");
    els.content.addEventListener(
      "animationend",
      () => {
        els.content.classList.remove("reader-transition-enter");
      },
      { once: true },
    );
  }

  function bindEdgeSwipeNavigation() {
    const container = els.contentStage || els.readerPanel;
    if (!container) return;
    const edgeZone = 32;
    const swipeThreshold = 64;
    const vertThreshold = 32;

    const resetSwipe = () => {
      state.pageSwipeState = null;
    };

    container.addEventListener("pointerdown", (e) => {
      if (
        isBookDetailOpen() ||
        (e.pointerType === "mouse" && e.button !== 0) ||
        e.button === 1
      )
        return;
      const x = e.clientX,
        y = e.clientY;
      const nearLeft = x <= edgeZone;
      const nearRight = x >= window.innerWidth - edgeZone;
      if (!nearLeft && !nearRight) return;
      state.pageSwipeState = {
        pointerId: e.pointerId,
        startX: x,
        startY: y,
        atLeftEdge: nearLeft,
        active: true,
      };
    });

    container.addEventListener("pointermove", (e) => {
      const s = state.pageSwipeState;
      if (!s || !s.active || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX,
        dy = e.clientY - s.startY;
      if (Math.abs(dy) > vertThreshold || (s.atLeftEdge ? dx < 0 : dx > 0))
        resetSwipe();
    });

    const finalize = (e) => {
      const s = state.pageSwipeState;
      if (!s || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      if (s.atLeftEdge && dx > swipeThreshold) moveToSibling(-1);
      else if (!s.atLeftEdge && dx < -swipeThreshold) moveToSibling(1);
      resetSwipe();
    };

    container.addEventListener("pointerup", finalize);
    container.addEventListener("pointercancel", resetSwipe);
    container.addEventListener("pointerleave", (e) => {
      if (
        state.pageSwipeState &&
        state.pageSwipeState.pointerId === e.pointerId
      )
        resetSwipe();
    });
  }

  function bindPullDownSearch() {
    const surface = els.readerViewport || els.contentStage;
    if (!surface) return;
    const releaseThreshold = 74,
      maxPull = 86;
    let ref = null;

    const clear = () => {
      if (!ref) return;
      surface.style.transform = "";
      ref = null;
    };

    surface.addEventListener("touchstart", (e) => {
      if (
        isBookDetailOpen() ||
        els.contentStage.scrollTop > 4 ||
        e.touches.length > 1
      )
        return;
      const touch = e.touches[0];
      ref = { id: touch.identifier, startY: touch.clientY, dragged: false };
    });

    surface.addEventListener("touchmove", (e) => {
      if (!ref) return;
      const touch = [...e.touches].find((t) => t.identifier === ref.id);
      if (!touch) return;
      const dy = touch.clientY - ref.startY;
      if (dy < 8) {
        clear();
        return;
      }
      ref.dragged = true;
      surface.style.transform = `translateY(${Math.min(dy, maxPull)}px)`;
    });

    surface.addEventListener("touchend", (e) => {
      if (!ref) return;
      const touch = [...e.changedTouches].find((t) => t.identifier === ref.id);
      if (!touch) return;
      const dy = touch.clientY - ref.startY;
      const reveal = ref.dragged && dy > releaseThreshold;
      clear();
      if (reveal) openSearchPanel();
    });

    surface.addEventListener("touchcancel", clear);
  }

  /* ─────────────────────────────────────────────────────────────
     RIPPLE EFFECT
  ───────────────────────────────────────────────────────────── */
  function bindRippleOnButtons() {
    document.addEventListener("pointerdown", (e) => {
      if (isBookDetailOpen()) return;
      const target =
        e.target instanceof Element
          ? e.target.closest(".icon-btn, .filter-chip, .chapter-item")
          : null;
      if (!target) return;
      if (e.button !== undefined && e.button > 0) return;
      createRipple(target, e);
    });
  }

  function createRipple(target, e) {
    if (!target || typeof target.closest !== "function") return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple-layer";
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), {
      once: true,
    });
  }

  /* ─────────────────────────────────────────────────────────────
     LONG-PRESS DETAIL SHEET
  ───────────────────────────────────────────────────────────── */
  function handleChapterListPointerStart(e) {
    if (
      (e.pointerType && e.pointerType !== "touch" && e.pointerType !== "pen") ||
      e.button > 0 ||
      !e.isPrimary
    )
      return;
    const btn =
      e.target instanceof Element
        ? e.target.closest("button.chapter-item[data-chapter-id]")
        : null;
    if (!btn || isBookDetailOpen()) return;
    const id = btn.dataset.chapterId;
    if (!id) return;

    state.pressState = {
      chapterId: id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      timer: setTimeout(() => {
        state.ignoreNextChapterClickUntil = Date.now() + 650;
        openBookDetailSheet(id);
      }, 520),
    };
    btn.addEventListener("pointerleave", cancelLongPress, { once: true });
  }

  function handleChapterListPointerMove(e) {
    const ps = state.pressState;
    if (!ps || ps.pointerId !== e.pointerId) return;
    if (
      Math.abs(e.clientX - ps.startX) > 8 ||
      Math.abs(e.clientY - ps.startY) > 8
    )
      cancelLongPress();
  }

  function handleChapterListPointerEnd(e) {
    if (!state.pressState || state.pressState.pointerId !== e.pointerId) return;
    cancelLongPress();
  }

  function cancelLongPress() {
    const ps = state.pressState;
    if (!ps) return;
    if (ps.timer) clearTimeout(ps.timer);
    state.pressState = null;
  }

  /* ─────────────────────────────────────────────────────────────
     PATH HELPERS
  ───────────────────────────────────────────────────────────── */
  function toReaderPath(rootRelativePath) {
    return `../${rootRelativePath
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/")}`;
  }

  /* ─────────────────────────────────────────────────────────────
     STORAGE
  ───────────────────────────────────────────────────────────── */
  function getStorageItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function setStorageItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {}
  }

  function readJSON(key, fallback) {
    try {
      const raw = getStorageItem(key);
      if (!raw) return cloneDefault(fallback);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object")
        return { ...fallback, ...parsed };
      return cloneDefault(fallback);
    } catch (_) {
      return cloneDefault(fallback);
    }
  }

  function readJSONWithLegacy(key, legacyKey, fallback) {
    const scoped = readJSON(key, fallback);
    const hasScoped = getStorageItem(key) !== null;
    if (hasScoped || !legacyKey) return scoped;

    const hasLegacy = getStorageItem(legacyKey) !== null;
    if (!hasLegacy) return scoped;

    const legacyValue = readJSON(legacyKey, fallback);
    setStorageItem(key, JSON.stringify(legacyValue));
    return legacyValue;
  }

  function cloneDefault(value) {
    if (Array.isArray(value)) return [...value];
    if (value && typeof value === "object") return { ...value };
    return value;
  }

  /* ─────────────────────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────────────────────── */
  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function addMediaQueryListener(query, listener) {
    if (typeof query.addEventListener === "function")
      query.addEventListener("change", listener);
    else if (typeof query.addListener === "function")
      query.addListener(listener);
  }
})();
