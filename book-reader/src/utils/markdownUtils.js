/**
 * Utility functions for fetching and managing markdown files
 */

// Episode ranges for folder structure
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

/**
 * Get the folder name for a given episode number
 * @param {number} episodeNum - Episode number
 * @returns {string|null} - Folder name or null if not found
 */
export function getFolderForEpisode(episodeNum) {
  const range = EPISODE_RANGES.find(r => episodeNum >= r.start && episodeNum <= r.end);
  return range ? range.folder : null;
}

/**
 * Format episode number with leading zeros (4 digits)
 * @param {number} num - Episode number
 * @returns {string} - Formatted number like "0001"
 */
export function formatEpisodeNumber(num) {
  return num.toString().padStart(4, '0');
}

/**
 * Build the URL path for an episode markdown file
 * @param {string} language - 'eng' or 'burmese'
 * @param {number} episodeNum - Episode number
 * @returns {string|null} - URL path or null if folder not found
 */
export function getEpisodePath(language, episodeNum) {
  const folder = getFolderForEpisode(episodeNum);
  if (!folder) return null;
  
  const langFolder = language === 'burmese' ? 'burmese-episodes' : 'eng-episodes';
  const filename = `${formatEpisodeNumber(episodeNum)}.md`;
  return `/${langFolder}/${folder}/${filename}`;
}

/**
 * Fetch markdown content for a specific episode
 * @param {string} language - 'eng' or 'burmese'
 * @param {number} episodeNum - Episode number
 * @returns {Promise<{content: string, episode: number, language: string}|null>} - Episode data or null if error
 */
export async function fetchEpisode(language, episodeNum) {
  const path = getEpisodePath(language, episodeNum);
  if (!path) {
    console.error(`No folder found for episode ${episodeNum}`);
    return null;
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // Episode doesn't exist yet
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const content = await response.text();
    return {
      content,
      episode: episodeNum,
      language,
      path
    };
  } catch (error) {
    console.error(`Error fetching episode ${episodeNum}:`, error);
    return null;
  }
}

/**
 * Get the next episode that exists
 * @param {string} language - 'eng' or 'burmese'
 * @param {number} currentEpisode - Current episode number
 * @param {number} maxAttempts - Maximum number of episodes to check
 * @returns {Promise<object|null>} - Next episode data or null
 */
export async function getNextEpisode(language, currentEpisode, maxAttempts = 5) {
  for (let i = 1; i <= maxAttempts; i++) {
    const next = await fetchEpisode(language, currentEpisode + i);
    if (next) return next;
  }
  return null;
}

/**
 * Get the previous episode that exists
 * @param {string} language - 'eng' or 'burmese'
 * @param {number} currentEpisode - Current episode number
 * @param {number} maxAttempts - Maximum number of episodes to check
 * @returns {Promise<object|null>} - Previous episode data or null
 */
export async function getPrevEpisode(language, currentEpisode, maxAttempts = 5) {
  for (let i = 1; i <= maxAttempts; i++) {
    const prevNum = currentEpisode - i;
    if (prevNum < 1) return null;
    const prev = await fetchEpisode(language, prevNum);
    if (prev) return prev;
  }
  return null;
}

/**
 * Get available episodes index for a language
 * This creates an index of available episodes by checking which files exist
 * @param {string} language - 'eng' or 'burmese'
 * @returns {Promise<number[]>} - Array of available episode numbers
 */
export async function getEpisodeIndex(language) {
  const index = [];
  // Check episodes in batches to avoid too many requests
  for (let ep = 1; ep <= 2088; ep++) {
    const path = getEpisodePath(language, ep);
    if (path) {
      try {
        const response = await fetch(path, { method: 'HEAD' });
        if (response.ok) {
          index.push(ep);
        }
      } catch (e) {
        // Ignore errors, episode doesn't exist
      }
    }
  }
  return index;
}

/**
 * Get the first available episode number
 * @param {string} language - 'eng' or 'burmese'
 * @returns {number} - First episode number (usually 1)
 */
export function getFirstEpisode() {
  return 1;
}

/**
 * Split content into pages for the book reader
 * @param {string} content - Markdown content
 * @param {number} maxCharsPerPage - Maximum characters per page
 * @returns {string[]} - Array of page contents
 */
export function splitIntoPages(content, maxCharsPerPage = 3000) {
  if (!content || content.length <= maxCharsPerPage) {
    return [content];
  }

  const pages = [];
  let currentPage = '';
  
  // Split by paragraphs to avoid cutting mid-paragraph
  const paragraphs = content.split('\n\n');
  
  for (const paragraph of paragraphs) {
    if ((currentPage + paragraph).length > maxCharsPerPage && currentPage.length > 0) {
      pages.push(currentPage.trim());
      currentPage = paragraph + '\n\n';
    } else {
      currentPage += paragraph + '\n\n';
    }
  }
  
  if (currentPage.trim()) {
    pages.push(currentPage.trim());
  }
  
  return pages.length > 0 ? pages : [content];
}

/**
 * Extract title from markdown content (first h1 heading)
 * @param {string} content - Markdown content
 * @returns {string|null} - Title or null
 */
export function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}
