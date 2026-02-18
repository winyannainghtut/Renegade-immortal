/**
 * Utility functions for fetching and managing markdown files.
 */

import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';

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

const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_MAX_CHARS_PER_PAGE = 2800;
const markdownParser = unified().use(remarkParse).use(remarkGfm);

function normalizeBasePath(basePath) {
  if (!basePath || typeof basePath !== 'string') {
    return '/';
  }

  if (basePath === '.' || basePath === './') {
    return './';
  }

  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

function getRuntimeBasePath() {
  if (typeof window === 'undefined') {
    return null;
  }

  const pathname = window.location.pathname || '/';
  if (pathname.endsWith('/')) {
    return pathname;
  }

  // `.../index.html` -> `.../`; `/repo` -> `/repo/`.
  const hasFileExtension = /\.[a-z0-9]+$/i.test(pathname);
  if (hasFileExtension) {
    const lastSlashIndex = pathname.lastIndexOf('/');
    return lastSlashIndex >= 0 ? pathname.slice(0, lastSlashIndex + 1) || '/' : '/';
  }

  return `${pathname}/`;
}

function getProjectBasePath() {
  if (typeof window === 'undefined') {
    return null;
  }

  const [firstSegment] = (window.location.pathname || '')
    .split('/')
    .filter(Boolean);

  return firstSegment ? `/${firstSegment}/` : '/';
}

function getBasePathCandidates() {
  const envBasePath = normalizeBasePath(import.meta.env.BASE_URL || '/');
  const runtimeBasePath = normalizeBasePath(getRuntimeBasePath() || '/');
  const projectBasePath = normalizeBasePath(getProjectBasePath() || '/');

  return [...new Set([envBasePath, runtimeBasePath, projectBasePath, '/'])];
}

function getBaseUrl() {
  const [basePath] = getBasePathCandidates();
  return basePath || '/';
}

function buildPathFromBase(basePath, relativePath) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const normalizedPath = String(relativePath || '').replace(/^\/+/, '');
  return `${normalizedBasePath}${normalizedPath}`;
}

function createRequestSignal(externalSignal, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const timeout =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_FETCH_TIMEOUT_MS;
  const timeoutController = new AbortController();
  let hasTimedOut = false;

  const timeoutId = setTimeout(() => {
    hasTimedOut = true;
    timeoutController.abort();
  }, timeout);

  const handleExternalAbort = () => {
    timeoutController.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      handleExternalAbort();
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
    }
  }

  return {
    signal: timeoutController.signal,
    hasTimedOut: () => hasTimedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', handleExternalAbort);
      }
    },
  };
}

export function buildPublicAssetPathCandidates(relativePath) {
  const normalizedPath = String(relativePath || '').replace(/^\/+/, '');
  if (!normalizedPath) {
    return [];
  }

  return getBasePathCandidates().map((basePath) => buildPathFromBase(basePath, normalizedPath));
}

