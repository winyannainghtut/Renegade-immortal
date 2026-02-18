import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const pairs = [
  { from: path.resolve(root, '../eng-episodes'), to: path.resolve(root, 'public/eng-episodes') },
  { from: path.resolve(root, '../burmese-episodes'), to: path.resolve(root, 'public/burmese-episodes') },
];

function parseFolderRange(folderName) {
  const match = folderName.match(/^(\d{4})-(\d{4})$/);
  if (!match) {
    return null;
  }
  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return null;
  }
  return { name: folderName, start, end };
}

function parseEpisodeFile(fileName) {
  const match = fileName.match(/^(\d{4})\.md$/);
  if (!match) {
    return null;
  }
  const episode = Number.parseInt(match[1], 10);
  return Number.isInteger(episode) ? episode : null;
}

async function buildLanguageIndex(languageRoot) {
  const directoryEntries = await readdir(languageRoot, { withFileTypes: true });
  const folders = directoryEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => parseFolderRange(entry.name))
    .filter(Boolean)
    .sort((left, right) => left.start - right.start);

  const episodeSet = new Set();
  for (const folder of folders) {
    const folderPath = path.join(languageRoot, folder.name);
    const fileEntries = await readdir(folderPath, { withFileTypes: true });
    for (const fileEntry of fileEntries) {
      if (!fileEntry.isFile()) {
        continue;
      }
      const episode = parseEpisodeFile(fileEntry.name);
      if (episode !== null) {
        episodeSet.add(episode);
      }
    }
  }

  const availableEpisodes = [...episodeSet].sort((left, right) => left - right);
  const totalEpisodes = availableEpisodes.length > 0 ? availableEpisodes[availableEpisodes.length - 1] : 0;

  return {
    folders,
    totalEpisodes,
    availableCount: availableEpisodes.length,
    availableEpisodes,
  };
}

for (const { from, to } of pairs) {
  await rm(to, { recursive: true, force: true });
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
  console.log(`Synced: ${from} -> ${to}`);
}

const engIndex = await buildLanguageIndex(path.resolve(root, 'public/eng-episodes'));
const burmeseIndex = await buildLanguageIndex(path.resolve(root, 'public/burmese-episodes'));

const episodeIndex = {
  eng: engIndex,
  burmese: burmeseIndex,
  metadata: {
    title: 'Renegade Immortal (Xian Ni)',
    titleBurmese: 'ဒုစရိုက်နတ်ဘုရား (仙逆)',
    author: 'Er Gen',
    description: "A Xianxia novel about Wang Lin's journey of cultivation against the heavens.",
    generated: true,
    lastUpdated: new Date().toISOString(),
  },
};

const outputPath = path.resolve(root, 'public/episode-index.json');
await writeFile(outputPath, `${JSON.stringify(episodeIndex, null, 2)}\n`, 'utf8');
console.log(`Generated: ${outputPath}`);
