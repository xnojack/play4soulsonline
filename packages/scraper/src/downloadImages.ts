import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { CardListEntry } from './scrapeCardList';

export async function downloadImage(
  entry: CardListEntry,
  outputDir: string
): Promise<string> {
  const id = entry.url.replace(/\/$/, '').split('/').pop() || entry.url;

  // Try common extensions
  const ext = path.extname(new URL(entry.imageUrl).pathname) || '.png';
  const filename = `${id}${ext}`;
  const localPath = path.join(outputDir, filename);

  if (fs.existsSync(localPath)) {
    return `/cards/${filename}`;
  }

  try {
    const response = await axios.get(entry.imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FourSoulsOnlineScraper/1.0)',
        Referer: 'https://foursouls.com/',
      },
    });

    fs.writeFileSync(localPath, Buffer.from(response.data as ArrayBuffer));
    return `/cards/${filename}`;
  } catch (err) {
    console.warn(`  Failed to download image for ${id}: ${err}`);
    return `/cards/placeholder.png`;
  }
}

export async function downloadImages(
  entries: CardListEntry[],
  outputDir: string,
  delayMs = 300
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  fs.mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const id = entry.url.replace(/\/$/, '').split('/').pop() || entry.url;

    process.stdout.write(`  [${i + 1}/${entries.length}] Downloading image for ${id}...`);
    const localPath = await downloadImage(entry, outputDir);
    map.set(id, localPath);
    console.log(` ${localPath}`);

    await new Promise((r) => setTimeout(r, delayMs));
  }

  return map;
}
