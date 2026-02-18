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
    filteredEntries: [],
    currentId: null,
    settings: sanitizeSettings(readJSONWithLegacy(SETTINGS_KEY, LEGACY_SETTINGS_KEY, defaultSettings)),
    progress: readProgress(),
    saveTimer: null,
    requestSequence: 0,
    activeFetchController: null,
    isLoadingChapter: false,
    settingsOpen: false
  };

  const els = {
    appShell: document.getElementById("appShell"),
    sidebar: document.getElementById("sidebar"),
    closeSidebarBtn: document.getElementById("closeSidebarBtn"),
    openSidebarBtn: document.getElementById("openSidebarBtn"),
    sidebarScrim: document.getElementById("sidebarScrim"),
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
    readerPanel: document.getElementById("readerPanel")
  };

  init();

  async function init() {
    bindEvents();
    hydrateSettingsControls();
    applyVisualSettings();
    setSettingsOpen(false);
    syncResponsiveState();
    await loadManifest();
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", () => {
      renderChapterList();
    });

    els.chapterList.addEventListener("click", handleChapterListClick);
    els.prevBtn.addEventListener("click", () => moveToSibling(-1));
    els.nextBtn.addEventListener("click", () => moveToSibling(1));

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

    els.fontSizeRange.addEventListener("input", () => {
      setFontSize(els.fontSizeRange.value);
    });

    if (els.decreaseFontSizeBtn) {
      els.decreaseFontSizeBtn.addEventListener("click", () => {
        setFontSize(Number(state.settings.fontSize) - FONT_SIZE_STEP);
      });
    }

    if (els.increaseFontSizeBtn) {
      els.increaseFontSizeBtn.addEventListener("click", () => {
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

    els.toggleSettingsBtn.addEventListener("click", () => {
      setSettingsOpen(!state.settingsOpen);
    });

    document.addEventListener("keydown", handleGlobalKeydown);

    document.addEventListener("click", (event) => {
      if (!state.settingsOpen) return;
      if (els.toolbar.contains(event.target)) return;
      setSettingsOpen(false);
    });

    els.contentStage.addEventListener("scroll", handleReadProgressScroll, { passive: true });
    els.content.addEventListener("click", handleContentLinkClick);

    window.addEventListener("beforeunload", () => {
      persistCurrentProgress();
      flushProgressSave();
    });

    addMediaQueryListener(SYSTEM_THEME_QUERY, () => {
      if (state.settings.theme === "system") {
        applyTheme();
      }
    });

    addMediaQueryListener(MOBILE_QUERY, syncResponsiveState);
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") {
      if (isSidebarOpen()) {
        setSidebarOpen(false);
      }
      if (state.settingsOpen) {
        setSettingsOpen(false);
      }
      return;
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
    const shouldOpen = Boolean(open && MOBILE_QUERY.matches);
    document.body.classList.toggle("sidebar-open", shouldOpen);
  }

  function isSidebarOpen() {
    return document.body.classList.contains("sidebar-open");
  }

  function setSettingsOpen(open) {
    state.settingsOpen = Boolean(open);
    els.settingsPanel.hidden = !state.settingsOpen;
    els.toggleSettingsBtn.setAttribute("aria-expanded", state.settingsOpen ? "true" : "false");
    const settingsLabel = state.settingsOpen ? "Close settings" : "Open settings";
    els.toggleSettingsBtn.setAttribute("aria-label", settingsLabel);
    els.toggleSettingsBtn.title = settingsLabel;
  }

  function syncResponsiveState() {
    if (!MOBILE_QUERY.matches) {
      setSidebarOpen(false);
    }
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

      result.push({
        id,
        path,
        sourceLabel: asNonEmptyString(entry.sourceLabel) || "Library",
        group: asNonEmptyString(entry.group),
        title: asNonEmptyString(entry.title) || titleFromPath(path)
      });
    }

    return result;
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
    els.sourceFilter.innerHTML = "";

    const allButton = buildFilterChip("All", "all", state.settings.source === "all");
    els.sourceFilter.appendChild(allButton);

    for (const source of sources) {
      const active = state.settings.source === source;
      const button = buildFilterChip(source, source, active);
      els.sourceFilter.appendChild(button);
    }
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

  function renderChapterList() {
    const query = els.searchInput.value.trim().toLowerCase();
    const sourceFilter = state.settings.source;

    const filtered = state.entries.filter((entry) => {
      if (sourceFilter !== "all" && entry.sourceLabel !== sourceFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${entry.title} ${entry.path} ${entry.group || ""}`.toLowerCase();
      return haystack.includes(query);
    });

    state.filteredEntries = filtered;
    els.chapterList.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.className = "chapter-group";
      empty.textContent = "No chapters match this filter.";
      els.chapterList.appendChild(empty);
      updateLibraryMeta();
      updateNavButtons();
      return;
    }

    let lastGroupKey = "";
    for (const entry of filtered) {
      const groupLabel = `${entry.sourceLabel} / ${entry.group || "root"}`;

      if (groupLabel !== lastGroupKey) {
        const groupItem = document.createElement("li");
        groupItem.className = "chapter-group";
        groupItem.textContent = groupLabel;
        els.chapterList.appendChild(groupItem);
        lastGroupKey = groupLabel;
      }

      const row = document.createElement("li");

      const button = document.createElement("button");
      button.type = "button";
      button.className = `chapter-item${entry.id === state.currentId ? " active" : ""}`;
      button.dataset.chapterId = entry.id;

      const title = document.createElement("div");
      title.className = "chapter-title";
      title.textContent = entry.title;

      const path = document.createElement("div");
      path.className = "chapter-path";
      path.textContent = entry.path;

      button.appendChild(title);
      button.appendChild(path);
      row.appendChild(button);
      els.chapterList.appendChild(row);
    }

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

    const firstInSource = state.entries.find((entry) => entry.sourceLabel === state.settings.source);
    if (firstInSource) {
      openChapter(firstInSource.id, { closeSidebarOnMobile: false });
    }
  }

  function handleChapterListClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest("button.chapter-item[data-chapter-id]");
    if (!button) return;

    const chapterId = button.dataset.chapterId;
    if (!chapterId) return;

    openChapter(chapterId, { closeSidebarOnMobile: true });
  }

  async function openChapter(chapterId, options = {}) {
    const entry = state.entriesById.get(chapterId);
    if (!entry) {
      return;
    }

    const closeSidebarOnMobile = Boolean(options.closeSidebarOnMobile);

    persistCurrentProgress();
    flushProgressSave();

    state.currentId = chapterId;
    setStorageItem(LAST_CHAPTER_KEY, chapterId);

    renderChapterList();
    scrollActiveChapterIntoView();
    setChapterMeta(entry, "Loading...");
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

    els.content.innerHTML = output;

    requestAnimationFrame(() => {
      if (useSavedPosition && state.currentId && restoreChapterProgress(state.currentId)) {
        return;
      }

      els.contentStage.scrollTop = 0;
      if (state.currentId) {
        setChapterProgress(state.currentId, 0);
        scheduleProgressSave();
      }
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

    const bySource = state.entries.filter((entry) => entry.sourceLabel === state.settings.source);
    return bySource.length ? bySource : state.entries;
  }

  function updateNavButtons() {
    if (!state.currentId || state.isLoadingChapter) {
      els.prevBtn.disabled = true;
      els.nextBtn.disabled = true;
      return;
    }

    const navEntries = getNavigationEntries();
    const currentIndex = navEntries.findIndex((entry) => entry.id === state.currentId);

    els.prevBtn.disabled = currentIndex <= 0;
    els.nextBtn.disabled = currentIndex < 0 || currentIndex >= navEntries.length - 1;
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

  function setFontSize(value) {
    state.settings.fontSize = clamp(Number(value), FONT_SIZE_MIN, FONT_SIZE_MAX);
    applyTypography();
    saveSettings();
  }

  function updateFontSizeButtons(value) {
    const fontSize = clamp(Number(value), FONT_SIZE_MIN, FONT_SIZE_MAX);

    if (els.decreaseFontSizeBtn) {
      els.decreaseFontSizeBtn.disabled = fontSize <= FONT_SIZE_MIN;
    }

    if (els.increaseFontSizeBtn) {
      els.increaseFontSizeBtn.disabled = fontSize >= FONT_SIZE_MAX;
    }
  }

  function applyTypography() {
    const fontSize = clamp(Number(state.settings.fontSize), FONT_SIZE_MIN, FONT_SIZE_MAX);
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
      fontSize: clamp(Number(source.fontSize), FONT_SIZE_MIN, FONT_SIZE_MAX),
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
    if (!state.currentId) return;

    setChapterProgress(state.currentId, Math.max(0, els.contentStage.scrollTop));
    scheduleProgressSave();
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
    const snapshot = getChapterProgress(chapterId);
    snapshot.scroll = Math.max(0, Number(position) || 0);
    state.progress[chapterId] = snapshot;
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

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