export function buildPublicAssetPath(relativePath) {
  const [firstCandidate] = buildPublicAssetPathCandidates(relativePath);
  if (firstCandidate) {
    return firstCandidate;
  }

  const normalizedPath = String(relativePath || '').replace(/^\/+/, '');
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

function getEpisodeRelativePath(language, episodeNum) {
  const folder = getFolderForEpisode(episodeNum);
  if (!folder) {
    return null;
  }

  const languageFolder = getLanguageFolder(language);
  const filename = `${formatEpisodeNumber(episodeNum)}.md`;
  return `${languageFolder}/${folder}/${filename}`;
}

/**
 * Build the URL path for an episode markdown file.
 */
export function getEpisodePath(language, episodeNum) {
  const relativePath = getEpisodeRelativePath(language, episodeNum);
  if (!relativePath) {
    return null;
  }

  return buildPublicAssetPath(relativePath);
}

export async function fetchPublicAsset(relativePath, options = {}) {
  const candidatePaths = buildPublicAssetPathCandidates(relativePath);
  if (candidatePaths.length === 0) {
    throw new Error(`Invalid public asset path: ${relativePath}`);
  }

  let lastResponse = null;
  let lastError = null;
  let lastPath = candidatePaths[candidatePaths.length - 1];

  for (const candidatePath of candidatePaths) {
    const request = createRequestSignal(options.signal, options.timeoutMs);

    try {
      const response = await fetch(candidatePath, { signal: request.signal });
      if (response.ok) {
        return { response, path: candidatePath };
      }

      lastResponse = response;
      lastPath = candidatePath;
    } catch (error) {
      if (error.name === 'AbortError') {
        if (request.hasTimedOut()) {
          throw new Error(`Request timed out while loading ${relativePath}.`);
        }
        throw error;
      }

      lastError = error;
      lastPath = candidatePath;
    } finally {
      request.cleanup();
    }
  }

  if (lastResponse) {
    return { response: lastResponse, path: lastPath };
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`Failed to load ${relativePath}.`);
}

/**
 * Fetch markdown content for a specific episode.
 * Returns null only for HTTP 404 (missing episode).
 */
export async function fetchEpisode(language, episodeNum, options = {}) {
  const episodeRelativePath = getEpisodeRelativePath(language, episodeNum);
  if (!episodeRelativePath) {
    return null;
  }

  const { response, path } = await fetchPublicAsset(episodeRelativePath, options);
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
    path,
  };
}

/**
 * Split content into pages for the book reader.
 */
function splitIntoPagesByMarkdownNodes(content, maxCharsPerPage) {
  let tree;
  try {
    tree = markdownParser.parse(content);
  } catch (error) {
    return null;
  }

  const nodes = Array.isArray(tree?.children) ? tree.children : [];
  if (nodes.length === 0) {
    return [content];
  }

  const nodeStarts = [];
  for (const node of nodes) {
    const startOffset = node?.position?.start?.offset;
    const endOffset = node?.position?.end?.offset;
    if (
      !Number.isInteger(startOffset) ||
      !Number.isInteger(endOffset) ||
      startOffset < 0 ||
      endOffset < startOffset ||
      endOffset > content.length
    ) {
      return null;
    }
    nodeStarts.push(startOffset);
  }

  const segments = nodeStarts
    .map((startOffset, index) => {
      const segmentStart = index === 0 ? 0 : startOffset;
      const segmentEnd = index < nodeStarts.length - 1 ? nodeStarts[index + 1] : content.length;
      if (segmentEnd <= segmentStart) {
        return '';
      }
      return content.slice(segmentStart, segmentEnd);
    })
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return [content];
  }

  const pages = [];
  let currentPage = '';

  const flushPage = () => {
    if (currentPage.trim()) {
      pages.push(currentPage);
    }
    currentPage = '';
  };

  for (const segment of segments) {
    if (!currentPage) {
      currentPage = segment;
      continue;
    }

    if (currentPage.length + segment.length <= maxCharsPerPage) {
      currentPage += segment;
      continue;
    }

    flushPage();
    currentPage = segment;
  }

  flushPage();
  return pages.length > 0 ? pages : [content];
}

export function splitIntoPages(content, maxCharsPerPage = DEFAULT_MAX_CHARS_PER_PAGE) {
  if (!content || !content.trim()) {
    return [];
  }

  const resolvedMaxChars =
    Number.isFinite(maxCharsPerPage) && maxCharsPerPage > 0
      ? Math.floor(maxCharsPerPage)
      : DEFAULT_MAX_CHARS_PER_PAGE;

  if (content.length <= resolvedMaxChars) {
    return [content];
  }

  const markdownAwarePages = splitIntoPagesByMarkdownNodes(content, resolvedMaxChars);
  if (markdownAwarePages && markdownAwarePages.length > 0) {
    return markdownAwarePages;
  }

  // Preserve full content if parsing fails instead of splitting markdown unsafely.
  return [content];
}

/**
 * Extract title from markdown content (first h1 heading).
 */
export function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}
