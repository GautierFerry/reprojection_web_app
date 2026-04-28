const state = {
  fileName: '',
  rows: [],
  headers: [],
  preview: [],
};

const EPSG_OPTIONS = [
  { code: 'EPSG:4326', label: 'EPSG:4326 — WGS 84 (lon/lat)' },
  { code: 'EPSG:3857', label: 'EPSG:3857 — Web Mercator' },
  { code: 'EPSG:2154', label: 'EPSG:2154 — RGF93 / Lambert-93' },
  { code: 'EPSG:32631', label: 'EPSG:32631 — WGS 84 / UTM zone 31N' },
  { code: 'EPSG:32632', label: 'EPSG:32632 — WGS 84 / UTM zone 32N' },
  { code: 'EPSG:27572', label: 'EPSG:27572 — NTF / Lambert zone II étendu' },
];

proj4.defs('EPSG:2154', '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs +type=crs');
proj4.defs('EPSG:32631', '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs +type=crs');
proj4.defs('EPSG:32632', '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs +type=crs');
proj4.defs('EPSG:27572', '+proj=lcc +lat_0=46.8 +lon_0=0 +lat_1=45.8989188888889 +lat_2=47.6960144444444 +x_0=600000 +y_0=2200000 +ellps=clrk80ign +pm=paris +units=m +no_defs +type=crs');

const byId = (id) => document.getElementById(id);
const els = {
  themeToggle: byId('themeToggle'),
  pickFileBtn: byId('pickFileBtn'),
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
};

const theme = { value: 'dark' };
els.themeToggle?.addEventListener('click', () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme.value);
});

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
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
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
  if (/^-?\d+(,\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  if (/^-?\d{1,3}(?:[ .]\d{3})*(?:,\d+)?$/.test(s)) {
    return Number(s.replace(/[ .](?=\d{3}(\D|$))/g, '').replace(',', '.'));
  }
  return Number(s.replace(',', '.'));
}

function guessField(headers, mode) {
  const patterns = mode === 'x'
    ? [/^x$/i, /lon/i, /long/i, /easting/i, /^est$/i]
    : [/^y$/i, /lat/i, /north/i, /northing/i];
  for (const h of headers) {
    if (patterns.some((p) => p.test(h))) return { name: h, score: 0.95 };
  }
  return headers[mode === 'x' ? 0 : 1]
    ? { name: headers[mode === 'x' ? 0 : 1], score: 0.35 }
    : null;
}

function setFieldSelects(headers, guessedX, guessedY) {
  const options = headers.map((h) => ({ value: h, label: h }));
  fillSelect(els.xField, options, guessedX?.name || headers[0]);
  fillSelect(els.yField, options, guessedY?.name || headers[1] || headers[0]);
  const xText = guessedX ? `${guessedX.name} (${guessedX.score.toFixed(2)})` : 'non détecté';
  const yText = guessedY ? `${guessedY.name} (${guessedY.score.toFixed(2)})` : 'non détecté';
  els.guessInfo.textContent = `Détection automatique : X = ${xText} · Y = ${yText}`;
}

function parseWorkbook(fileName, workbook) {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { fileName, rows, headers, format: fileName.toLowerCase().endsWith('.csv') ? 'CSV' : 'Excel' };
}

async function inspectFile(file) {
  try {
    let parsed;
    if (file.name.toLowerCase().endsWith('.csv')) {
      const text = await file.text();
      const delimiter = detectDelimiter(text);
      const workbook = XLSX.read(text, { type: 'string', FS: delimiter });
      parsed = parseWorkbook(file.name, workbook);
      parsed.delimiter = delimiter === '\t' ? 'Tabulation' : delimiter;
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      parsed = parseWorkbook(file.name, workbook);
      parsed.delimiter = 'Excel';
    }

    state.fileName = parsed.fileName;
    state.rows = parsed.rows;
    state.headers = parsed.headers;
    state.preview = parsed.rows.slice(0, 20);

    const guessedX = guessField(parsed.headers, 'x');
    const guessedY = guessField(parsed.headers, 'y');
    const warnings = [];
    if (!parsed.headers.length) warnings.push('Aucune colonne détectée. Vérifiez le fichier source.');
    if (parsed.rows.length === 0) warnings.push('Aucune ligne de données détectée.');

    els.currentFile.textContent = parsed.fileName;
    els.baseName.value = parsed.fileName.replace(/\.[^.]+$/, '') + '_reproj';
    els.kpiCols.textContent = parsed.headers.length;
    els.kpiRows.textContent = state.preview.length;
    els.kpiDelim.textContent = parsed.delimiter;

    renderWarnings(warnings);
    renderTable(parsed.headers, state.preview);
    setFieldSelects(parsed.headers, guessedX, guessedY);
    toast('Fichier analysé avec succès.', 'warn');
  } catch (e) {
    toast(`Erreur d'analyse : ${String(e)}`, 'error');
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
      const out = { ...row, [`${xField}_${epsgOut}`]: rx, [`${yField}_${epsgOut}`]: ry };
      if (joinXY) out.ND_Geom = `${rx},${ry}`;
      outRows.push(out);
    } catch {
      rejected.push(row);
    }
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

els.pickFileBtn?.addEventListener('click', () => els.fileInput.click());
els.fileInput?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) inspectFile(file);
});

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
els.dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) inspectFile(file);
});

els.runBtn?.addEventListener('click', () => {
  if (!state.rows.length) return toast('Importez un fichier avant de lancer la reprojection.', 'error');
  if (!els.exportCsv.checked && !els.exportXlsx.checked) return toast('Sélectionnez au moins un format d’export.', 'error');

  try {
    const { outRows, rejected } = transformRows();
    const files = exportFiles(outRows);
    const warnings = rejected.length ? `<div class="alert warn">${rejected.length} ligne(s) ignorée(s) car les coordonnées étaient invalides.</div>` : '';
    els.result.innerHTML = `
      <div class="stack downloads">
        <div class="alert warn">
          <strong>Traitement terminé.</strong><br>
          Lignes traitées : ${outRows.length} · Lignes rejetées : ${rejected.length}<br>
          EPSG source : <code>${els.epsgIn.value}</code> · EPSG cible : <code>${els.epsgOut.value}</code>
        </div>
        <div class="panel pad stack">
          <div>Exports déclenchés : ${files.map(escapeHtml).join(', ')}</div>
          <div class="muted">Les fichiers ont été téléchargés dans votre navigateur.</div>
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

loadEpsg();
