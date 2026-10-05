const state = {
  file: null,
  fileName: '',
  rows: [],
  headers: [],
  preview: [],
};

let map = null;
let mapMarkers = [];

const EPSG_OPTIONS = [
  { code: 'EPSG:4326', label: 'EPSG:4326 — WGS 84 (lon/lat)' },
  { code: 'EPSG:3857', label: 'EPSG:3857 — Web Mercator' },
  { code: 'EPSG:2154', label: 'EPSG:2154 — RGF93 / Lambert-93' },
  { code: 'EPSG:32631', label: 'EPSG:32631 — WGS 84 / UTM zone 31N' },
  { code: 'EPSG:32632', label: 'EPSG:32632 — WGS 84 / UTM zone 32N' },
  { code: 'EPSG:27572', label: 'EPSG:27572 — NTF / Lambert zone II étendu' },
  { code: 'EPSG:2972', label: 'EPSG:2972 — RGFG95 / UTM zone 22N — Guyane' },
  { code: 'EPSG:2975', label: 'EPSG:2975 — RGR92 / UTM zone 40S — La Réunion' },
  { code: 'EPSG:32620', label: 'EPSG:32620 — WGS 84 / UTM zone 20N — Antilles' },
];

proj4.defs('EPSG:2154', '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs +type=crs');
proj4.defs('EPSG:32631', '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs +type=crs');
proj4.defs('EPSG:32632', '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs +type=crs');
proj4.defs('EPSG:27572', '+proj=lcc +lat_0=46.8 +lon_0=0 +lat_1=45.8989188888889 +lat_2=47.6960144444444 +x_0=600000 +y_0=2200000 +ellps=clrk80ign +pm=paris +units=m +no_defs +type=crs');
proj4.defs('EPSG:2972','+proj=utm +zone=22 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:2975','+proj=utm +zone=40 +south +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:32620','+proj=utm +zone=20 +datum=WGS84 +units=m +no_defs');

const byId = (id) => document.getElementById(id);
const els = {
  fileInput: byId('fileInput'),
  runBtn: byId('runBtn'),
  dropzone: byId('dropzone'),
  currentFile: byId('currentFile'),
  kpiCols: byId('kpiCols'),
  kpiRows: byId('kpiRows'),
  kpiDelim: byId('kpiDelim'),
  xField: byId('xField'),
  yField: byId('yField'),
  epsgIn: byId('epsgIn'),
  epsgOut: byId('epsgOut'),
  warnings: byId('warnings'),
  thead: byId('thead'),
  tbody: byId('tbody'),
  result: byId('result'),
  guessInfo: byId('guessInfo'),
  joinXY: byId('joinXY'),
  exportCsv: byId('exportCsv'),
  exportXlsx: byId('exportXlsx'),
  baseName: byId('baseName'),
  previewLoader: byId('previewLoader'),
};

function toast(message, kind = 'warn') {
  els.result.innerHTML = `<div class="alert ${kind}">${message}</div>`;
}

function fillSelect(select, values, selected) {
  select.innerHTML = values
    .map((v) => `<option value="${v.code ?? v.value ?? v}">${v.label ?? v}</option>`)
    .join('');
  if (selected) select.value = selected;
}

function renderWarnings(list = []) {
  els.warnings.innerHTML = list.map((w) => `<div class="alert warn">${w}</div>`).join('');
}

