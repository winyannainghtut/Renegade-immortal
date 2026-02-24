(function () {
  "use strict";

  const repoScope = (() => {
    const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
    return firstSegment || "local";
  })();

  const SETTINGS_KEY = `novel_reader_settings_${repoScope}_v1`;
  const LAST_CHAPTER_KEY = `novel_reader_last_chapter_${repoScope}_v1`;
  const PROGRESS_KEY = `novel_reader_scroll_progress_${repoScope}_v1`;
  const LEGACY_SETTINGS_KEY = "novel_reader_settings_v1";
  const LEGACY_LAST_CHAPTER_KEY = "novel_reader_last_chapter_v1";
  const LEGACY_PROGRESS_KEY = "novel_reader_scroll_progress_v1";
  const SYSTEM_THEME_QUERY = window.matchMedia("(prefers-color-scheme: dark)");
  const MOBILE_QUERY = window.matchMedia("(max-width: 980px)");
  const FONT_SIZE_MIN = 14;
  const FONT_SIZE_MAX = 32;
  const FONT_SIZE_STEP = 1;
  const SEARCH_INPUT_DEBOUNCE_MS = 120;
  const SCROLL_VISIBILITY_THRESHOLD = 300;

  const defaultSettings = {
    theme: "system",
    font: "serif",
    fontSize: 19,
    lineHeight: 1.75,
    width: 780,
    source: "all"
  };

  const fontMap = {
    serif: "'Source Serif 4', Georgia, serif",
    friendly: "'Atkinson Hyperlegible', 'Segoe UI', sans-serif",
    classic: "'Alegreya', Georgia, serif",
    myanmarSerif: "'Noto Serif Myanmar', 'Padauk', 'Myanmar Text', 'Pyidaungsu', 'Noto Sans Myanmar', serif",
    myanmarSans: "'Noto Sans Myanmar', 'Padauk', 'Myanmar Text', 'Pyidaungsu', 'Atkinson Hyperlegible', sans-serif",
    myanmarPadauk: "'Padauk', 'Noto Sans Myanmar', 'Myanmar Text', 'Pyidaungsu', sans-serif"
  };

  const state = {
    entries: [],
    entriesById: new Map(),
    entriesBySource: new Map(),
    filteredEntries: [],
    chapterButtonById: new Map(),
    activeChapterButtonId: null,
    currentId: null,
    settings: sanitizeSettings(readJSONWithLegacy(SETTINGS_KEY, LEGACY_SETTINGS_KEY, defaultSettings)),
    progress: readProgress(),
    saveTimer: null,
    searchRenderTimer: null,
    requestSequence: 0,
    activeFetchController: null,
    isLoadingChapter: false,
    settingsOpen: false,
    scrollButtonRaf: null,
    pendingScrollTop: 0,
    scrollToTopVisible: false,
    readProgress: 0,
    pressState: null,
    ignoreNextChapterClickUntil: 0,
    detailChapterId: null,
    pageSwipeState: null,
    pullState: null,
    ambientPulse: 0
  };

  const els = {
    appShell: document.getElementById("appShell"),
    sidebar: document.getElementById("sidebar"),
    closeSidebarBtn: document.getElementById("closeSidebarBtn"),
    openSidebarBtn: document.getElementById("openSidebarBtn"),
    sidebarScrim: document.getElementById("sidebarScrim"),
    scrollToTopBtn: document.getElementById("scrollToTopBtn"),
    chapterList: document.getElementById("chapterList"),
    sourceFilter: document.getElementById("sourceFilter"),
    libraryMeta: document.getElementById("libraryMeta"),
    searchInput: document.getElementById("searchInput"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    toggleSettingsBtn: document.getElementById("toggleSettingsBtn"),
    settingsPanel: document.getElementById("settingsPanel"),
    toolbar: document.getElementById("toolbar"),
    themeSelect: document.getElementById("themeSelect"),
    fontSelect: document.getElementById("fontSelect"),
    decreaseFontSizeBtn: document.getElementById("decreaseFontSizeBtn"),
    fontSizeRange: document.getElementById("fontSizeRange"),
    increaseFontSizeBtn: document.getElementById("increaseFontSizeBtn"),
    fontSizeValue: document.getElementById("fontSizeValue"),
    lineHeightRange: document.getElementById("lineHeightRange"),
    lineHeightValue: document.getElementById("lineHeightValue"),
    widthRange: document.getElementById("widthRange"),
    widthValue: document.getElementById("widthValue"),
    chapterTitle: document.getElementById("chapterTitle"),
    chapterInfo: document.getElementById("chapterInfo"),
    content: document.getElementById("content"),
    contentStage: document.getElementById("contentStage"),
    readerPanel: document.getElementById("readerPanel"),
    ambientGlow: document.getElementById("ambientGlow"),
    readProgressFill: document.getElementById("readProgressFill"),
    navLibraryBtn: document.getElementById("navLibraryBtn"),
    navPrevBtn: document.getElementById("navPrevBtn"),
    navNextBtn: document.getElementById("navNextBtn"),
    controlCenterBtn: document.getElementById("controlCenterBtn"),
    searchHintBtn: document.getElementById("searchHintBtn"),
    readerViewport: document.getElementById("readerViewport"),
    bookDetailSheet: document.getElementById("bookDetailSheet"),
    bookDetailTitle: document.getElementById("bookDetailTitle"),
    bookDetailPath: document.getElementById("bookDetailPath"),
    bookDetailSource: document.getElementById("bookDetailSource"),
    bookDetailExcerpt: document.getElementById("bookDetailExcerpt"),
    openFromDetailBtn: document.getElementById("openFromDetailBtn"),
    goToNearestBtn: document.getElementById("goToNearestBtn"),
    closeBookDetailBtn: document.getElementById("closeBookDetailBtn")
  };

  init();

  async function init() {
    if (els.scrollToTopBtn) {
      state.scrollToTopVisible = !els.scrollToTopBtn.classList.contains("is-hidden");
    }

    bindEvents();
    hydrateSettingsControls();
    applyVisualSettings();
    setSettingsOpen(false);
    syncResponsiveState();
    applyProgressBar(0);
    await loadManifest();
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", () => {
      scheduleChapterListRender();
    });

    els.chapterList.addEventListener("click", handleChapterListClick);
    els.prevBtn.addEventListener("click", () => moveToSibling(-1));
    els.nextBtn.addEventListener("click", () => moveToSibling(1));
    if (els.navLibraryBtn) {
      els.navLibraryBtn.addEventListener("click", () => {
        setSidebarOpen(true);
      });
    }

    if (els.navPrevBtn) {
      els.navPrevBtn.addEventListener("click", () => {
        moveToSibling(-1);
      });
    }

    if (els.navNextBtn) {
      els.navNextBtn.addEventListener("click", () => {
        moveToSibling(1);
      });
    }

    if (els.controlCenterBtn) {
      els.controlCenterBtn.addEventListener("click", () => {
        setSettingsOpen(!state.settingsOpen);
      });
    }

    if (els.searchHintBtn) {
      els.searchHintBtn.addEventListener("click", () => {
        openSearchPanel();
      });
    }

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

    const handleFontSizeInput = () => {
      setFontSize(els.fontSizeRange.value);
    };

    els.fontSizeRange.addEventListener("input", handleFontSizeInput);
    els.fontSizeRange.addEventListener("change", handleFontSizeInput);

    if (els.decreaseFontSizeBtn) {
      els.decreaseFontSizeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFontSize(Number(state.settings.fontSize) - FONT_SIZE_STEP);
      });
    }

    if (els.increaseFontSizeBtn) {
      els.increaseFontSizeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFontSize(Number(state.settings.fontSize) + FONT_SIZE_STEP);
      });
    }

    els.lineHeightRange.addEventListener("input", () => {
      state.settings.lineHeight = clamp(Number(els.lineHeightRange.value), 1.35, 2.2);
      applyTypography();
      saveSettings();
    });

    els.widthRange.addEventListener("input", () => {
      state.settings.width = clamp(Number(els.widthRange.value), 560, 1080);
      applyTypography();
      saveSettings();
    });

    els.openSidebarBtn.addEventListener("click", () => {
      setSidebarOpen(true);
    });

    els.closeSidebarBtn.addEventListener("click", () => {
      setSidebarOpen(false);
    });

    els.sidebarScrim.addEventListener("click", () => {
      setSidebarOpen(false);
    });

    if (els.scrollToTopBtn) {
      els.scrollToTopBtn.addEventListener("click", () => {
        scrollToTop();
      });
    }

    if (els.openFromDetailBtn) {
      els.openFromDetailBtn.addEventListener("click", () => {
        const chapterId = state.detailChapterId;
        if (!chapterId) {
          return;
        }

        closeBookDetailSheet();
        openChapter(chapterId, { closeSidebarOnMobile: true });
      });
    }

    if (els.goToNearestBtn) {
      els.goToNearestBtn.addEventListener("click", () => {
        const chapterId = state.detailChapterId;
        if (!chapterId) {
          return;
        }

        closeBookDetailSheet();
        openChapter(chapterId, { closeSidebarOnMobile: false });
      });
    }

    if (els.closeBookDetailBtn) {
      els.closeBookDetailBtn.addEventListener("click", () => {
        closeBookDetailSheet();
      });
    }

    if (els.bookDetailSheet) {
      els.bookDetailSheet.addEventListener("click", (event) => {
        if (event.target === els.bookDetailSheet) {
          closeBookDetailSheet();
        }
      });
    }

    els.toggleSettingsBtn.addEventListener("click", () => {
      setSettingsOpen(!state.settingsOpen);
    });

    document.addEventListener("keydown", handleGlobalKeydown);

    document.addEventListener("click", (event) => {
      if (!state.settingsOpen) return;
      if (els.toolbar.contains(event.target)) return;
      setSettingsOpen(false);
    });

    if (els.settingsPanel) {
      els.settingsPanel.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });

      els.settingsPanel.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    }

    els.contentStage.addEventListener("scroll", handleReadProgressScroll, { passive: true });
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    els.content.addEventListener("click", handleContentLinkClick);

    window.addEventListener("beforeunload", () => {
      persistCurrentProgress();
      flushProgressSave();
    });

    els.chapterList.addEventListener("pointerdown", handleChapterListPointerStart);
    els.chapterList.addEventListener("pointermove", handleChapterListPointerMove);
    els.chapterList.addEventListener("pointerup", handleChapterListPointerEnd);
    els.chapterList.addEventListener("pointercancel", handleChapterListPointerEnd);
    els.chapterList.addEventListener("pointerleave", handleChapterListPointerEnd);

    addMediaQueryListener(SYSTEM_THEME_QUERY, () => {
      if (state.settings.theme === "system") {
        applyTheme();
      }
    });

    addMediaQueryListener(MOBILE_QUERY, syncResponsiveState);
    bindReaderGestures();
    bindRippleOnButtons();
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") {
      if (els.bookDetailSheet && isBookDetailOpen()) {
        closeBookDetailSheet();
        return;
      }

      if (isSidebarOpen()) {
        setSidebarOpen(false);
        return;
      }
      if (state.settingsOpen) {
        setSettingsOpen(false);
      }
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowLeft") {
      moveToSibling(-1);
    }

    if (event.key === "ArrowRight") {
      moveToSibling(1);
    }
  }

  function isTypingTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  }

  function setSidebarOpen(open) {
    const shouldOpen = Boolean(open);
    els.appShell.classList.toggle("sidebar-visible", shouldOpen);
    document.body.classList.toggle("sidebar-open", shouldOpen);
  }

  function isSidebarOpen() {
    return els.appShell.classList.contains("sidebar-visible");
  }

  function setSettingsOpen(open) {
    state.settingsOpen = Boolean(open);
    els.settingsPanel.hidden = !state.settingsOpen;
    els.toggleSettingsBtn.setAttribute("aria-expanded", state.settingsOpen ? "true" : "false");
    const settingsLabel = state.settingsOpen ? "Close settings" : "Open settings";
    els.toggleSettingsBtn.setAttribute("aria-label", settingsLabel);
    els.toggleSettingsBtn.title = settingsLabel;
    if (els.controlCenterBtn) {
      els.controlCenterBtn.setAttribute("aria-expanded", state.settingsOpen ? "true" : "false");
      els.controlCenterBtn.setAttribute("aria-label", settingsLabel);
      els.controlCenterBtn.title = settingsLabel;
    }
  }

  function syncResponsiveState() {
    // Sidebar now behaves consistently on all screen sizes
    // No automatic closing needed when resizing
  }

  async function loadManifest() {
    try {
      const response = await fetch("./manifest.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Unable to load manifest (${response.status})`);
      }

      const payload = await response.json();
      state.entries = normalizeEntries(payload.entries);
      state.entriesById = new Map(state.entries.map((entry) => [entry.id, entry]));
      state.entriesBySource = buildEntriesBySource(state.entries);

      normalizeSourceSetting();
      renderSourceFilter();
      renderChapterList();

      if (!state.entries.length) {
        els.chapterInfo.textContent = "No markdown files were indexed.";
        return;
      }

      const lastChapter = getStorageItem(LAST_CHAPTER_KEY) || getStorageItem(LEGACY_LAST_CHAPTER_KEY);
      const defaultChapter = state.entries[0].id;
      const initialChapter = state.entriesById.has(lastChapter)
        ? lastChapter
        : defaultChapter;

      if (initialChapter) {
        await openChapter(initialChapter, { closeSidebarOnMobile: false });
      }
    } catch (error) {
      els.libraryMeta.textContent = "Failed to load chapter index";
      els.chapterInfo.textContent = String(error.message || error);
      renderChapterContent('<p class="empty-state">Run <code>python3 reader/generate_manifest.py</code> then reload.</p>', {
        useSavedPosition: false
      });
    }
  }

  function normalizeEntries(rawEntries) {
    if (!Array.isArray(rawEntries)) return [];

    const result = [];
    for (const entry of rawEntries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const id = asNonEmptyString(entry.id) || asNonEmptyString(entry.path);
      const path = asNonEmptyString(entry.path) || id;

      if (!id || !path) {
        continue;
      }

      const sourceLabel = asNonEmptyString(entry.sourceLabel) || "Library";
      const group = asNonEmptyString(entry.group);
      const title = asNonEmptyString(entry.title) || titleFromPath(path);
      const palette = generateEntryPalette(title, path, sourceLabel);

      result.push({
        id,
        path,
        sourceLabel,
        group,
        title,
        palette,
        groupLabel: `${sourceLabel} / ${group || "root"}`,
        searchText: `${title} ${path} ${group}`.toLowerCase()
      });
    }

    return result;
  }

  function buildEntriesBySource(entries) {
    const map = new Map();

    for (const entry of entries) {
      const list = map.get(entry.sourceLabel);
      if (list) {
        list.push(entry);
      } else {
        map.set(entry.sourceLabel, [entry]);
      }
    }

    return map;
  }

  function titleFromPath(path) {
    const stem = path.split("/").pop() || path;
    const title = stem.replace(/\.md$/i, "").replace(/[_-]+/g, " ").trim();
    return title || path;
  }

  function asNonEmptyString(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    return trimmed;
  }

  function normalizeSourceSetting() {
    const sources = new Set(state.entries.map((entry) => entry.sourceLabel));

    if (state.settings.source !== "all" && !sources.has(state.settings.source)) {
      state.settings.source = "all";
      saveSettings();
    }
  }

  function renderSourceFilter() {
    const sources = [...new Set(state.entries.map((entry) => entry.sourceLabel))];
    const fragment = document.createDocumentFragment();

    const allButton = buildFilterChip("All", "all", state.settings.source === "all");
    fragment.appendChild(allButton);

    for (const source of sources) {
      const active = state.settings.source === source;
      const button = buildFilterChip(source, source, active);
      fragment.appendChild(button);
    }

    els.sourceFilter.replaceChildren(fragment);
  }

  function buildFilterChip(label, value, active) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${active ? " active" : ""}`;
    button.textContent = label;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.addEventListener("click", () => {
      state.settings.source = value;
      saveSettings();
      renderSourceFilter();
      renderChapterList();
      ensureCurrentChapterInSource();
    });
    return button;
  }

  function scheduleChapterListRender() {
    if (state.searchRenderTimer) {
      clearTimeout(state.searchRenderTimer);
    }

    state.searchRenderTimer = window.setTimeout(() => {
      state.searchRenderTimer = null;
      renderChapterList();
    }, SEARCH_INPUT_DEBOUNCE_MS);
  }

  function renderChapterList() {
    if (state.searchRenderTimer) {
      clearTimeout(state.searchRenderTimer);
      state.searchRenderTimer = null;
    }

    const query = els.searchInput.value.trim().toLowerCase();
    const sourceFilter = state.settings.source;
    const sourceEntries = sourceFilter === "all"
      ? state.entries
      : state.entriesBySource.get(sourceFilter) || [];

    const filtered = query
      ? sourceEntries.filter((entry) => entry.searchText.includes(query))
      : sourceEntries;

    state.filteredEntries = filtered;
    const fragment = document.createDocumentFragment();
    const chapterButtonById = new Map();
    state.activeChapterButtonId = null;

    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.className = "chapter-group";
      empty.textContent = "No chapters match this filter.";
      fragment.appendChild(empty);
      els.chapterList.replaceChildren(fragment);
      state.chapterButtonById = chapterButtonById;
      updateLibraryMeta();
      updateNavButtons();
      return;
    }

    let lastGroupKey = "";
    for (const entry of filtered) {
      const groupLabel = entry.groupLabel;

      if (groupLabel !== lastGroupKey) {
        const groupItem = document.createElement("li");
        groupItem.className = "chapter-group";
        groupItem.textContent = groupLabel;
        fragment.appendChild(groupItem);
        lastGroupKey = groupLabel;
      }

      const row = document.createElement("li");

      const button = document.createElement("button");
      const isActive = entry.id === state.currentId;
      button.type = "button";
      button.className = `chapter-item${isActive ? " active" : ""}`;
      button.dataset.chapterId = entry.id;
      button.style.setProperty("--coverA", entry.palette?.coverA || "#4a91ff");
      button.style.setProperty("--coverB", entry.palette?.coverB || "#9d61ff");
      button.style.setProperty("--coverC", entry.palette?.coverC || "#5ad1ff");
      if (isActive) {
        state.activeChapterButtonId = entry.id;
      }

      const visual = document.createElement("span");
      visual.className = "chapter-visual";
      visual.style.setProperty("--coverA", entry.palette?.coverA || "#4a91ff");
      visual.style.setProperty("--coverB", entry.palette?.coverB || "#9d61ff");
      visual.style.setProperty("--coverC", entry.palette?.coverC || "#5ad1ff");

      const title = document.createElement("div");
      title.className = "chapter-title";
      title.textContent = entry.title;

      const path = document.createElement("div");
      path.className = "chapter-path";
      path.textContent = entry.path;

      button.appendChild(visual);
      button.appendChild(title);
      button.appendChild(path);
      row.appendChild(button);
      fragment.appendChild(row);
      chapterButtonById.set(entry.id, button);
    }

    state.chapterButtonById = chapterButtonById;
    els.chapterList.replaceChildren(fragment);

    updateLibraryMeta();
    updateNavButtons();
  }

  function updateLibraryMeta() {
    const total = state.entries.length;
    const visible = state.filteredEntries.length;

    if (!total) {
      els.libraryMeta.textContent = "No chapters indexed";
      return;
    }

    if (visible === total) {
      els.libraryMeta.textContent = `${total} chapters indexed`;
      return;
    }

    els.libraryMeta.textContent = `${visible} of ${total} chapters shown`;
  }

  function ensureCurrentChapterInSource() {
    if (!state.currentId || state.settings.source === "all") {
      return;
    }

    const currentEntry = state.entriesById.get(state.currentId);
    if (currentEntry && currentEntry.sourceLabel === state.settings.source) {
      return;
    }

    const sourceEntries = state.entriesBySource.get(state.settings.source) || [];
    const firstInSource = sourceEntries[0];
    if (firstInSource) {
      openChapter(firstInSource.id, { closeSidebarOnMobile: false });
    }
  }

  function setActiveChapterInList(chapterId) {
    if (state.activeChapterButtonId && state.activeChapterButtonId !== chapterId) {
      const prevButton = state.chapterButtonById.get(state.activeChapterButtonId);
      if (prevButton) {
        prevButton.classList.remove("active");
      }
    }

    const nextButton = state.chapterButtonById.get(chapterId);
    if (!nextButton) {
      state.activeChapterButtonId = null;
      return;
    }

    nextButton.classList.add("active");
    state.activeChapterButtonId = chapterId;
  }

  function handleChapterListClick(event) {
    if (Date.now() < state.ignoreNextChapterClickUntil) {
      event.preventDefault();
      closeBookDetailSheet();
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest("button.chapter-item[data-chapter-id]");
    if (!button) return;

    const chapterId = button.dataset.chapterId;
    if (!chapterId) return;

    openChapter(chapterId, { closeSidebarOnMobile: true });
  }

  async function openChapter(chapterId, options = {}) {
    if (isBookDetailOpen()) {
      closeBookDetailSheet();
    }

    const entry = state.entriesById.get(chapterId);
    if (!entry) {
      return;
    }

    const closeSidebarOnMobile = Boolean(options.closeSidebarOnMobile);

    persistCurrentProgress();
    flushProgressSave();

    state.currentId = chapterId;
    setStorageItem(LAST_CHAPTER_KEY, chapterId);

    setActiveChapterInList(chapterId);
    scrollActiveChapterIntoView();
    setChapterMeta(entry, "Loading...");
    updateReaderSurfaceFromChapter(entry);
    animateReaderTransition();
    setChapterLoading(true);
    els.content.innerHTML = '<p class="empty-state">Loading chapter...</p>';

    if (state.activeFetchController) {
      state.activeFetchController.abort();
    }

    const requestId = ++state.requestSequence;
    const controller = new AbortController();
    state.activeFetchController = controller;

    try {
      const response = await fetch(toReaderPath(entry.path), {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Could not open ${entry.path} (${response.status})`);
      }

      const markdown = await response.text();
      if (!isActiveRequest(requestId, chapterId)) {
        return;
      }

      const html = renderMarkdownToSafeHtml(markdown, entry.path);
      renderChapterContent(html, { useSavedPosition: true });

      setChapterMeta(entry, "Chapter loaded.");

      if (closeSidebarOnMobile) {
        setSidebarOpen(false);
      }
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }

      if (!isActiveRequest(requestId, chapterId)) {
        return;
      }

      const message = String(error.message || error);
      setChapterMeta(entry, message);
      renderChapterContent(`<p class="empty-state">${escapeHtml(message)}</p>`, {
        useSavedPosition: false
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
      if (active && typeof active.scrollIntoView === "function") {
        active.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  }

  function renderChapterContent(html, options = {}) {
    const useSavedPosition = Boolean(options.useSavedPosition);
    const output = html || '<p class="empty-state">Pick any markdown file to start reading.</p>';

    els.content.classList.remove("reader-transition-enter", "reader-transition-leave");
    void els.content.offsetWidth;
    els.content.classList.add("reader-transition-enter");

    els.content.innerHTML = output;

    requestAnimationFrame(() => {
      applyProgressGlow(0);
      if (useSavedPosition && state.currentId && restoreChapterProgress(state.currentId)) {
        scheduleScrollToTopButtonUpdate(els.contentStage.scrollTop);
        updateReadProgress();
        applyProgressGlow(state.readProgress);
        return;
      }

      els.contentStage.scrollTop = 0;
      if (state.currentId) {
        setChapterProgress(state.currentId, 0);
        scheduleProgressSave();
      }

      updateReadProgress();
      scheduleScrollToTopButtonUpdate(0);
    });
  }

  function renderMarkdownToSafeHtml(markdown, chapterPath) {
    let rendered;

    try {
      if (window.marked && typeof window.marked.parse === "function") {
        rendered = window.marked.parse(markdown, {
          mangle: false,
          headerIds: true
        });
      } else {
        rendered = `<pre>${escapeHtml(markdown)}</pre>`;
      }
    } catch (_error) {
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
    const template = document.createElement("template");
    template.innerHTML = html;

    const targets = [
      { selector: "a[href]", attribute: "href" },
      { selector: "img[src]", attribute: "src" },
      { selector: "source[src]", attribute: "src" },
      { selector: "video[src]", attribute: "src" },
      { selector: "audio[src]", attribute: "src" }
    ];

    for (const target of targets) {
      const elements = template.content.querySelectorAll(target.selector);
      for (const element of elements) {
        const rawValue = element.getAttribute(target.attribute);
        const resolved = resolveRelativeAssetUrl(chapterPath, rawValue);

        if (!resolved) {
          continue;
        }

        element.setAttribute(target.attribute, resolved.href);

        if (element.tagName === "A" && resolved.chapterId) {
          element.dataset.chapterId = resolved.chapterId;
        }
      }
    }

    return template.innerHTML;
  }

  function resolveRelativeAssetUrl(chapterPath, rawValue) {
    if (typeof rawValue !== "string") {
      return null;
    }

    const value = rawValue.trim();
    if (!value || value.startsWith("#")) {
      return null;
    }

    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) {
      return null;
    }

    if (value.startsWith("/")) {
      return null;
    }

    const resolved = resolveRelativePath(chapterPath, value);
    if (!resolved || !resolved.path) {
      return null;
    }

    const href = `${toReaderPath(resolved.path)}${resolved.suffix}`;
    const isMarkdown = /\.md$/i.test(resolved.path);
    const chapterId = isMarkdown && state.entriesById.has(resolved.path)
      ? resolved.path
      : null;

    return { href, chapterId };
  }

  function resolveRelativePath(baseFilePath, relativePath) {
    try {
      const parts = baseFilePath.split("/");
      parts.pop();
      const baseDir = parts.join("/");
      const baseUrl = new URL(`https://reader.local/${baseDir ? `${baseDir}/` : ""}`);
      const resolvedUrl = new URL(relativePath, baseUrl);
      const normalizedPath = resolvedUrl.pathname
        .replace(/^\/+/, "")
        .split("/")
        .map(decodeUriComponentSafe)
        .join("/");

      return {
        path: normalizedPath,
        suffix: `${resolvedUrl.search}${resolvedUrl.hash}`
      };
    } catch (_error) {
      return null;
    }
  }

  function decodeUriComponentSafe(value) {
    try {
      return decodeURIComponent(value);
    } catch (_error) {
      return value;
    }
  }

  function handleContentLinkClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a[data-chapter-id]");
    if (!anchor) {
      return;
    }

    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const chapterId = anchor.dataset.chapterId;
    if (!chapterId) {
      return;
    }

    event.preventDefault();
    openChapter(chapterId, { closeSidebarOnMobile: true });
  }

  function setChapterMeta(entry, detail) {
    els.chapterTitle.textContent = entry ? entry.title : "Select a chapter";
    els.chapterInfo.textContent = detail;
  }

  function setChapterLoading(loading) {
    state.isLoadingChapter = Boolean(loading);
    updateNavButtons();
  }

  function moveToSibling(direction) {
    if (!state.currentId) {
      return;
    }

    const navEntries = getNavigationEntries();
    if (!navEntries.length) {
      return;
    }

    const currentIndex = navEntries.findIndex((entry) => entry.id === state.currentId);
    if (currentIndex < 0) {
      return;
    }

    const nextEntry = navEntries[currentIndex + direction];
    if (nextEntry) {
      openChapter(nextEntry.id, { closeSidebarOnMobile: false });
    }
  }

  function getNavigationEntries() {
    if (state.settings.source === "all") {
      return state.entries;
    }

    const bySource = state.entriesBySource.get(state.settings.source);
    return bySource && bySource.length ? bySource : state.entries;
  }

  function updateNavButtons() {
    if (!state.currentId || state.isLoadingChapter) {
      els.prevBtn.disabled = true;
      els.nextBtn.disabled = true;
      if (els.navPrevBtn) {
        els.navPrevBtn.disabled = true;
      }
      if (els.navNextBtn) {
        els.navNextBtn.disabled = true;
      }
      return;
    }

    const navEntries = getNavigationEntries();
    const currentIndex = navEntries.findIndex((entry) => entry.id === state.currentId);

    els.prevBtn.disabled = currentIndex <= 0;
    els.nextBtn.disabled = currentIndex < 0 || currentIndex >= navEntries.length - 1;
    if (els.navPrevBtn) {
      els.navPrevBtn.disabled = els.prevBtn.disabled;
    }
    if (els.navNextBtn) {
      els.navNextBtn.disabled = els.nextBtn.disabled;
    }
  }

  function hydrateSettingsControls() {
    const settings = sanitizeSettings(state.settings);
    state.settings = settings;

    els.themeSelect.value = settings.theme;
    els.fontSelect.value = settings.font;
    els.fontSizeRange.value = String(settings.fontSize);
    els.lineHeightRange.value = String(settings.lineHeight);
    els.widthRange.value = String(settings.width);
  }

  function applyVisualSettings() {
    applyTheme();
    applyTypography();
  }

  function applyTheme() {
    const theme = state.settings.theme;
    const resolved = theme === "system"
      ? SYSTEM_THEME_QUERY.matches ? "dark" : "light"
      : theme;

    document.documentElement.setAttribute("data-theme", resolved);
  }

  function normalizeFontSize(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return FONT_SIZE_MIN;
    }

    const steppedValue = Math.round(numericValue / FONT_SIZE_STEP) * FONT_SIZE_STEP;
    return clamp(steppedValue, FONT_SIZE_MIN, FONT_SIZE_MAX);
  }

  function setFontSize(value) {
    state.settings.fontSize = normalizeFontSize(value);
    applyTypography();
    saveSettings();
  }

  function updateFontSizeButtons(value) {
    const fontSize = normalizeFontSize(value);

    if (els.decreaseFontSizeBtn) {
      els.decreaseFontSizeBtn.disabled = fontSize <= FONT_SIZE_MIN;
    }

    if (els.increaseFontSizeBtn) {
      els.increaseFontSizeBtn.disabled = fontSize >= FONT_SIZE_MAX;
    }
  }

  function applyTypography() {
    const fontSize = normalizeFontSize(state.settings.fontSize);
    const lineHeight = clamp(Number(state.settings.lineHeight), 1.35, 2.2);
    const width = clamp(Number(state.settings.width), 560, 1080);
    const fontFamily = fontMap[state.settings.font] || fontMap.serif;

    state.settings.fontSize = fontSize;
    document.documentElement.style.setProperty("--reader-font-size", `${fontSize}px`);
    document.documentElement.style.setProperty("--reader-line-height", `${lineHeight}`);
    document.documentElement.style.setProperty("--reader-width", `${width}px`);
    document.documentElement.style.setProperty("--reader-font", fontFamily);

    els.fontSizeRange.value = String(fontSize);
    els.fontSizeValue.textContent = `${fontSize}px`;
    els.lineHeightValue.textContent = lineHeight.toFixed(2);
    els.widthValue.textContent = `${width}px`;
    updateFontSizeButtons(fontSize);
  }

  function normalizeTheme(value) {
    return value === "light" || value === "dark" || value === "system"
      ? value
      : defaultSettings.theme;
  }

  function normalizeFont(value) {
    return Object.prototype.hasOwnProperty.call(fontMap, value)
      ? value
      : defaultSettings.font;
  }

  function sanitizeSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};

    return {
      theme: normalizeTheme(source.theme),
      font: normalizeFont(source.font),
      fontSize: normalizeFontSize(source.fontSize),
      lineHeight: clamp(Number(source.lineHeight), 1.35, 2.2),
      width: clamp(Number(source.width), 560, 1080),
      source: asNonEmptyString(source.source) || "all"
    };
  }

  function saveSettings() {
    state.settings = sanitizeSettings(state.settings);
    setStorageItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }

  function handleReadProgressScroll() {
    const scrollTop = els.contentStage.scrollTop;

    if (state.currentId) {
      setChapterProgress(state.currentId, Math.max(0, scrollTop));
      scheduleProgressSave();
      updateReadProgress();
    }

    const activeScrollTop = Math.max(scrollTop, getWindowScrollTop());
    scheduleScrollToTopButtonUpdate(activeScrollTop);
  }

  function handleWindowScroll() {
    const scrollTop = Math.max(getWindowScrollTop(), els.contentStage.scrollTop);
    scheduleScrollToTopButtonUpdate(scrollTop);
  }

  function bindReaderGestures() {
    bindEdgeSwipeNavigation();
    bindPullDownSearch();
  }

  function animateReaderTransition() {
    if (!els.content) return;

    els.content.classList.remove("reader-transition-enter", "reader-transition-leave");
    els.content.classList.add("reader-transition-leave");
    window.setTimeout(() => {
      if (!els.content) return;
      els.content.classList.remove("reader-transition-leave");
      els.content.classList.add("reader-transition-enter");
      els.content.addEventListener("animationend", () => {
        els.content.classList.remove("reader-transition-enter");
      }, { once: true });
    }, 0);
  }

  function bindEdgeSwipeNavigation() {
    const container = els.contentStage || els.readerPanel;
    if (!container) return;
    const edgeZone = 30;
    const swipeThreshold = 62;
    const verticalThreshold = 30;

    const resetEdgeSwipe = () => {
      state.pageSwipeState = null;
    };

    container.addEventListener("pointerdown", (event) => {
      if (isBookDetailOpen() || event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      if (event.button === 1) return;

      const x = event.clientX;
      const y = event.clientY;
      const nearLeft = x <= edgeZone;
      const nearRight = x >= window.innerWidth - edgeZone;
      if (!nearLeft && !nearRight) {
        return;
      }

      state.pageSwipeState = {
        pointerId: event.pointerId,
        startX: x,
        startY: y,
        atLeftEdge: nearLeft,
        active: true
      };
    });

    container.addEventListener("pointermove", (event) => {
      const stateRef = state.pageSwipeState;
      if (!stateRef || !stateRef.active || stateRef.pointerId !== event.pointerId) return;

      const dx = event.clientX - stateRef.startX;
      const dy = event.clientY - stateRef.startY;
      const movedVertically = Math.abs(dy) > verticalThreshold;
      const movedAgainstEdge = stateRef.atLeftEdge ? dx < 0 : dx > 0;

      if (movedVertically || movedAgainstEdge) {
        resetEdgeSwipe();
      }
    });

    const finalizeEdgeSwipe = (event) => {
      const stateRef = state.pageSwipeState;
      if (!stateRef || stateRef.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - stateRef.startX;
      if (stateRef.atLeftEdge && dx > swipeThreshold) {
        moveToSibling(-1);
      } else if (!stateRef.atLeftEdge && dx < -swipeThreshold) {
        moveToSibling(1);
      }

      resetEdgeSwipe();
    };

    container.addEventListener("pointerup", finalizeEdgeSwipe);
    container.addEventListener("pointercancel", resetEdgeSwipe);
    container.addEventListener("pointerleave", (event) => {
      if (state.pageSwipeState && state.pageSwipeState.pointerId === event.pointerId) {
        resetEdgeSwipe();
      }
    });
  }

  function bindPullDownSearch() {
    const surface = els.readerViewport || els.contentStage;
    if (!surface) return;

    const pullReleaseThreshold = 74;
    const maxPull = 86;
    let stateRef = null;

    const clearPullState = () => {
      if (!stateRef) return;
      surface.style.transform = "";
      stateRef = null;
    };

    surface.addEventListener("touchstart", (event) => {
      if (isBookDetailOpen()) return;
      if (els.contentStage.scrollTop > 4) return;
      if (event.touches.length > 1) return;

      const touch = event.touches[0];
      stateRef = {
        pointerId: touch.identifier,
        startY: touch.clientY,
        currentY: touch.clientY,
        active: true,
        dragged: false
      };
    });

    surface.addEventListener("touchmove", (event) => {
      if (!stateRef || !stateRef.active) return;

      const touch = [...event.touches].find((current) => current.identifier === stateRef.pointerId);
      if (!touch) return;

      const deltaY = touch.clientY - stateRef.startY;
      stateRef.currentY = touch.clientY;
      if (deltaY < 8) {
        clearPullState();
        return;
      }

      stateRef.dragged = true;
      const clamped = Math.min(deltaY, maxPull);
      surface.style.transform = `translateY(${clamped}px)`;
    });

    surface.addEventListener("touchend", (event) => {
      if (!stateRef || !stateRef.active) return;
      const pointerId = stateRef.pointerId;
      const touch = [...event.changedTouches].find((current) => current.identifier === pointerId);
      if (!touch) return;

      const deltaY = touch.clientY - stateRef.startY;
      const shouldRevealSearch = stateRef.dragged && deltaY > pullReleaseThreshold;
      clearPullState();
      if (shouldRevealSearch) {
        openSearchPanel();
      }
    });

    surface.addEventListener("touchcancel", clearPullState);
    surface.addEventListener("touchleave", clearPullState);
  }

  function bindRippleOnButtons() {
    const trigger = (event) => {
      if (isBookDetailOpen()) return;
      const target = event.target instanceof Element
        ? event.target.closest(".icon-btn, .filter-chip, .chapter-item, .search-wrap")
        : null;
      if (!target) return;

      if (event.button !== undefined && event.button > 0) return;
      if (event.target.closest(".search-wrap")) {
        // Prevent unnecessary ripples for plain input focus.
        return;
      }

      createRipple(target, event);
    };

    document.addEventListener("pointerdown", trigger);
  }

  function createRipple(target, event) {
    if (!target || typeof target.closest !== "function") return;

    const rect = target.getBoundingClientRect();
    const radiusX = Math.max(0, event.clientX - rect.left);
    const radiusY = Math.max(0, event.clientY - rect.top);
    const ripple = document.createElement("span");
    ripple.className = "ripple-layer";
    ripple.style.left = `${radiusX}px`;
    ripple.style.top = `${radiusY}px`;
    target.style.position = target.style.position || "relative";
    target.style.overflow = "hidden";
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => {
      ripple.remove();
    }, { once: true });
  }

  function handleChapterListPointerStart(event) {
    if (event.pointerType && event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (event.button > 0) return;
    if (!event.isPrimary) return;

    const button = event.target instanceof Element
      ? event.target.closest("button.chapter-item[data-chapter-id]")
      : null;

    if (!button) return;
    if (isBookDetailOpen()) return;

    const chapterId = button.dataset.chapterId;
    if (!chapterId) return;

    state.pressState = {
      chapterId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      timer: setTimeout(() => {
        state.ignoreNextChapterClickUntil = Date.now() + 650;
        openBookDetailSheet(chapterId);
      }, 520)
    };

    const cancelPress = () => {
      cancelLongPress();
    };

    button.addEventListener("pointerleave", cancelPress, { once: true });
  }

  function handleChapterListPointerMove(event) {
    const pressState = state.pressState;
    if (!pressState || pressState.pointerId !== event.pointerId) return;

    const deltaX = Math.abs(event.clientX - pressState.startX);
    const deltaY = Math.abs(event.clientY - pressState.startY);

    if (deltaX > 8 || deltaY > 8) {
      cancelLongPress();
    }
  }

  function handleChapterListPointerEnd(event) {
    if (!state.pressState || state.pressState.pointerId !== event.pointerId) {
      return;
    }

    cancelLongPress();
  }

  function cancelLongPress() {
    const pressState = state.pressState;
    if (!pressState) return;

    if (pressState.timer) {
      clearTimeout(pressState.timer);
    }
    state.pressState = null;
  }

  function isBookDetailOpen() {
    return Boolean(els.bookDetailSheet && els.bookDetailSheet.dataset.open === "true");
  }

  function openBookDetailSheet(chapterId) {
    const entry = state.entriesById.get(chapterId);
    if (!entry) {
      return;
    }
    if (!els.bookDetailSheet || !els.bookDetailTitle || !els.bookDetailPath || !els.bookDetailSource) {
      return;
    }

    const palette = entry.palette || generateEntryPalette(entry.title, entry.path, entry.sourceLabel);
    state.detailChapterId = chapterId;
    els.bookDetailTitle.textContent = entry.title;
    els.bookDetailPath.textContent = entry.path;
    els.bookDetailSource.textContent = `${entry.sourceLabel} / ${entry.group || "root"}`;
    els.bookDetailExcerpt.textContent = makeEntryExcerpt(entry);
    els.bookDetailSheet.dataset.open = "true";
    if (els.bookDetailSheet instanceof HTMLElement) {
      els.bookDetailSheet.setAttribute("data-open", "true");
    }
    if (els.bookDetailSheet instanceof HTMLElement) {
      els.bookDetailSheet.style.display = "grid";
    }
    if (els.bookDetailTitle) {
      els.bookDetailTitle.style.color = palette.accent;
    }
    cancelLongPress();
  }

  function closeBookDetailSheet() {
    if (!els.bookDetailSheet) return;
    state.detailChapterId = null;
    els.bookDetailSheet.dataset.open = "false";
    els.bookDetailSheet.removeAttribute("data-open");
  }

  function openSearchPanel() {
    setSidebarOpen(true);
    window.requestAnimationFrame(() => {
      if (els.searchInput) {
        try {
          els.searchInput.focus({ preventScroll: true });
        } catch (_error) {
          els.searchInput.focus();
        }
      }
    });
  }

  function makeEntryExcerpt(entry) {
    const fallback = `Open ${entry.title} to read this chapter.`;
    const pathSeed = asNonEmptyString(entry.path).replace(/\.md$/i, "").replace(/[_-]+/g, " ");
    return `${fallback} Source: ${entry.sourceLabel || "Library"}. Location: ${pathSeed}.`;
  }

  function applyProgressBar(progressPercent) {
    if (!els.readProgressFill) return;
    const value = clamp(Number(progressPercent), 0, 100);
    state.readProgress = value;
    els.readProgressFill.style.width = `${value}%`;
    applyProgressGlow(value / 100);
  }

  function updateReadProgress() {
    if (!state.currentId) {
      applyProgressBar(0);
      return;
    }

    const maxScrollTop = Math.max(0, els.contentStage.scrollHeight - els.contentStage.clientHeight);
    if (maxScrollTop === 0) {
      applyProgressBar(0);
      return;
    }

    const percent = (els.contentStage.scrollTop / maxScrollTop) * 100;
    applyProgressBar(percent);
  }

  function applyProgressGlow(progress01) {
    const glowRatio = clamp(Number(progress01), 0, 1);
    if (els.ambientGlow) {
      els.ambientGlow.style.opacity = `${0.16 + glowRatio * 0.32}`;
    }
  }

  function updateReaderSurfaceFromChapter(entry) {
    const palette = entry ? (entry.palette || generateEntryPalette(entry.title, entry.path, entry.sourceLabel)) : null;
    if (!palette) return;

    const root = document.documentElement;
    root.style.setProperty("--accent", palette.accent);
    root.style.setProperty("--accent-soft", `color-mix(in srgb, ${palette.accent} 24%, transparent)`);
    root.style.setProperty("--accent-a", palette.accent);
    root.style.setProperty("--accent-b", palette.secondary);
    root.style.setProperty("--accent-c", palette.tertiary);
    root.style.setProperty("--neon", palette.neon);
    root.style.setProperty("--reader-bg-top", "1px");
    root.style.setProperty("--reader-bg-bottom", "1px");
    if (els.ambientGlow) {
      els.ambientGlow.style.background = `radial-gradient(700px 700px at 15% 15%, ${palette.accentSoft}, transparent 55%), radial-gradient(500px 500px at 90% 8%, color-mix(in srgb, ${palette.secondary} 30%, transparent), transparent 52%)`;
      els.ambientGlow.style.opacity = "0.86";
    }
  }

  function generateEntryPalette(...entryValues) {
    const seed = entryValues
      .filter(Boolean)
      .join("|")
      .toLowerCase();
    const hash = hashString(seed);
    const hue = mod(hash, 360);
    const accent = `hsl(${hue} 84% 58%)`;
    const secondary = `hsl(${mod(hue + 28, 360)} 80% 56%)`;
    const tertiary = `hsl(${mod(hue + 82, 360)} 78% 60%)`;
    const neon = `hsl(${mod(hue + 10, 360)} 92% 65%)`;
    const accentSoft = `color-mix(in srgb, ${accent} 26%, transparent)`;
    const coverA = `hsl(${mod(hue - 6, 360)} 70% 66%)`;
    const coverB = `hsl(${mod(hue + 40, 360)} 74% 58%)`;
    const coverC = `hsl(${mod(hue + 78, 360)} 82% 58%)`;

    return { accent, secondary, tertiary, neon, accentSoft, coverA, coverB, coverC };
  }

  function getWindowScrollTop() {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function scheduleScrollToTopButtonUpdate(scrollTop) {
    state.pendingScrollTop = Math.max(0, Number(scrollTop) || 0);

    if (state.scrollButtonRaf !== null) {
      return;
    }

    state.scrollButtonRaf = requestAnimationFrame(() => {
      state.scrollButtonRaf = null;
      updateScrollToTopButton(state.pendingScrollTop);
    });
  }

  function updateScrollToTopButton(scrollTop) {
    if (!els.scrollToTopBtn) return;

    const shouldShow = scrollTop > SCROLL_VISIBILITY_THRESHOLD;
    if (shouldShow === state.scrollToTopVisible) {
      return;
    }

    state.scrollToTopVisible = shouldShow;
    els.scrollToTopBtn.classList.toggle("is-hidden", !shouldShow);
  }

  function scrollToTop() {
    // Scroll both possible containers; fallback to instant scroll if smooth options throw.
    try {
      els.contentStage.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch (_error) {
      els.contentStage.scrollTop = 0;
    }

    try {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch (_error) {
      window.scrollTo(0, 0);
    }

    if (state.scrollButtonRaf !== null) {
      cancelAnimationFrame(state.scrollButtonRaf);
      state.scrollButtonRaf = null;
    }
    state.pendingScrollTop = 0;
    updateScrollToTopButton(0);
  }

  function scheduleProgressSave() {
    if (state.saveTimer) {
      return;
    }

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

  function persistCurrentProgress() {
    if (!state.currentId) {
      return;
    }

    setChapterProgress(state.currentId, Math.max(0, els.contentStage.scrollTop));
    scheduleProgressSave();
  }

  function setChapterProgress(chapterId, position) {
    const scroll = Math.max(0, Number(position) || 0);
    const snapshot = state.progress[chapterId];

    if (snapshot && typeof snapshot === "object") {
      snapshot.scroll = scroll;
      return;
    }

    state.progress[chapterId] = { scroll };
  }

  function getChapterProgress(chapterId) {
    const raw = state.progress[chapterId];

    if (raw && typeof raw === "object") {
      return {
        scroll: Math.max(0, Number(raw.scroll) || 0)
      };
    }

    const legacyScroll = Math.max(0, Number(raw) || 0);
    return {
      scroll: Number.isFinite(legacyScroll) ? legacyScroll : 0
    };
  }

  function restoreChapterProgress(chapterId) {
    const snapshot = getChapterProgress(chapterId);
    const maxTop = Math.max(0, els.contentStage.scrollHeight - els.contentStage.clientHeight);
    const top = clamp(snapshot.scroll, 0, maxTop);

    els.contentStage.scrollTop = top;
    return top > 0;
  }

  function readProgress() {
    const value = readJSONWithLegacy(PROGRESS_KEY, LEGACY_PROGRESS_KEY, {});
    return value && typeof value === "object" ? value : {};
  }

  function toReaderPath(rootRelativePath) {
    const safePath = rootRelativePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    return `../${safePath}`;
  }

  function addMediaQueryListener(query, listener) {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", listener);
    } else if (typeof query.addListener === "function") {
      query.addListener(listener);
    }
  }

  function getStorageItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function setStorageItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_error) {
      // Ignore write errors (private mode/quota).
    }
  }

  function readJSON(key, fallback) {
    try {
      const raw = getStorageItem(key);
      if (!raw) return cloneDefault(fallback);

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...fallback, ...parsed };
      }

      return cloneDefault(fallback);
    } catch (_error) {
      return cloneDefault(fallback);
    }
  }

  function readJSONWithLegacy(key, legacyKey, fallback) {
    const scopedValue = readJSON(key, fallback);
    const hasScoped = getStorageItem(key) !== null;

    if (hasScoped || !legacyKey) {
      return scopedValue;
    }

    const hasLegacy = getStorageItem(legacyKey) !== null;
    if (!hasLegacy) {
      return scopedValue;
    }

    const legacyValue = readJSON(legacyKey, fallback);
    setStorageItem(key, JSON.stringify(legacyValue));
    return legacyValue;
  }

  function cloneDefault(value) {
    if (Array.isArray(value)) return [...value];
    if (value && typeof value === "object") return { ...value };
    return value;
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  function hashString(value) {
    const source = String(value || "");
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = (hash << 5) - hash + source.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function mod(value, divisor) {
    const normalized = ((value % divisor) + divisor) % divisor;
    return normalized;
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
