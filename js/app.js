const invoke = window.__TAURI__?.core?.invoke;
const openDialog = window.__TAURI__?.dialog?.open;

const state = {
  filePath: '',
  headers: [],
  preview: [],
};

const byId = (id) => document.getElementById(id);
const els = {
  themeToggle: byId('themeToggle'),
  pickFileBtn: byId('pickFileBtn'),
  pickFolderBtn: byId('pickFolderBtn'),
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
  outputFolder: byId('outputFolder'),
  warnings: byId('warnings'),
  thead: byId('thead'),
  tbody: byId('tbody'),
  result: byId('result'),
  guessInfo: byId('guessInfo'),
  joinXY: byId('joinXY'),
  exportCsv: byId('exportCsv'),
  exportXlsx: byId('exportXlsx'),
};

if (!invoke || !openDialog) {
  console.warn('Tauri non disponible : les appels backend sont désactivés.');
}

const theme = { value: 'dark' };
els.themeToggle?.addEventListener('click', () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme.value);
});

function toast(message, kind = 'warn') {
  els.result.innerHTML = `<div class="alert ${kind}">${message}</div>`;
}

function fillSelect(select, values, selected) {
  if (!select) return;
  select.innerHTML = values
    .map((v) => {
      const value = v.code ?? v.value ?? v;
      const label = v.label ?? v;
      return `<option value="${value}">${label}</option>`;
    })
    .join('');
  if (selected) {
    select.value = selected;
  }
}

async function loadEpsg() {
  try {
    const options = await invoke('epsg_options');
    fillSelect(els.epsgIn, options, 'EPSG:4326');
    fillSelect(els.epsgOut, options, 'EPSG:2154');
  } catch (e) {
    toast(`Impossible de charger les EPSG : ${String(e)}`, 'error');
  }
}

function renderWarnings(list = []) {
  els.warnings.innerHTML = list
    .map((w) => `<div class="alert warn">${w}</div>`)
    .join('');
}

function renderTable(headers, rows) {
  els.thead.innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  els.tbody.innerHTML = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((h) => `<td>${(r[h] ?? '').toString()}</td>`)
          .join('')}</tr>`,
    )
    .join('');
}

function setFieldSelects(headers, guessedX, guessedY) {
  const options = headers.map((h) => ({ value: h, label: h }));
  fillSelect(els.xField, options, guessedX?.name || headers[0]);
  fillSelect(els.yField, options, guessedY?.name || headers[1] || headers[0]);

  const xText = guessedX ? `${guessedX.name} (${guessedX.score})` : 'non détecté';
  const yText = guessedY ? `${guessedY.name} (${guessedY.score})` : 'non détecté';
  els.guessInfo.textContent = `Détection automatique : X = ${xText} · Y = ${yText}`;
}

async function inspect(path) {
  if (!path) return;
  try {
    const data = await invoke('inspect_file', { path });

    state.filePath = path;
    state.headers = data.headers;
    state.preview = data.preview;

    els.currentFile.textContent = data.file_name;
    els.kpiCols.textContent = data.headers.length;
    els.kpiRows.textContent = data.preview.length;
    els.kpiDelim.textContent = data.delimiter || 'Excel';

    renderWarnings(data.warnings || []);
    renderTable(data.headers, data.preview);
    setFieldSelects(data.headers, data.guessed_x, data.guessed_y);

    toast('Fichier analysé avec succès.', 'warn');
  } catch (e) {
    toast(`Erreur d'analyse : ${String(e)}`, 'error');
  }
}

els.pickFileBtn?.addEventListener('click', async () => {
  try {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: 'Données', extensions: ['csv', 'xlsx', 'xls'] }],
    });
    if (path) {
      inspect(path);
    }
  } catch (e) {
    toast(`Erreur lors de la sélection du fichier : ${String(e)}`, 'error');
  }
});

els.pickFolderBtn?.addEventListener('click', async () => {
  try {
    const path = await openDialog({ directory: true, multiple: false });
    if (path) {
      els.outputFolder.value = path;
    }
  } catch (e) {
    toast(`Erreur lors de la sélection du dossier : ${String(e)}`, 'error');
  }
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
els.dropzone.addEventListener('drop', async (e) => {
  const path = e.dataTransfer?.files?.[0]?.path;
  if (path) {
    inspect(path);
  }
});

els.runBtn?.addEventListener('click', async () => {
  if (!state.filePath) {
    return toast('Importez un fichier avant de lancer la reprojection.', 'error');
  }
  if (!els.outputFolder.value) {
    return toast('Choisissez un dossier de sortie.', 'error');
  }
  if (!els.exportCsv.checked && !els.exportXlsx.checked) {
    return toast('Sélectionnez au moins un format d’export.', 'error');
  }

  try {
    const res = await invoke('transform_file', {
      req: {
        input_path: state.filePath,
        output_folder: els.outputFolder.value,
        x_field: els.xField.value,
        y_field: els.yField.value,
        epsg_in: els.epsgIn.value,
        epsg_out: els.epsgOut.value,
        export_csv: els.exportCsv.checked,
        export_xlsx: els.exportXlsx.checked,
        join_xy: els.joinXY.checked,
      },
    });

    const outputs = (res.outputs || []).map((p) => `<li>${p}</li>`).join('');
    const warnings = (res.warnings || []).map((w) => `<div class="alert warn">${w}</div>`).join('');

    els.result.innerHTML = `
      <div class="stack">
        <div class="alert warn">
          <strong>Traitement terminé.</strong><br>
          Lignes traitées : ${res.processed_rows} · Lignes rejetées : ${res.rejected_rows}
          <ul>${outputs}</ul>
        </div>
        ${warnings}
      </div>
    `;
  } catch (e) {
    toast(`Erreur de reprojection : ${String(e)}`, 'error');
  }
});

loadEpsg();
