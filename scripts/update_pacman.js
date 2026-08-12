#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const username = process.env.USERNAME || 'Arnoldujr';
const filename = process.env.FILENAME || 'pacman-contribution-graph-dark.svg';
const widthDefault = parseInt(process.env.WIDTH || '1166', 10);
const theme = (process.env.THEME || 'dark');

const contribUrl = `https://github.com/users/${username}/contributions`;

async function fetchSvg() {
  const res = await fetch(contribUrl, { headers: { 'User-Agent': 'github-readme-pacman' } });
  if (!res.ok) throw new Error(`Failed to fetch contributions page: ${res.status}`);
  const text = await res.text();
  const match = text.match(/<svg[\s\S]*?class=\"js-calendar-graph-svg\"[\s\S]*?<\/svg>/i);
  let svg = match ? match[0] : null;
  if (!svg) {
    const m2 = text.match(/<svg[\s\S]*?<\/svg>/i);
    svg = m2 ? m2[0] : null;
  }
  if (!svg) throw new Error('Could not find SVG on contributions page');
  return svg;
}

function extractSize(svg) {
  const wMatch = svg.match(/width=\"(\d+)\"/);
  const hMatch = svg.match(/height=\"(\d+)\"/);
  if (wMatch && hMatch) return { width: parseInt(wMatch[1], 10), height: parseInt(hMatch[1], 10) };
  const vb = svg.match(/viewBox=\"([\d\s\.]+)\"/);
  if (vb) {
    const parts = vb[1].split(/\s+/).map(Number);
    return { width: parts[2], height: parts[3] };
  }
  return { width: widthDefault, height: 184 };
}

function makePacmanOverlay(innerSvg, size) {
  const bg = theme === 'dark' ? '#0d1117' : '#ffffff';
  const pacmanColor = '#FFCC00';
  const ghostColors = ['#ff6b6b', '#ffb86b', '#6bd6ff'];
  const w = size.width;
  const h = size.height;
  const pacmanPath = (cx, cy, r, mouthAngle) => {
    return `
    <g id="pacman" transform="translate(${cx},${cy})">
      <circle r="${r}" fill="${pacmanColor}" />
      <polygon id="mouth" points="0,0 ${r},${-r} ${r},${r}" fill="${bg}">
        <animateTransform attributeName="transform" attributeType="XML" dur="0.3s" type="rotate" values="0 0 0;20 0 0;0 0 0" repeatCount="indefinite"/>
      </polygon>
    </g>`;
  };

  function ghost(x, delay, color) {
    return `
    <g class="ghost" transform="translate(${x},${h/2 - 10})">
      <rect x="-10" y="-10" width="20" height="18" rx="6" ry="6" fill="${color}" />
      <circle cx="-4" cy="-3" r="2" fill="#fff" />
      <circle cx="4" cy="-3" r="2" fill="#fff" />
      <circle cx="-4" cy="-3" r="1" fill="#000" />
      <circle cx="4" cy="-3" r="1" fill="#000" />
      <animateTransform attributeName="transform" attributeType="XML" type="translate" dur="9s" values="-${20},0; ${w+20},0" begin="${delay}s" repeatCount="indefinite" />
    </g>`;
  }

  const pacmanGroup = `
    <g id="pacmanGroup">
      ${pacmanPath(-20, h/2, 10)}
      <animateTransform attributeName="transform" attributeType="XML" type="translate" dur="9s" values="0,0; ${w+40},0" repeatCount="indefinite"/>
    </g>
  `;

  const ghosts = ghost(0, 1.5, ghostColors[0]) + ghost(-40, 3.0, ghostColors[1]) + ghost(-80, 4.5, ghostColors[2]);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title">
  <title id="title">Pac-Man contribution graph for ${username}</title>
  <rect width="100%" height="100%" fill="${bg}" />
  <g id="contrib" transform="translate(0,0)">
    ${innerSvg}
  </g>
  <g id="overlay">
    ${ghosts}
    ${pacmanGroup}
  </g>
</svg>`;
  return svg;
}

async function run() {
  try {
    console.log('Fetching contributions for', username);
    const innerSvg = await fetchSvg();
    const size = extractSize(innerSvg);
    const innerStripped = innerSvg.replace(/^\s*<\?xml[\s\S]*?\?>\s*/,'');
    const innerContentMatch = innerStripped.match(/^<svg[\s\S]*?>([\s\S]*)<\/svg>$/i);
    const innerContent = innerContentMatch ? innerContentMatch[1] : innerStripped;

    const combined = makePacmanOverlay(innerContent, size);

    fs.writeFileSync(filename, combined, 'utf8');
    fs.writeFileSync('contributions_raw.svg', innerSvg, 'utf8');
    console.log('Wrote', filename);

    const readmePath = path.join(process.cwd(), 'README.md');
    if (fs.existsSync(readmePath)) {
      let readme = fs.readFileSync(readmePath, 'utf8');
      readme = readme.replace(/<img\s+src="\.\/pacman-contribution-graph-dark\.svg"[\s\S]*?>/g, '');
      readme = readme.replace(/<img\s+src="\.\/snake\.svg"[\s\S]*?>/g, '');
      if (/##\s*Contribution/i.test(readme)) {
        readme = readme.replace(/(##\s*Contribution[\s\S]*?\n)/i, `$1\n<img src="./${filename}" alt="Pac-Man contribution graph" width="${widthDefault}" />\n\n`);
      } else if (/##\s*Contribution snake/i.test(readme)) {
        readme = readme.replace(/(##\s*Contribution snake[\s\S]*?\n)/i, `$1\n<img src="./${filename}" alt="Pac-Man contribution graph" width="${widthDefault}" />\n\n`);
      } else {
        readme = readme + `\n## Contributions\n\n<img src="./${filename}" alt="Pac-Man contribution graph" width="${widthDefault}" />\n`;
      }
      fs.writeFileSync(readmePath, readme, 'utf8');
      console.log('Updated README.md');
    } else {
      console.log('README.md not found; skipping README update');
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();