import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML      = 'file://' + path.join(__dirname, 'index.html');
const TMP_DIR   = path.join(__dirname, '_rec_tmp');
const OUT_MP4   = path.join(__dirname, 'magicum-ad.mp4');
const DURATION  = 10_000;   // ms to record
const W = 430, H = 760;

fs.mkdirSync(TMP_DIR, { recursive: true });

console.log('Launching headless Chromium…');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
         '--disable-gpu','--run-all-compositor-stages-before-draw'],
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: TMP_DIR,
    size: { width: W, height: H },
  },
});

const page = await context.newPage();
console.log('Loading page…');
await page.goto(HTML, { waitUntil: 'load' });

console.log(`Recording ${DURATION / 1000}s…`);
await page.waitForTimeout(DURATION);

console.log('Stopping recording…');
const videoPath = await page.video().path();
await context.close();
await browser.close();

// Wait for webm to be fully written
await new Promise(r => setTimeout(r, 1000));

console.log(`WebM saved: ${videoPath}`);
console.log('Converting to MP4…');

const result = spawnSync('ffmpeg', [
  '-y',
  '-i', videoPath,
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-vf', 'scale=430:760:flags=lanczos',
  OUT_MP4,
], { stdio: 'inherit' });

if (result.status === 0) {
  console.log(`\n✓ Done: ${OUT_MP4}`);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
} else {
  console.error('ffmpeg failed');
  process.exit(1);
}
