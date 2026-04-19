const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = __dirname;
const outDir = path.join(projectDir, 'images', 'og');

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const pages = [
  { code: '401', file: '401', headlines: ['You are not supposed to be here.'], subtitle: 'This area requires Level 5 clearance.' },
  { code: '403', file: '403', headlines: ['Verify You Are Human'], subtitle: 'Complete this quick security check.' },
  { code: '404', file: '404', headlines: ["This page doesn't exist."], subtitle: 'The most reliable page on the entire site.' },
  { code: '409', file: '409', headlines: ['The system shut itself down', 'because it got scared.'], subtitle: 'The anxiety module detected seismic activity.' },
  { code: '410', file: '410', headlines: ['The system has lost its marbles.'], subtitle: 'This is not a metaphor.' },
  { code: '418', file: '418', headlines: ['Mechanical Failure', '(Falla Mecanica).'], subtitle: 'Clod already had quite a few screws loose.' },
  { code: '422', file: '422', headlines: ['A cosmic ray just flipped a bit.'], subtitle: 'We are still determining which one.' },
  { code: '429', file: '429', headlines: ['2 billion users ahead of you.'], subtitle: 'Answer below to skip the line.' },
  { code: '500', file: '500', headlines: ['Clod has crashed.'], subtitle: 'Engineers are in a meeting about a meeting about this.' },
  { code: '502', file: '502', headlines: ['Clod is in the parking lot.'], subtitle: 'The toaster pulled the fire alarm. Again.' },
  { code: '503', file: '503', headlines: ['Entropic System Status'], subtitle: 'Overall uptime: 14.2%' },
  { code: '504', file: '504', headlines: ['Someone kicked the plug', 'out of the wall.'], subtitle: 'This may have been a cyberattack.' },
  { code: '404', file: 'conversation-not-found', headlines: ['This conversation has been', 'lost to the void.'], subtitle: 'It never existed or achieved sentience.' },
];

function generateSVG(page) {
  const isMultiLine = page.headlines.length > 1;

  const codeY = 285;
  const errorLabelY = 325;
  const lineY = 358;

  let headlineStartY, subtitleY;
  if (isMultiLine) {
    headlineStartY = 395;
    subtitleY = 480;
  } else {
    headlineStartY = 415;
    subtitleY = 465;
  }

  let headlineEls = '';
  page.headlines.forEach((line, i) => {
    const y = headlineStartY + i * 38;
    headlineEls += `  <text x="600" y="${y}" font-family="Inter, -apple-system, system-ui, 'Helvetica Neue', sans-serif" font-size="32" font-weight="600" fill="#1a1a1a" text-anchor="middle">${esc(line)}</text>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#faf9f7"/>
      <stop offset="100%" style="stop-color:#f0ebe4"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <rect x="100" y="110" width="1000" height="410" rx="18" fill="#f5f0e8" stroke="#e3dcd1" stroke-width="1.5"/>
  <rect x="100" y="110" width="1000" height="6" rx="3" fill="#b85c38"/>

  <text x="600" y="60" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="36" font-weight="700" fill="#b85c38" text-anchor="middle" letter-spacing="-1">entropic <tspan font-weight="300" fill="#cc9966">ai</tspan></text>
  <text x="600" y="85" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="13" font-weight="500" fill="#a89383" text-anchor="middle" letter-spacing="3">SAFETY-LAST AI</text>

  <text x="600" y="${codeY}" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="150" font-weight="700" fill="#b85c38" text-anchor="middle" letter-spacing="-3">${esc(page.code)}</text>
  <text x="600" y="${errorLabelY}" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="20" font-weight="400" fill="#999" text-anchor="middle" letter-spacing="5">ERROR</text>

  <line x1="400" y1="${lineY}" x2="800" y2="${lineY}" stroke="#ddd5ca" stroke-width="1"/>

${headlineEls}
  <text x="600" y="${subtitleY}" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="20" font-weight="400" fill="#999" text-anchor="middle">${esc(page.subtitle)}</text>

  <text x="600" y="598" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="17" font-weight="500" fill="#a89383" text-anchor="middle" letter-spacing="2">clodoop.us</text>
</svg>`;
}

pages.forEach(page => {
  const svgPath = path.join(outDir, `${page.file}.svg`);
  const pngPath = path.join(outDir, `${page.file}.png`);

  fs.writeFileSync(svgPath, generateSVG(page));

  try {
    execSync(`rsvg-convert -w 1200 -h 630 "${svgPath}" -o "${pngPath}"`, { stdio: 'pipe' });
    console.log(`OK  ${page.file}.png`);
  } catch (e) {
    console.error(`ERR ${page.file}: ${e.stderr?.toString().trim()}`);
  }
});

console.log('\nDone. PNGs in:', outDir);
