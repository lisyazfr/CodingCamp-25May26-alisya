/* ============================================================
   BudgetViz — Vanilla JS App
   All data stored in localStorage
   ============================================================ */

// ── Constants ────────────────────────────────────────────────
const LS_TRANSACTIONS = 'budgetviz_transactions';
const LS_CATEGORIES   = 'budgetviz_categories';
const LS_LIMIT        = 'budgetviz_limit';
const LS_THEME        = 'budgetviz_theme';

const DEFAULT_CATEGORIES = [
  { name: 'Food',      emoji: '' },
  { name: 'Transport', emoji: '' },
  { name: 'Fun',       emoji: '' },
];

// Chart.js palette — pastel purple tones, cycles if more categories added
const CHART_COLORS = [
  '#b39ddb', '#ce93d8', '#f48fb1', '#80cbc4',
  '#90caf9', '#ffcc80', '#a5d6a7', '#ef9a9a',
  '#80deea', '#ffe082', '#bcaaa4', '#c5e1a5',
];

// ── State ────────────────────────────────────────────────────
let transactions = [];
let categories   = [];
let spendingLimit = null;
let pieChart      = null;

// Viewing month: { year, month } (0-indexed month)
let viewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };

// ── DOM refs ─────────────────────────────────────────────────
const body            = document.body;
const toggleModeBtn   = document.getElementById('toggleMode');
const totalBalanceEl  = document.getElementById('totalBalance');
const limitDisplay    = document.getElementById('limitDisplay');
const limitBarWrap    = document.getElementById('limitBarWrap');
const limitBar        = document.getElementById('limitBar');
const limitWarning    = document.getElementById('limitWarning');

const txForm          = document.getElementById('transactionForm');
const itemNameInput   = document.getElementById('itemName');
const amountInput     = document.getElementById('amount');
const categorySelect  = document.getElementById('category');
const txDateInput     = document.getElementById('txDate');
const formError       = document.getElementById('formError');

const txList          = document.getElementById('transactionList');
const emptyState      = document.getElementById('emptyState');
const sortBySelect    = document.getElementById('sortBy');

const pieCanvas       = document.getElementById('pieChart');
const chartEmpty      = document.getElementById('chartEmpty');

const currentMonthLabel = document.getElementById('currentMonthLabel');
const prevMonthBtn    = document.getElementById('prevMonth');
const nextMonthBtn    = document.getElementById('nextMonth');
const monthCount      = document.getElementById('monthCount');
const monthTotal      = document.getElementById('monthTotal');
const monthTop        = document.getElementById('monthTop');

// Modals
const limitModal      = document.getElementById('limitModal');
const openLimitBtn    = document.getElementById('openLimitModal');
const closeLimitBtn   = document.getElementById('closeLimitModal');
const saveLimitBtn    = document.getElementById('saveLimit');
const removeLimitBtn  = document.getElementById('removeLimit');
const limitInput      = document.getElementById('limitInput');

const catModal        = document.getElementById('catModal');
const openCatBtn      = document.getElementById('openCatModal');
const closeCatBtn     = document.getElementById('closeCatModal');
const saveCatBtn      = document.getElementById('saveCat');
const catNameInput    = document.getElementById('catName');
const catEmojiInput   = document.getElementById('catEmoji');
const catError        = document.getElementById('catError');

