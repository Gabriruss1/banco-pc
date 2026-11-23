/* ==========================================================================
   Banco PC — configuratore
   Logica: stato, compatibilità, auto-build, rendering, dialoghi.
   ========================================================================== */
(() => {
  'use strict';

  const BY_ID = new Map(PARTS.map(p => [p.id, p]));
  const CAT_BY_ID = new Map(CATEGORIES.map(c => [c.id, c]));
  const CORE_CATS = CATEGORIES.filter(c => c.required).map(c => c.id);
  const EXTRA_CATS = CATEGORIES.filter(c => !c.required).map(c => c.id);
  const STORAGE_KEY = 'banco-pc-v1';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const euro = n => '€' + Math.round(n).toLocaleString('it-IT');
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + euro(Math.abs(n));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const P = id => (id ? BY_ID.get(id) : null);
  const partOf = (picks, cat) => P(picks[cat]);

  /* ------------------------------- Stato -------------------------------- */

  const DEFAULT_STATE = { budget: 1500, includeExtras: false, picks: {} };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Number.isFinite(parsed.budget)) {
          const picks = {};
          for (const [cat, id] of Object.entries(parsed.picks || {})) {
            if (CAT_BY_ID.has(cat) && BY_ID.has(id)) picks[cat] = id;
          }
          return { budget: clamp(parsed.budget, 600, 8000), includeExtras: !!parsed.includeExtras, picks };
        }
      }
    } catch (_) { /* storage non disponibile */ }
    return { ...DEFAULT_STATE, picks: {} };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  let state = loadState();

  /* --------------------------- Calcoli di base --------------------------- */

  function total(picks = state.picks) {
    return Object.values(picks).reduce((sum, id) => sum + (P(id)?.price || 0), 0);
  }

  function powerEstimate(picks) {
    const cpu = partOf(picks, 'cpu');
    const gpu = partOf(picks, 'gpu');
    const storage = partOf(picks, 'storage');
    const fans = partOf(picks, 'fans');
    const load = Math.round(
      (cpu ? cpu.tdp * 1.25 : 35) +
      (gpu ? gpu.tdp * 1.2 : 15) +
      55 +
      (storage && storage.kind === 'hdd' ? 10 : 5) +
      (fans ? 6 : 0)
    );
    const recommended = Math.ceil((load * 1.3) / 50) * 50;
    return { load, recommended };
  }

  const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4K': '4K', 'UW': 'ultrawide' };
  const RES_FACTOR = { '1080p': 1.35, '1440p': 1.0, '4K': 0.55, 'UW': 0.85 };

  function fpsEstimate(picks) {
    const gpu = partOf(picks, 'gpu');
    const cpu = partOf(picks, 'cpu');
    const monitor = partOf(picks, 'monitor');
    if (!gpu) return 0;
    const res = monitor?.resolution || '1440p';
    const factor = RES_FACTOR[res] || 1;
    const gpuFps = gpu.score * 1.95 * factor;
    const cpuFps = (cpu ? cpu.score : 40) * 2.35;
    return Math.round(Math.min(gpuFps, cpuFps) / 5) * 5;
  }

  /* --------------------------- Compatibilità ----------------------------- */

  function analyze(picks) {
    const issues = [];
    const add = (level, text, cats) => issues.push({ level, text, cats });
    const cpu = partOf(picks, 'cpu');
    const mobo = partOf(picks, 'mobo');
    const gpu = partOf(picks, 'gpu');
    const ram = partOf(picks, 'ram');
    const psu = partOf(picks, 'psu');
    const pcCase = partOf(picks, 'case');
    const cooler = partOf(picks, 'cooler');
    const monitor = partOf(picks, 'monitor');

    if (!cpu) add('warn', 'Nessun processore selezionato.', ['cpu']);
    if (!mobo) add('warn', 'Nessuna scheda madre selezionata.', ['mobo']);
    if (!gpu) add('warn', 'Nessuna scheda video selezionata.', ['gpu']);
    if (!ram) add('warn', 'Nessuna memoria RAM selezionata.', ['ram']);
    if (!psu) add('warn', 'Nessun alimentatore selezionato.', ['psu']);
    if (!pcCase) add('warn', 'Nessun case selezionato.', ['case']);
    if (!cooler && cpu) add('warn', 'Nessun dissipatore selezionato.', ['cooler']);

    if (cpu && mobo && cpu.socket !== mobo.socket) {
      add('error', `Socket incompatibile: ${cpu.socket} sulla CPU, ${mobo.socket} sulla scheda madre.`, ['cpu', 'mobo']);
    }
    if (ram && mobo && ram.type !== mobo.ramType) {
      add('error', `La RAM è ${ram.type} ma la scheda madre vuole ${mobo.ramType}.`, ['ram', 'mobo']);
    }
    if (mobo && pcCase && !pcCase.formFactors.includes(mobo.formFactor)) {
      add('error', `Il case non supporta il formato ${mobo.formFactor}.`, ['mobo', 'case']);
    }
    if (gpu && pcCase && gpu.length > pcCase.maxGpu) {
      add('error', `La GPU è lunga ${gpu.length} mm, il case arriva a ${pcCase.maxGpu} mm.`, ['gpu', 'case']);
    }
    if (cooler && pcCase) {
      if (cooler.kind === 'air' && cooler.height > pcCase.maxCooler) {
        add('error', `Il dissipatore è alto ${cooler.height} mm, il case arriva a ${pcCase.maxCooler} mm.`, ['cooler', 'case']);
      }
      if (cooler.kind === 'aio' && !pcCase.radiators.includes(cooler.radiator)) {
        add('error', `Il case non ospita un radiatore da ${cooler.radiator} mm.`, ['cooler', 'case']);
      }
    }
    if (cooler && cpu) {
      if (!cooler.sockets.includes(cpu.socket)) {
        add('error', `Il dissipatore non supporta il socket ${cpu.socket}.`, ['cooler', 'cpu']);
      } else if (cooler.tdp < cpu.tdp * 1.05) {
        add('warn', `Dissipatore al limite: ${cooler.tdp} W per una CPU da ${cpu.tdp} W.`, ['cooler', 'cpu']);
      }
    }
    if (psu) {
      const { load, recommended } = powerEstimate(picks);
      if (psu.watt < load) {
        add('error', `Alimentatore sottodimensionato: ${psu.watt} W per un carico di circa ${load} W.`, ['psu', 'gpu', 'cpu']);
      } else if (psu.watt < recommended) {
        add('warn', `Margine stretto: ${psu.watt} W, consigliati ${recommended} W.`, ['psu', 'gpu', 'cpu']);
      }
    }
    if (monitor && gpu) {
      if (monitor.resolution === '4K' && gpu.score < 60) {
        add('warn', 'GPU poco potente per giocare in 4K: meglio 1440p.', ['monitor', 'gpu']);
      } else if (monitor.resolution === '1440p' && gpu.score < 38) {
        add('warn', 'Per il 1440p questa GPU è al limite: meglio 1080p.', ['monitor', 'gpu']);
      }
    }
    if (ram && ram.capacity <= 16 && ['1440p', '4K'].includes(monitor?.resolution)) {
      add('warn', '16 GB di RAM bastano, ma 32 GB sono più future-proof.', ['ram']);
    }
    if (cpu && !cpu.igpu && !gpu) {
      add('error', 'Questa CPU non ha grafica integrata: serve una scheda video.', ['cpu', 'gpu']);
    }
    return issues;
  }

  /* ----------------------------- Auto-build ------------------------------ */

  const recipeTotal = picks => total(picks);

  function cheapestPsu(minWatt) {
    return PARTS.filter(p => p.cat === 'psu' && p.watt >= minWatt)
      .sort((a, b) => a.price - b.price || b.watt - a.watt)[0] || null;
  }

  function cheapestCooler(cpu, pcCase) {
    return PARTS.filter(p => {
      if (p.cat !== 'cooler' || !p.sockets.includes(cpu.socket)) return false;
      if (p.tdp < cpu.tdp) return false;
      if (!pcCase) return true;
      if (p.kind === 'air') return p.height <= pcCase.maxCooler;
      return pcCase.radiators.includes(p.radiator);
    }).sort((a, b) => a.price - b.price)[0] || null;
  }

  function bestGpuUpgrade(picks, cap) {
    const cur = partOf(picks, 'gpu');
    if (!cur) return null;
    const pcCase = partOf(picks, 'case');
    const psu = partOf(picks, 'psu');
    const rem = cap - total(picks);
    let best = null;
    for (const g of PARTS) {
      if (g.cat !== 'gpu' || g.score <= cur.score) continue;
      const delta = g.price - cur.price;
      if (delta <= 0 || delta > rem) continue;
      if (pcCase && g.length > pcCase.maxGpu) continue;
      let psuUpgrade = null;
      let extra = 0;
      if (psu) {
        const { recommended } = powerEstimate({ ...picks, gpu: g.id });
        if (psu.watt < recommended) {
          psuUpgrade = cheapestPsu(recommended);
          if (!psuUpgrade) continue;
          extra = Math.max(0, psuUpgrade.price - psu.price);
        }
      }
      if (delta + extra > rem) continue;
      if (!best || g.score > best.gpu.score) best = { gpu: g, psu: psuUpgrade };
    }
    return best;
  }

  function bestCpuUpgrade(picks, cap) {
    const cur = partOf(picks, 'cpu');
    const mobo = partOf(picks, 'mobo');
    const pcCase = partOf(picks, 'case');
    const cooler = partOf(picks, 'cooler');
    if (!cur || !mobo) return null;
    const rem = cap - total(picks);
    let best = null;
    for (const c of PARTS) {
      if (c.cat !== 'cpu' || c.socket !== mobo.socket || c.score <= cur.score) continue;
      const delta = c.price - cur.price;
      if (delta <= 0 || delta > rem) continue;
      let coolerUpgrade = null;
      let extra = 0;
      if (!cooler || cooler.tdp < c.tdp) {
        coolerUpgrade = cheapestCooler(c, pcCase);
        if (!coolerUpgrade) continue;
        extra = Math.max(0, coolerUpgrade.price - (cooler?.price || 0));
      }
      if (delta + extra > rem) continue;
      if (!best || c.score > best.cpu.score) best = { cpu: c, cooler: coolerUpgrade };
    }
    return best;
  }

  function pickExtras(picks) {
    const out = { ...picks };
    let rem = state.budget - total(out);
    const gpu = partOf(out, 'gpu');
    const prefs = !gpu ? ['1080p'] :
      gpu.score >= 78 ? ['4K', '1440p'] :
      gpu.score >= 55 ? ['1440p', 'UW', '1080p'] : ['1080p'];

    const monitors = PARTS.filter(p => p.cat === 'monitor');
    const budgetForMonitor = Math.max(0, rem * 0.72);
    const monitor =
      monitors.filter(m => prefs.includes(m.resolution) && m.price <= budgetForMonitor).sort((a, b) => b.price - a.price)[0] ||
      monitors.filter(m => m.price <= budgetForMonitor).sort((a, b) => b.price - a.price)[0];
    if (monitor) {
      out.monitor = monitor.id;
      rem -= monitor.price;
    }

    if (rem >= 200) {
      out.keyboard = 'kb-mech';
      out.mouse = 'mouse-mid';
      out.headset = 'headset-mid';
      rem -= 200;
      if (rem >= 70) out.keyboard = 'kb-premium';
    } else if (rem >= 85) {
      out.keyboard = 'kb-budget';
      out.mouse = 'mouse-budget';
      out.headset = 'headset-budget';
    }
    return out;
  }

  function computeBuild() {
    const extrasReserve = state.includeExtras
      ? Math.min(clamp(state.budget * 0.22, 200, 700), Math.max(0, state.budget - 590))
      : 0;
    const coreCap = state.budget - extrasReserve;

    let recipe = RECIPES[0];
    for (const r of RECIPES) {
      if (recipeTotal(r.picks) <= coreCap) recipe = r;
    }
    let picks = { ...recipe.picks };

    for (let i = 0; i < 6; i++) {
      let changed = false;
      const g = bestGpuUpgrade(picks, coreCap);
      if (g) {
        picks = { ...picks, gpu: g.gpu.id };
        if (g.psu) picks.psu = g.psu.id;
        changed = true;
      }
      const c = bestCpuUpgrade(picks, coreCap);
      if (c) {
        picks = { ...picks, cpu: c.cpu.id };
        if (c.cooler) picks.cooler = c.cooler.id;
        changed = true;
      }
      if (!changed) break;
    }

    if (state.budget >= 1000 && coreCap - total(picks) >= 120) {
      picks.os = 'os-win11-home';
    }
    if (state.includeExtras) picks = pickExtras(picks);
    return picks;
  }

  function autoBuild({ toastMsg = 'Build rigenerata per il tuo budget.' } = {}) {
    state.picks = computeBuild();
    saveState();
    renderAll();
    if (toastMsg) toast(toastMsg);
  }

  let recCache = { key: '', picks: null };
  function getRecommended() {
    const key = state.budget + '|' + state.includeExtras;
    if (recCache.key !== key) recCache = { key, picks: computeBuild() };
    return recCache.picks;
  }

  /* ------------------------------- Render -------------------------------- */

  const els = {
    budgetNumber: $('#budgetNumber'),
    presets: $$('#presets [data-budget]'),
    caliper: $('#caliper'),
    caliperFill: $('#caliperFill'),
    caliperNeedle: $('#caliperNeedle'),
    caliperTicks: $('#caliperTicks'),
    caliperScale: $('#caliperScale'),
    caliperTotal: $('#caliperTotal'),
    caliperBudget: $('#caliperBudget'),
    budgetHint: $('#budgetHint'),
    includeExtras: $('#includeExtras'),
    sheetList: $('#sheetList'),
    sheetCount: $('#sheetCount'),
    sumTotal: $('#sumTotal'),
    sumBudgetLine: $('#sumBudgetLine'),
    sumChart: $('#sumChart'),
    sumFps: $('#sumFps'),
    sumFpsLabel: $('#sumFpsLabel'),
    sumPower: $('#sumPower'),
    sumPowerLabel: $('#sumPowerLabel'),
    sumPsu: $('#sumPsu'),
    sumPsuLabel: $('#sumPsuLabel'),
    sumIssues: $('#sumIssues'),
    sumOver: $('#sumOver'),
    optimize: $('#btnOptimize'),
    copy: $('#btnCopy'),
    share: $('#btnShare'),
    reset: $('#btnReset'),
    picker: $('#picker'),
    pickerTitle: $('#pickerTitle'),
    pickerSub: $('#pickerSub'),
    pickerList: $('#pickerList'),
    pickerSearch: $('#pickerSearch'),
    pickerSort: $('#pickerSort'),
    pickerOnly: $('#pickerOnlyCompatible'),
    pickerClear: $('#pickerClear'),
    pickerCount: $('#pickerCount'),
    help: $('#helpDialog'),
    toast: $('#toast')
  };

  function renderBudget() {
    els.budgetNumber.value = state.budget;
    els.includeExtras.checked = state.includeExtras;

    const spent = total();
    const pct = state.budget > 0 ? clamp((spent / state.budget) * 100, 0, 100) : 0;
    const over = spent > state.budget;

    els.caliperFill.style.width = pct + '%';
    els.caliperFill.classList.toggle('is-over', over);
    els.caliperNeedle.style.left = pct + '%';
    els.caliperNeedle.classList.toggle('is-over', over);
    els.caliperNeedle.classList.toggle('at-start', pct < 12);
    els.caliperNeedle.classList.toggle('at-end', pct > 88);
    els.caliperTotal.textContent = euro(spent);
    els.caliperBudget.textContent = 'budget ' + euro(state.budget);

    // tacche e scala
    const ticks = [];
    const scale = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const major = i % 5 === 0;
      const left = (i / steps) * 100;
      const value = Math.round((state.budget / steps) * i);
      ticks.push(`<span class="tick${major ? ' is-major' : ''}" style="left:${left}%"></span>`);
      if (major) {
        const edge = i === 0 ? ' is-first' : i === steps ? ' is-last' : '';
        scale.push(`<span class="${edge.trim()}" style="left:${left}%">${euro(value)}</span>`);
      }
    }
    els.caliperTicks.innerHTML = ticks.join('');
    els.caliperScale.innerHTML = scale.join('');

    els.presets.forEach(b => b.classList.toggle('is-active', Number(b.dataset.budget) === state.budget));

    const remaining = state.budget - spent;
    els.budgetHint.classList.toggle('is-over', over);
    els.budgetHint.innerHTML = over
      ? `Sei <b>${euro(Math.abs(remaining))}</b> sopra il budget. <button class="link" data-action="optimize">Ottimizza la build</button>`
      : `Restano <b>${euro(Math.max(0, remaining))}</b> da spendere.`;

    els.optimize.textContent = over ? 'Rientra nel budget' : 'Ottimizza per il budget';
  }

  function renderSheet() {
    const issues = analyze(state.picks);
    const flagged = new Set();
    for (const issue of issues) {
      if (issue.level === 'error' || issue.level === 'warn') issue.cats.forEach(c => flagged.add(c));
    }

    const rows = [];
    let coreCount = 0;
    let extraCount = 0;

    CATEGORIES.forEach((cat, index) => {
      const part = partOf(state.picks, cat.id);
      if (part) {
        if (cat.required) coreCount++; else extraCount++;
      }
      const isExtra = !cat.required;
      const warn = part && flagged.has(cat.id);
      const number = String(index + 1).padStart(2, '0');
      const price = part ? euro(part.price) : '—';
      const body = part
        ? `<span class="slot-part">${escapeHtml(part.name)}</span>
           <span class="slot-specs">${escapeHtml(part.short || '')}</span>`
        : `<span class="slot-part is-empty">Scegli ${cat.label.toLowerCase()}</span>
           <span class="slot-specs">${escapeHtml(cat.hint)}</span>`;

      rows.push(`
        <li>
          <button class="slot${part ? ' is-set' : ''}${isExtra ? ' is-extra' : ''}${warn ? ' is-warn' : ''}" data-cat="${cat.id}" type="button">
            <span class="slot-index">${number}</span>
            <span class="slot-main">
              <span class="slot-cat">${cat.label}${isExtra ? ' <em>extra</em>' : ''}${warn ? ' <i class="warn-dot" title="Controlla la compatibilità"></i>' : ''}</span>
              ${body}
            </span>
            <span class="slot-price">${price}</span>
            <span class="slot-go" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/></svg>
            </span>
          </button>
        </li>`);
    });

    els.sheetList.innerHTML = rows.join('');
    els.sheetCount.textContent = `${coreCount}/${CORE_CATS.length} core${extraCount ? ` · ${extraCount} extra` : ''}`;
  }

  function breakdown() {
    const sum = cats => cats.reduce((a, c) => a + (P(state.picks[c])?.price || 0), 0);
    return [
      { label: 'Scheda video', value: sum(['gpu']), color: '#ff5a1f' },
      { label: 'CPU e scheda madre', value: sum(['cpu', 'mobo']), color: '#5b93bd' },
      { label: 'RAM e archiviazione', value: sum(['ram', 'storage']), color: '#79b3a0' },
      { label: 'Alimentatore, case, cooling', value: sum(['psu', 'case', 'cooler', 'fans']), color: '#c3cfd6' },
      { label: 'Sistema, monitor, accessori', value: sum(['os', 'monitor', 'keyboard', 'mouse', 'headset']), color: '#e8b23a' }
    ].filter(g => g.value > 0);
  }

  function renderSummary() {
    const spent = total();
    const remaining = state.budget - spent;
    const over = remaining < 0;
    els.sumTotal.textContent = euro(spent);
    els.sumBudgetLine.innerHTML = over
      ? `<span class="is-over">${euro(Math.abs(remaining))} sopra il budget</span>`
      : `${euro(remaining)} sotto il budget`;
    els.sumOver.classList.toggle('is-visible', over);

    const groups = breakdown();
    if (groups.length) {
      const bar = groups.map(g =>
        `<span style="width:${(g.value / spent) * 100}%;background:${g.color}" title="${g.label}: ${euro(g.value)}"></span>`
      ).join('');
      const legend = groups.map(g =>
        `<li><i style="background:${g.color}"></i><span>${g.label}</span><b>${euro(g.value)}</b></li>`
      ).join('');
      els.sumChart.innerHTML = `<div class="chart-bar">${bar}</div><ul class="chart-legend">${legend}</ul>`;
    } else {
      els.sumChart.innerHTML = '<p class="chart-empty">La build è vuota. Imposta un budget e genera una proposta.</p>';
    }

    const fps = fpsEstimate(state.picks);
    const monitor = partOf(state.picks, 'monitor');
    els.sumFps.textContent = fps ? '~' + fps : '—';
    els.sumFpsLabel.textContent = fps ? 'fps a ' + RES_LABEL[monitor?.resolution || '1440p'] : 'fps stimati';
    const { load } = powerEstimate(state.picks);
    const psu = partOf(state.picks, 'psu');
    els.sumPower.textContent = load;
    els.sumPowerLabel.textContent = 'W assorbiti';
    els.sumPsu.textContent = psu ? psu.watt : '—';
    els.sumPsuLabel.textContent = psu ? 'W disponibili' : 'alimentatore';

    const issues = analyze(state.picks);
    const errors = issues.filter(i => i.level === 'error');
    const warns = issues.filter(i => i.level === 'warn');
    const shown = [...errors, ...warns].slice(0, 5);

    let issuesHtml;
    if (!shown.length) {
      issuesHtml = `<div class="issue is-ok"><i></i><span>Tutto compatibile. La build è pronta.</span></div>`;
    } else {
      issuesHtml = shown.map(i =>
        `<div class="issue is-${i.level === 'error' ? 'error' : 'warn'}"><i></i><span>${escapeHtml(i.text)}</span></div>`
      ).join('') + (errors.length + warns.length > 5
        ? `<p class="issue-more">+${errors.length + warns.length - 5} altri avvisi</p>` : '');
    }
    if (!state.picks.os) {
      issuesHtml += `<button class="os-hint" data-action="pick-os" type="button">Sistema operativo non incluso. Aggiungi Windows</button>`;
    }
    els.sumIssues.innerHTML = issuesHtml;

    els.optimize.textContent = over ? 'Rientra nel budget' : 'Ottimizza per il budget';
  }

  function renderAll() {
    renderBudget();
    renderSheet();
    renderSummary();
  }

  /* ------------------------------- Picker -------------------------------- */

  let pickerCat = null;
  let pickerSort = 'consigliati';
  let pickerOnlyCompatible = false;
  let pickerQuery = '';

  function baselineIssues() {
    return new Set(analyze(state.picks).map(i => i.text));
  }

  function optionCompatibility(part, baseline) {
    const next = { ...state.picks, [part.cat]: part.id };
    const issues = analyze(next).filter(i => i.cats.includes(part.cat) && !baseline.has(i.text));
    const error = issues.find(i => i.level === 'error');
    if (error) return { level: 'error', text: error.text };
    const warn = issues.find(i => i.level === 'warn');
    if (warn) return { level: 'warn', text: warn.text };
    return { level: 'ok', text: 'Compatibile' };
  }

  function openPicker(catId) {
    pickerCat = catId;
    pickerSort = 'consigliati';
    pickerOnlyCompatible = false;
    pickerQuery = '';
    els.pickerSearch.value = '';
    els.pickerSort.value = 'consigliati';
    els.pickerOnly.checked = false;
    renderPicker();
    if (!els.picker.open) els.picker.showModal();
    setTimeout(() => els.pickerSearch.focus(), 30);
  }

  function renderPicker() {
    const cat = CAT_BY_ID.get(pickerCat);
    const current = partOf(state.picks, pickerCat);
    els.pickerTitle.textContent = 'Scegli ' + cat.label.toLowerCase();
    els.pickerSub.innerHTML = current
      ? `Ora: <b>${escapeHtml(current.name)}</b> · ${euro(current.price)}`
      : `Nessun componente selezionato · ${escapeHtml(cat.hint)}`;

    const baseline = baselineIssues();
    const recommended = getRecommended()[pickerCat];
    const q = pickerQuery.trim().toLowerCase();

    let options = PARTS.filter(p => p.cat === pickerCat);
    if (q) {
      options = options.filter(p =>
        (p.name + ' ' + (p.short || '') + ' ' + (p.specs || []).join(' ')).toLowerCase().includes(q)
      );
    }

    const decorated = options.map(p => {
      const compat = optionCompatibility(p, baseline);
      const newTotal = total({ ...state.picks, [pickerCat]: p.id });
      return { part: p, compat, newTotal };
    });

    let list = decorated;
    if (pickerOnlyCompatible) list = list.filter(o => o.compat.level !== 'error');

    if (pickerSort === 'price-asc') list.sort((a, b) => a.part.price - b.part.price);
    else if (pickerSort === 'price-desc') list.sort((a, b) => b.part.price - a.part.price);
    else if (pickerSort === 'score') {
      const metric = p => p.score ?? p.capacity ?? p.watt ?? p.refresh ?? p.price;
      list.sort((a, b) => metric(b.part) - metric(a.part));
    }
    else {
      list.sort((a, b) => {
        if (a.part.id === recommended) return -1;
        if (b.part.id === recommended) return 1;
        return a.part.price - b.part.price;
      });
    }

    const cards = [];
    if (!cat.required) {
      cards.push(`
        <li>
          <div class="option option-none">
            <button class="opt-body" data-part="" type="button">
              <span class="opt-check" aria-hidden="true"></span>
              <span class="opt-main">
                <span class="opt-name">Nessuno</span>
                <span class="opt-specs">Non includere ${cat.label.toLowerCase()} nella build</span>
              </span>
              <span class="opt-price"><strong>€0</strong><small>${current ? signed(-current.price) : ''}</small></span>
            </button>
          </div>
        </li>`);
    }

    for (const { part, compat, newTotal } of list) {
      const delta = current ? part.price - current.price : part.price;
      const isCurrent = current?.id === part.id;
      const overBudget = newTotal > state.budget;
      const tags = [];
      if (part.id === recommended) tags.push('<span class="tag tag-rec">Consigliato</span>');
      if (part.tag) tags.push(`<span class="tag">${escapeHtml(part.tag)}</span>`);
      if (isCurrent) tags.push('<span class="tag tag-current">Selezionato</span>');
      cards.push(`
        <li>
          <div class="option${isCurrent ? ' is-current' : ''}${part.id === recommended ? ' is-recommended' : ''}">
            <button class="opt-body" data-part="${part.id}" type="button">
              <span class="opt-check" aria-hidden="true"></span>
              <span class="opt-main">
                <span class="opt-name">${escapeHtml(part.name)}</span>
                <span class="opt-specs">${(part.specs || []).map(escapeHtml).join(' · ')}</span>
                <span class="opt-meta">
                  <span class="compat compat-${compat.level}"><i></i>${escapeHtml(compat.text)}</span>
                  ${tags.join('')}
                  ${overBudget ? `<span class="tag tag-over">${euro(newTotal - state.budget)} sopra budget</span>` : ''}
                </span>
              </span>
              <span class="opt-price">
                <strong>${euro(part.price)}</strong>
                <small class="${delta < 0 ? 'is-down' : ''}">${current ? (delta === 0 ? '—' : signed(delta)) : ''}</small>
              </span>
            </button>
            ${part.amazon ? `<a class="opt-amazon" href="${escapeHtml(part.amazon)}" target="_blank" rel="noopener noreferrer" title="Apri il prodotto su Amazon.it">Vedi su Amazon
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>
            </a>` : ''}
          </div>
        </li>`);
    }

    els.pickerList.innerHTML = cards.join('') ||
      '<li class="picker-empty">Nessun componente con questi filtri.</li>';
    els.pickerCount.textContent = `${list.length} opzioni`;

    if (!cat.required) els.pickerClear.hidden = false;
    else els.pickerClear.hidden = true;
  }

  function choosePart(id) {
    if (id) state.picks[pickerCat] = id;
    else delete state.picks[pickerCat];
    saveState();
    renderAll();
    els.picker.close();
  }

  /* ------------------------------- Toast --------------------------------- */

  let toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2600);
  }

  /* --------------------------- Export / share ---------------------------- */

  function summaryText() {
    const lines = [];
    lines.push('BANCO PC — la mia configurazione');
    lines.push('Budget: ' + euro(state.budget));
    for (const cat of CATEGORIES) {
      const part = partOf(state.picks, cat.id);
      if (part) lines.push(`${cat.label}: ${part.name} — ${euro(part.price)}`);
    }
    lines.push('—'.repeat(28));
    lines.push('Totale: ' + euro(total()));
    const fps = fpsEstimate(state.picks);
    if (fps) lines.push(`Stima: ~${fps} fps a ${RES_LABEL[partOf(state.picks, 'monitor')?.resolution || '1440p']}`);
    const { load, recommended } = powerEstimate(state.picks);
    lines.push(`Consumo stimato: ${load} W · alimentatore consigliato: ${recommended} W`);
    const issues = analyze(state.picks).filter(i => i.level === 'error');
    lines.push(issues.length ? 'Attenzione: ' + issues.map(i => i.text).join(' ') : 'Compatibilità: tutto ok');
    lines.push('');
    lines.push('Prezzi indicativi — novembre 2026.');
    return lines.join('\n');
  }

  function encodeState() {
    const payload = {
      b: state.budget,
      e: state.includeExtras ? 1 : 0,
      p: state.picks
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64;
  }

  function decodeState(hash) {
    try {
      const raw = hash.replace(/^#build=/, '');
      if (!raw) return null;
      const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(escape(atob(b64)));
      const data = JSON.parse(json);
      if (!data || !Number.isFinite(data.b)) return null;
      const picks = {};
      for (const [cat, id] of Object.entries(data.p || {})) {
        if (CAT_BY_ID.has(cat) && BY_ID.has(id)) picks[cat] = id;
      }
      return { budget: clamp(data.b, 600, 8000), includeExtras: !!data.e, picks };
    } catch (_) {
      return null;
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      area.remove();
      return ok;
    }
  }

  function shareLink() {
    const base = location.protocol === 'file:'
      ? location.href.split('#')[0]
      : location.origin + location.pathname;
    const encoded = encodeState();
    history.replaceState(null, '', '#build=' + encoded);
    copyText(base + '#build=' + encoded).then(ok => {
      toast(ok ? 'Link copiato: incollalo dove vuoi.' : 'Link pronto nella barra degli indirizzi.');
    });
  }

  /* ------------------------------ Eventi --------------------------------- */

  function setBudget(value, { rebuildIfEmpty = false } = {}) {
    const next = clamp(Math.round(Number(value) || 0), 600, 8000);
    state.budget = next;
    saveState();
    renderBudget();
    renderSummary();
    if (rebuildIfEmpty && !Object.keys(state.picks).length) autoBuild({ toastMsg: null });
  }

  els.budgetNumber.addEventListener('change', () => setBudget(els.budgetNumber.value));
  els.budgetNumber.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); els.budgetNumber.blur(); }
  });

  els.presets.forEach(btn => {
    btn.addEventListener('click', () => {
      setBudget(btn.dataset.budget);
      els.presets.forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });

  els.includeExtras.addEventListener('change', () => {
    state.includeExtras = els.includeExtras.checked;
    saveState();
    if (state.includeExtras && !state.picks.monitor) {
      autoBuild({ toastMsg: 'Build rigenerata con monitor e accessori.' });
    } else {
      renderAll();
      toast(state.includeExtras ? 'Il budget riserverà spazio per monitor e accessori.' : 'Monitor e accessori non riservati nel budget.');
    }
  });

  els.sheetList.addEventListener('click', e => {
    const slot = e.target.closest('[data-cat]');
    if (slot) openPicker(slot.dataset.cat);
  });

  els.pickerList.addEventListener('click', e => {
    const option = e.target.closest('[data-part]');
    if (!option) return;
    choosePart(option.dataset.part);
  });

  els.pickerSearch.addEventListener('input', () => {
    pickerQuery = els.pickerSearch.value;
    renderPicker();
  });
  els.pickerSort.addEventListener('change', () => {
    pickerSort = els.pickerSort.value;
    renderPicker();
  });
  els.pickerOnly.addEventListener('change', () => {
    pickerOnlyCompatible = els.pickerOnly.checked;
    renderPicker();
  });
  els.pickerClear.addEventListener('click', () => choosePart(''));

  els.picker.addEventListener('click', e => {
    if (e.target === els.picker) els.picker.close();
  });
  $('#pickerClose').addEventListener('click', () => els.picker.close());

  els.optimize.addEventListener('click', () => autoBuild());
  els.copy.addEventListener('click', () => {
    copyText(summaryText()).then(ok => toast(ok ? 'Riepilogo copiato negli appunti.' : 'Copia non riuscita.'));
  });
  els.share.addEventListener('click', shareLink);
  els.reset.addEventListener('click', () => {
    if (!confirm('Svuotare tutti i componenti scelti?')) return;
    state.picks = {};
    saveState();
    renderAll();
    toast('Build svuotata.');
  });

  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]');
    if (action?.dataset.action === 'optimize') autoBuild();
    if (action?.dataset.action === 'help') els.help.showModal();
    if (action?.dataset.action === 'pick-os') openPicker('os');
  });

  $('#btnHelp').addEventListener('click', () => els.help.showModal());
  $('#btnHelpClose').addEventListener('click', () => els.help.close());
  $('#btnPrint').addEventListener('click', () => window.print());
  els.help.addEventListener('click', e => {
    if (e.target === els.help) els.help.close();
  });

  // Il dialog picker si chiude con Esc in modo nativo.

  /* ------------------------------- Avvio --------------------------------- */

  function init() {
    const fromHash = decodeState(location.hash);
    if (fromHash) {
      state = fromHash;
      saveState();
    } else if (!Object.keys(state.picks).length) {
      state.picks = computeBuild();
      saveState();
    }

    // evidenzia il preset corrispondente
    els.presets.forEach(b => b.classList.toggle('is-active', Number(b.dataset.budget) === state.budget));

    renderAll();

    if (!location.hash && !localStorage.getItem(STORAGE_KEY + '-seen')) {
      try { localStorage.setItem(STORAGE_KEY + '-seen', '1'); } catch (_) {}
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  init();
})();
