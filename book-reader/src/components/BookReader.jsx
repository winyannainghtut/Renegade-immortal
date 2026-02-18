import { useState, useEffect, useRef, useCallback } from 'react';
import HTMLFlipBook from 'react-pageflip';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  fetchEpisode, 
  getNextEpisode, 
  getPrevEpisode, 
  splitIntoPages,
  formatEpisodeNumber,
  extractTitle 
} from '../utils/markdownUtils';

// Individual page component for the flip book
const Page = ({ pageNumber, children, className = '' }) => {
  return (
    <div className={`page bg-book-paper p-6 md:p-8 shadow-inner ${className}`}>
      <div className="page-content text-book-text font-serif leading-relaxed">
        <div className="text-xs text-book-accent mb-4 opacity-60">
          Page {pageNumber}
        </div>
        {children}
      </div>
    </div>
  );
};

// Burmese page with special font
const BurmesePage = ({ pageNumber, children }) => {
  return (
    <div className="page bg-book-paper p-6 md:p-8 shadow-inner">
      <div className="page-content text-book-text font-burmese leading-relaxed">
        <div className="text-xs text-book-accent mb-4 opacity-60">
          စာမျက်နှာ {pageNumber}
        </div>
        {children}
      </div>
    </div>
  );
};

const BookReader = ({ language, setLanguage }) => {
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [totalEpisodes, setTotalEpisodes] = useState(2088);
  const [isMobile, setIsMobile] = useState(false);
  
  const flipBookRef = useRef(null);

  // Check if mobile for responsive display
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load episode content
  const loadEpisode = useCallback(async (epNum) => {
    setLoading(true);
    setError(null);
    
    const episode = await fetchEpisode(language, epNum);
    
    if (episode) {
      const title = extractTitle(episode.content) || `Episode ${formatEpisodeNumber(epNum)}`;
      setEpisodeTitle(title);
      setCurrentEpisode(epNum);
      
      // Split content into pages
      const pageContents = splitIntoPages(episode.content, isMobile ? 2500 : 3500);
      setPages(pageContents);
      setPageNumber(1);
      
      // Reset flipbook to first page
      if (flipBookRef.current) {
        flipBookRef.current.pageFlip().flip(0);
      }
    } else {
      setError(`Episode ${formatEpisodeNumber(epNum)} not found in ${language === 'burmese' ? 'Burmese' : 'English'}`);
      setPages([]);
    }
    
    setLoading(false);
  }, [language, isMobile]);

  // Load initial episode
  useEffect(() => {
    loadEpisode(1);
  }, [loadEpisode]);

  // Handle language change
  useEffect(() => {
    loadEpisode(currentEpisode);
  }, [language, loadEpisode]);

  const handleNextEpisode = async () => {
    const nextEp = currentEpisode + 1;
    if (nextEp <= totalEpisodes) {
      await loadEpisode(nextEp);
    }
  };

  const handlePrevEpisode = async () => {
    const prevEp = currentEpisode - 1;
    if (prevEp >= 1) {
      await loadEpisode(prevEp);
    }
  };

  const handleEpisodeInputChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= totalEpisodes) {
      loadEpisode(value);
    }
  };

  const onFlip = (e) => {
    setPageNumber(e.data + 1);
  };

  // Calculate book dimensions based on viewport
  const getBookDimensions = () => {
    const padding = 32;
    const maxWidth = isMobile ? window.innerWidth - padding : Math.min(window.innerWidth - 100, 1200);
    const maxHeight = window.innerHeight - 200;
    
    if (isMobile) {
      // Single page on mobile
      return {
        width: Math.min(maxWidth, 400),
        height: Math.min(maxHeight, 600),
        showCover: true,
        mobileScrollSupport: true
      };
    } else {
      // Two page spread on desktop
      const pageWidth = Math.min(maxWidth / 2, 500);
      const pageHeight = Math.min(maxHeight, 700);
      return {
        width: pageWidth,
        height: pageHeight,
        showCover: false,
        mobileScrollSupport: false
      };
    }
  };

  const dims = getBookDimensions();
  const PageComponent = language === 'burmese' ? BurmesePage : Page;

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      {/* Header */}
      <header className="flex-none bg-book-dark text-amber-100 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold truncate">
            Renegade Immortal
          </h1>
          
          {/* Language Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm opacity-70">Language:</span>
            <div className="flex bg-amber-900/50 rounded-lg p-1">
              <button
                onClick={() => setLanguage('eng')}
                className={`px-3 py-1 rounded text-xs md:text-sm transition-all ${
                  language === 'eng' 
                    ? 'bg-amber-600 text-white' 
                    : 'text-amber-200 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('burmese')}
                className={`px-3 py-1 rounded text-xs md:text-sm transition-all ${
                  language === 'burmese' 
                    ? 'bg-amber-600 text-white' 
                    : 'text-amber-200 hover:text-white'
                }`}
              >
                မြန်မာ
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Episode Info Bar */}
      <div className="flex-none bg-amber-100 border-b border-amber-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevEpisode}
              disabled={currentEpisode <= 1 || loading}
              className="px-3 py-1 bg-book-accent text-white rounded text-sm disabled:opacity-50 hover:bg-amber-800 transition-colors"
            >
              ← Prev
            </button>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-book-text font-medium">
                {language === 'burmese' ? 'အပိုင်း' : 'Ep'}:
              </label>
              <input
                type="number"
                min="1"
                max={totalEpisodes}
                value={currentEpisode}
                onChange={handleEpisodeInputChange}
                className="w-16 px-2 py-1 text-sm border border-amber-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-book-accent"
              />
              <span className="text-sm text-book-text">/ {totalEpisodes}</span>
            </div>
            
            <button
              onClick={handleNextEpisode}
              disabled={currentEpisode >= totalEpisodes || loading}
              className="px-3 py-1 bg-book-accent text-white rounded text-sm disabled:opacity-50 hover:bg-amber-800 transition-colors"
            >
              Next →
            </button>
          </div>
          
          <div className="text-sm text-book-text truncate max-w-xs md:max-w-md">
            {loading ? (
              <span className="italic">Loading...</span>
            ) : (
              episodeTitle
            )}
          </div>
        </div>
      </div>

      {/* Main Book Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {loading ? (
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-book-accent border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-book-text">
              {language === 'burmese' ? 'ဖတ်ရှုနေသည်...' : 'Loading...'}
            </p>
          </div>
        ) : error ? (
          <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => loadEpisode(1)}
              className="px-4 py-2 bg-book-accent text-white rounded hover:bg-amber-800 transition-colors"
            >
              {language === 'burmese' ? 'ပထမဆုံး အပိုင်းသို့' : 'Go to First Episode'}
            </button>
          </div>
        ) : pages.length > 0 ? (
          <div className="book-container">
            <HTMLFlipBook
              ref={flipBookRef}
              width={dims.width}
              height={dims.height}
              size="fixed"
              minWidth={200}
              maxWidth={600}
              minHeight={300}
              maxHeight={800}
              maxShadowOpacity={0.5}
              showCover={dims.showCover}
              mobileScrollSupport={dims.mobileScrollSupport}
              onFlip={onFlip}
              className="shadow-2xl"
              style={{}}
              startPage={0}
              drawShadow={true}
              flippingTime={800}
              usePortrait={isMobile}
              startZIndex={0}
              autoSize={true}
              clickEventForward={true}
              useMouseEvents={true}
              swipeDistance={30}
              showPageCorners={true}
              disableFlipByClick={false}
            >
              {pages.map((pageContent, index) => (
                <PageComponent key={index} pageNumber={index + 1}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {pageContent}
                  </ReactMarkdown>
                </PageComponent>
              ))}
            </HTMLFlipBook>
          </div>
        ) : (
          <div className="text-center text-book-text">
            {language === 'burmese' 
              ? 'မည်သည့်အကြောင်းအရာမှ မရှိပါ' 
              : 'No content available'}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex-none bg-book-dark text-amber-100 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
          <div>
            {language === 'burmese' ? 'စာမျက်နှာ' : 'Page'} {pageNumber} {language === 'burmese' ? '' : 'of'} {pages.length}
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline opacity-70">
              {language === 'burmese' 
                ? 'စာမျက်နှာများကို လှန်ရန် နовал် ညာဘက်ကို နှိပ်ပါ' 
                : 'Click or swipe to turn pages'}
            </span>
            <span className="md:hidden opacity-70">
              {language === 'burmese' ? 'လှန်ရန် စာမျက်နှာကို ထိပါ' : 'Tap to flip'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookReader;