// ── Helpers ──────────────────────────────────────────────────
function formatRp(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getMonthName(year, month) {
  return new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function getCategoryEmoji(name) {
  const cat = categories.find(c => c.name === name);
  return cat ? cat.emoji : '📦';
}

function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// ── LocalStorage ─────────────────────────────────────────────
function loadData() {
  try {
    transactions  = JSON.parse(localStorage.getItem(LS_TRANSACTIONS)) || [];
    const saved   = JSON.parse(localStorage.getItem(LS_CATEGORIES));
    categories    = saved && saved.length ? saved : [...DEFAULT_CATEGORIES];
    spendingLimit = JSON.parse(localStorage.getItem(LS_LIMIT));
  } catch {
    transactions  = [];
    categories    = [...DEFAULT_CATEGORIES];
    spendingLimit = null;
  }
}

function saveTransactions() {
  localStorage.setItem(LS_TRANSACTIONS, JSON.stringify(transactions));
}

function saveCategories() {
  localStorage.setItem(LS_CATEGORIES, JSON.stringify(categories));
}

function saveLimit() {
  localStorage.setItem(LS_LIMIT, JSON.stringify(spendingLimit));
}

// ── Theme ─────────────────────────────────────────────────────
function applyTheme(theme) {
  body.classList.toggle('dark', theme === 'dark');
  body.classList.toggle('light', theme !== 'dark');
  toggleModeBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
  localStorage.setItem(LS_THEME, theme);
}

function initTheme() {
  const saved = localStorage.getItem(LS_THEME);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

toggleModeBtn.addEventListener('click', () => {
  const isDark = body.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
  // Rebuild chart so colors update properly
  renderChart();
});

// ── Category Select ───────────────────────────────────────────
function populateCategorySelect() {
  // Keep the placeholder option
  categorySelect.innerHTML = '<option value="">Select category</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });
}

// ── Balance ───────────────────────────────────────────────────
function calcTotal(txArray) {
  return txArray.reduce((sum, tx) => sum + tx.amount, 0);
}

function updateBalance() {
  const total = calcTotal(transactions);
  totalBalanceEl.textContent = formatRp(total);

  // Limit bar
  if (spendingLimit) {
    const pct = Math.min((total / spendingLimit) * 100, 100);
    limitDisplay.textContent = formatRp(spendingLimit);
    limitBarWrap.style.display = 'block';
    limitBar.style.width = pct + '%';

    limitBar.classList.remove('warn', 'over');
    if (total > spendingLimit) {
      limitBar.classList.add('over');
      limitWarning.textContent = `Over limit by ${formatRp(total - spendingLimit)}`;
    } else if (pct >= 80) {
      limitBar.classList.add('warn');
      limitWarning.textContent = `${Math.round(pct)}% of limit used`;
    } else {
      limitWarning.textContent = '';
    }
  } else {
    limitDisplay.textContent = 'Not set';
    limitBarWrap.style.display = 'none';
    limitWarning.textContent = '';
  }
}

// ── Monthly Summary ───────────────────────────────────────────
function updateMonthlySummary() {
  currentMonthLabel.textContent = getMonthName(viewMonth.year, viewMonth.month);

  const filtered = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === viewMonth.year && d.getMonth() === viewMonth.month;
  });

  monthCount.textContent = filtered.length;
  monthTotal.textContent = formatRp(calcTotal(filtered));

  if (filtered.length === 0) {
    monthTop.textContent = '—';
    return;
  }

  // Find top category by total spend
  const catTotals = {};
  filtered.forEach(tx => {
    catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  });
  const top = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  monthTop.textContent = top[0];
}

prevMonthBtn.addEventListener('click', () => {
  viewMonth.month--;
  if (viewMonth.month < 0) { viewMonth.month = 11; viewMonth.year--; }
  updateMonthlySummary();
});

nextMonthBtn.addEventListener('click', () => {
  viewMonth.month++;
  if (viewMonth.month > 11) { viewMonth.month = 0; viewMonth.year++; }
  updateMonthlySummary();
});

// ── Transaction List ──────────────────────────────────────────
function getSortedTransactions() {
  const sort = sortBySelect.value;
  const arr  = [...transactions];

  switch (sort) {
    case 'date-desc':     return arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    case 'date-asc':      return arr.sort((a, b) => new Date(a.date) - new Date(b.date));
    case 'amount-desc':   return arr.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':    return arr.sort((a, b) => a.amount - b.amount);
    case 'category-asc':  return arr.sort((a, b) => a.category.localeCompare(b.category));
    default:              return arr;
  }
}

function renderTransactions() {
  const sorted = getSortedTransactions();
  const total  = calcTotal(transactions);

  // Clear existing items (keep emptyState)
  Array.from(txList.querySelectorAll('.tx-item')).forEach(el => el.remove());

  if (sorted.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  sorted.forEach(tx => {
    const li = document.createElement('li');
    li.className = 'tx-item';
    li.dataset.id = tx.id;

    // Highlight if this single transaction is over limit (or total is over)
    if (spendingLimit && total > spendingLimit) {
      li.classList.add('over-limit');
    }

    const dateStr = tx.date
      ? new Date(tx.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    li.innerHTML = `
      <span class="tx-icon">${escapeHtml(tx.category.charAt(0))}</span>
      <div class="tx-info">
        <div class="tx-name">${escapeHtml(tx.name)}</div>
        <div class="tx-meta">${escapeHtml(tx.category)}${dateStr ? ' · ' + dateStr : ''}</div>
      </div>
      <span class="tx-amount">−${formatRp(tx.amount)}</span>
      <button class="tx-delete" data-id="${tx.id}" title="Delete">✕</button>
    `;
    txList.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Delete via event delegation
txList.addEventListener('click', e => {
  const btn = e.target.closest('.tx-delete');
  if (!btn) return;
  const id = btn.dataset.id;
  transactions = transactions.filter(tx => tx.id !== id);
  saveTransactions();
  renderAll();
});

sortBySelect.addEventListener('change', renderTransactions);

// ── Chart ─────────────────────────────────────────────────────
function renderChart() {
  // Aggregate by category
  const catTotals = {};
  transactions.forEach(tx => {
    catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  });

  const labels = Object.keys(catTotals);
  const data   = Object.values(catTotals);

  if (data.length === 0) {
    chartEmpty.style.display = 'block';
    pieCanvas.style.display  = 'none';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  chartEmpty.style.display = 'none';
  pieCanvas.style.display  = 'block';

  const colors = labels.map((_, i) => getChartColor(i));
  const isDark = body.classList.contains('dark');
  const textColor = isDark ? '#e8e0f5' : '#2d2540';

  if (pieChart) {
    pieChart.data.labels = labels;
    pieChart.data.datasets[0].data   = data;
    pieChart.data.datasets[0].backgroundColor = colors;
    pieChart.options.plugins.legend.labels.color = textColor;
    pieChart.update();
    return;
  }

  pieChart = new Chart(pieCanvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: isDark ? '#231d35' : '#ffffff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { family: "'Segoe UI', system-ui, sans-serif", size: 12 },
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val   = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = ((val / total) * 100).toFixed(1);
              return ` ${formatRp(val)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ── Add Transaction ───────────────────────────────────────────
// Set today's date as default
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  txDateInput.value = today;
}

txForm.addEventListener('submit', e => {
  e.preventDefault();
  formError.textContent = '';

  const name     = itemNameInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const category = categorySelect.value;
  const date     = txDateInput.value;

  // Validation
  if (!name)            { formError.textContent = 'Please enter an item name.'; return; }
  if (!amount || amount <= 0) { formError.textContent = 'Please enter a valid amount.'; return; }
  if (!category)        { formError.textContent = 'Please select a category.'; return; }
  if (!date)            { formError.textContent = 'Please select a date.'; return; }

  const tx = { id: generateId(), name, amount, category, date };
  transactions.unshift(tx);
  saveTransactions();
  renderAll();

  // Reset form
  itemNameInput.value = '';
  amountInput.value   = '';
  categorySelect.value = '';
  setDefaultDate();
  itemNameInput.focus();
});

// ── Spending Limit Modal ──────────────────────────────────────
openLimitBtn.addEventListener('click', () => {
  limitInput.value = spendingLimit || '';
  limitModal.classList.add('open');
  limitInput.focus();
});

closeLimitBtn.addEventListener('click', () => limitModal.classList.remove('open'));

limitModal.addEventListener('click', e => {
  if (e.target === limitModal) limitModal.classList.remove('open');
});

saveLimitBtn.addEventListener('click', () => {
  const val = parseFloat(limitInput.value);
  if (!val || val <= 0) { alert('Please enter a valid limit amount.'); return; }
  spendingLimit = val;
  saveLimit();
  limitModal.classList.remove('open');
  updateBalance();
  renderTransactions();
});

removeLimitBtn.addEventListener('click', () => {
  spendingLimit = null;
  saveLimit();
  limitModal.classList.remove('open');
  updateBalance();
  renderTransactions();
});

// ── Custom Category Modal ─────────────────────────────────────
openCatBtn.addEventListener('click', () => {
  catNameInput.value  = '';
  catEmojiInput.value = '';
  catError.textContent = '';
  catModal.classList.add('open');
  catNameInput.focus();
});

closeCatBtn.addEventListener('click', () => catModal.classList.remove('open'));

catModal.addEventListener('click', e => {
  if (e.target === catModal) catModal.classList.remove('open');
});

saveCatBtn.addEventListener('click', () => {
  catError.textContent = '';
  const name  = catNameInput.value.trim();
  const emoji = catEmojiInput.value.trim() || cat.name.charAt(0);

  if (!name) { catError.textContent = 'Category name is required.'; return; }
  if (categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    catError.textContent = 'Category already exists.'; return;
  }

  categories.push({ name, emoji });
  saveCategories();
  populateCategorySelect();
  categorySelect.value = name;
  catModal.classList.remove('open');
});

// ── Render All ────────────────────────────────────────────────
function renderAll() {
  updateBalance();
  updateMonthlySummary();
  renderTransactions();
  renderChart();
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  loadData();
  initTheme();
  populateCategorySelect();
  setDefaultDate();
  renderAll();
}

init();