function renderTable(headers, rows) {
  els.thead.innerHTML = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
  els.tbody.innerHTML = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml((r[h] ?? '').toString())}</td>`).join('')}</tr>`)
    .join('');
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function detectDelimiter(text) {
  // On ne prend que les 2000 premiers caractères pour économiser la RAM
  const sample = text.slice(0, 2000).split(/\r?\n/).slice(0, 5).join('\n');
  const candidates = [';', ',', '\t'];
  let best = ';';
  let bestScore = -1;
  
  for (const d of candidates) {
    const score = sample.split(d).length;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

function normalizeNumber(value) {
  if (typeof value === 'number') return value;
  const s = String(value ?? '').trim();
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  if (/^-?\d{1,3}(?:[ .]\d{3})*(?:,\d+)?$/.test(s)) {
    return Number(s.replace(/[ .](?=\d{3}(\D|$))/g, '').replace(',', '.'));
  }
  return Number(s.replace(',', '.'));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isNumeric(value) {
  return Number.isFinite(normalizeNumber(value));
}

function numericRatio(rows, field) {
  if (!rows?.length) return 0;

  let valid = 0;
  let total = 0;

  for (const row of rows) {
    const value = row[field];

    if (value === null || value === undefined || String(value).trim() === '') {
      continue;
    }

    total++;

    if (isNumeric(value)) {
      valid++;
    }
  }

  return total ? valid / total : 0;
}

function guessCoordinateFields(headers, rows = []) {

  const rules = {

    x: [
      { regex: /^(x|coordx|coord_x|xcoord|x_coord)$/i, score: 1.00 },
      { regex: /^(lon|longitude|lng)$/i, score: 0.98 },
      { regex: /^(easting|est|east)$/i, score: 0.95 },

      { regex: /(^|[_\s-])(x|lon|longitude|lng)([_\s-]|$)/i, score: 0.90 },

      { regex: /(coord|coordonnee|coordinate).*x/i, score: 0.88 },
      { regex: /x.*(coord|coordonnee|coordinate)/i, score: 0.88 },

      { regex: /(x_l93|x_wgs84|x_gps|x_utm)/i, score: 0.85 },

      { regex: /(^|[_\s-])x([_\s-]|$)/i, score: 0.75 }
    ],

    y: [
      { regex: /^(y|coordy|coord_y|ycoord|y_coord)$/i, score: 1.00 },
      { regex: /^(lat|latitude)$/i, score: 0.98 },
      { regex: /^(northing|nord|north)$/i, score: 0.95 },

      { regex: /(^|[_\s-])(y|lat|latitude)([_\s-]|$)/i, score: 0.90 },

      { regex: /(coord|coordonnee|coordinate).*y/i, score: 0.88 },
      { regex: /y.*(coord|coordonnee|coordinate)/i, score: 0.88 },

      { regex: /(y_l93|y_wgs84|y_gps|y_utm)/i, score: 0.85 },

      { regex: /(^|[_\s-])y([_\s-]|$)/i, score: 0.75 }
    ]
  };

  function scoreField(field, mode) {

    const normalized = normalizeText(field);

    let bestScore = 0;

    for (const rule of rules[mode]) {
      if (rule.regex.test(normalized)) {
        bestScore = Math.max(bestScore, rule.score);
      }
    }

    const numeric = numericRatio(rows, field);
    if (numeric >= 0.95) {
      bestScore += 0.20;
    } else if (numeric >= 0.70) {
      bestScore += 0.10;
    } else if (numeric < 0.30) {
      bestScore -= 0.30;
    }
    if (normalized.length > 30) {
      bestScore -= 0.05;
    }

    return bestScore;
  }

  const xCandidates = headers
    .map(field => ({
      name: field,
      score: scoreField(field, 'x')
    }))
    .sort((a, b) => b.score - a.score);

  const yCandidates = headers
    .map(field => ({
      name: field,
      score: scoreField(field, 'y')
    }))
    .sort((a, b) => b.score - a.score);

  // On cherche la meilleure combinaison X/Y
  let bestPair = null;

  for (const x of xCandidates.slice(0, 10)) {
    for (const y of yCandidates.slice(0, 10)) {

      // X et Y doivent être deux colonnes différentes
      if (x.name === y.name) continue;

      const score = x.score + y.score;

      if (!bestPair || score > bestPair.score) {
        bestPair = {
          x,
          y,
          score
        };
      }
    }
  }

  // Fallback
  if (!bestPair) {
    return {
      x: headers[0]
        ? { name: headers[0], score: 0.20 }
        : null,

      y: headers[1]
        ? { name: headers[1], score: 0.20 }
        : null
    };
  }

  return {
    x: bestPair.x,
    y: bestPair.y
  };
}

// ======================================================
// DÉTECTION AUTOMATIQUE DE L'EPSG
// ======================================================

const EPSG_DETECTION_RULES = [

  // EPSG explicite
  {
    epsg: 'EPSG:2972',
    patterns: [
      /epsg[\s:_-]*2972/i,
      /rgfg95/i,
      /rgfg95.*22/i,
      /utm.*22n/i,
      /guyane/i,
      /guyana/i
    ],
    score: 100
  },

  {
    epsg: 'EPSG:2975',
    patterns: [
      /epsg[\s:_-]*2975/i,
      /rgr92/i,
      /rgr92.*40/i,
      /utm.*40s/i,
      /reunion/i,
      /la reunion/i,
      /réunion/i
    ],
    score: 100
  },

  {
    epsg: 'EPSG:32620',
    patterns: [
      /epsg[\s:_-]*32620/i,
      /wgs84.*20/i,
      /wgs.*84.*20/i,
      /utm.*20n/i,
      /utm20/i,
      /antilles/i,
      /martinique/i,
      /guadeloupe/i
    ],
    score: 100
  },

  {
    epsg: 'EPSG:2154',
    patterns: [
      /epsg[\s:_-]*2154/i,
      /lambert[\s_-]*93/i,
      /lambert93/i,
      /rgf93/i,
      /l93/i
    ],
    score: 100
  },

  {
    epsg: 'EPSG:4326',
    patterns: [
      /epsg[\s:_-]*4326/i,
      /wgs[\s_-]*84/i,
      /wgs84/i,
      /gps/i,
      /latitude/i,
      /longitude/i
    ],
    score: 100
  },

  {
    epsg: 'EPSG:3857',
    patterns: [
      /epsg[\s:_-]*3857/i,
      /web[\s_-]*mercator/i,
      /mercator/i
    ],
    score: 100
  },

  {
    epsg: 'EPSG:32631',
    patterns: [
      /epsg[\s:_-]*32631/i,
      /utm[\s_-]*31n/i,
      /utm31/i
    ],
    score: 100
  },

  {
    epsg: 'EPSG:32632',
    patterns: [
      /epsg[\s:_-]*32632/i,
      /utm[\s_-]*32n/i,
      /utm32/i
    ],
    score: 100
  },

  {
    epsg: 'EPSG:27572',
    patterns: [
      /epsg[\s:_-]*27572/i,
      /lambert.*ii/i,
      /lambert.*2/i,
      /ntf/i
    ],
    score: 100
  }
];

function detectEPSG(fileName, headers, rows, xField, yField) {

  const candidates = [];

  // --------------------------------------------------
  // 1. Recherche textuelle
  // --------------------------------------------------

  const textSources = [
    fileName,
    ...headers
  ];

  // On ajoute également les valeurs des premières lignes
  for (const row of rows.slice(0, 20)) {

    for (const value of Object.values(row)) {

      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ''
      ) {
        textSources.push(String(value));
      }
    }
  }

  const fullText = textSources.join(' | ');

  for (const rule of EPSG_DETECTION_RULES) {

    let matches = 0;

    for (const pattern of rule.patterns) {
      if (pattern.test(fullText)) {
        matches++;
      }
    }

    if (matches > 0) {
      candidates.push({
        epsg: rule.epsg,
        score: rule.score + matches * 5,
        reason: 'information trouvée dans le fichier'
      });
    }
  }

  // --------------------------------------------------
  // 2. Recherche par coordonnées
  // --------------------------------------------------

  if (xField && yField && rows.length) {

    const coordinates = rows
      .map(row => ({
        x: normalizeNumber(row[xField]),
        y: normalizeNumber(row[yField])
      }))
      .filter(p =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y)
      );

    if (coordinates.length) {

      const avgX =
        coordinates.reduce((sum, p) => sum + p.x, 0)
        / coordinates.length;

      const avgY =
        coordinates.reduce((sum, p) => sum + p.y, 0)
        / coordinates.length;

      // WGS84
      if (
        Math.abs(avgX) <= 180 &&
        Math.abs(avgY) <= 90
      ) {
        candidates.push({
          epsg: 'EPSG:4326',
          score: 70,
          reason: 'plage de coordonnées compatible WGS84'
        });
      }

      // Web Mercator
      else if (
        Math.abs(avgX) > 1000000 &&
        Math.abs(avgY) > 1000000
      ) {
        candidates.push({
          epsg: 'EPSG:3857',
          score: 50,
          reason: 'plage de coordonnées compatible Web Mercator'
        });
      }

      // Guyane — RGFG95 / UTM 22N
      else if (
        avgX >= 100000 &&
        avgX <= 900000 &&
        avgY >= 0 &&
        avgY <= 2000000
      ) {
        candidates.push({
          epsg: 'EPSG:2972',
          score: 60,
          reason: 'plage de coordonnées compatible Guyane'
        });
      }

      // Réunion — RGR92 / UTM 40S
      else if (
        avgX >= 200000 &&
        avgX <= 500000 &&
        avgY >= 7000000 &&
        avgY <= 8000000
      ) {
        candidates.push({
          epsg: 'EPSG:2975',
          score: 60,
          reason: 'plage de coordonnées compatible Réunion'
        });
      }

      // Antilles — WGS84 / UTM 20N
      else if (
        avgX >= 100000 &&
        avgX <= 900000 &&
        avgY >= 1000000 &&
        avgY <= 2500000
      ) {
        candidates.push({
          epsg: 'EPSG:32620',
          score: 60,
          reason: 'plage de coordonnées compatible UTM 20N'
        });
      }

      // Lambert 93
      else if (
        avgX >= 0 &&
        avgX <= 1300000 &&
        avgY >= 6000000 &&
        avgY <= 7200000
      ) {
        candidates.push({
          epsg: 'EPSG:2154',
          score: 60,
          reason: 'plage de coordonnées compatible Lambert-93'
        });
      }
    }
  }

  // --------------------------------------------------
  // 3. On choisit le meilleur candidat
  // --------------------------------------------------

  if (!candidates.length) {
    return {
      epsg: 'EPSG:4326',
      score: 0,
      reason: 'Aucune information suffisante'
    };
  }

  candidates.sort((a, b) => b.score - a.score);

  return candidates[0];
}

function setFieldSelects(headers, guessedX, guessedY) {
  const options = headers.map(h => ({
    value: h,
    label: h
  }));

  fillSelect(
    els.xField,
    options,
    guessedX?.name || headers[0]
  );

  fillSelect(
    els.yField,
    options,
    guessedY?.name || headers[1] || headers[0]
  );

  const xText = guessedX
    ? `${guessedX.name} (${guessedX.score.toFixed(2)})`
    : 'non détecté';

  const yText = guessedY
    ? `${guessedY.name} (${guessedY.score.toFixed(2)})`
    : 'non détecté';

  if (els.guessInfo) {
    els.guessInfo.textContent =
      `X : ${xText} · Y : ${yText}`;
  }
}

function parseWorkbook(fileName, workbook) {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  // On retire le dangereux { defval: '' } et on ignore les lignes vides
  const rows = XLSX.utils.sheet_to_json(firstSheet, { blankrows: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { 
    fileName, 
    rows, 
    headers, 
    format: fileName.toLowerCase().endsWith('.csv') ? 'CSV' : 'Excel' 
  };
}

function setLoading(isLoading) {
  if (isLoading) {
    // On vide le tableau précédent
    els.thead.innerHTML = '';
    els.tbody.innerHTML = '';
    
    // On affiche la roue crantée centrale
    if (els.previewLoader) els.previewLoader.style.display = 'flex';
  } else {
    // On cache la roue crantée à la fin du chargement
    if (els.previewLoader) els.previewLoader.style.display = 'none';
  }
}

function parseLargeCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 20,
      complete: function(results) {
        resolve({
          fileName: file.name,
          rows: [],
          headers: results.meta.fields,
          preview: results.data,
          format: 'CSV',
          delimiter: results.meta.delimiter || ';'
        });
      },
      error: reject
    });
  });
}

