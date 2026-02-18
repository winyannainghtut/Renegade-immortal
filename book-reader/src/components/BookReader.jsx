import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HTMLFlipBook from 'react-pageflip';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FlipBookErrorBoundary from './FlipBookErrorBoundary';
import {
  extractTitle,
  fetchEpisode,
  formatEpisodeNumber,
  splitIntoPages,
} from '../utils/markdownUtils';
import {
  fetchEpisodeIndex,
  findNearestEpisode,
  getAdjacentEpisode,
  getAvailableEpisodes,
  normalizeLanguage,
} from '../utils/episodeIndex';

const MOBILE_BREAKPOINT = 768;

const LANGUAGE_COPY = {
  eng: {
    name: 'English',
    shortName: 'EN',
    languageLabel: 'Language',
    episodeLabel: 'Episode',
    loadingEpisode: 'Loading episode...',
    unavailableHint: 'Episode not available in this language. Showing nearest available episode.',
    noContent: 'No content available for this episode.',
    pageLabel: 'Page',
    clickHintDesktop: 'Click, drag, or use swipe gestures to turn pages.',
    clickHintMobile: 'Swipe or tap edges to turn pages.',
    loadErrorFallback: 'Could not load the selected episode.',
    retry: 'Retry',
  },
  burmese: {
    name: 'မြန်မာ',
    shortName: 'MM',
    languageLabel: 'ဘာသာစကား',
    episodeLabel: 'အပိုင်း',
    loadingEpisode: 'အပိုင်းကို ဖွင့်နေသည်...',
    unavailableHint: 'ရွေးထားသော အပိုင်း မရှိသဖြင့် အနီးဆုံး အပိုင်းကို ပြထားသည်။',
    noContent: 'ဤအပိုင်းတွင် ဖတ်ရန် အကြောင်းအရာမရှိပါ။',
    pageLabel: 'စာမျက်နှာ',
    clickHintDesktop: 'စာမျက်နှာပြောင်းရန် နှိပ်ပါ၊ ဆွဲပါ သို့မဟုတ် swipe လုပ်ပါ။',
    clickHintMobile: 'Swipe သို့မဟုတ် အနားဘက်ကို နှိပ်ပြီး စာမျက်နှာပြောင်းနိုင်သည်။',
    loadErrorFallback: 'ရွေးထားသော အပိုင်းကို ဖွင့်မရပါ။',
    retry: 'ထပ်စမ်း',
  },
};

function getInitialViewport() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function getBookDimensions(isMobile, viewport) {
  const horizontalPadding = isMobile ? 24 : 120;
  const verticalReserve = isMobile ? 265 : 230;
  const usableWidth = Math.max(280, viewport.width - horizontalPadding);
  const usableHeight = Math.max(360, viewport.height - verticalReserve);

  if (isMobile) {
    return {
      width: Math.min(usableWidth, 420),
      height: Math.min(usableHeight, 680),
      showCover: true,
    };
  }

  const pageWidth = Math.min((usableWidth - 24) / 2, 520);
  return {
    width: Math.max(260, pageWidth),
    height: Math.min(usableHeight, 780),
    showCover: false,
  };
}

