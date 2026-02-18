/**
 * Episode Index Management
 * 
 * This utility manages the list of available episodes for both English and Burmese.
 * It creates indices by scanning the folder structure.
 */

import { EPISODE_RANGES } from './markdownUtils';

// Default maximum episode
const MAX_EPISODE = 2088;

/**
 * Generate the folder path for an episode
 */
function getFolderPath(episodeNum) {
  const range = EPISODE_RANGES.find(r => episodeNum >= r.start && episodeNum <= r.end);
  return range ? range.folder : null;
}

/**
 * Create an index of available episodes
 * This generates a JSON structure representing all episodes and their availability
 */
export function generateEpisodeIndex() {
  const index = {
    eng: [],
    burmese: [],
    metadata: {
      totalEpisodes: MAX_EPISODE,
      lastUpdated: new Date().toISOString()
    }
  };

  for (let ep = 1; ep <= MAX_EPISODE; ep++) {
    const folder = getFolderPath(ep);
    if (folder) {
      // Add episode entry with folder info
      const episodeEntry = {
        number: ep,
        folder: folder,
        paddedNumber: ep.toString().padStart(4, '0')
      };
      
      // Both languages have the same structure
      index.eng.push(episodeEntry);
      index.burmese.push(episodeEntry);
    }
  }

  return index;
}

/**
 * Get episodes by range
 */
export function getEpisodesByRange(language, start, end) {
  const index = generateEpisodeIndex();
  const episodes = index[language] || index.eng;
  return episodes.filter(ep => ep.number >= start && ep.number <= end);
}

/**
 * Search episodes by number or partial match
 */
export function searchEpisodes(query, language = 'eng') {
  const index = generateEpisodeIndex();
  const episodes = index[language] || index.eng;
  
  if (!query) return episodes;
  
  const numQuery = parseInt(query, 10);
  if (!isNaN(numQuery)) {
    return episodes.filter(ep => ep.number === numQuery);
  }
  
  return episodes.filter(ep => 
    ep.paddedNumber.includes(query)
  );
}

/**
 * Get episodes in a specific folder
 */
export function getEpisodesInFolder(folderName, language = 'eng') {
  const index = generateEpisodeIndex();
  const episodes = index[language] || index.eng;
  return episodes.filter(ep => ep.folder === folderName);
}

/**
 * Get all folder names
 */
export function getAllFolders() {
  return EPISODE_RANGES.map(r => ({
    folder: r.folder,
    start: r.start,
    end: r.end,
    count: r.end - r.start + 1
  }));
}

/**
 * Format episode display name
 */
export function formatEpisodeName(episodeNum, title = null) {
  const padded = episodeNum.toString().padStart(4, '0');
  if (title) {
    return `Episode ${padded} - ${title}`;
  }
  return `Episode ${padded}`;
}

/**
 * Format Burmese episode display name
 */
export function formatBurmeseEpisodeName(episodeNum, title = null) {
  const padded = episodeNum.toString().padStart(4, '0');
  if (title) {
    return `အပိုင်း ${padded} - ${title}`;
  }
  return `အပိုင်း ${padded}`;
}