async function inspectFile(file) {
  try {
    setLoading(true);

    let parsed;
    // Si c'est un CSV, on utilise la lecture optimisée
    if (file.name.toLowerCase().endsWith('.csv')) {
      parsed = await parseLargeCSV(file);
    } 
    // Si c'est un Excel, on garde SheetJS
    else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { blankrows: false });
      parsed = {
        fileName: file.name,
        rows: rows,
        headers: rows.length ? Object.keys(rows[0]) : [],
        format: 'Excel',
        delimiter: 'N/A'
      };
      parsed.preview = parsed.rows.slice(0, 20);
    }

    // Le reste du code ne change pas...
    state.fileName = parsed.fileName;
    state.rows = parsed.rows;          // <-- On stocke TOUTES les lignes ici
    state.headers = parsed.headers;
    
    // On génère le preview seulement si la fonction de parsing ne l'a pas déjà fait
    state.preview = parsed.preview || parsed.rows.slice(0, 20);

    const coordinateGuess = guessCoordinateFields(
      parsed.headers,
      state.preview
    );

    const guessedX = coordinateGuess.x;
    const guessedY = coordinateGuess.y;

    const detectedEPSG = detectEPSG(
      parsed.fileName,
      parsed.headers,
      state.preview,
      guessedX?.name,
      guessedY?.name
    );
    const warnings = [];
    if (!parsed.headers.length) warnings.push('Aucune colonne détectée. Vérifiez le fichier source.');
    if (state.preview.length === 0) warnings.push('Aucune ligne de données détectée.');

    els.currentFile.textContent = parsed.fileName;
    els.baseName.value = parsed.fileName.replace(/\.[^.]+$/, '') + '_reproj';
    els.kpiCols.textContent = parsed.headers.length;
    els.kpiRows.textContent = state.rows.length; // Afficher le total de lignes est plus pertinent !
    els.kpiDelim.textContent = parsed.delimiter;

    renderTable(parsed.headers, state.preview);
    setFieldSelects(parsed.headers, guessedX, guessedY);
    fillSelect(els.epsgIn, EPSG_OPTIONS, detectedEPSG.epsg);

    // Laisser le DOM terminer son rendu avant de recalculer la taille Leaflet
    requestAnimationFrame(() => {
      if (map) {
        map.invalidateSize({ pan: false });
      }

      updateMap();
    });
    
  } catch (e) {
    toast(`Erreur d'analyse : ${String(e)}`, 'error');
  } finally {
    setLoading(false);
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

function transformRows() {

  const xField = els.xField.value;
  const yField = els.yField.value;
  const epsgIn = els.epsgIn.value;
  const epsgOut = els.epsgOut.value;
  const joinXY = els.joinXY.checked;

  console.log('==============================');
  console.log('REPROJECTION');
  console.log('X :', xField);
  console.log('Y :', yField);
  console.log('EPSG source :', epsgIn);
  console.log('EPSG cible :', epsgOut);
  console.log('ND :', joinXY);
  console.log('==============================');

  const outRows = [];
  const rejected = [];

  for (const row of state.rows) {
    const x = normalizeNumber(row[xField]);
    const y = normalizeNumber(row[yField]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      rejected.push(row);
      continue;
    }
  try {

    const [rx, ry] = proj4(epsgIn, epsgOut, [x, y]);
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) {
      throw new Error(
        `Résultat invalide : ${rx}, ${ry}`
      );
    }
    const out = {
      ...row,
      [`${xField}_${epsgOut}`]: rx,
      [`${yField}_${epsgOut}`]: ry
    };

    if (joinXY) {
      out.ND_Geom = `${rx},${ry}`;
    }
    outRows.push(out);
  } catch (e) {
    console.error(
      'Erreur reprojection :',
      {epsgIn, epsgOut, x, y, erreur: e});
    rejected.push(row);}
  }
  return { outRows, rejected };
}

