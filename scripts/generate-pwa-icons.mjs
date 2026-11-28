import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/icons';
mkdirSync(OUT, { recursive: true });

// Brand mark: white cross over an open book on the app's navy background.
// `maskable` keeps the artwork inside the safe zone so Android can crop it.
const artwork = (size, maskable) => {
  const scale = size / 512;
  const pad = maskable ? 66 : 0;
  const inner = 512 - pad * 2;
  const crossX = pad + inner / 2;
  const crossW = inner * 0.085;
  const crossH = inner * 0.52;
  const crossY = pad + inner * 0.13;
  const armW = inner * 0.3;
  const armY = crossY + crossH * 0.24;
  const bookY = pad + inner * 0.72;
  const bookH = inner * 0.1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1e2a5a"/>
  <g transform="scale(${scale})">
    <rect x="${crossX - crossW / 2}" y="${crossY}" width="${crossW}" height="${crossH}" rx="${crossW * 0.25}" fill="#f7b733"/>
    <rect x="${crossX - armW / 2}" y="${armY}" width="${armW}" height="${crossW}" rx="${crossW * 0.25}" fill="#f7b733"/>
    <path d="M${pad + inner * 0.16} ${bookY} Q${crossX} ${bookY - bookH * 0.55} ${pad + inner * 0.84} ${bookY} L${pad + inner * 0.84} ${bookY + bookH} Q${crossX} ${bookY + bookH * 0.45} ${pad + inner * 0.16} ${bookY + bookH} Z" fill="#ffffff" opacity="0.94"/>
    <rect x="${crossX - 1.5}" y="${bookY - bookH * 0.16}" width="3" height="${bookH * 1.05}" fill="#1e2a5a" opacity="0.35"/>
  </g>
</svg>`;
};

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'favicon-32.png', size: 32, maskable: false },
];

for (const target of targets) {
  await sharp(Buffer.from(artwork(target.size, target.maskable)))
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${target.name}`);
  console.log('wrote', target.name);
}
