/**
 * Winamp Chrome Skin
 * Mercury-metallic panels, EQ-visualizer CPU bars, beveled chrome, organic SVG shapes.
 */

const METADATA = {
  id: 'winamp-chrome',
  name: 'Species 8472',
  author: 'Aerotop',
  description: 'Lava lamp mirror chrome · Frutiger glass · Bioluminescent organic goo',
};

// ── Helpers ──────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function formatBytesPerSec(bytes) {
  if (!bytes || bytes < 0) return '0 B/s';
  return formatBytes(bytes) + '/s';
}

function formatUptime(seconds) {
  if (!seconds) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function cpuColorClass(pct) {
  if (pct >= 80) return 'wc-cpu-hot';
  if (pct >= 50) return 'wc-cpu-warm';
  if (pct >= 20) return 'wc-cpu-mild';
  return 'wc-cpu-cool';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatKB(kb) {
  if (kb >= 1048576) return (kb / 1048576).toFixed(1) + 'G';
  if (kb >= 1024) return (kb / 1024).toFixed(0) + 'M';
  return kb + 'K';
}

function formatTime(startedMs) {
  if (!startedMs) return '0:00';
  const now = Date.now();
  let elapsed = Math.floor((now - new Date(startedMs).getTime()) / 1000);
  if (elapsed < 0) elapsed = 0;
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}.${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}.${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
}

// ── SVG Background ──────────────────────────────────────────
// No SVG background — panels float over fully transparent desktop

function generateBgSVG(width, height) {
  return ''; // Fully transparent
}

// ── Skin State ───────────────────────────────────────────────

let state = {
  container: null,
  elements: {},
  sortColumn: 'cpu',
  sortDirection: 'desc',
  searchQuery: '',
  selectedPid: null,
  treeView: false,
  eqPeaks: [],   // Peak hold values for EQ bars
  lastSnapshot: null,
};

// ── Build DOM ────────────────────────────────────────────────

function buildUI(container) {
  // Load stylesheet
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './skins/winamp-chrome/skin.css';
  link.setAttribute('data-skin', 'winamp-chrome');
  document.head.appendChild(link);

  container.innerHTML = `
    <div class="wc-main">
      <!-- SVG background shape -->
      <div class="wc-bg-shape" id="wc-bg"></div>

      <!-- Floating window controls -->
      <div class="wc-logo-tag">AEROTOP</div>
      <div class="wc-window-controls">
        <button class="wc-window-btn" id="wc-btn-min" title="Minimize">_</button>
        <button class="wc-window-btn" id="wc-btn-max" title="Maximize">□</button>
        <button class="wc-window-btn close" id="wc-btn-close" title="Close">✕</button>
      </div>

      <!-- Content layout -->
      <div class="wc-content">
        <!-- System info top row -->
        <div class="wc-info-row">
          <!-- CPU Panel -->
          <div class="wc-panel" style="flex: 2;">
            <div class="wc-panel-label">CPU</div>
            <div class="wc-cpu-eq" id="wc-cpu-eq"></div>
            <div class="wc-cpu-overall">
            <div class="wc-cpu-pct" id="wc-cpu-pct">0%</div>
              <span class="wc-cpu-model" id="wc-cpu-model">—</span>
            </div>
          </div>

          <!-- Memory Panel -->
          <div class="wc-panel" style="flex: 1;">
            <div class="wc-panel-label">Memory</div>
            <div class="wc-mem-meter">
              <div class="wc-mem-label-row">
                <span>RAM</span>
                <span id="wc-mem-text">0 / 0</span>
              </div>
              <div class="wc-mem-bar-outer">
                <div class="wc-mem-bar-inner ram" id="wc-mem-bar" style="width: 0%"></div>
                <span class="wc-mem-bar-text" id="wc-mem-pct">0%</span>
              </div>
            </div>
            <div class="wc-mem-meter">
              <div class="wc-mem-label-row">
                <span>SWP</span>
                <span id="wc-swap-text">0 / 0</span>
              </div>
              <div class="wc-mem-bar-outer">
                <div class="wc-mem-bar-inner swap" id="wc-swap-bar" style="width: 0%"></div>
                <span class="wc-mem-bar-text" id="wc-swap-pct">0%</span>
              </div>
            </div>
            <!-- Net I/O -->
            <div class="wc-panel-label" style="margin-top: 6px;">Network</div>
            <div id="wc-net-io">
              <div class="wc-io-row">
                <span class="wc-io-arrow up">▲</span>
                <span class="wc-io-value" id="wc-net-tx">0 B/s</span>
                <span class="wc-io-arrow down">▼</span>
                <span class="wc-io-value" id="wc-net-rx">0 B/s</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats bar -->
        <div class="wc-stats-grid">
          <div class="wc-stat-item">
            <div class="wc-stat-value" id="wc-tasks-total">0</div>
            <div class="wc-stat-label">Tasks</div>
          </div>
          <div class="wc-stat-item">
            <div class="wc-stat-value" id="wc-tasks-running">0</div>
            <div class="wc-stat-label">Running</div>
          </div>
          <div class="wc-stat-item">
            <div class="wc-stat-value" id="wc-load-avg">0.0</div>
            <div class="wc-stat-label">Load</div>
          </div>
          <div class="wc-stat-item">
            <div class="wc-stat-value" id="wc-uptime">0m</div>
            <div class="wc-stat-label">Uptime</div>
          </div>
          <div class="wc-stat-item">
            <div class="wc-stat-value" id="wc-temp">—</div>
            <div class="wc-stat-label">Temp</div>
          </div>
        </div>

        <!-- Process table -->
        <div class="wc-panel wc-process-panel">
          <div class="wc-process-toolbar">
            <input type="text" class="wc-search-input" id="wc-search" 
                   placeholder="/ Search processes..." />
            <button class="wc-toolbar-btn" id="wc-btn-tree">F5 Tree</button>
            <button class="wc-toolbar-btn" id="wc-btn-kill">F9 Kill</button>
          </div>
          <div class="wc-process-table-wrap" id="wc-proc-wrap">
            <table class="wc-process-table">
              <thead>
                <tr>
                  <th class="wc-col-pid" data-col="pid">PID <span class="sort-arrow"></span></th>
                  <th class="wc-col-user" data-col="user">User <span class="sort-arrow"></span></th>
                  <th class="wc-col-pri" data-col="priority">PRI <span class="sort-arrow"></span></th>
                  <th class="wc-col-nice" data-col="nice">NI <span class="sort-arrow"></span></th>
                  <th class="wc-col-virt" data-col="memVsz">VIRT <span class="sort-arrow"></span></th>
                  <th class="wc-col-res" data-col="memRss">RES <span class="sort-arrow"></span></th>
                  <th class="wc-col-cpu sorted" data-col="cpu">CPU% <span class="sort-arrow">▼</span></th>
                  <th class="wc-col-mem" data-col="mem">MEM% <span class="sort-arrow"></span></th>
                  <th class="wc-col-state" data-col="state">S <span class="sort-arrow"></span></th>
                  <th class="wc-col-time" data-col="started">TIME+ <span class="sort-arrow"></span></th>
                  <th class="wc-col-cmd" data-col="command">Command <span class="sort-arrow"></span></th>
                </tr>
              </thead>
              <tbody id="wc-proc-body"></tbody>
            </table>
          </div>
        </div>

        <!-- Function keys bar -->
        <div class="wc-fkey-bar">
          <div class="wc-fkey" data-action="help"><span class="wc-fkey-key">F1</span><span class="wc-fkey-label">Help</span></div>
          <div class="wc-fkey" data-action="setup"><span class="wc-fkey-key">F2</span><span class="wc-fkey-label">Setup</span></div>
          <div class="wc-fkey" data-action="search"><span class="wc-fkey-key">F3</span><span class="wc-fkey-label">Search</span></div>
          <div class="wc-fkey" data-action="sort"><span class="wc-fkey-key">F4</span><span class="wc-fkey-label">Sort</span></div>
          <div class="wc-fkey" data-action="tree"><span class="wc-fkey-key">F5</span><span class="wc-fkey-label">Tree</span></div>
          <div class="wc-fkey" data-action="nice"><span class="wc-fkey-key">F7/8</span><span class="wc-fkey-label">Nice±</span></div>
          <div class="wc-fkey" data-action="kill"><span class="wc-fkey-key">F9</span><span class="wc-fkey-label">Kill</span></div>
          <div class="wc-fkey" data-action="quit"><span class="wc-fkey-key">F10</span><span class="wc-fkey-label">Quit</span></div>
        </div>
      </div>

      <!-- Setup overlay -->
      <div class="wc-help-overlay" id="wc-setup-overlay">
        <div class="wc-help-inner">
          <h3>⚙ System Setup</h3>
          <div class="wc-setup-grid">
            <div class="wc-setup-item">
              <span class="wc-setup-label">CPU History</span>
              <label class="wc-switch">
                <input type="checkbox" checked id="wc-set-cpu-hist" />
                <span class="wc-slider"></span>
              </label>
            </div>
            <div class="wc-setup-item">
              <span class="wc-setup-label">Smooth Gradients</span>
              <label class="wc-switch">
                <input type="checkbox" checked id="wc-set-smooth" />
                <span class="wc-slider"></span>
              </label>
            </div>
            <div class="wc-setup-item">
              <span class="wc-setup-label">Refresh Rate</span>
              <span class="wc-setup-value">1.0s</span>
            </div>
          </div>
          <div class="wc-help-close">Press Esc or click backdrop to close</div>
        </div>
      </div>

      <!-- About overlay -->
      <div class="wc-help-overlay" id="wc-about-overlay">
        <div class="wc-help-inner wc-about-inner">
          <h3>🌊 AEROTOP</h3>
          <div class="wc-about-body">
            <p class="wc-about-tagline">A Frutiger Aero system monitor</p>
            <p class="wc-about-credit">Made by <strong>Joe George</strong> with <strong>Claude Opus 4</strong><br>February 2026</p>
            <div class="wc-about-links">
              <a href="#" class="wc-about-link" data-url="https://github.com/joe-george-1">🔗 GitHub</a>
              <a href="#" class="wc-about-link" data-url="https://ko-fi.com/joe_george">☕ Ko-Fi</a>
            </div>
          </div>
          <div class="wc-help-close">Click logo or press Esc to close</div>
        </div>
      </div>

      <!-- Help overlay -->
      <div class="wc-help-overlay" id="wc-help-overlay">
        <div class="wc-help-inner">
          <h3>⌨ Keyboard Shortcuts</h3>
          <div class="wc-help-grid">
            <div class="wc-help-key">F1</div><div class="wc-help-desc">Toggle this help</div>
            <div class="wc-help-key">F3 / /</div><div class="wc-help-desc">Search processes</div>
            <div class="wc-help-key">F4</div><div class="wc-help-desc">Cycle sort column</div>
            <div class="wc-help-key">F5</div><div class="wc-help-desc">Toggle tree view</div>
            <div class="wc-help-key">F7</div><div class="wc-help-desc">Nice − (higher priority)</div>
            <div class="wc-help-key">F8</div><div class="wc-help-desc">Nice + (lower priority)</div>
            <div class="wc-help-key">F9</div><div class="wc-help-desc">Kill / send signal</div>
            <div class="wc-help-key">F10</div><div class="wc-help-desc">Quit</div>
            <div class="wc-help-key">↑ / ↓</div><div class="wc-help-desc">Navigate processes</div>
            <div class="wc-help-key">Esc</div><div class="wc-help-desc">Close dialogs / blur search</div>
            <div class="wc-help-key">DblClick</div><div class="wc-help-desc">Kill selected process</div>
          </div>
          <div class="wc-help-close">Press F1 or Esc to close</div>
        </div>
      </div>

      <!-- Kill process dialog -->
      <div class="wc-kill-dialog" id="wc-kill-dialog">
        <div class="wc-kill-dialog-inner">
          <h3>⚠ Send Signal</h3>
          <div class="wc-kill-pid" id="wc-kill-pid-info">PID: —</div>
          <div class="wc-signal-list">
            <button class="wc-signal-btn" data-signal="SIGTERM">SIGTERM (15)</button>
            <button class="wc-signal-btn" data-signal="SIGKILL">SIGKILL (9)</button>
            <button class="wc-signal-btn" data-signal="SIGSTOP">SIGSTOP</button>
            <button class="wc-signal-btn" data-signal="SIGCONT">SIGCONT</button>
            <button class="wc-signal-btn" data-signal="SIGHUP">SIGHUP (1)</button>
            <button class="wc-signal-btn" data-signal="SIGINT">SIGINT (2)</button>
          </div>
          <button class="wc-kill-cancel" id="wc-kill-cancel">Cancel (Esc)</button>
        </div>
      </div>

      <!-- Resize handle -->
      <div class="wc-resize-handle"></div>
    </div>
  `;

  // Cache element references
  const el = {};
  el.bg = document.getElementById('wc-bg');
  el.cpuEq = document.getElementById('wc-cpu-eq');
  el.cpuPct = document.getElementById('wc-cpu-pct');
  el.cpuModel = document.getElementById('wc-cpu-model');
  el.memBar = document.getElementById('wc-mem-bar');
  el.memPct = document.getElementById('wc-mem-pct');
  el.memText = document.getElementById('wc-mem-text');
  el.swapBar = document.getElementById('wc-swap-bar');
  el.swapPct = document.getElementById('wc-swap-pct');
  el.swapText = document.getElementById('wc-swap-text');
  el.netTx = document.getElementById('wc-net-tx');
  el.netRx = document.getElementById('wc-net-rx');
  el.tasksTotal = document.getElementById('wc-tasks-total');
  el.tasksRunning = document.getElementById('wc-tasks-running');
  el.loadAvg = document.getElementById('wc-load-avg');
  el.uptime = document.getElementById('wc-uptime');
  el.temp = document.getElementById('wc-temp');
  el.search = document.getElementById('wc-search');
  el.procBody = document.getElementById('wc-proc-body');
  el.procWrap = document.getElementById('wc-proc-wrap');
  el.killDialog = document.getElementById('wc-kill-dialog');
  el.killPidInfo = document.getElementById('wc-kill-pid-info');
  el.helpOverlay = document.getElementById('wc-help-overlay');
  el.aboutOverlay = document.getElementById('wc-about-overlay');
  el.setupOverlay = document.getElementById('wc-setup-overlay');
  state.elements = el;

  // Set up SVG background
  updateBgSVG();

  // Bind events
  bindEvents(container);
}

function updateBgSVG() {
  const el = state.elements;
  if (el.bg) {
    const rect = el.bg.getBoundingClientRect();
    el.bg.innerHTML = generateBgSVG(rect.width || 900, rect.height || 700);
  }
}

// ── Event Binding ────────────────────────────────────────────

function bindEvents(container) {
  const el = state.elements;

  // Window controls
  document.getElementById('wc-btn-close').addEventListener('click', () => window.aerotop.windowClose());
  document.getElementById('wc-btn-min').addEventListener('click', () => window.aerotop.windowMinimize());
  document.getElementById('wc-btn-max').addEventListener('click', () => window.aerotop.windowMaximize());

  // Logo click => About popup
  document.querySelector('.wc-logo-tag').addEventListener('click', () => {
    state.elements.aboutOverlay.classList.toggle('active');
  });

  // About links => open external URLs
  document.querySelectorAll('.wc-about-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = link.dataset.url;
      if (url) {
        window.open(url, '_blank');
      }
    });
  });

  // Click outside overlay to dismiss
  el.helpOverlay.addEventListener('click', (e) => {
    if (e.target === el.helpOverlay) el.helpOverlay.classList.remove('active');
  });
  el.aboutOverlay.addEventListener('click', (e) => {
    if (e.target === el.aboutOverlay) el.aboutOverlay.classList.remove('active');
  });
  el.setupOverlay.addEventListener('click', (e) => {
    if (e.target === el.setupOverlay) el.setupOverlay.classList.remove('active');
  });

  // Search
  el.search.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    if (state.lastSnapshot) renderProcesses(state.lastSnapshot);
  });

  // Sort headers
  container.querySelectorAll('.wc-process-table th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortColumn === col) {
        state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
      } else {
        state.sortColumn = col;
        state.sortDirection = col === 'command' || col === 'user' || col === 'state' ? 'asc' : 'desc';
      }
      updateSortHeaders(container);
      if (state.lastSnapshot) renderProcesses(state.lastSnapshot);
    });
  });

  // Tree toggle
  document.getElementById('wc-btn-tree').addEventListener('click', () => {
    state.treeView = !state.treeView;
    document.getElementById('wc-btn-tree').classList.toggle('active', state.treeView);
    if (state.lastSnapshot) renderProcesses(state.lastSnapshot);
  });

  // Kill button
  document.getElementById('wc-btn-kill').addEventListener('click', () => openKillDialog());

  // Kill dialog signals
  el.killDialog.querySelectorAll('.wc-signal-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const signal = btn.dataset.signal;
      if (state.selectedPid) {
        const result = await window.aerotop.killProcess(state.selectedPid, signal);
        if (!result.success) {
          console.error('Kill failed:', result.error);
        }
      }
      el.killDialog.classList.remove('active');
    });
  });

  // Kill cancel
  document.getElementById('wc-kill-cancel').addEventListener('click', () => {
    el.killDialog.classList.remove('active');
  });

  // Click on kill dialog background to close
  el.killDialog.addEventListener('click', (e) => {
    if (e.target === el.killDialog) {
      el.killDialog.classList.remove('active');
    }
  });

  // F-key bar
  container.querySelectorAll('.wc-fkey').forEach(fkey => {
    fkey.addEventListener('click', () => {
      const action = fkey.dataset.action;
      handleFKeyAction(action);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyDown);

  // Resize observer for SVG background
  const resizeObserver = new ResizeObserver(() => updateBgSVG());
  resizeObserver.observe(container);
  state._resizeObserver = resizeObserver;
}

function handleKeyDown(e) {
  const el = state.elements;

  switch (e.key) {
    case 'F1':
      e.preventDefault();
      handleFKeyAction('help');
      break;
    case 'F3':
    case '/':
      if (document.activeElement !== el.search) {
        e.preventDefault();
        el.search.focus();
      }
      break;
    case 'F5':
      e.preventDefault();
      state.treeView = !state.treeView;
      document.getElementById('wc-btn-tree').classList.toggle('active', state.treeView);
      if (state.lastSnapshot) renderProcesses(state.lastSnapshot);
      break;
    case 'F7':
      e.preventDefault();
      if (state.selectedPid) {
        const p7 = state.lastSnapshot?.processes.list.find(p => p.pid === state.selectedPid);
        if (p7) {
          const newNice = Math.max(-20, (p7.nice || 0) - 1);
          window.aerotop.reniceProcess(state.selectedPid, newNice);
        }
      }
      break;
    case 'F8':
      e.preventDefault();
      if (state.selectedPid) {
        const p8 = state.lastSnapshot?.processes.list.find(p => p.pid === state.selectedPid);
        if (p8) {
          const newNice = Math.min(19, (p8.nice || 0) + 1);
          window.aerotop.reniceProcess(state.selectedPid, newNice);
        }
      }
      break;
    case 'F9':
      e.preventDefault();
      openKillDialog();
      break;
    case 'F10':
      e.preventDefault();
      window.aerotop.windowClose();
      break;
    case 'Escape':
      el.killDialog.classList.remove('active');
      el.helpOverlay.classList.remove('active');
      el.aboutOverlay.classList.remove('active');
      el.setupOverlay.classList.remove('active');
      el.search.blur();
      break;
    case 'ArrowUp':
      e.preventDefault();
      navigateProcess(-1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      navigateProcess(1);
      break;
  }
}

function handleFKeyAction(action) {
  switch (action) {
    case 'help':
      state.elements.helpOverlay.classList.toggle('active');
      break;
    case 'setup':
      state.elements.setupOverlay.classList.toggle('active');
      break;
    case 'search':
      state.elements.search.focus();
      break;
    case 'sort':
      cycleSortColumn();
      break;
    case 'tree':
      state.treeView = !state.treeView;
      document.getElementById('wc-btn-tree').classList.toggle('active', state.treeView);
      if (state.lastSnapshot) renderProcesses(state.lastSnapshot);
      break;
    case 'nice':
      // F7/8 handled by keyboard; button cycles between them
      if (state.selectedPid) {
        const proc = state.lastSnapshot?.processes.list.find(p => p.pid === state.selectedPid);
        if (proc) {
          const newNice = Math.min(19, (proc.nice || 0) + 1);
          window.aerotop.reniceProcess(state.selectedPid, newNice);
        }
      }
      break;
    case 'kill':
      openKillDialog();
      break;
    case 'quit':
      window.aerotop.windowClose();
      break;
  }
}

// ── Sort Column Cycling ──────────────────────────────────────

const SORT_COLUMNS = ['cpu', 'mem', 'pid', 'user', 'priority', 'nice', 'memVsz', 'memRss', 'command', 'state', 'started'];

function cycleSortColumn() {
  const idx = SORT_COLUMNS.indexOf(state.sortColumn);
  const nextIdx = (idx + 1) % SORT_COLUMNS.length;
  state.sortColumn = SORT_COLUMNS[nextIdx];
  // Numeric cols default desc, string cols default asc
  const strCols = ['command', 'user', 'state'];
  state.sortDirection = strCols.includes(state.sortColumn) ? 'asc' : 'desc';
  updateSortHeaders(state.container);
  if (state.lastSnapshot) renderProcesses(state.lastSnapshot);
}

function openKillDialog() {
  if (!state.selectedPid) return;
  const proc = state.lastSnapshot?.processes.list.find(p => p.pid === state.selectedPid);
  state.elements.killPidInfo.textContent = proc
    ? `PID ${proc.pid} — ${proc.name} (${proc.user})`
    : `PID ${state.selectedPid}`;
  state.elements.killDialog.classList.add('active');
}

function navigateProcess(direction) {
  if (!state.lastSnapshot) return;
  const procs = state.treeView ? state._flatTreeCache || [] : getFilteredSortedProcesses(state.lastSnapshot);
  if (procs.length === 0) return;

  const currentIdx = procs.findIndex(p => p.pid === state.selectedPid);
  let newIdx = currentIdx + direction;
  if (newIdx < 0) newIdx = 0;
  if (newIdx >= procs.length) newIdx = procs.length - 1;

  state.selectedPid = procs[newIdx].pid;
  renderProcesses(state.lastSnapshot);

  // Scroll into view
  const row = state.elements.procBody.querySelector(`tr[data-pid="${state.selectedPid}"]`);
  if (row) row.scrollIntoView({ block: 'nearest' });
}

function updateSortHeaders(container) {
  container.querySelectorAll('.wc-process-table th[data-col]').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    if (th.dataset.col === state.sortColumn) {
      th.classList.add('sorted');
      arrow.textContent = state.sortDirection === 'desc' ? '▼' : '▲';
    } else {
      th.classList.remove('sorted');
      arrow.textContent = '';
    }
  });
}

// ── Data Update ──────────────────────────────────────────────

function update(snapshot) {
  state.lastSnapshot = snapshot;

  updateCPU(snapshot);
  updateMemory(snapshot);
  updateStats(snapshot);
  updateNetwork(snapshot);
  renderProcesses(snapshot);
}

// ── CPU EQ Visualizer ────────────────────────────────────────

function updateCPU(snapshot) {
  const el = state.elements;
  const cores = snapshot.cpu.coreLoads;

  // Overall percentage
  el.cpuPct.textContent = snapshot.cpu.overallLoad.toFixed(1) + '%';
  el.cpuPct.className = 'wc-cpu-pct ' + cpuColorClass(snapshot.cpu.overallLoad);

  // Model name + user/system breakdown (update every tick)
  const usr = snapshot.cpu.userLoad ? snapshot.cpu.userLoad.toFixed(1) : '0.0';
  const sys = snapshot.cpu.systemLoad ? snapshot.cpu.systemLoad.toFixed(1) : '0.0';
  if (!state._cpuModelBase) {
    state._cpuModelBase = snapshot.cpu.model + ' (' + snapshot.cpu.cores + ' cores)';
  }
  el.cpuModel.textContent = state._cpuModelBase + '  usr:' + usr + '%  sys:' + sys + '%';

  // Build EQ bars if not already built
  if (el.cpuEq.children.length === 0 || el.cpuEq.querySelectorAll('.wc-eq-bar-group').length !== cores.length) {
    el.cpuEq.innerHTML = '';
    state.eqPeaks = new Array(cores.length).fill(0);

    cores.forEach((_, i) => {
      const group = document.createElement('div');
      group.className = 'wc-eq-bar-group';
      group.innerHTML = `
        <div class="wc-eq-bar" id="wc-eq-bar-${i}"></div>
        <div class="wc-eq-bar-peak" id="wc-eq-peak-${i}"></div>
      `;
      el.cpuEq.appendChild(group);
    });
  }

  // Update bar heights and peaks
  cores.forEach((core, i) => {
    const bar = document.getElementById(`wc-eq-bar-${i}`);
    const peak = document.getElementById(`wc-eq-peak-${i}`);
    if (!bar || !peak) return;

    const pct = Math.max(0, Math.min(100, core.load));
    bar.style.height = pct + '%';

    // Peak hold effect — rises instantly, falls slowly
    if (pct > state.eqPeaks[i]) {
      state.eqPeaks[i] = pct;
    } else {
      state.eqPeaks[i] = Math.max(pct, state.eqPeaks[i] - 2);
    }
    peak.style.bottom = state.eqPeaks[i] + '%';
  });
}

// ── Memory ───────────────────────────────────────────────────

function updateMemory(snapshot) {
  const el = state.elements;
  const mem = snapshot.memory;

  const memPct = (mem.active / mem.total * 100) || 0;
  el.memBar.style.width = memPct + '%';
  el.memPct.textContent = memPct.toFixed(1) + '%';
  el.memText.textContent = formatBytes(mem.active) + ' / ' + formatBytes(mem.total);

  const swapPct = mem.swapTotal > 0 ? (mem.swapUsed / mem.swapTotal * 100) : 0;
  el.swapBar.style.width = swapPct + '%';
  el.swapPct.textContent = swapPct.toFixed(1) + '%';
  el.swapText.textContent = formatBytes(mem.swapUsed) + ' / ' + formatBytes(mem.swapTotal);
}

// ── Stats ────────────────────────────────────────────────────

function updateStats(snapshot) {
  const el = state.elements;
  el.tasksTotal.textContent = snapshot.processes.all;
  el.tasksRunning.textContent = snapshot.processes.running;
  el.loadAvg.textContent = (snapshot.load.avg1 || snapshot.load.currentLoad / 100 * snapshot.cpu.cores).toFixed(2);
  el.uptime.textContent = formatUptime(snapshot.uptime);
  el.temp.textContent = snapshot.temperature && snapshot.temperature.main
    ? snapshot.temperature.main + '°C'
    : '—';
}

// ── Network ──────────────────────────────────────────────────

function updateNetwork(snapshot) {
  const el = state.elements;
  if (!snapshot.network || snapshot.network.length === 0) return;

  // Aggregate all interfaces
  let txSec = 0, rxSec = 0;
  snapshot.network.forEach(n => {
    txSec += n.txSec || 0;
    rxSec += n.rxSec || 0;
  });

  el.netTx.textContent = formatBytesPerSec(txSec);
  el.netRx.textContent = formatBytesPerSec(rxSec);
}

// ── Process List ─────────────────────────────────────────────

function getFilteredSortedProcesses(snapshot) {
  let procs = [...snapshot.processes.list];

  // Filter by search query
  if (state.searchQuery) {
    procs = procs.filter(p =>
      p.name.toLowerCase().includes(state.searchQuery) ||
      p.command.toLowerCase().includes(state.searchQuery) ||
      p.user.toLowerCase().includes(state.searchQuery) ||
      String(p.pid).includes(state.searchQuery)
    );
  }

  // Sort
  const col = state.sortColumn;
  const dir = state.sortDirection === 'desc' ? -1 : 1;

  procs.sort((a, b) => {
    let va = a[col], vb = b[col];
    if (typeof va === 'string') {
      return va.localeCompare(vb) * dir;
    }
    return ((va || 0) - (vb || 0)) * dir;
  });

  return procs;
}

function renderProcesses(snapshot) {
  const el = state.elements;

  if (state.treeView) {
    renderTreeView(snapshot);
    return;
  }

  const procs = getFilteredSortedProcesses(snapshot);

  const rows = procs.map(p => {
    const selected = p.pid === state.selectedPid ? ' selected' : '';
    const cpuClass = cpuColorClass(p.cpu);
    return `<tr class="${selected}" data-pid="${p.pid}">
      <td class="wc-col-pid">${p.pid}</td>
      <td class="wc-col-user">${escapeHtml(p.user)}</td>
      <td class="wc-col-pri">${p.priority || 0}</td>
      <td class="wc-col-nice">${p.nice}</td>
      <td class="wc-col-virt">${formatKB(p.memVsz || 0)}</td>
      <td class="wc-col-res">${formatKB(p.memRss || 0)}</td>
      <td class="wc-col-cpu ${cpuClass}">${p.cpu.toFixed(1)}</td>
      <td class="wc-col-mem">${p.mem.toFixed(1)}</td>
      <td class="wc-col-state">${p.state}</td>
      <td class="wc-col-time">${formatTime(p.started)}</td>
      <td class="wc-col-cmd">${escapeHtml(p.command || p.name)}</td>
    </tr>`;
  }).join('');

  el.procBody.innerHTML = rows;
  bindProcessRows(el);
}

// ── Tree View ────────────────────────────────────────────────

function renderTreeView(snapshot) {
  const el = state.elements;
  const procs = snapshot.processes.list;

  // Build parent→children map
  const byPid = new Map();
  const roots = [];

  procs.forEach(p => {
    byPid.set(p.pid, { ...p, children: [] });
  });

  procs.forEach(p => {
    const node = byPid.get(p.pid);
    const parent = byPid.get(p.parentPid);
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children at each level by CPU desc
  function sortChildren(nodes) {
    nodes.sort((a, b) => b.cpu - a.cpu);
    nodes.forEach(n => sortChildren(n.children));
  }
  sortChildren(roots);

  // Flatten tree with indentation
  const flat = [];
  function flatten(nodes, depth, parentPrefix) {
    nodes.forEach((node, i) => {
      const isLast = i === nodes.length - 1;
      const branch = depth === 0 ? '' : parentPrefix + (isLast ? '└─ ' : '├─ ');
      const childPrefix = depth === 0 ? '' : parentPrefix + (isLast ? '   ' : '│  ');
      flat.push({ ...node, _depth: depth, _prefix: branch });
      if (node.children.length > 0) {
        flatten(node.children, depth + 1, childPrefix);
      }
    });
  }
  flatten(roots, 0, '');

  // Filter by search query
  let filtered = flat;
  if (state.searchQuery) {
    filtered = flat.filter(p =>
      p.name.toLowerCase().includes(state.searchQuery) ||
      (p.command || '').toLowerCase().includes(state.searchQuery) ||
      p.user.toLowerCase().includes(state.searchQuery) ||
      String(p.pid).includes(state.searchQuery)
    );
  }

  // Cache for arrow key navigation
  state._flatTreeCache = filtered;

  const rows = filtered.map(p => {
    const selected = p.pid === state.selectedPid ? ' selected' : '';
    const cpuClass = cpuColorClass(p.cpu);
    const treeCmd = p._prefix + escapeHtml(p.command || p.name);
    return `<tr class="${selected}" data-pid="${p.pid}">
      <td class="wc-col-pid">${p.pid}</td>
      <td class="wc-col-user">${escapeHtml(p.user)}</td>
      <td class="wc-col-pri">${p.priority || 0}</td>
      <td class="wc-col-nice">${p.nice}</td>
      <td class="wc-col-virt">${formatKB(p.memVsz || 0)}</td>
      <td class="wc-col-res">${formatKB(p.memRss || 0)}</td>
      <td class="wc-col-cpu ${cpuClass}">${p.cpu.toFixed(1)}</td>
      <td class="wc-col-mem">${p.mem.toFixed(1)}</td>
      <td class="wc-col-state">${p.state}</td>
      <td class="wc-col-time">${formatTime(p.started)}</td>
      <td class="wc-col-cmd">${treeCmd}</td>
    </tr>`;
  }).join('');

  el.procBody.innerHTML = rows;
  bindProcessRows(el);
}

// ── Bind Process Row Clicks ──────────────────────────────────

function bindProcessRows(el) {
  el.procBody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => {
      state.selectedPid = parseInt(row.dataset.pid);
      el.procBody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    });
    row.addEventListener('dblclick', () => {
      state.selectedPid = parseInt(row.dataset.pid);
      openKillDialog();
    });
  });
}

// ── Lifecycle ────────────────────────────────────────────────

function init(container) {
  state.container = container;
  buildUI(container);
}

function destroy() {
  document.removeEventListener('keydown', handleKeyDown);
  if (state._resizeObserver) {
    state._resizeObserver.disconnect();
  }
  state.container = null;
  state.elements = {};
  state.lastSnapshot = null;
  state.eqPeaks = [];
}

function getMetadata() {
  return METADATA;
}

// ── Export ────────────────────────────────────────────────────

export default { init, update, destroy, getMetadata };