function exportFiles(rows) {
  const baseName = (els.baseName.value || 'reprojection_resultat').trim();
  const links = [];

  if (els.exportCsv.checked) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const csvName = `${baseName}.csv`;
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), csvName);
    links.push(csvName);
  }

  if (els.exportXlsx.checked) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Reprojection');
    const array = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const xlsxName = `${baseName}.xlsx`;
    downloadBlob(new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), xlsxName);
    links.push(xlsxName);
  }

  return links;
}

els.dropzone?.addEventListener('click', () => els.fileInput.click());
els.fileInput?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    state.file = file; 
    inspectFile(file);
  }
});

// Drag & drop sécurisé
if (els.dropzone) {
  ['dragenter', 'dragover'].forEach((evt) =>
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.style.transform = 'scale(1.01)';
    }),
  );

  ['dragleave', 'drop'].forEach((evt) =>
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.style.transform = 'scale(1)';
    }),
  );

    // Dans la zone de drag & drop :
    els.dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) {
        state.file = file; 
        inspectFile(file);
    }
    });
}

els.runBtn?.addEventListener('click', async () => {
  const file = state.file; // On récupère le fichier sauvegardé
  if (!file) return toast('Importez un fichier avant de lancer.', 'error');

  // Sécurité anti-crash pour les fichiers Excel
  if (!file.name.toLowerCase().endsWith('.csv') && file.size > 50 * 1024 * 1024) {
    return toast('Ce fichier Excel est trop lourd pour le navigateur. Veuillez le convertir en CSV pour le traiter.', 'error');
  }

  // Si c'est un CSV, on lance le flux
  if (file.name.toLowerCase().endsWith('.csv')) {
    if (!window.showSaveFilePicker) {
      toast("L'écriture directe sur disque n'est pas supportée par votre navigateur (ou vous n'êtes pas en HTTPS). Le traitement va se faire en mémoire.", "warn");
      await processCSV_RAM(file);
      return;
    }
    await processHugeCSV(file);
    return;
  }

  // --- TRAITEMENT EXCEL NORMAL (pour les petits fichiers) ---
  try {
    const { outRows, rejected } = transformRows();
    const files = exportFiles(outRows);
    const warnings = rejected.length
      ? `<div class="alert warn">${rejected.length} ligne(s) ignorée(s) car les coordonnées étaient invalides.</div>`
      : '';
    els.result.innerHTML = `
      <div class="stack downloads">
        <div class="alert warn">
          <strong>Traitement terminé.</strong><br>
          Lignes traitées : ${outRows.length} · Lignes rejetées : ${rejected.length}
        </div>
        <div class="panel pad stack">
          <div>Exports : ${files.map(escapeHtml).join(', ')}</div>
          <div class="muted">Fichiers téléchargés dans votre navigateur.</div>
        </div>
        ${warnings}
      </div>
    `;
  } catch (e) {
    toast(`Erreur de reprojection : ${String(e)}`, 'error');
  }
});