function MarkdownPage({ language, pageNumber, content }) {
  return (
    <div className="page h-full bg-book-paper px-5 py-5 shadow-inner md:px-8 md:py-7">
      <div
        className={`page-content h-full leading-relaxed text-book-text ${
          language === 'burmese' ? 'font-burmese' : 'font-serif'
        }`}
      >
        <p className="mb-3 text-xs font-semibold tracking-wide text-book-accent/70">
          {language === 'burmese' ? `စာမျက်နှာ ${pageNumber}` : `Page ${pageNumber}`}
        </p>
        <div className="reader-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function SimpleReaderView({ language, pages, pageIndex, onPageChange }) {
  const canGoBack = pageIndex > 0;
  const canGoForward = pageIndex < pages.length - 1;

  return (
    <div className="w-full max-w-4xl">
      <div className="h-[70vh] min-h-[340px] max-h-[760px] overflow-hidden rounded-lg shadow-2xl">
        <MarkdownPage language={language} pageNumber={pageIndex + 1} content={pages[pageIndex]} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={!canGoBack}
          className="rounded bg-book-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          ← Page
        </button>
        <p className="text-sm text-book-text">
          {pageIndex + 1} / {pages.length}
        </p>
        <button
          type="button"
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={!canGoForward}
          className="rounded bg-book-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Page →
        </button>
      </div>
    </div>
  );
}

function BookReader() {
  const navigate = useNavigate();
  const { episodeNum } = useParams();
  const [searchParams] = useSearchParams();

  const [viewport, setViewport] = useState(getInitialViewport);
  const [indexState, setIndexState] = useState({
    loading: true,
    error: '',
    data: null,
  });
  const [indexReloadToken, setIndexReloadToken] = useState(0);
  const [episodeState, setEpisodeState] = useState({
    loading: true,
    error: '',
    title: '',
    content: '',
  });
  const [episodeReloadToken, setEpisodeReloadToken] = useState(0);
  const [jumpValue, setJumpValue] = useState('1');
  const [pageIndex, setPageIndex] = useState(0);
  const [manualSimpleMode, setManualSimpleMode] = useState(false);
  const [flipFailed, setFlipFailed] = useState(false);

  const flipBookRef = useRef(null);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    async function loadIndex() {
      setIndexState({
        loading: true,
        error: '',
        data: null,
      });

      try {
        const indexData = await fetchEpisodeIndex({ signal: abortController.signal });
        if (isCancelled) {
          return;
        }
        setIndexState({
          loading: false,
          error: '',
          data: indexData,
        });
      } catch (error) {
        if (isCancelled || error.name === 'AbortError') {
          return;
        }
        setIndexState({
          loading: false,
          error: error.message || 'Failed to load episode index.',
          data: null,
        });
      }
    }

    loadIndex();
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [indexReloadToken]);

  const requestedEpisode = useMemo(() => {
    const parsed = Number.parseInt(String(episodeNum || ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [episodeNum]);

  const queryLanguage = searchParams.get('lang');
  const language = normalizeLanguage(queryLanguage);
  const languageCopy = LANGUAGE_COPY[language];

  const availableEpisodes = useMemo(
    () => getAvailableEpisodes(indexState.data, language),
    [indexState.data, language],
  );
  const firstAvailableEpisode = availableEpisodes[0] ?? 1;
  const lastAvailableEpisode = availableEpisodes[availableEpisodes.length - 1] ?? 1;
  const resolvedEpisode = useMemo(
    () => findNearestEpisode(availableEpisodes, requestedEpisode ?? firstAvailableEpisode),
    [availableEpisodes, firstAvailableEpisode, requestedEpisode],
  );

  useEffect(() => {
    if (indexState.loading || availableEpisodes.length === 0 || resolvedEpisode === null) {
      return;
    }

    const shouldCanonicalize =
      requestedEpisode !== resolvedEpisode || queryLanguage !== language;

    if (shouldCanonicalize) {
      navigate(`/episode/${resolvedEpisode}?lang=${language}`, { replace: true });
    }
  }, [
    availableEpisodes.length,
    indexState.loading,
    language,
    navigate,
    queryLanguage,
    requestedEpisode,
    resolvedEpisode,
  ]);

  useEffect(() => {
    if (indexState.loading || availableEpisodes.length === 0 || resolvedEpisode === null) {
      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();

    async function loadEpisode() {
      setEpisodeState((previousState) => ({
        ...previousState,
        loading: true,
        error: '',
      }));

      try {
        const episode = await fetchEpisode(language, resolvedEpisode, { signal: abortController.signal });
        if (isCancelled) {
          return;
        }

        if (!episode) {
          setEpisodeState({
            loading: false,
            error: languageCopy.loadErrorFallback,
            title: `${languageCopy.episodeLabel} ${formatEpisodeNumber(resolvedEpisode)}`,
            content: '',
          });
          return;
        }

        const episodeTitle =
          extractTitle(episode.content) ||
          `${languageCopy.episodeLabel} ${formatEpisodeNumber(resolvedEpisode)}`;

        setEpisodeState({
          loading: false,
          error: '',
          title: episodeTitle,
          content: episode.content,
        });
        setPageIndex(0);
        setJumpValue(String(resolvedEpisode));
        setFlipFailed(false);
      } catch (error) {
        if (isCancelled || error.name === 'AbortError') {
          return;
        }
        setEpisodeState({
          loading: false,
          error: error.message || languageCopy.loadErrorFallback,
          title: `${languageCopy.episodeLabel} ${formatEpisodeNumber(resolvedEpisode)}`,
          content: '',
        });
      }
    }

    loadEpisode();
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [
    availableEpisodes.length,
    episodeReloadToken,
    indexState.loading,
    language,
    languageCopy.episodeLabel,
    languageCopy.loadErrorFallback,
    resolvedEpisode,
  ]);

  useEffect(() => {
    if (resolvedEpisode !== null) {
      setJumpValue(String(resolvedEpisode));
    }
  }, [resolvedEpisode]);

  const isMobile = viewport.width < MOBILE_BREAKPOINT;
  const maxCharsPerPage = isMobile ? 2100 : 3200;
  const pages = useMemo(
    () => splitIntoPages(episodeState.content, maxCharsPerPage),
    [episodeState.content, maxCharsPerPage],
  );

  useEffect(() => {
    setPageIndex((currentIndex) => {
      if (pages.length === 0) {
        return 0;
      }
      return Math.min(currentIndex, pages.length - 1);
    });
  }, [pages.length]);

  const simpleMode = manualSimpleMode || flipFailed || pages.length < 2;

  useEffect(() => {
    if (simpleMode || pages.length === 0) {
      return;
    }
    const pageFlipApi = flipBookRef.current?.pageFlip?.();
    if (!pageFlipApi || typeof pageFlipApi.flip !== 'function') {
      return;
    }

    try {
      pageFlipApi.flip(0);
    } catch (error) {
      console.error('Flipbook reset failed, switching to fallback mode:', error);
      setFlipFailed(true);
    }
  }, [language, pages.length, resolvedEpisode, simpleMode]);

  const dimensions = useMemo(() => getBookDimensions(isMobile, viewport), [isMobile, viewport]);

  const previousEpisode = useMemo(
    () => getAdjacentEpisode(availableEpisodes, resolvedEpisode, -1),
    [availableEpisodes, resolvedEpisode],
  );
  const nextEpisode = useMemo(
    () => getAdjacentEpisode(availableEpisodes, resolvedEpisode, 1),
    [availableEpisodes, resolvedEpisode],
  );

  const handleGoToEpisode = useCallback(
    (targetEpisode) => {
      const closestEpisode = findNearestEpisode(availableEpisodes, targetEpisode);
      if (closestEpisode !== null) {
        navigate(`/episode/${closestEpisode}?lang=${language}`);
      }
    },
    [availableEpisodes, language, navigate],
  );

  const handleLanguageChange = useCallback(
    (targetLanguage) => {
      const normalizedTargetLanguage = normalizeLanguage(targetLanguage);
      if (normalizedTargetLanguage === language) {
        return;
      }

      const targetEpisodes = getAvailableEpisodes(indexState.data, normalizedTargetLanguage);
      const fallbackEpisode = findNearestEpisode(
        targetEpisodes,
        resolvedEpisode ?? requestedEpisode ?? firstAvailableEpisode,
      );
      if (fallbackEpisode === null) {
        return;
      }

      navigate(`/episode/${fallbackEpisode}?lang=${normalizedTargetLanguage}`);
    },
    [firstAvailableEpisode, indexState.data, language, navigate, requestedEpisode, resolvedEpisode],
  );

  const handleJumpSubmit = (event) => {
    event.preventDefault();
    const parsedEpisode = Number.parseInt(jumpValue, 10);
    if (!Number.isInteger(parsedEpisode)) {
      setJumpValue(String(resolvedEpisode ?? firstAvailableEpisode));
      return;
    }
    handleGoToEpisode(parsedEpisode);
  };

  const handleFlipEvent = useCallback((event) => {
    const nextPageIndex = Number.parseInt(String(event?.data), 10);
    if (Number.isInteger(nextPageIndex) && nextPageIndex >= 0) {
      setPageIndex(nextPageIndex);
    }
  }, []);

  const handleFallbackPageChange = useCallback(
    (nextPageIndex) => {
      if (pages.length === 0) {
        return;
      }
      const boundedIndex = Math.min(Math.max(nextPageIndex, 0), pages.length - 1);
      setPageIndex(boundedIndex);
    },
    [pages.length],
  );

  const handleModeToggle = () => {
    if (simpleMode) {
      if (pages.length > 1) {
        setFlipFailed(false);
        setManualSimpleMode(false);
      }
      return;
    }
    setManualSimpleMode(true);
  };

  const modeToggleLabel = simpleMode
    ? flipFailed
      ? 'Retry flip view'
      : 'Enable flip view'
    : 'Use simple view';

  const episodeAdjusted = requestedEpisode !== null && resolvedEpisode !== null && requestedEpisode !== resolvedEpisode;

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      <div className="flex h-full flex-col">
        <header className="flex-none bg-book-dark px-4 py-3 text-amber-100 shadow-lg">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold md:text-xl">Renegade Immortal</h1>
              <p className="text-xs opacity-70 md:text-sm">
                {languageCopy.languageLabel}: {languageCopy.name} ({availableEpisodes.length} episodes)
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-amber-900/50 p-1">
              <button
                type="button"
                onClick={() => handleLanguageChange('eng')}
                className={`rounded px-3 py-1.5 text-xs transition-all md:text-sm ${
                  language === 'eng'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-200 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('burmese')}
                className={`rounded px-3 py-1.5 text-xs transition-all md:text-sm ${
                  language === 'burmese'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-200 hover:text-white'
                }`}
              >
                မြန်မာ
              </button>
            </div>
          </div>
        </header>

        <section className="flex-none border-b border-amber-200 bg-amber-100 px-4 py-2">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleGoToEpisode(firstAvailableEpisode)}
                disabled={indexState.loading || resolvedEpisode === firstAvailableEpisode}
                className="rounded bg-book-accent px-2.5 py-1 text-sm text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={() => previousEpisode !== null && handleGoToEpisode(previousEpisode)}
                disabled={indexState.loading || previousEpisode === null}
                className="rounded bg-book-accent px-3 py-1 text-sm text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                ← Prev
              </button>
              <form className="flex items-center gap-2" onSubmit={handleJumpSubmit}>
                <label className="text-sm font-medium text-book-text" htmlFor="episode-input">
                  {languageCopy.episodeLabel}
                </label>
                <input
                  id="episode-input"
                  type="number"
                  min={firstAvailableEpisode}
                  max={lastAvailableEpisode}
                  value={jumpValue}
                  onChange={(event) => setJumpValue(event.target.value)}
                  className="w-20 rounded border border-amber-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-book-accent"
                />
                <button
                  type="submit"
                  disabled={indexState.loading}
                  className="rounded border border-amber-600 px-2 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Go
                </button>
              </form>
              <button
                type="button"
                onClick={() => nextEpisode !== null && handleGoToEpisode(nextEpisode)}
                disabled={indexState.loading || nextEpisode === null}
                className="rounded bg-book-accent px-3 py-1 text-sm text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => handleGoToEpisode(lastAvailableEpisode)}
                disabled={indexState.loading || resolvedEpisode === lastAvailableEpisode}
                className="rounded bg-book-accent px-2.5 py-1 text-sm text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                ⏭
              </button>
            </div>
            <div className="max-w-full truncate text-sm text-book-text">
              {episodeState.loading ? languageCopy.loadingEpisode : episodeState.title}
            </div>
          </div>
        </section>

        {episodeAdjusted && (
          <div className="flex-none border-b border-amber-300 bg-amber-200/70 px-4 py-2 text-sm text-book-text">
            <div className="mx-auto w-full max-w-7xl">
              {languageCopy.unavailableHint} ({formatEpisodeNumber(requestedEpisode)} →{' '}
              {formatEpisodeNumber(resolvedEpisode)})
            </div>
          </div>
        )}

        <main className="min-h-0 flex-1 px-4 py-4">
          <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center">
            {indexState.loading ? (
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-book-accent border-t-transparent" />
                <p className="text-book-text">Loading episode index...</p>
              </div>
            ) : indexState.error ? (
              <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                <p className="mb-4 text-red-700">{indexState.error}</p>
                <button
                  type="button"
                  onClick={() => setIndexReloadToken((token) => token + 1)}
                  className="rounded bg-book-accent px-4 py-2 text-white transition-colors hover:bg-amber-800"
                >
                  Reload index
                </button>
              </div>
            ) : episodeState.loading ? (
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-book-accent border-t-transparent" />
                <p className="text-book-text">{languageCopy.loadingEpisode}</p>
              </div>
            ) : episodeState.error ? (
              <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                <p className="mb-4 text-red-700">{episodeState.error}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEpisodeReloadToken((token) => token + 1)}
                    className="rounded bg-book-accent px-4 py-2 text-white transition-colors hover:bg-amber-800"
                  >
                    {languageCopy.retry}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoToEpisode(firstAvailableEpisode)}
                    className="rounded border border-amber-700 px-4 py-2 text-book-text transition-colors hover:bg-amber-100"
                  >
                    {languageCopy.episodeLabel} {formatEpisodeNumber(firstAvailableEpisode)}
                  </button>
                </div>
              </div>
            ) : pages.length === 0 ? (
              <p className="text-book-text">{languageCopy.noContent}</p>
            ) : simpleMode ? (
              <SimpleReaderView
                language={language}
                pages={pages}
                pageIndex={pageIndex}
                onPageChange={handleFallbackPageChange}
              />
            ) : (
              <FlipBookErrorBoundary
                resetKey={`${language}-${resolvedEpisode}-${pages.length}`}
                onError={() => setFlipFailed(true)}
                fallback={
                  <SimpleReaderView
                    language={language}
                    pages={pages}
                    pageIndex={pageIndex}
                    onPageChange={handleFallbackPageChange}
                  />
                }
              >
                <div className="book-container">
                  <HTMLFlipBook
                    ref={flipBookRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    size="fixed"
                    minWidth={220}
                    maxWidth={620}
                    minHeight={340}
                    maxHeight={840}
                    maxShadowOpacity={0.45}
                    showCover={dimensions.showCover}
                    mobileScrollSupport
                    onFlip={handleFlipEvent}
                    className="shadow-2xl"
                    drawShadow
                    flippingTime={700}
                    usePortrait={isMobile}
                    startZIndex={0}
                    autoSize
                    clickEventForward
                    useMouseEvents
                    swipeDistance={24}
                    showPageCorners
                  >
                    {pages.map((pageContent, index) => (
                      <MarkdownPage
                        key={`${resolvedEpisode}-${index}`}
                        language={language}
                        pageNumber={index + 1}
                        content={pageContent}
                      />
                    ))}
                  </HTMLFlipBook>
                </div>
              </FlipBookErrorBoundary>
            )}
          </div>
        </main>

        <footer className="flex-none bg-book-dark px-4 py-2 text-amber-100">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              {languageCopy.pageLabel} {Math.min(pageIndex + 1, Math.max(pages.length, 1))} /{' '}
              {Math.max(pages.length, 1)}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleModeToggle}
                disabled={pages.length < 2 && simpleMode}
                className="rounded border border-amber-300/70 px-2 py-1 text-xs transition-colors hover:bg-amber-100/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pages.length < 2 && simpleMode ? 'Single page mode' : modeToggleLabel}
              </button>
              <p className="hidden opacity-75 md:block">
                {isMobile ? languageCopy.clickHintMobile : languageCopy.clickHintDesktop}
              </p>
              <p className="opacity-75 md:hidden">{languageCopy.shortName}</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default BookReader;
