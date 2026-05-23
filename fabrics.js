const fabricPresets = [
  { name: 'ЗОЛОТИЙ ОКСАМИТ',     cat: 'оксамит', c1: '#C9A96E', c2: '#8B5E2A', pat: 'velvet'  },
  { name: 'СМАРАГДОВИЙ ОКСАМИТ', cat: 'оксамит', c1: '#1B4D3E', c2: '#2E7D5E', pat: 'velvet'  },
  { name: 'БУРГУНДСЬКИЙ ОКСАМИТ',cat: 'оксамит', c1: '#6B1E3D', c2: '#3A0A1F', pat: 'velvet'  },
  { name: 'УЛЬТРАМАРИН',         cat: 'оксамит', c1: '#1E2A5E', c2: '#3B4B9A', pat: 'velvet'  },
  { name: 'ГРАФІТОВИЙ ЛЬОН',     cat: 'льон',    c1: '#3D3D3D', c2: '#5A5A5A', pat: 'linen'   },
  { name: 'ПІСОЧНИЙ ЛЬОН',       cat: 'льон',    c1: '#C4A882', c2: '#8C6840', pat: 'linen'   },
  { name: 'ПОПЕЛЯСТИЙ ЛЬОН',     cat: 'льон',    c1: '#8C8C8C', c2: '#5A5A5A', pat: 'linen'   },
  { name: 'ПЕРЛАМУТРОВИЙ ШОВК',  cat: 'шовк',    c1: '#E8DDD0', c2: '#C8BAA0', pat: 'silk'    },
  { name: 'СРІБНИЙ ШОВК',        cat: 'шовк',    c1: '#A0A5B0', c2: '#C9CDD6', pat: 'silk'    },
  { name: 'РОЖЕВИЙ ШОВК',        cat: 'шовк',    c1: '#C4748C', c2: '#8C3050', pat: 'silk'    },
  { name: 'КАРАМЕЛЬНА ШКІРА',    cat: 'шкіра',   c1: '#8B5E3C', c2: '#5A3018', pat: 'leather' },
  { name: 'ЧОРНА ШКІРА',         cat: 'шкіра',   c1: '#1A1A1A', c2: '#3A3A3A', pat: 'leather' },
];

function generateFabricSVG({ c1, c2, pat }) {
  let inner = '';
  if (pat === 'velvet') {
    inner =
      `<defs><linearGradient id="vg" x1="0%" y1="0%" x2="100%" y2="100%">` +
      `<stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c1}"/></linearGradient></defs>` +
      `<rect width="100" height="100" fill="url(#vg)"/>` +
      Array.from({length: 8}, (_, i) =>
        `<line x1="${i * 13 - 4}" y1="0" x2="${i * 13 + 8}" y2="100" stroke="${c1}" stroke-width="2" opacity="0.22"/>`
      ).join('');
  } else if (pat === 'linen') {
    inner =
      `<rect width="100" height="100" fill="${c1}"/>` +
      Array.from({length: 11}, (_, i) =>
        `<line x1="${i * 10}" y1="0" x2="${i * 10}" y2="100" stroke="${c2}" stroke-width="0.7" opacity="0.5"/>` +
        `<line x1="0" y1="${i * 10}" x2="100" y2="${i * 10}" stroke="${c2}" stroke-width="0.7" opacity="0.5"/>`
      ).join('');
  } else if (pat === 'silk') {
    inner =
      `<defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">` +
      `<stop offset="0%" stop-color="${c1}"/><stop offset="35%" stop-color="${c2}"/>` +
      `<stop offset="65%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>` +
      `<rect width="100" height="100" fill="url(#sg)"/>` +
      `<rect width="100" height="100" fill="${c1}" opacity="0.15"/>`;
  } else if (pat === 'leather') {
    const grains = Array.from({length: 16}, (_, i) => {
      const x = (i * 17 + 7) % 90 + 5;
      const y = (i * 23 + 11) % 90 + 5;
      return `<ellipse cx="${x}" cy="${y}" rx="${1.5 + i % 3}" ry="0.8" fill="${c2}" opacity="0.3"/>`;
    }).join('');
    inner = `<rect width="100" height="100" fill="${c1}"/>` + grains;
  }
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`
  );
}