fillSelect(els.epsgIn, EPSG_OPTIONS, 'EPSG:4326');
fillSelect(els.epsgOut, EPSG_OPTIONS, 'EPSG:2154');

async function processHugeCSV(file) {
  const xField = els.xField.value;
  const yField = els.yField.value;
  const epsgIn = els.epsgIn.value;
  const epsgOut = els.epsgOut.value;
  const joinXY = els.joinXY.checked;

  try {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: els.baseName.value + '.csv',
      types: [{ description: 'Fichier CSV', accept: { 'text/csv': ['.csv'] } }],
    });
    
    const writableStream = await fileHandle.createWritable();
    
    setLoading(true);
    let processedCount = 0;
    let isFirstChunk = true;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      chunkSize: 1024 * 1024, // Des blocs de 1Mo pour préserver la RAM
      chunk: async function(results, parser) {
        parser.pause(); 
        
        const outRows = [];
        
        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          const x = normalizeNumber(row[xField]);
          const y = normalizeNumber(row[yField]);
          
          if (Number.isFinite(x) && Number.isFinite(y)) {
           try {
            const [rx, ry] = proj4(
              epsgIn,
              epsgOut,
              [x, y]
            );
            if (!Number.isFinite(rx) || !Number.isFinite(ry)) {
              throw new Error(
                `Coordonnées de sortie invalides : ${rx}, ${ry}`
              );
            }
            const out = {
              ...row,
              [`${xField}_${epsgOut}`]: rx,
              [`${yField}_${epsgOut}`]: ry
            };

            if (joinXY) {
              out.ND_Geom = `${rx},${ry}`;}
            outRows.push(out);
          } catch (e) {
            console.error(
              'Erreur reprojection CSV :',
              {epsgIn, epsgOut, x, y, erreur: e.message }
            );
          }
          }
        }

        if (outRows.length > 0) {
          const csvText = Papa.unparse(outRows, { header: isFirstChunk });
          await writableStream.write(csvText + '\n');
          processedCount += outRows.length;
          isFirstChunk = false;
          if (els.guessInfo) els.guessInfo.textContent = `Écriture : ${processedCount} lignes...`;
        }

        // VITAL POUR ÉVITER LE CRASH : On force le vidage de la RAM
        results.data = [];
        outRows.length = 0;

        setTimeout(() => {
            parser.resume();
        }, 20); // Délai augmenté pour laisser le Garbage Collector travailler
      },
      complete: async function() {
        await writableStream.close();
        setLoading(false);
        toast(`Succès ! ${processedCount} lignes traitées et écrites directement sur le disque.`, 'success');
      },
      error: async function(err) {
        await writableStream.close();
        setLoading(false);
        toast(`Erreur pendant la lecture : ${err}`, 'error');
      }
    });

  } catch (error) {
    setLoading(false);
    if (error.name !== 'AbortError') {
      toast(`Erreur système : ${error.message}`, 'error');
    }
  }
}

