import { buildPublicAssetPath } from './markdownUtils';

const DEFAULT_MAX_EPISODE = 2088;

export function normalizeLanguage(language) {
  if (language === 'burmese' || language === 'my' || language === 'mm') {
    return 'burmese';
  }
  return 'eng';
}

function normalizeEpisodeNumber(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeEpisodeList(episodes) {
  if (!Array.isArray(episodes)) {
    return [];
  }
  const normalized = episodes
    .map((episode) => normalizeEpisodeNumber(episode))
    .filter((episode) => episode !== null);
  return [...new Set(normalized)].sort((a, b) => a - b);
}

function expandFolderRanges(folders) {
  if (!Array.isArray(folders)) {
    return [];
  }

  const episodes = [];
  for (const folder of folders) {
    const start = normalizeEpisodeNumber(folder?.start);
    const end = normalizeEpisodeNumber(folder?.end);
    if (start === null || end === null || end < start) {
      continue;
    }
    for (let number = start; number <= end; number += 1) {
      episodes.push(number);
    }
  }

  return normalizeEpisodeList(episodes);
}

function createFallbackIndex() {
  return {
    eng: {
      totalEpisodes: DEFAULT_MAX_EPISODE,
      availableEpisodes: Array.from({ length: DEFAULT_MAX_EPISODE }, (_, index) => index + 1),
      folders: [],
    },
    burmese: {
      totalEpisodes: 100,
      availableEpisodes: Array.from({ length: 100 }, (_, index) => index + 1),
      folders: [{ name: '0001-0100', start: 1, end: 100 }],
    },
    metadata: {
      title: 'Renegade Immortal (Xian Ni)',
      lastUpdated: new Date().toISOString(),
      generated: false,
    },
  };
}

export async function fetchEpisodeIndex(options = {}) {
  const indexPath = buildPublicAssetPath('episode-index.json');

  try {
    const response = await fetch(indexPath, { signal: options.signal });
    if (!response.ok) {
      throw new Error(`Failed to load episode index (${response.status})`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error('Episode index fallback activated:', error);
    return createFallbackIndex();
  }
}

export function getAvailableEpisodes(indexData, language) {
  const normalizedLanguage = normalizeLanguage(language);
  const languageSection = indexData?.[normalizedLanguage] || {};

  const directList = normalizeEpisodeList(languageSection.availableEpisodes);
  if (directList.length > 0) {
    return directList;
  }

  const fromFolders = expandFolderRanges(languageSection.folders);
  if (fromFolders.length > 0) {
    return fromFolders;
  }

  const total = normalizeEpisodeNumber(languageSection.totalEpisodes) || DEFAULT_MAX_EPISODE;
  return Array.from({ length: total }, (_, index) => index + 1);
}

export function findNearestEpisode(availableEpisodes, targetEpisode) {
  if (!Array.isArray(availableEpisodes) || availableEpisodes.length === 0) {
    return null;
  }

  const target = normalizeEpisodeNumber(targetEpisode) || availableEpisodes[0];
  const first = availableEpisodes[0];
  const last = availableEpisodes[availableEpisodes.length - 1];

  if (target <= first) {
    return first;
  }
  if (target >= last) {
    return last;
  }

  let left = 0;
  let right = availableEpisodes.length - 1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const current = availableEpisodes[middle];
    if (current === target) {
      return current;
    }
    if (current < target) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  const lower = availableEpisodes[right];
  const upper = availableEpisodes[left];
  if (typeof lower !== 'number') {
    return upper;
  }
  if (typeof upper !== 'number') {
    return lower;
  }
  return target - lower <= upper - target ? lower : upper;
}

export function getAdjacentEpisode(availableEpisodes, currentEpisode, direction) {
  if (!Array.isArray(availableEpisodes) || availableEpisodes.length === 0) {
    return null;
  }

  const index = availableEpisodes.indexOf(currentEpisode);
  if (index < 0) {
    return null;
  }

  const nextIndex = direction > 0 ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= availableEpisodes.length) {
    return null;
  }
  return availableEpisodes[nextIndex];
}
