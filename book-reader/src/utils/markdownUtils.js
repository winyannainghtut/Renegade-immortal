/**
 * Utility functions for fetching and managing markdown files.
 */

// Episode ranges for folder structure.
export const EPISODE_RANGES = [
  { start: 1, end: 100, folder: '0001-0100' },
  { start: 101, end: 200, folder: '0101-0200' },
  { start: 201, end: 300, folder: '0201-0300' },
  { start: 301, end: 400, folder: '0301-0400' },
  { start: 401, end: 500, folder: '0401-0500' },
  { start: 501, end: 600, folder: '0501-0600' },
  { start: 601, end: 700, folder: '0601-0700' },
  { start: 701, end: 800, folder: '0701-0800' },
  { start: 801, end: 900, folder: '0801-0900' },
  { start: 901, end: 1000, folder: '0901-1000' },
  { start: 1001, end: 1100, folder: '1001-1100' },
  { start: 1101, end: 1200, folder: '1101-1200' },
  { start: 1201, end: 1300, folder: '1201-1300' },
  { start: 1301, end: 1400, folder: '1301-1400' },
  { start: 1401, end: 1500, folder: '1401-1500' },
  { start: 1501, end: 1600, folder: '1501-1600' },
  { start: 1601, end: 1700, folder: '1601-1700' },
  { start: 1701, end: 1800, folder: '1701-1800' },
  { start: 1801, end: 1900, folder: '1801-1900' },
  { start: 1901, end: 2000, folder: '1901-2000' },
  { start: 2001, end: 2100, folder: '2001-2088' },
];

function getBaseUrl() {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export function buildPublicAssetPath(relativePath) {
  const normalizedPath = relativePath.replace(/^\/+/, '');
  return `${getBaseUrl()}${normalizedPath}`;
}

/**
 * Format episode number with leading zeros (4 digits).
 */
export function formatEpisodeNumber(num) {
  return String(num).padStart(4, '0');
}

/**
 * Get the folder name for a given episode number.
 */
export function getFolderForEpisode(episodeNum) {
  const range = EPISODE_RANGES.find((entry) => episodeNum >= entry.start && episodeNum <= entry.end);
  return range ? range.folder : null;
}

function getLanguageFolder(language) {
  return language === 'burmese' ? 'burmese-episodes' : 'eng-episodes';
}

/**
 * Build the URL path for an episode markdown file.
 */
export function getEpisodePath(language, episodeNum) {
  const folder = getFolderForEpisode(episodeNum);
  if (!folder) {
    return null;
  }

  const languageFolder = getLanguageFolder(language);
  const filename = `${formatEpisodeNumber(episodeNum)}.md`;
  return buildPublicAssetPath(`${languageFolder}/${folder}/${filename}`);
}

/**
 * Fetch markdown content for a specific episode.
 * Returns null only for HTTP 404 (missing episode).
 */
export async function fetchEpisode(language, episodeNum, options = {}) {
  const episodePath = getEpisodePath(language, episodeNum);
  if (!episodePath) {
    return null;
  }

  const response = await fetch(episodePath, { signal: options.signal });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load episode ${formatEpisodeNumber(episodeNum)} (${response.status})`);
  }

  const content = await response.text();
  return {
    content,
    episode: episodeNum,
    language,
    path: episodePath,
  };
}

/**
 * Split content into pages for the book reader.
 */
export function splitIntoPages(content, maxCharsPerPage = 2800) {
  if (!content || !content.trim()) {
    return [];
  }

  if (content.length <= maxCharsPerPage) {
    return [content.trim()];
  }

  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const pages = [];
  let currentPage = '';

  const pushCurrentPage = () => {
    if (currentPage.trim()) {
      pages.push(currentPage.trim());
      currentPage = '';
    }
  };

  for (const block of blocks) {
    const joined = currentPage ? `${currentPage}\n\n${block}` : block;
    if (joined.length <= maxCharsPerPage) {
      currentPage = joined;
      continue;
    }

    pushCurrentPage();

    if (block.length <= maxCharsPerPage) {
      currentPage = block;
      continue;
    }

    let remaining = block;
    while (remaining.length > maxCharsPerPage) {
      let splitAt = remaining.lastIndexOf('\n', maxCharsPerPage);
      if (splitAt < Math.floor(maxCharsPerPage * 0.45)) {
        splitAt = remaining.lastIndexOf(' ', maxCharsPerPage);
      }
      if (splitAt < Math.floor(maxCharsPerPage * 0.45)) {
        splitAt = maxCharsPerPage;
      }
      pages.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trimStart();
    }
    currentPage = remaining;
  }

  pushCurrentPage();
  return pages.length > 0 ? pages : [content.trim()];
}

/**
 * Extract title from markdown content (first h1 heading).
 */
export function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}