//  autre solution
async function processCSV_RAM(file) {
  setLoading(true);
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      state.rows = results.data;
      try {
        const { outRows, rejected } = transformRows();
        const files = exportFiles(outRows);
        els.result.innerHTML = `
          <div class="stack downloads">
            <div class="alert warn">
              <strong>Traitement CSV (Mémoire) terminé.</strong><br>
              Lignes traitées : ${outRows.length}
            </div>
            <div class="panel pad stack">
              <div>Exports : ${files.map(escapeHtml).join(', ')}</div>
            </div>
          </div>`;
      } catch (e) {
        toast(`Erreur : ${e}`, 'error');
      } finally {
        setLoading(false);
      }
    }
  });
}

// --- INITIALISATION DE LA CARTE ---
function initMap() {
  map = L.map('leafletMap').setView([46.2276, 2.2137], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Important : le conteneur peut ne pas avoir sa taille finale
  // au moment de l'initialisation de Leaflet.
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

function updateMap() {
  if (!map) return;

  map.invalidateSize({ pan: false });

  mapMarkers.forEach(m => map.removeLayer(m));
  mapMarkers = [];

  const xField = els.xField.value;
  const yField = els.yField.value;
  const epsgIn = els.epsgIn.value;

  if (!xField || !yField || !epsgIn || state.preview.length === 0) return;

  const bounds = L.latLngBounds();
  let validPoints = 0;

  // 2. On parcourt les 20 lignes de l'aperçu
  state.preview.forEach(row => {
    const x = normalizeNumber(row[xField]);
    const y = normalizeNumber(row[yField]);

    if (Number.isFinite(x) && Number.isFinite(y)) {
      try {
        // La carte a besoin de coordonnées GPS (WGS84 / EPSG:4326)
        const [lng, lat] = proj4(epsgIn, 'EPSG:4326', [x, y]);
        
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90) {
           // On dessine un cercle orange (#f97316) pour chaque point
           const marker = L.circleMarker([lat, lng], {
             radius: 6,
             fillColor: '#f97316',
             color: '#fff',
             weight: 1,
             opacity: 1,
             fillOpacity: 0.8
           }).addTo(map);
           
           // Infobulle au survol
           marker.bindTooltip(`X: ${x}<br>Y: ${y}`);
           
           bounds.extend([lat, lng]);
           mapMarkers.push(marker);
           validPoints++;
        }
      } catch (e) {
        // Point ignoré si la reprojection échoue
      }
    }
  });

 
  if (validPoints > 0) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  } else {
    map.setView([46.2276, 2.2137], 5);
  }
}

initMap();

window.addEventListener('resize', () => {
  if (map) {
    map.invalidateSize({ pan: false });
  }
});

els.xField.addEventListener('change', updateMap);
els.yField.addEventListener('change', updateMap);
els.epsgIn.addEventListener('change', updateMap);