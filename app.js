/* Detailer Pro — offline-first PWA for car detailing businesses.
   All data lives in localStorage on the device. */

'use strict';

// ---------------------------------------------------------------- storage

const STORE_KEY = 'detailerpro-data';

const DEFAULT_SERVICES = [
  { name: 'Basic Wash', type: 'service', price: 3000, duration: 45, desc: 'Exterior hand wash, wheels, tires, dry' },
  { name: 'Interior Detail', type: 'service', price: 10000, duration: 90, desc: 'Vacuum, wipe-down, glass, mats' },
  { name: 'Engine Bay Clean', type: 'service', price: 5000, duration: 30, desc: 'Degrease and dress engine bay' },
  { name: 'Standard Package', type: 'package', price: 15000, duration: 120, desc: 'Exterior wash + interior detail' },
  { name: 'Deluxe Package', type: 'package', price: 25000, duration: 180, desc: 'Full interior + exterior detail, wax & polish' },
  { name: 'VIP Package', type: 'package', price: 40000, duration: 240, desc: 'Complete detail, engine bay clean, paint sealant' },
  { name: '23000 GSm Large Density Microfiber Cleaning Towel', type: 'product', price: 5000, duration: 0, desc: '' },
];

const CATALOG_TYPES = [
  ['package', 'Packages'],
  ['service', 'Services'],
  ['product', 'Products'],
];

function freshState() {
  return {
    settings: {
      bizName: 'Fatoma Autocare',
      tagline: 'We care for your car like our own',
      logo: 'AF',
      logoImg: 'logo.svg',
      phone: '08012345678',
      email: '',
      address: 'Kano State, Nigeria',
      currency: '₦',
      decimals: 0,
      taxRate: 0,
      invoicePrefix: 'FTM-',
      invoiceNumStyle: 'date',
      nextInvoiceNum: 1,
      lastInvMonth: '',
      defaultIntervalWeeks: 4,
      invoiceFooter: 'Thank you for your business!',
      bottomTagline: 'We care for your car like our own',
      payName: 'Mohammed Ali Bukar Fatoma',
      payNumber: '8059604694',
      payBank: 'OPay',
      signatureName: 'Mohammed Ali Bukar Fatoma',
      signatureImg: '',
      accent: '#c8102e',
      theme: 'light',
    },
    services: DEFAULT_SERVICES.map((s) => ({ id: uid(), active: true, ...s })),
    clients: [],
    jobs: [],
    invoices: [],
  };
}

let db;
try {
  db = JSON.parse(localStorage.getItem(STORE_KEY)) || freshState();
} catch (e) {
  db = freshState();
}
// merge any new settings keys into older saved data
db.settings = { ...freshState().settings, ...db.settings };
// older data: catalog items default to plain services
db.services.forEach((s) => { if (!s.type) s.type = 'service'; });
// older invoices: flat discount → typed discount, and add payment tracking
db.invoices.forEach((i) => {
  if (i.discountType === undefined) {
    i.discountType = 'amount';
    i.discountValue = Number(i.discount) || 0;
  }
  if (i.amountPaid === undefined) {
    i.amountPaid = i.status === 'paid' ? invoiceTotal(i) : 0;
  }
});

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

// ---------------------------------------------------------------- helpers

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function money(n) {
  const v = Number(n) || 0;
  const d = Number(db.settings.decimals ?? 2);
  return db.settings.currency + v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function moneyBare(n) {
  const v = Number(n) || 0;
  const d = Number(db.settings.decimals ?? 2);
  return v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return hh + ':' + String(m).padStart(2, '0') + ' ' + ap;
}

function daysBetween(aISO, bISO) {
  const a = parseISO(aISO), b = parseISO(bISO);
  return Math.round((b - a) / 86400000);
}

function addDays(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function getClient(id) { return db.clients.find((c) => c.id === id); }
function getService(id) { return db.services.find((s) => s.id === id); }
function getJob(id) { return db.jobs.find((j) => j.id === id); }
function getInvoice(id) { return db.invoices.find((i) => i.id === id); }
function getVehicle(client, vid) { return (client?.vehicles || []).find((v) => v.id === vid); }

function vehicleLabel(client, vid) {
  const v = getVehicle(client, vid);
  if (!v) return '';
  return [v.year, v.make, v.model].filter(Boolean).join(' ') + (v.color ? ` (${v.color})` : '');
}

function jobTotal(job) {
  let t = 0;
  (job.serviceIds || []).forEach((sid) => { t += Number(getService(sid)?.price) || 0; });
  (job.customItems || []).forEach((it) => { t += Number(it.price) || 0; });
  if (job.priceOverride !== '' && job.priceOverride != null && !isNaN(job.priceOverride)) {
    t = Number(job.priceOverride);
  }
  return t;
}

function invoiceSubtotal(inv) {
  return inv.items.reduce((t, it) => t + (Number(it.qty) || 1) * (Number(it.price) || 0), 0);
}
function invoiceDiscount(inv) {
  const sub = invoiceSubtotal(inv);
  let d = 0;
  if (inv.discountType === 'percent') d = sub * (Number(inv.discountValue) || 0) / 100;
  else d = Number(inv.discountValue ?? inv.discount) || 0;
  return Math.min(d, sub); // discount can never exceed the subtotal
}
function invoiceTotal(inv) {
  const sub = invoiceSubtotal(inv);
  const disc = invoiceDiscount(inv);
  const tax = (sub - disc) * ((Number(inv.taxRate) || 0) / 100);
  const delivery = Number(inv.delivery) || 0;
  return Math.max(0, Math.round((sub - disc + tax + delivery) * 100) / 100);
}
function invoiceBalance(inv) {
  return Math.max(0, invoiceTotal(inv) - (Number(inv.amountPaid) || 0));
}
// status: 'paid' | 'part' | 'unpaid'
function invoiceStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  return (Number(inv.amountPaid) || 0) > 0 ? 'part' : 'unpaid';
}
function statusPill(inv) {
  const st = invoiceStatus(inv);
  const overdue = st !== 'paid' && inv.dueDate && inv.dueDate < todayISO();
  if (st === 'paid') return '<span class="pill ok">Paid</span>';
  if (st === 'part') return `<span class="pill ${overdue ? 'danger' : 'warn'}">Part-paid</span>`;
  return `<span class="pill ${overdue ? 'danger' : 'warn'}">${overdue ? 'Overdue' : 'Unpaid'}</span>`;
}

// Next service due for a client = last completed job date + interval weeks.
// Clients with reminders toggled off (one-off customers etc.) never come due.
function clientNextDue(client) {
  if (client.trackDue === false) return null;
  const done = db.jobs
    .filter((j) => j.clientId === client.id && j.status === 'completed' && j.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!done.length) return null;
  const weeks = Number(client.intervalWeeks) || Number(db.settings.defaultIntervalWeeks) || 4;
  return addDays(done[0].date, weeks * 7);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------- theming

function applyTheme() {
  const s = db.settings;
  document.body.classList.toggle('light', s.theme === 'light');
  document.documentElement.style.setProperty('--accent', s.accent);
  const r = parseInt(s.accent.slice(1, 3), 16), g = parseInt(s.accent.slice(3, 5), 16), b = parseInt(s.accent.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.14)`);
  document.getElementById('bizName').textContent = s.bizName || 'Fatoma Autocare';
  document.getElementById('bizTagline').textContent = s.tagline || '';
  const logoEl = document.getElementById('bizLogo');
  if (s.logoImg) {
    logoEl.innerHTML = `<img src="${esc(s.logoImg)}" alt="" style="width:100%;height:100%;object-fit:contain">`;
    logoEl.style.background = '#fff';
    logoEl.style.padding = '3px';
  } else {
    logoEl.textContent = s.logo || 'AF';
    logoEl.style.background = '';
    logoEl.style.padding = '';
  }
}

// ---------------------------------------------------------------- modal

function openModal(title, bodyHTML, onMount) {
  const host = document.getElementById('modalHost');
  host.innerHTML = `
    <div class="modal-back" id="modalBack">
      <div class="modal">
        <div class="modal-head"><b>${esc(title)}</b><button class="x" id="modalX">✕</button></div>
        <div class="modal-body">${bodyHTML}</div>
      </div>
    </div>`;
  document.getElementById('modalX').onclick = closeModal;
  document.getElementById('modalBack').onclick = (e) => { if (e.target.id === 'modalBack') closeModal(); };
  if (onMount) onMount(host);
}

function closeModal() {
  document.getElementById('modalHost').innerHTML = '';
}

// ---------------------------------------------------------------- router

let currentTab = 'dash';
let detailView = null; // {type:'client'|'job'|'invoice', id}

function nav(tab) {
  currentTab = tab;
  detailView = null;
  render();
}

function openDetail(type, id) {
  detailView = { type, id };
  render();
}

function render() {
  applyTheme();
  document.querySelectorAll('nav.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === currentTab);
  });
  const view = document.getElementById('view');
  const fab = document.getElementById('fab');
  fab.style.display = 'flex';

  if (detailView) {
    fab.style.display = 'none';
    if (detailView.type === 'client') view.innerHTML = clientDetailHTML(detailView.id);
    else if (detailView.type === 'job') view.innerHTML = jobDetailHTML(detailView.id);
    else if (detailView.type === 'invoice') view.innerHTML = invoiceDetailHTML(detailView.id);
    window.scrollTo(0, 0);
    return;
  }

  if (currentTab === 'dash') { view.innerHTML = dashHTML(); }
  else if (currentTab === 'clients') { view.innerHTML = clientsHTML(); }
  else if (currentTab === 'jobs') { view.innerHTML = jobsHTML(); }
  else if (currentTab === 'invoices') { view.innerHTML = invoicesHTML(); }
  else if (currentTab === 'settings') { fab.style.display = 'none'; view.innerHTML = settingsHTML(); }
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- dashboard

function dashHTML() {
  const today = todayISO();
  const weekAgo = addDays(today, -7);
  const monthStart = today.slice(0, 8) + '01';

  const completed = db.jobs.filter((j) => j.status === 'completed');
  const revenueWeek = completed.filter((j) => j.date >= weekAgo && j.date <= today).reduce((t, j) => t + jobTotal(j), 0);
  const revenueMonth = completed.filter((j) => j.date >= monthStart && j.date <= today).reduce((t, j) => t + jobTotal(j), 0);
  const unpaid = db.invoices.filter((i) => i.status !== 'paid');
  const unpaidTotal = unpaid.reduce((t, i) => t + invoiceBalance(i), 0);

  const todayJobs = db.jobs
    .filter((j) => j.date === today && j.status !== 'cancelled')
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const upcoming = db.jobs
    .filter((j) => j.date > today && j.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    .slice(0, 5);

  const due = db.clients
    .map((c) => ({ c, due: clientNextDue(c) }))
    .filter((x) => x.due && x.due <= addDays(today, 7))
    .filter((x) => !db.jobs.some((j) => j.clientId === x.c.id && j.status === 'scheduled'))
    .sort((a, b) => a.due.localeCompare(b.due));

  let html = `
    <div class="stats">
      <div class="stat accent"><div class="lbl">This week</div><div class="val">${money(revenueWeek)}</div></div>
      <div class="stat"><div class="lbl">This month</div><div class="val">${money(revenueMonth)}</div></div>
      <div class="stat"><div class="lbl">Today's jobs</div><div class="val">${todayJobs.length}</div></div>
      <div class="stat ${unpaid.length ? 'warn' : ''}"><div class="lbl">Unpaid (${unpaid.length})</div><div class="val">${money(unpaidTotal)}</div></div>
    </div>`;

  html += `<h2 class="section">Today — ${fmtDateShort(today)}</h2>`;
  if (!todayJobs.length) {
    html += `<div class="card muted">No jobs scheduled today.</div>`;
  } else {
    todayJobs.forEach((j) => { html += jobCardHTML(j); });
  }

  if (due.length) {
    html += `<h2 class="section">Due for service</h2>`;
    due.slice(0, 6).forEach(({ c, due: d }) => {
      const overdue = d < today;
      html += `
        <div class="card tappable" onclick="openDetail('client','${c.id}')">
          <div class="row">
            <div class="avatar">${esc(initials(c.name))}</div>
            <div class="grow">
              <div class="nowrap"><b>${esc(c.name)}</b></div>
              <div class="muted">${overdue ? 'Overdue since' : 'Due'} ${fmtDate(d)}</div>
            </div>
            <span class="pill ${overdue ? 'danger' : 'warn'}">${overdue ? Math.abs(daysBetween(today, d)) + 'd overdue' : 'in ' + daysBetween(today, d) + 'd'}</span>
          </div>
        </div>`;
    });
  }

  html += `<h2 class="section">Upcoming</h2>`;
  if (!upcoming.length) {
    html += `<div class="card muted">Nothing scheduled ahead. Tap ＋ to book a job.</div>`;
  } else {
    upcoming.forEach((j) => { html += jobCardHTML(j, true); });
  }

  return html;
}

// ---------------------------------------------------------------- clients

let clientSearch = '';

function clientsHTML() {
  const q = clientSearch.toLowerCase();
  const list = db.clients
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) ||
      (c.vehicles || []).some((v) => `${v.make} ${v.model} ${v.plate}`.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  let html = `<input class="search" placeholder="Search clients, phone, vehicle…" value="${esc(clientSearch)}"
    oninput="clientSearch=this.value;renderListOnly('clientList', clientListHTML())">`;
  html += `<div id="clientList">${clientListHTML(list)}</div>`;
  return html;
}

function clientListHTML(list) {
  if (!list) {
    const q = clientSearch.toLowerCase();
    list = db.clients
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) ||
        (c.vehicles || []).some((v) => `${v.make} ${v.model} ${v.plate}`.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  if (!list.length) {
    return `<div class="empty"><div class="big">👥</div>${db.clients.length ? 'No matches.' : 'No clients yet.<br>Tap ＋ to add your first client.'}</div>`;
  }
  const today = todayISO();
  return list.map((c) => {
    const due = clientNextDue(c);
    const vehicles = (c.vehicles || []).map((v) => [v.make, v.model].filter(Boolean).join(' ')).filter(Boolean).join(', ');
    let duePill = '';
    if (due) {
      const overdue = due < today;
      duePill = `<span class="pill ${overdue ? 'danger' : due <= addDays(today, 7) ? 'warn' : ''}">${overdue ? 'overdue' : 'due ' + fmtDate(due)}</span>`;
    }
    return `
      <div class="card tappable" onclick="openDetail('client','${c.id}')">
        <div class="row">
          <div class="avatar">${esc(initials(c.name))}</div>
          <div class="grow">
            <div class="nowrap"><b>${esc(c.name)}</b></div>
            <div class="muted nowrap">${esc(vehicles || c.phone || 'No vehicle on file')}</div>
          </div>
          ${duePill}
        </div>
      </div>`;
  }).join('');
}

function renderListOnly(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function clientDetailHTML(id) {
  const c = getClient(id);
  if (!c) { detailView = null; return clientsHTML(); }
  const today = todayISO();
  const due = clientNextDue(c);
  const jobs = db.jobs.filter((j) => j.clientId === id).sort((a, b) => b.date.localeCompare(a.date));
  const invoices = db.invoices.filter((i) => i.clientId === id).sort((a, b) => b.dateIssued.localeCompare(a.dateIssued));
  const spent = jobs.filter((j) => j.status === 'completed').reduce((t, j) => t + jobTotal(j), 0);
  const smsBody = encodeURIComponent(`Hi ${c.name.split(' ')[0]}, your vehicle is due for detailing. Would you like to book your next appointment?`);

  let html = `
    <button class="btn small ghost no-print" onclick="nav('clients')">‹ Clients</button>
    <div class="card" style="margin-top:12px">
      <div class="row">
        <div class="avatar" style="width:54px;height:54px;font-size:20px">${esc(initials(c.name))}</div>
        <div class="grow">
          <b style="font-size:18px">${esc(c.name)}</b>
          <div class="muted">${jobs.filter((j) => j.status === 'completed').length} jobs · ${money(spent)} lifetime</div>
        </div>
      </div>
      ${due ? `<hr class="divider"><div class="row"><div class="grow muted">Next service due</div><span class="pill ${due < today ? 'danger' : 'accent'}">${fmtDate(due)}</span></div>` : ''}
      <hr class="divider">
      <div class="iconbtns">
        ${c.phone ? `<a href="tel:${esc(c.phone)}"><span class="ico">📞</span>Call</a>
        <a href="sms:${esc(c.phone)}${due ? `?&body=${smsBody}` : ''}"><span class="ico">💬</span>Text</a>` : ''}
        ${c.email ? `<a href="mailto:${esc(c.email)}"><span class="ico">✉️</span>Email</a>` : ''}
        <button onclick="openClientForm('${c.id}')"><span class="ico">✏️</span>Edit</button>
      </div>
      ${c.address ? `<hr class="divider"><div class="muted">📍 ${esc(c.address)}</div>` : ''}
      ${c.notes ? `<hr class="divider"><div class="muted">📝 ${esc(c.notes)}</div>` : ''}
    </div>

    <h2 class="section">Vehicles</h2>
    <div class="card">`;
  if (!(c.vehicles || []).length) html += `<div class="muted">No vehicles on file.</div>`;
  (c.vehicles || []).forEach((v) => {
    html += `
      <div class="listline">
        <div class="grow">
          <b>${esc([v.year, v.make, v.model].filter(Boolean).join(' '))}</b>
          <div class="muted small">${esc([v.color, v.plate ? 'Plate: ' + v.plate : ''].filter(Boolean).join(' · '))}</div>
          ${v.notes ? `<div class="muted small">${esc(v.notes)}</div>` : ''}
        </div>
      </div>`;
  });
  html += `</div>
    <div class="btnrow">
      <button class="btn" onclick="openJobForm(null,'${c.id}')">＋ Book job</button>
      <button class="btn ghost" onclick="openInvoiceForm(null,'${c.id}')">＋ Invoice</button>
    </div>`;

  html += `<h2 class="section">Job history</h2>`;
  if (!jobs.length) html += `<div class="card muted">No jobs yet.</div>`;
  jobs.slice(0, 20).forEach((j) => { html += jobCardHTML(j, true); });

  if (invoices.length) {
    html += `<h2 class="section">Invoices</h2>`;
    invoices.forEach((i) => { html += invoiceCardHTML(i); });
  }

  html += `<div class="btnrow"><button class="btn danger" onclick="deleteClient('${c.id}')">Delete client</button></div>`;
  return html;
}

function openClientForm(id) {
  const c = id ? getClient(id) : null;
  const vehicles = c ? JSON.parse(JSON.stringify(c.vehicles || [])) : [];
  window._formVehicles = vehicles;

  const body = `
    <div class="field"><label>Full name *</label><input id="f_name" value="${esc(c?.name || '')}" placeholder="Jane Smith"></div>
    <div class="field-2">
      <div class="field"><label>Phone</label><input id="f_phone" type="tel" value="${esc(c?.phone || '')}" placeholder="555-0100"></div>
      <div class="field"><label>Email</label><input id="f_email" type="email" value="${esc(c?.email || '')}" placeholder="jane@mail.com"></div>
    </div>
    <div class="field"><label>Address</label><input id="f_address" value="${esc(c?.address || '')}" placeholder="12 Main St"></div>
    <label class="checkline"><input type="checkbox" id="f_trackDue" ${c?.trackDue === false ? '' : 'checked'}
      onchange="document.getElementById('intervalField').style.display = this.checked ? '' : 'none'">
      <span class="grow">Remind when next detailing is due<div class="muted small">Turn off for one-off customers with no regular schedule</div></span></label>
    <div class="field" id="intervalField" style="${c?.trackDue === false ? 'display:none' : ''}">
      <label>Service interval (weeks) — leave blank for default (${db.settings.defaultIntervalWeeks})</label>
      <input id="f_interval" type="number" inputmode="numeric" value="${c?.intervalWeeks || ''}" placeholder="${db.settings.defaultIntervalWeeks}"></div>
    <div class="field"><label>Notes</label><textarea id="f_notes" placeholder="Gate code, preferences…">${esc(c?.notes || '')}</textarea></div>
    <h2 class="section">Vehicles</h2>
    <div id="vehicleList"></div>
    <button class="btn small ghost" onclick="addVehicleRow()">＋ Add vehicle</button>
    <div class="btnrow"><button class="btn block" onclick="saveClient('${id || ''}')">Save client</button></div>`;
  openModal(id ? 'Edit client' : 'New client', body, () => renderVehicleRows());
}

function renderVehicleRows() {
  const host = document.getElementById('vehicleList');
  if (!host) return;
  host.innerHTML = window._formVehicles.map((v, i) => `
    <div class="card" style="padding:12px">
      <div class="field-2">
        <div class="field"><label>Year</label><input data-vi="${i}" data-vk="year" value="${esc(v.year || '')}" inputmode="numeric" placeholder="2022"></div>
        <div class="field"><label>Make</label><input data-vi="${i}" data-vk="make" value="${esc(v.make || '')}" placeholder="Toyota"></div>
      </div>
      <div class="field-2">
        <div class="field"><label>Model</label><input data-vi="${i}" data-vk="model" value="${esc(v.model || '')}" placeholder="Camry"></div>
        <div class="field"><label>Color</label><input data-vi="${i}" data-vk="color" value="${esc(v.color || '')}" placeholder="Black"></div>
      </div>
      <div class="field-2">
        <div class="field"><label>Plate</label><input data-vi="${i}" data-vk="plate" value="${esc(v.plate || '')}"></div>
        <div class="field"><label>Notes</label><input data-vi="${i}" data-vk="notes" value="${esc(v.notes || '')}" placeholder="Pet hair, tint…"></div>
      </div>
      <button class="btn small danger" onclick="removeVehicleRow(${i})">Remove vehicle</button>
    </div>`).join('');
  host.querySelectorAll('input[data-vi]').forEach((inp) => {
    inp.oninput = () => { window._formVehicles[Number(inp.dataset.vi)][inp.dataset.vk] = inp.value; };
  });
}

function addVehicleRow() {
  window._formVehicles.push({ id: uid(), year: '', make: '', model: '', color: '', plate: '', notes: '' });
  renderVehicleRows();
}

function removeVehicleRow(i) {
  window._formVehicles.splice(i, 1);
  renderVehicleRows();
}

function saveClient(id) {
  const name = document.getElementById('f_name').value.trim();
  if (!name) { toast('Name is required'); return; }
  const data = {
    name,
    phone: document.getElementById('f_phone').value.trim(),
    email: document.getElementById('f_email').value.trim(),
    address: document.getElementById('f_address').value.trim(),
    trackDue: document.getElementById('f_trackDue').checked,
    intervalWeeks: document.getElementById('f_interval').value.trim(),
    notes: document.getElementById('f_notes').value.trim(),
    vehicles: window._formVehicles.filter((v) => v.make || v.model || v.plate || v.year),
  };
  if (id) {
    Object.assign(getClient(id), data);
  } else {
    const c = { id: uid(), createdAt: todayISO(), ...data };
    db.clients.push(c);
    detailView = { type: 'client', id: c.id };
    currentTab = 'clients';
  }
  save();
  closeModal();
  render();
  toast('Client saved');
}

function deleteClient(id) {
  const c = getClient(id);
  if (!confirm(`Delete ${c.name} and all their jobs and invoices? This cannot be undone.`)) return;
  db.clients = db.clients.filter((x) => x.id !== id);
  db.jobs = db.jobs.filter((x) => x.clientId !== id);
  db.invoices = db.invoices.filter((x) => x.clientId !== id);
  save();
  nav('clients');
  toast('Client deleted');
}

// ---------------------------------------------------------------- jobs

let jobFilter = 'upcoming';

const JOB_STATUS = {
  scheduled: { label: 'Scheduled', cls: 'accent' },
  inprogress: { label: 'In progress', cls: 'warn' },
  completed: { label: 'Completed', cls: 'ok' },
  cancelled: { label: 'Cancelled', cls: 'danger' },
};

function jobCardHTML(j, withDate) {
  const c = getClient(j.clientId);
  const st = JOB_STATUS[j.status] || JOB_STATUS.scheduled;
  const services = (j.serviceIds || []).map((sid) => getService(sid)?.name).filter(Boolean)
    .concat((j.customItems || []).map((it) => it.name));
  return `
    <div class="card tappable" onclick="openDetail('job','${j.id}')">
      <div class="row">
        <div class="grow">
          <div class="nowrap"><b>${esc(c?.name || 'Unknown client')}</b></div>
          <div class="muted nowrap">${esc(services.join(', ') || 'No services listed')}</div>
          <div class="muted small">${withDate ? fmtDateShort(j.date) + (j.time ? ' · ' : '') : ''}${fmtTime(j.time)}${j.vehicleId ? ' · ' + esc(vehicleLabel(c, j.vehicleId)) : ''}</div>
        </div>
        <div style="text-align:right">
          <div class="amount">${money(jobTotal(j))}</div>
          <span class="pill ${st.cls}">${st.label}</span>
        </div>
      </div>
    </div>`;
}

function jobsHTML() {
  const today = todayISO();
  let list = db.jobs.slice();
  if (jobFilter === 'upcoming') list = list.filter((j) => j.status === 'scheduled' || j.status === 'inprogress');
  else if (jobFilter === 'completed') list = list.filter((j) => j.status === 'completed');
  else if (jobFilter === 'today') list = list.filter((j) => j.date === today && j.status !== 'cancelled');
  list.sort((a, b) => (jobFilter === 'completed' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || (a.time || '').localeCompare(b.time || ''));

  const chips = [['upcoming', 'Upcoming'], ['today', 'Today'], ['completed', 'Completed'], ['all', 'All']];
  let html = `<div class="filterbar">${chips.map(([k, l]) =>
    `<button class="chip ${jobFilter === k ? 'active' : ''}" onclick="jobFilter='${k}';render()">${l}</button>`).join('')}</div>`;

  if (!list.length) {
    html += `<div class="empty"><div class="big">🧽</div>No jobs here.<br>Tap ＋ to schedule one.</div>`;
    return html;
  }
  let lastDate = null;
  list.forEach((j) => {
    if (j.date !== lastDate) {
      lastDate = j.date;
      html += `<h2 class="section">${j.date === today ? 'Today — ' : ''}${fmtDateShort(j.date)}</h2>`;
    }
    html += jobCardHTML(j);
  });
  return html;
}

function jobDetailHTML(id) {
  const j = getJob(id);
  if (!j) { detailView = null; return jobsHTML(); }
  const c = getClient(j.clientId);
  const st = JOB_STATUS[j.status] || JOB_STATUS.scheduled;
  const inv = j.invoiceId ? getInvoice(j.invoiceId) : null;

  let lines = '';
  (j.serviceIds || []).forEach((sid) => {
    const s = getService(sid);
    if (s) lines += `<div class="listline"><div class="grow">${esc(s.name)}</div><div class="amount">${money(s.price)}</div></div>`;
  });
  (j.customItems || []).forEach((it) => {
    lines += `<div class="listline"><div class="grow">${esc(it.name)}</div><div class="amount">${money(it.price)}</div></div>`;
  });

  return `
    <button class="btn small ghost" onclick="nav('jobs')">‹ Jobs</button>
    <div class="card" style="margin-top:12px">
      <div class="row">
        <div class="grow">
          <b style="font-size:17px">${esc(c?.name || 'Unknown client')}</b>
          <div class="muted">${fmtDateShort(j.date)}${j.time ? ' · ' + fmtTime(j.time) : ''}</div>
          ${j.vehicleId ? `<div class="muted small">🚙 ${esc(vehicleLabel(c, j.vehicleId))}</div>` : ''}
        </div>
        <span class="pill ${st.cls}">${st.label}</span>
      </div>
      <hr class="divider">
      ${lines || '<div class="muted">No services listed.</div>'}
      <div class="row" style="margin-top:10px"><div class="grow"><b>Total</b></div><div class="amount" style="font-size:18px">${money(jobTotal(j))}</div></div>
      ${j.notes ? `<hr class="divider"><div class="muted">📝 ${esc(j.notes)}</div>` : ''}
    </div>

    ${j.status === 'scheduled' ? `<div class="btnrow">
        <button class="btn" onclick="setJobStatus('${j.id}','inprogress')">▶ Start job</button>
        <button class="btn ghost" onclick="setJobStatus('${j.id}','completed')">✓ Complete</button>
      </div>` : ''}
    ${j.status === 'inprogress' ? `<div class="btnrow">
        <button class="btn" onclick="setJobStatus('${j.id}','completed')">✓ Mark completed</button>
      </div>` : ''}
    ${j.status === 'completed' && !inv ? `<div class="btnrow">
        <button class="btn" onclick="createInvoiceFromJob('${j.id}')">🧾 Generate invoice</button>
      </div>` : ''}
    ${inv ? `<div class="card tappable" onclick="openDetail('invoice','${inv.id}')">
        <div class="row"><div class="grow"><b>Invoice ${esc(inv.number)}</b><div class="muted">${fmtDate(inv.dateIssued)}</div></div>
        <span class="pill ${inv.status === 'paid' ? 'ok' : 'warn'}">${inv.status === 'paid' ? 'Paid' : 'Unpaid'}</span></div>
      </div>` : ''}

    <div class="btnrow">
      <button class="btn ghost" onclick="openJobForm('${j.id}')">✏️ Edit</button>
      ${j.status !== 'cancelled' ? `<button class="btn ghost" onclick="setJobStatus('${j.id}','cancelled')">Cancel job</button>` : ''}
      <button class="btn danger" onclick="deleteJob('${j.id}')">Delete</button>
    </div>`;
}

function setJobStatus(id, status) {
  const j = getJob(id);
  j.status = status;
  save();
  render();
  toast(status === 'completed' ? 'Job completed 🎉' : 'Job ' + JOB_STATUS[status].label.toLowerCase());
}

function deleteJob(id) {
  if (!confirm('Delete this job?')) return;
  db.jobs = db.jobs.filter((x) => x.id !== id);
  save();
  nav('jobs');
  toast('Job deleted');
}

function openJobForm(id, presetClientId) {
  if (!db.clients.length) { toast('Add a client first'); openClientForm(); return; }
  const j = id ? getJob(id) : null;
  window._formCustomItems = j ? JSON.parse(JSON.stringify(j.customItems || [])) : [];
  const selClient = j?.clientId || presetClientId || db.clients[0].id;

  const body = `
    <div class="field"><label>Client *</label>
      <select id="f_client" onchange="refreshVehicleSelect()">${db.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) =>
        `<option value="${c.id}" ${c.id === selClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Vehicle</label><select id="f_vehicle"></select></div>
    <div class="field-2">
      <div class="field"><label>Date *</label><input id="f_date" type="date" value="${j?.date || todayISO()}"></div>
      <div class="field"><label>Time</label><input id="f_time" type="time" value="${j?.time || ''}"></div>
    </div>
    ${catalogChecklistHTML(j)}
    <div id="customItems"></div>
    <button class="btn small ghost" onclick="addCustomItemRow()">＋ Custom line item</button>
    <div class="field" style="margin-top:12px"><label>Price override — leave blank to use the sum of services</label>
      <input id="f_override" type="number" inputmode="decimal" value="${j?.priceOverride ?? ''}" placeholder="Auto"></div>
    <div class="field"><label>Notes</label><textarea id="f_jnotes" placeholder="Special requests…">${esc(j?.notes || '')}</textarea></div>
    <div class="btnrow"><button class="btn block" onclick="saveJob('${id || ''}')">Save job</button></div>`;

  openModal(id ? 'Edit job' : 'New job', body, () => {
    refreshVehicleSelect(j?.vehicleId);
    renderCustomItemRows();
  });
}

function catalogChecklistHTML(j) {
  return CATALOG_TYPES.map(([type, label]) => {
    const items = db.services.filter((s) => s.active && (s.type || 'service') === type);
    if (!items.length) return '';
    return `<h2 class="section">${label}</h2>
      <div class="card" style="padding:4px 14px">
        ${items.map((s) => `
          <label class="checkline"><input type="checkbox" class="svc" value="${s.id}" ${j?.serviceIds?.includes(s.id) ? 'checked' : ''}>
          <span class="grow">${esc(s.name)}${s.desc ? `<div class="muted small">${esc(s.desc)}</div>` : ''}</span><b>${money(s.price)}</b></label>`).join('')}
      </div>`;
  }).join('');
}

function refreshVehicleSelect(selectedId) {
  const cid = document.getElementById('f_client').value;
  const c = getClient(cid);
  const sel = document.getElementById('f_vehicle');
  const vehicles = c?.vehicles || [];
  sel.innerHTML = `<option value="">— none —</option>` + vehicles.map((v) =>
    `<option value="${v.id}" ${v.id === selectedId ? 'selected' : ''}>${esc([v.year, v.make, v.model].filter(Boolean).join(' '))}</option>`).join('');
  if (!selectedId && vehicles.length === 1) sel.value = vehicles[0].id;
}

function renderCustomItemRows() {
  const host = document.getElementById('customItems');
  if (!host) return;
  host.innerHTML = window._formCustomItems.map((it, i) => `
    <div class="field-2" style="align-items:end">
      <div class="field"><label>Item</label><input data-ci="${i}" data-ck="name" value="${esc(it.name)}" placeholder="Odor removal"></div>
      <div class="field"><label>Price <button class="btn small danger" style="float:right;padding:0 6px" onclick="removeCustomItemRow(${i})">✕</button></label>
        <input data-ci="${i}" data-ck="price" type="number" inputmode="decimal" value="${it.price}"></div>
    </div>`).join('');
  host.querySelectorAll('input[data-ci]').forEach((inp) => {
    inp.oninput = () => { window._formCustomItems[Number(inp.dataset.ci)][inp.dataset.ck] = inp.value; };
  });
}

function addCustomItemRow() {
  window._formCustomItems.push({ name: '', price: '' });
  renderCustomItemRows();
}

function removeCustomItemRow(i) {
  window._formCustomItems.splice(i, 1);
  renderCustomItemRows();
}

function saveJob(id) {
  const date = document.getElementById('f_date').value;
  if (!date) { toast('Date is required'); return; }
  const data = {
    clientId: document.getElementById('f_client').value,
    vehicleId: document.getElementById('f_vehicle').value,
    date,
    time: document.getElementById('f_time').value,
    serviceIds: [...document.querySelectorAll('.svc:checked')].map((x) => x.value),
    customItems: window._formCustomItems.filter((it) => it.name),
    priceOverride: document.getElementById('f_override').value,
    notes: document.getElementById('f_jnotes').value.trim(),
  };
  if (id) {
    Object.assign(getJob(id), data);
  } else {
    const j = { id: uid(), status: 'scheduled', createdAt: todayISO(), ...data };
    db.jobs.push(j);
    detailView = { type: 'job', id: j.id };
    currentTab = 'jobs';
  }
  save();
  closeModal();
  render();
  toast('Job saved');
}

// ---------------------------------------------------------------- invoices

let invoiceFilter = 'all';

function nextInvoiceNumber() {
  const s = db.settings;
  if (s.invoiceNumStyle === 'date') {
    // e.g. FTM-250601 → year 25, month 06, invoice 01 (counter resets monthly)
    const now = new Date();
    const ym = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
    if (s.lastInvMonth !== ym) {
      // restart the counter only on a genuine month change — an empty
      // lastInvMonth just means the counter was set manually or seeded
      if (s.lastInvMonth) s.nextInvoiceNum = 1;
      s.lastInvMonth = ym;
      save();
    }
    return s.invoicePrefix + ym + String(s.nextInvoiceNum).padStart(2, '0');
  }
  return s.invoicePrefix + String(s.nextInvoiceNum).padStart(3, '0');
}

function invoiceCardHTML(inv) {
  const c = getClient(inv.clientId);
  const bal = invoiceBalance(inv);
  return `
    <div class="card tappable" onclick="openDetail('invoice','${inv.id}')">
      <div class="row">
        <div class="grow">
          <b>${esc(inv.number)}</b> <span class="muted">· ${esc(c?.name || inv.billTo || 'Unknown')}</span>
          <div class="muted small">${fmtDate(inv.dateIssued)}${inv.dueDate ? ' · due ' + fmtDate(inv.dueDate) : ''}${invoiceStatus(inv) === 'part' ? ' · ' + money(bal) + ' left' : ''}</div>
        </div>
        <div style="text-align:right">
          <div class="amount">${money(invoiceTotal(inv))}</div>
          ${statusPill(inv)}
        </div>
      </div>
    </div>`;
}

function invoicesHTML() {
  let list = db.invoices.slice().sort((a, b) => b.dateIssued.localeCompare(a.dateIssued));
  if (invoiceFilter === 'unpaid') list = list.filter((i) => i.status !== 'paid');
  else if (invoiceFilter === 'paid') list = list.filter((i) => i.status === 'paid');

  const unpaidTotal = db.invoices.filter((i) => i.status !== 'paid').reduce((t, i) => t + invoiceBalance(i), 0);

  let html = `<div class="filterbar">
    ${[['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid']].map(([k, l]) =>
      `<button class="chip ${invoiceFilter === k ? 'active' : ''}" onclick="invoiceFilter='${k}';render()">${l}</button>`).join('')}
  </div>`;
  if (unpaidTotal > 0) html += `<div class="card"><div class="row"><div class="grow muted">Outstanding balance</div><b class="amount" style="color:var(--warn)">${money(unpaidTotal)}</b></div></div>`;

  if (!list.length) {
    html += `<div class="empty"><div class="big">🧾</div>No invoices${invoiceFilter !== 'all' ? ' in this filter' : ' yet'}.<br>Complete a job or tap ＋ to create one.</div>`;
    return html;
  }
  list.forEach((i) => { html += invoiceCardHTML(i); });
  return html;
}

function invoiceDetailHTML(id) {
  const inv = getInvoice(id);
  if (!inv) { detailView = null; return invoicesHTML(); }
  const c = getClient(inv.clientId);
  const s = db.settings;
  const sub = invoiceSubtotal(inv);
  const disc = invoiceDiscount(inv);
  const tax = (sub - disc) * ((Number(inv.taxRate) || 0) / 100);
  const delivery = inv.delivery;
  const total = invoiceTotal(inv);
  const st = invoiceStatus(inv);
  const balance = invoiceBalance(inv);
  const today = todayISO();
  const overdue = st !== 'paid' && inv.dueDate && inv.dueDate < today;
  const cur = s.currency;
  const hasPayInfo = s.payName || s.payNumber || s.payBank;
  const discLabel = inv.discountType === 'percent' ? `DISCOUNT (${Number(inv.discountValue) || 0}%)` : 'DISCOUNT';

  return `
    <button class="btn small ghost no-print" onclick="nav('invoices')">‹ Invoices</button>
    <div class="inv-paper" style="margin-top:12px">
      <div class="inv2-head">
        <div class="inv2-brand">
          ${s.logoImg ? `<img class="inv2-logoimg" src="${esc(s.logoImg)}" alt="">` : `<div class="inv2-logo">${esc(s.logo)}</div>`}
          <div><b style="font-size:18px">${esc(s.bizName)}</b></div>
        </div>
        <div class="inv2-meta">
          <div class="inv2-title">INVOICE</div>
          <div class="inv2-metarow"><span>INVOICE NO:</span><b>${esc(inv.number)}</b></div>
          <div class="inv2-metarow"><span>DATE:</span><b>${fmtDate(inv.dateIssued)}</b></div>
          ${inv.dueDate ? `<div class="inv2-metarow"><span>DUE DATE:</span><b>${fmtDate(inv.dueDate)}</b></div>` : ''}
        </div>
      </div>

      <div class="inv2-parties">
        <div class="grow">
          <div class="inv2-lbl">BILLED TO:</div>
          <div class="inv2-billname">${esc(c?.name || inv.billTo || '—')}</div>
          ${c?.phone ? `<div class="muted small">${esc(c.phone)}</div>` : ''}
        </div>
        <div>
          <div class="inv2-lbl">FROM:</div>
          <b>${esc(s.bizName)}</b>
          ${s.phone ? `<div class="muted small">📞 ${esc(s.phone)}</div>` : ''}
          ${s.address ? `<div class="muted small">📍 ${esc(s.address)}</div>` : ''}
        </div>
      </div>

      <div style="overflow-x:auto">
      <table class="inv-table inv2-table">
        <thead><tr><th>S/N</th><th>Description</th><th class="num">Qty</th><th class="num">Unit Price (${esc(cur)})</th><th class="num">Amount (${esc(cur)})</th></tr></thead>
        <tbody>
          ${inv.items.map((it, i) => `<tr>
            <td>${i + 1}</td>
            <td>${esc(it.name)}</td>
            <td class="num">${Number(it.qty) || 1}</td>
            <td class="num">${moneyBare(it.price)}</td>
            <td class="num">${moneyBare((Number(it.qty) || 1) * (Number(it.price) || 0))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>

      <div class="inv-totals">
        <div class="row"><span class="muted">SUBTOTAL</span><span>${moneyBare(sub)}</span></div>
        ${disc ? `<div class="row"><span class="muted">${discLabel}</span><span>−${moneyBare(disc)}</span></div>` : ''}
        ${Number(inv.taxRate) ? `<div class="row"><span class="muted">TAX (${inv.taxRate}%)</span><span>${moneyBare(tax)}</span></div>` : ''}
        ${delivery !== '' && delivery != null ? `<div class="row"><span class="muted">DELIVERY</span><span>${moneyBare(delivery)}</span></div>` : ''}
        <div class="row inv2-grand"><span>TOTAL</span><span>${money(total)}</span></div>
        ${st === 'part' ? `
          <div class="row"><span class="muted">AMOUNT PAID</span><span>${moneyBare(inv.amountPaid)}</span></div>
          <div class="row"><span class="muted"><b>BALANCE DUE</b></span><span style="color:var(--danger)"><b>${moneyBare(balance)}</b></span></div>` : ''}
        ${st === 'paid' ? `<div class="row"><span class="muted">Paid</span><span style="color:var(--ok)">✓ ${fmtDate(inv.paidDate)}</span></div>` : ''}
      </div>

      <div class="inv2-thanks">${esc(s.invoiceFooter || '')}</div>
      ${inv.notes ? `<div class="muted small" style="margin-top:8px">${esc(inv.notes)}</div>` : ''}

      ${s.signatureName || s.signatureImg ? `
      <div style="margin-top:18px">
        ${s.signatureImg
          ? `<img src="${esc(s.signatureImg)}" alt="" style="height:46px;max-width:180px;object-fit:contain;display:block">`
          : `<div style="width:180px;border-bottom:1px solid var(--line);height:26px"></div>`}
        <b style="font-size:14px">${esc(s.signatureName)}</b>
        <div class="muted small">Authorized signature</div>
      </div>` : ''}

      ${hasPayInfo ? `
      <div class="inv2-paybox">
        <div class="inv2-paylbl">💳 PAYMENT INFORMATION</div>
        <div class="muted small" style="margin:6px 0 10px">Please make payment to the account below:</div>
        ${s.payName ? `<div class="inv2-payrow"><span>ACCOUNT NAME</span><b>${esc(s.payName)}</b></div>` : ''}
        ${s.payNumber ? `<div class="inv2-payrow"><span>ACCOUNT NUMBER</span><b>${esc(s.payNumber)}</b></div>` : ''}
        ${s.payBank ? `<div class="inv2-payrow"><span>BANK / WALLET</span><b>${esc(s.payBank)}</b></div>` : ''}
      </div>` : ''}

      ${s.bottomTagline ? `<div class="inv2-tagbar">${esc(s.bottomTagline)}</div>` : ''}
    </div>

    <div class="no-print">
      ${st !== 'paid'
        ? `<div class="btnrow">
            <button class="btn" onclick="markPaid('${inv.id}')">✓ Mark fully paid</button>
            <button class="btn ghost" onclick="openPaymentForm('${inv.id}')">${esc(cur)} Record payment</button>
          </div>`
        : `<div class="btnrow"><button class="btn ghost" onclick="markUnpaid('${inv.id}')">Mark as unpaid</button></div>`}
      ${overdue ? `<div class="card"><span class="pill danger">Overdue</span> <span class="muted small">Due date was ${fmtDate(inv.dueDate)}</span></div>` : ''}
      <div class="btnrow">
        <button class="btn" onclick="exportInvoicePDF('${inv.id}')">📄 Export PDF</button>
        <button class="btn ghost" onclick="shareInvoice('${inv.id}')">📤 Share text</button>
      </div>
      <div class="btnrow">
        <button class="btn ghost" onclick="window.print()">🖨 Print</button>
        <button class="btn ghost" onclick="duplicateInvoice('${inv.id}')">⧉ Duplicate</button>
      </div>
      <div class="btnrow">
        <button class="btn ghost" onclick="openInvoiceForm('${inv.id}')">✏️ Edit</button>
        <button class="btn danger" onclick="deleteInvoice('${inv.id}')">Delete</button>
      </div>
    </div>`;
}

function markPaid(id) {
  const inv = getInvoice(id);
  inv.status = 'paid';
  inv.amountPaid = invoiceTotal(inv);
  inv.paidDate = todayISO();
  save();
  render();
  toast('Invoice marked paid 💰');
}

function markUnpaid(id) {
  const inv = getInvoice(id);
  inv.status = 'unpaid';
  inv.amountPaid = 0;
  inv.paidDate = null;
  save();
  render();
}

function openPaymentForm(id) {
  const inv = getInvoice(id);
  const balance = invoiceBalance(inv);
  const body = `
    <div class="muted" style="margin-bottom:12px">Total ${money(invoiceTotal(inv))} · already paid ${money(inv.amountPaid || 0)} · balance <b style="color:var(--danger)">${money(balance)}</b></div>
    <div class="field"><label>Amount received (${esc(db.settings.currency)})</label>
      <input id="pay_amount" type="number" inputmode="decimal" value="${balance}" min="0"></div>
    <div class="btnrow"><button class="btn block" onclick="recordPayment('${id}')">Record payment</button></div>`;
  openModal('Record payment — ' + inv.number, body);
}

function recordPayment(id) {
  const inv = getInvoice(id);
  const amt = Number(document.getElementById('pay_amount').value);
  if (!amt || amt <= 0) { toast('Enter a valid amount'); return; }
  inv.amountPaid = (Number(inv.amountPaid) || 0) + amt;
  if (inv.amountPaid >= invoiceTotal(inv) - 0.005) {
    inv.amountPaid = invoiceTotal(inv);
    inv.status = 'paid';
    inv.paidDate = todayISO();
    toast('Fully paid 💰');
  } else {
    inv.status = 'unpaid';
    toast('Part-payment recorded — ' + money(invoiceBalance(inv)) + ' left');
  }
  save();
  closeModal();
  render();
}

function duplicateInvoice(id) {
  const src = getInvoice(id);
  const dup = JSON.parse(JSON.stringify(src));
  dup.id = uid();
  dup.number = nextInvoiceNumber();
  dup.jobId = null;
  dup.dateIssued = todayISO();
  dup.dueDate = addDays(todayISO(), 14);
  dup.status = 'unpaid';
  dup.amountPaid = 0;
  dup.paidDate = null;
  db.invoices.push(dup);
  db.settings.nextInvoiceNum++;
  save();
  openDetail('invoice', dup.id);
  toast('Duplicated as ' + dup.number);
}

function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  const job = db.jobs.find((j) => j.invoiceId === id);
  if (job) job.invoiceId = null;
  db.invoices = db.invoices.filter((x) => x.id !== id);
  save();
  nav('invoices');
  toast('Invoice deleted');
}

function shareInvoice(id) {
  const inv = getInvoice(id);
  const c = getClient(inv.clientId);
  const s = db.settings;
  const lines = inv.items.map((it) => `• ${it.name} — ${money((Number(it.qty) || 1) * (Number(it.price) || 0))}`).join('\n');
  const delivery = Number(inv.delivery) || 0;
  const st = invoiceStatus(inv);
  const payStatus = st === 'paid' ? '\nStatus: PAID ✓'
    : st === 'part' ? `\nAmount paid: ${money(inv.amountPaid)}\nBalance due: ${money(invoiceBalance(inv))}` : '';
  const payInfo = [s.payName && `Account name: ${s.payName}`, s.payNumber && `Account number: ${s.payNumber}`, s.payBank && `Bank/Wallet: ${s.payBank}`].filter(Boolean).join('\n');
  const text = `${s.bizName}\nInvoice ${inv.number} — ${fmtDate(inv.dateIssued)}\n\nBill to: ${c?.name || inv.billTo || ''}\n\n${lines}${delivery ? `\n• Delivery — ${money(delivery)}` : ''}\n\nTotal: ${money(invoiceTotal(inv))}${payStatus}${inv.dueDate ? `\nDue: ${fmtDate(inv.dueDate)}` : ''}${payInfo ? `\n\nPayment information:\n${payInfo}` : ''}\n\n${s.invoiceFooter || ''}`;
  if (navigator.share) {
    navigator.share({ title: `Invoice ${inv.number}`, text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => toast('Invoice copied to clipboard'));
  }
}

// ---------------------------------------------------------------- PDF export
// pdfmake (~2 MB) is loaded on demand the first time a PDF is exported,
// then kept in the service-worker cache for offline use.

let _pdfLibsPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(el);
  });
}

async function ensurePdfMake() {
  if (window.pdfMake) return;
  if (!_pdfLibsPromise) {
    _pdfLibsPromise = loadScript('lib/pdfmake.min.js').then(() => loadScript('lib/vfs_fonts.js'));
  }
  await _pdfLibsPromise;
}

// Rasterize the current logo (SVG file or uploaded image) to a PNG data URI for pdfmake.
function logoDataURI() {
  return new Promise((resolve) => {
    const src = db.settings.logoImg;
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const h = 120;
        const w = Math.round(h * (img.width / img.height || 1));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png'));
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function exportInvoicePDF(id) {
  const inv = getInvoice(id);
  if (!inv) return;
  toast('Preparing PDF…');
  try {
    await ensurePdfMake();
    const logo = await logoDataURI();

    const s = db.settings;
    const c = getClient(inv.clientId);
    const cur = s.currency;
    const RED = s.accent || '#c8102e';
    const BLACK = '#15151a';
    const GREY = '#666666';
    const LINE = '#cccccc';

    const sub = invoiceSubtotal(inv);
    const disc = invoiceDiscount(inv);
    const tax = (sub - disc) * ((Number(inv.taxRate) || 0) / 100);
    const delivery = Number(inv.delivery) || 0;
    const total = invoiceTotal(inv);
    const st = invoiceStatus(inv);
    const nb = (n) => moneyBare(n);

    const itemRows = inv.items.map((it, i) => [
      { text: String(i + 1), style: 'cell', alignment: 'center' },
      { text: it.name || '', style: 'cell' },
      { text: String(Number(it.qty) || 1), style: 'cell', alignment: 'center' },
      { text: nb(it.price), style: 'cell', alignment: 'right' },
      { text: nb((Number(it.qty) || 1) * (Number(it.price) || 0)), style: 'cell', alignment: 'right' },
    ]);

    const totalsBody = [];
    const trow = (label, value, opts = {}) => totalsBody.push([
      { text: label, fontSize: 9, bold: !!opts.bold, color: opts.color || GREY, alignment: 'right', border: [false, false, false, false], margin: [0, 2, 8, 2] },
      { text: value, fontSize: opts.big ? 12 : 10, bold: !!opts.bold, color: opts.fill ? '#fff' : (opts.color || BLACK), alignment: 'right', fillColor: opts.fill || null, border: [false, false, false, false], margin: [4, opts.big ? 4 : 2, 4, opts.big ? 4 : 2] },
    ]);
    trow('SUBTOTAL', nb(sub));
    if (disc) trow(inv.discountType === 'percent' ? `DISCOUNT (${Number(inv.discountValue) || 0}%)` : 'DISCOUNT', '−' + nb(disc));
    if (Number(inv.taxRate)) trow(`TAX (${inv.taxRate}%)`, nb(tax));
    trow('DELIVERY', nb(delivery));
    trow('TOTAL', cur + nb(total), { bold: true, fill: RED, big: true });
    if (st === 'part') {
      trow('AMOUNT PAID', nb(inv.amountPaid));
      trow('BALANCE DUE', cur + nb(invoiceBalance(inv)), { bold: true, color: RED });
    }
    if (st === 'paid') trow('PAID', fmtDate(inv.paidDate), { color: '#1a9a5c', bold: true });

    const hasPayInfo = s.payName || s.payNumber || s.payBank;
    const payRows = [
      s.payName && ['ACCOUNT NAME', s.payName],
      s.payNumber && ['ACCOUNT NUMBER', s.payNumber],
      s.payBank && ['BANK / WALLET', s.payBank],
    ].filter(Boolean);

    const dd = {
      pageSize: 'A4',
      pageMargins: [46, 40, 46, 66],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: BLACK },
      styles: {
        cell: { fontSize: 10, margin: [4, 5, 4, 5] },
        th: { fontSize: 9, bold: true, color: '#fff', fillColor: RED, margin: [4, 6, 4, 6] },
        redLbl: { fontSize: 8, bold: true, color: '#fff', fillColor: RED },
      },
      content: [
        // header: brand left, INVOICE meta right
        {
          columns: [
            {
              width: '*',
              stack: [
                ...(logo ? [{ image: logo, fit: [110, 46], margin: [0, 0, 0, 4] }] : []),
                { text: s.bizName, fontSize: 16, bold: true },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'INVOICE', fontSize: 24, bold: true, alignment: 'right', margin: [0, 0, 0, 6] },
                {
                  table: {
                    body: [
                      [{ text: 'INVOICE NO:', style: 'redLbl', margin: [4, 2, 4, 2] }, { text: inv.number, fontSize: 9, bold: true, alignment: 'right', margin: [4, 2, 0, 2] }],
                      [{ text: 'DATE:', style: 'redLbl', margin: [4, 2, 4, 2] }, { text: fmtDate(inv.dateIssued), fontSize: 9, alignment: 'right', margin: [4, 2, 0, 2] }],
                      ...(inv.dueDate ? [[{ text: 'DUE DATE:', style: 'redLbl', margin: [4, 2, 4, 2] }, { text: fmtDate(inv.dueDate), fontSize: 9, alignment: 'right', margin: [4, 2, 0, 2] }]] : []),
                    ],
                  },
                  layout: 'noBorders',
                },
              ],
            },
          ],
        },
        // full-width red rule (canvas lines get displaced by pdfmake flow — use a filled cell)
        {
          table: { widths: ['*'], heights: [3], body: [[{ text: '', fontSize: 1, fillColor: RED, border: [false, false, false, false] }]] },
          layout: 'noBorders',
          margin: [0, 8, 0, 14],
        },

        // billed to / from
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'BILLED TO:', fontSize: 8, bold: true, color: RED, margin: [0, 0, 0, 3] },
                { text: c?.name || inv.billTo || '—', fontSize: 15, bold: true },
                ...(c?.phone ? [{ text: c.phone, fontSize: 9, color: GREY, margin: [0, 2, 0, 0] }] : []),
                ...(c?.address ? [{ text: c.address, fontSize: 9, color: GREY }] : []),
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'FROM:', fontSize: 8, bold: true, color: RED, margin: [0, 0, 0, 3] },
                { text: s.bizName, fontSize: 10, bold: true },
                ...(s.phone ? [{ text: s.phone, fontSize: 9, color: GREY }] : []),
                ...(s.address ? [{ text: s.address, fontSize: 9, color: GREY }] : []),
              ],
            },
          ],
          margin: [0, 0, 0, 16],
        },

        // items table
        {
          table: {
            headerRows: 1,
            widths: [28, '*', 34, 90, 90],
            body: [
              [
                { text: 'S/N', style: 'th', alignment: 'center' },
                { text: 'DESCRIPTION', style: 'th' },
                { text: 'QTY', style: 'th', alignment: 'center' },
                { text: `UNIT PRICE (${cur})`, style: 'th', alignment: 'right' },
                { text: `AMOUNT (${cur})`, style: 'th', alignment: 'right' },
              ],
              ...itemRows,
            ],
          },
          layout: {
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
            hLineColor: () => LINE, vLineColor: () => LINE,
          },
          margin: [0, 0, 0, 10],
        },

        // totals (right aligned)
        {
          columns: [
            { width: '*', text: '' },
            { width: 'auto', table: { body: totalsBody }, layout: 'noBorders' },
          ],
          margin: [0, 0, 0, 12],
        },

        // thank you + notes
        ...(s.invoiceFooter ? [{ text: s.invoiceFooter, italics: true, color: RED, fontSize: 13, margin: [0, 0, 0, 4] }] : []),
        ...(inv.notes ? [{ text: inv.notes, fontSize: 9, color: GREY, margin: [0, 0, 0, 4] }] : []),

        // signature
        ...(s.signatureName || s.signatureImg ? [
          ...(s.signatureImg
            ? [{ image: s.signatureImg, fit: [140, 44], margin: [0, 14, 0, 2] }]
            : [{
                table: { widths: [160], heights: [1], body: [[{ text: '', fontSize: 1, fillColor: LINE, border: [false, false, false, false] }]] },
                layout: 'noBorders',
                margin: [0, 44, 0, 2],
              }]),
          { text: s.signatureName || '', fontSize: 10, bold: true },
          { text: 'Authorized signature', fontSize: 8, color: GREY, margin: [0, 1, 0, 0] },
        ] : []),

        // payment information box
        ...(hasPayInfo ? [{
          table: {
            widths: ['*'],
            body: [[{
              border: [true, true, true, true],
              stack: [
                // fillColor only paints table cells, so the chip must be its own tiny table
                { table: { body: [[{ text: 'PAYMENT INFORMATION', style: 'redLbl', fontSize: 9, margin: [6, 3, 6, 3] }]] }, layout: 'noBorders' },
                { text: 'Please make payment to the account below:', fontSize: 8, color: GREY, margin: [2, 6, 2, 6] },
                ...payRows.map(([l, v]) => ({
                  columns: [
                    { width: 110, text: l, fontSize: 8, bold: true, color: RED, margin: [2, 2, 0, 2] },
                    { width: '*', text: v, fontSize: 10, bold: true, margin: [0, 1, 2, 2] },
                  ],
                })),
              ],
              margin: [6, 6, 6, 6],
            }]],
          },
          layout: {
            hLineWidth: () => 1.5, vLineWidth: () => 1.5,
            hLineColor: () => RED, vLineColor: () => RED,
          },
          margin: [0, 16, 0, 0],
        }] : []),
      ],

      footer: () => ({
        table: {
          widths: ['*'],
          heights: [3, 26],
          body: [
            [{ text: '', fontSize: 1, fillColor: RED, border: [false, false, false, false] }],
            [{ text: s.bottomTagline || '', italics: true, color: '#fff', fillColor: BLACK, alignment: 'center', fontSize: 10, margin: [0, 8, 0, 8], border: [false, false, false, false] }],
          ],
        },
        layout: 'noBorders',
      }),
    };

    const filename = `Invoice-${inv.number}.pdf`;
    const blob = await new Promise((resolve) => pdfMake.createPdf(dd).getBlob(resolve));
    const file = new File([blob], filename, { type: 'application/pdf' });

    // same iOS-safe delivery as backups: share sheet first, download fallback
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    toast('PDF exported ✓');
  } catch (e) {
    if (e.name !== 'AbortError') toast('PDF failed: ' + e.message);
  }
}

function createInvoiceFromJob(jobId) {
  const j = getJob(jobId);
  const items = [];
  (j.serviceIds || []).forEach((sid) => {
    const s = getService(sid);
    if (s) items.push({ name: s.name, qty: 1, price: s.price });
  });
  (j.customItems || []).forEach((it) => items.push({ name: it.name, qty: 1, price: Number(it.price) || 0 }));
  if (j.priceOverride !== '' && j.priceOverride != null && !isNaN(j.priceOverride) && j.priceOverride !== undefined) {
    items.length = 0;
    items.push({ name: 'Detailing service', qty: 1, price: Number(j.priceOverride) });
  }
  const inv = {
    id: uid(),
    number: nextInvoiceNumber(),
    clientId: j.clientId,
    jobId: j.id,
    dateIssued: todayISO(),
    dueDate: addDays(todayISO(), 14),
    items,
    taxRate: db.settings.taxRate,
    discountType: 'amount',
    discountValue: 0,
    delivery: 0,
    status: 'unpaid',
    amountPaid: 0,
    paidDate: null,
    notes: '',
  };
  db.invoices.push(inv);
  j.invoiceId = inv.id;
  db.settings.nextInvoiceNum++;
  save();
  openDetail('invoice', inv.id);
  toast('Invoice ' + inv.number + ' created');
}

function openInvoiceForm(id, presetClientId) {
  const inv = id ? getInvoice(id) : null;
  window._formInvItems = inv ? JSON.parse(JSON.stringify(inv.items)) : [];
  const selClient = inv?.clientId || presetClientId || (db.clients[0] && db.clients[0].id) || '';

  const body = `
    <div class="field"><label>Client</label>
      <select id="fi_client">
        <option value="">— no client —</option>
        ${db.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) =>
          `<option value="${c.id}" ${c.id === selClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select></div>
    <div class="field-2">
      <div class="field"><label>Issue date</label><input id="fi_date" type="date" value="${inv?.dateIssued || todayISO()}"></div>
      <div class="field"><label>Due date</label><input id="fi_due" type="date" value="${inv?.dueDate || addDays(todayISO(), 14)}"></div>
    </div>
    <h2 class="section">Line items</h2>
    <div id="invItems"></div>
    <div class="row" style="gap:8px">
      <button class="btn small ghost" onclick="addInvItemRow()">＋ Blank item</button>
      <select id="fi_addService" style="flex:1;font-family:inherit;font-size:14px;background:var(--bg-raised);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:9px" onchange="addServiceAsItem(this)">
        <option value="">＋ Add from catalog…</option>
        ${CATALOG_TYPES.map(([type, label]) => {
          const items = db.services.filter((s) => s.active && (s.type || 'service') === type);
          if (!items.length) return '';
          return `<optgroup label="${label}">${items.map((s) => `<option value="${s.id}">${esc(s.name)} — ${money(s.price)}</option>`).join('')}</optgroup>`;
        }).join('')}
      </select>
    </div>
    <div class="field-2" style="margin-top:14px">
      <div class="field"><label>Discount type</label>
        <select id="fi_discType">
          <option value="amount" ${(inv?.discountType || 'amount') === 'amount' ? 'selected' : ''}>Amount (${esc(db.settings.currency)})</option>
          <option value="percent" ${inv?.discountType === 'percent' ? 'selected' : ''}>Percent (%)</option>
        </select></div>
      <div class="field"><label>Discount value</label><input id="fi_disc" type="number" inputmode="decimal" value="${inv?.discountValue ?? inv?.discount ?? 0}"></div>
    </div>
    <div class="field-2">
      <div class="field"><label>Delivery fee (${esc(db.settings.currency)})</label><input id="fi_delivery" type="number" inputmode="decimal" value="${inv?.delivery ?? 0}"></div>
      <div class="field"><label>Tax rate %</label><input id="fi_tax" type="number" inputmode="decimal" value="${inv ? inv.taxRate : db.settings.taxRate}"></div>
    </div>
    <div class="field"><label>Notes on invoice</label><textarea id="fi_notes">${esc(inv?.notes || '')}</textarea></div>
    <div class="btnrow"><button class="btn block" onclick="saveInvoice('${id || ''}')">Save invoice</button></div>`;

  openModal(id ? 'Edit ' + inv.number : 'New invoice ' + nextInvoiceNumber(), body, () => renderInvItemRows());
}

function renderInvItemRows() {
  const host = document.getElementById('invItems');
  if (!host) return;
  if (!window._formInvItems.length) {
    host.innerHTML = '<div class="muted small" style="margin-bottom:10px">No line items yet.</div>';
    return;
  }
  host.innerHTML = window._formInvItems.map((it, i) => `
    <div class="row" style="gap:6px;margin-bottom:8px">
      <input data-ii="${i}" data-ik="name" value="${esc(it.name)}" placeholder="Service" style="flex:3;font-family:inherit;font-size:14px;background:var(--bg-raised);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px">
      <input data-ii="${i}" data-ik="qty" type="number" inputmode="numeric" value="${it.qty}" style="flex:1;min-width:0;font-family:inherit;font-size:14px;background:var(--bg-raised);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px" title="Qty">
      <input data-ii="${i}" data-ik="price" type="number" inputmode="decimal" value="${it.price}" style="flex:1.4;min-width:0;font-family:inherit;font-size:14px;background:var(--bg-raised);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px" title="Price">
      <button class="btn small danger" style="padding:8px" onclick="removeInvItemRow(${i})">✕</button>
    </div>`).join('');
  host.querySelectorAll('input[data-ii]').forEach((inp) => {
    inp.oninput = () => { window._formInvItems[Number(inp.dataset.ii)][inp.dataset.ik] = inp.value; };
  });
}

function addInvItemRow() {
  window._formInvItems.push({ name: '', qty: 1, price: '' });
  renderInvItemRows();
}

function addServiceAsItem(sel) {
  const s = getService(sel.value);
  if (s) {
    window._formInvItems.push({ name: s.name, qty: 1, price: s.price });
    renderInvItemRows();
  }
  sel.value = '';
}

function removeInvItemRow(i) {
  window._formInvItems.splice(i, 1);
  renderInvItemRows();
}

function saveInvoice(id) {
  const items = window._formInvItems.filter((it) => it.name);
  if (!items.length) { toast('Add at least one line item'); return; }
  const data = {
    clientId: document.getElementById('fi_client').value,
    dateIssued: document.getElementById('fi_date').value || todayISO(),
    dueDate: document.getElementById('fi_due').value,
    items,
    taxRate: document.getElementById('fi_tax').value,
    discountType: document.getElementById('fi_discType').value,
    discountValue: document.getElementById('fi_disc').value,
    delivery: document.getElementById('fi_delivery').value,
    notes: document.getElementById('fi_notes').value.trim(),
  };
  if (id) {
    Object.assign(getInvoice(id), data);
    save();
    closeModal();
    render();
  } else {
    const inv = { id: uid(), number: nextInvoiceNumber(), jobId: null, status: 'unpaid', amountPaid: 0, paidDate: null, ...data };
    db.invoices.push(inv);
    db.settings.nextInvoiceNum++;
    save();
    closeModal();
    openDetail('invoice', inv.id);
    currentTab = 'invoices';
  }
  toast('Invoice saved');
}

// ---------------------------------------------------------------- settings

function settingsHTML() {
  const s = db.settings;
  return `
    <h2 class="section">Your business</h2>
    <div class="card">
      <div class="field"><label>Business name</label><input id="s_bizName" value="${esc(s.bizName)}" onchange="setSetting('bizName',this.value)"></div>
      <div class="field"><label>Tagline</label><input id="s_tagline" value="${esc(s.tagline)}" onchange="setSetting('tagline',this.value)"></div>
      <div class="field"><label>Logo</label>
        <div class="row">
          <div style="width:56px;height:56px;border:1px solid var(--line);border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
            ${s.logoImg ? `<img src="${esc(s.logoImg)}" alt="" style="width:100%;height:100%;object-fit:contain;padding:3px;box-sizing:border-box">` : `<b style="color:var(--accent)">${esc(s.logo)}</b>`}
          </div>
          <button class="btn small ghost" onclick="document.getElementById('logoFile').click()">Upload image</button>
          ${s.logoImg ? `<button class="btn small danger" onclick="setSetting('logoImg','')">Remove</button>` : ''}
        </div>
        <input type="file" id="logoFile" accept="image/*" style="display:none" onchange="uploadLogo(this)">
      </div>
      <div class="field"><label>Fallback logo text (used if no image)</label><input id="s_logo" value="${esc(s.logo)}" maxlength="4" onchange="setSetting('logo',this.value)"></div>
      <div class="field-2">
        <div class="field"><label>Phone</label><input id="s_phone" value="${esc(s.phone)}" onchange="setSetting('phone',this.value)"></div>
        <div class="field"><label>Email</label><input id="s_email" value="${esc(s.email)}" onchange="setSetting('email',this.value)"></div>
      </div>
      <div class="field"><label>Address (shown on invoices)</label><input id="s_address" value="${esc(s.address)}" onchange="setSetting('address',this.value)"></div>
    </div>

    <h2 class="section">Packages, services & products</h2>
    ${CATALOG_TYPES.map(([type, label]) => {
      const items = db.services.filter((sv) => (sv.type || 'service') === type);
      return `<div class="card">
        <div class="muted small" style="text-transform:uppercase;letter-spacing:0.06em;font-weight:600;padding-bottom:4px">${label}</div>
        ${items.map((sv) => `
          <div class="listline">
            <div class="grow">
              <b style="${sv.active ? '' : 'opacity:0.45;text-decoration:line-through'}">${esc(sv.name)}</b>
              <div class="muted small">${money(sv.price)}${sv.duration ? ' · ' + sv.duration + ' min' : ''}</div>
              ${sv.desc ? `<div class="muted small">${esc(sv.desc)}</div>` : ''}
            </div>
            <button class="btn small ghost" onclick="openServiceForm('${sv.id}')">Edit</button>
          </div>`).join('') || '<div class="muted small">None yet.</div>'}
        <div style="padding-top:10px"><button class="btn small ghost" onclick="openServiceForm(null,'${type}')">＋ Add ${label.toLowerCase().replace(/s$/, '')}</button></div>
      </div>`;
    }).join('')}

    <h2 class="section">Invoicing</h2>
    <div class="card">
      <div class="field-2">
        <div class="field"><label>Currency symbol</label><input value="${esc(s.currency)}" maxlength="4" onchange="setSetting('currency',this.value)"></div>
        <div class="field"><label>Show decimals (kobo)</label>
          <select onchange="setSetting('decimals',Number(this.value))">
            <option value="0" ${!Number(s.decimals) ? 'selected' : ''}>No — ${esc(s.currency)}5,000</option>
            <option value="2" ${Number(s.decimals) === 2 ? 'selected' : ''}>Yes — ${esc(s.currency)}5,000.00</option>
          </select></div>
      </div>
      <div class="field-2">
        <div class="field"><label>Invoice prefix</label><input value="${esc(s.invoicePrefix)}" onchange="setSetting('invoicePrefix',this.value)"></div>
        <div class="field"><label>Numbering style</label>
          <select onchange="setSetting('invoiceNumStyle',this.value)">
            <option value="date" ${s.invoiceNumStyle === 'date' ? 'selected' : ''}>By month (${esc(s.invoicePrefix)}250601)</option>
            <option value="seq" ${s.invoiceNumStyle !== 'date' ? 'selected' : ''}>Sequential (${esc(s.invoicePrefix)}001)</option>
          </select></div>
      </div>
      <div class="field-2">
        <div class="field"><label>Next invoice #</label><input type="number" inputmode="numeric" value="${s.nextInvoiceNum}" onchange="setSetting('nextInvoiceNum',Math.max(1,Number(this.value)||1))"></div>
        <div class="field"><label>Default tax rate %</label><input type="number" inputmode="decimal" value="${s.taxRate}" onchange="setSetting('taxRate',Number(this.value)||0)"></div>
      </div>
      <div class="field"><label>Thank-you message on invoice</label><textarea onchange="setSetting('invoiceFooter',this.value)">${esc(s.invoiceFooter)}</textarea></div>
      <div class="field"><label>Bottom tagline bar on invoice</label><input value="${esc(s.bottomTagline)}" onchange="setSetting('bottomTagline',this.value)"></div>
    </div>

    <h2 class="section">Payment information (shown on invoices)</h2>
    <div class="card">
      <div class="field"><label>Account name</label><input value="${esc(s.payName)}" onchange="setSetting('payName',this.value)"></div>
      <div class="field-2">
        <div class="field"><label>Account number</label><input value="${esc(s.payNumber)}" onchange="setSetting('payNumber',this.value)"></div>
        <div class="field"><label>Bank / wallet</label><input value="${esc(s.payBank)}" onchange="setSetting('payBank',this.value)"></div>
      </div>
    </div>

    <h2 class="section">Authorized signature (shown on invoices)</h2>
    <div class="card">
      <div class="field"><label>Signatory name</label><input value="${esc(s.signatureName)}" onchange="setSetting('signatureName',this.value)"></div>
      <div class="field"><label>Signature</label>
        ${s.signatureImg
          ? `<img src="${esc(s.signatureImg)}" alt="" style="height:60px;max-width:100%;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:4px">`
          : `<div class="muted small" style="border:1.5px dashed var(--line);border-radius:8px;padding:16px;text-align:center">No signature yet — draw or upload one</div>`}
      </div>
      <div class="btnrow" style="margin-top:0">
        <button class="btn ghost" onclick="openSignaturePad()">✍ Draw</button>
        <button class="btn ghost" onclick="document.getElementById('sigFile').click()">Upload</button>
        ${s.signatureImg ? `<button class="btn danger" onclick="setSetting('signatureImg','');render()">Remove</button>` : ''}
      </div>
      <input type="file" id="sigFile" accept="image/*" style="display:none" onchange="uploadSignature(this)">
    </div>

    <h2 class="section">Scheduling</h2>
    <div class="card">
      <div class="field"><label>Default service interval (weeks between visits)</label>
        <input type="number" inputmode="numeric" value="${s.defaultIntervalWeeks}" onchange="setSetting('defaultIntervalWeeks',Math.max(1,Number(this.value)||4))"></div>
      <div class="muted small">Used to compute each client's next-due date after a completed job. Override per client in their profile.</div>
    </div>

    <h2 class="section">Appearance</h2>
    <div class="card">
      <div class="field-2">
        <div class="field"><label>Theme</label>
          <select onchange="setSetting('theme',this.value)">
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
          </select></div>
        <div class="field"><label>Accent color</label><input type="color" value="${esc(s.accent)}" onchange="setSetting('accent',this.value)"></div>
      </div>
    </div>

    <h2 class="section">Connectivity</h2>
    <div class="card">
      <label class="checkline"><input type="checkbox" ${getOfflineMode() ? 'checked' : ''} onchange="setOfflineMode(this.checked)">
        <span class="grow">Offline mode<div class="muted small">On: the app runs entirely from this phone and never touches the internet. Turn off only when you want to update the app, then close and reopen it.</div></span></label>
    </div>

    <h2 class="section">Data</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:10px">All data is stored on this device only. Back it up regularly.</div>
      <div class="btnrow" style="margin-top:0">
        <button class="btn ghost" onclick="exportData()">⬇ Export backup</button>
        <button class="btn ghost" onclick="document.getElementById('importFile').click()">⬆ Import</button>
      </div>
      <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(this)">
      <div class="btnrow"><button class="btn danger" onclick="resetAll()">Erase all data</button></div>
    </div>
    <div class="muted small" style="text-align:center;padding:10px 0 20px">Detailer Pro · ${db.clients.length} clients · ${db.jobs.length} jobs · ${db.invoices.length} invoices</div>`;
}

// ---------------------------------------------------------------- signature

function uploadSignature(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / img.width, 200 / img.height);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      setSetting('signatureImg', c.toDataURL('image/png'));
      render();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function openSignaturePad() {
  const body = `
    <canvas id="sigCanvas" width="500" height="180"
      style="width:100%;height:180px;border:1.5px solid var(--line);border-radius:10px;background:#fff;touch-action:none;cursor:crosshair"></canvas>
    <div class="muted small" style="margin:6px 0 12px">Sign above using your finger</div>
    <div class="btnrow" style="margin-top:0">
      <button class="btn ghost" onclick="clearSigCanvas()">Clear</button>
      <button class="btn" onclick="saveSigCanvas()">Save signature</button>
    </div>`;
  openModal('Draw your signature', body, () => initSigCanvas());
}

function initSigCanvas() {
  const canvas = document.getElementById('sigCanvas');
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#15151a';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let drawing = false;
  let lastX = 0, lastY = 0;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return [(src.clientX - r.left) * (canvas.width / r.width), (src.clientY - r.top) * (canvas.height / r.height)];
  }
  function start(e) { e.preventDefault(); drawing = true; [lastX, lastY] = pos(e); }
  function move(e) {
    e.preventDefault();
    if (!drawing) return;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    [lastX, lastY] = [x, y];
  }
  function stop() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);
}

function clearSigCanvas() {
  const canvas = document.getElementById('sigCanvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function saveSigCanvas() {
  const canvas = document.getElementById('sigCanvas');
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const hasContent = data.some((v, i) => i % 4 === 3 && v > 0);
  if (!hasContent) { toast('Draw your signature first'); return; }
  setSetting('signatureImg', canvas.toDataURL('image/png'));
  closeModal();
  render();
  toast('Signature saved');
}

function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      // downscale so the data URI stays small enough for localStorage
      const max = 512;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      setSetting('logoImg', c.toDataURL('image/png'));
      render();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function setSetting(key, val) {
  db.settings[key] = val;
  save();
  applyTheme();
  toast('Saved');
}

function openServiceForm(id, presetType) {
  const sv = id ? getService(id) : null;
  const type = sv?.type || presetType || 'service';
  const body = `
    <div class="field"><label>Name *</label><input id="sv_name" value="${esc(sv?.name || '')}" placeholder="${type === 'package' ? 'Deluxe Package' : type === 'product' ? 'Microfiber Cleaning Towel' : 'Interior Detail'}"></div>
    <div class="field"><label>Type</label>
      <select id="sv_type">
        <option value="service" ${type === 'service' ? 'selected' : ''}>Service</option>
        <option value="package" ${type === 'package' ? 'selected' : ''}>Package (bundle of services at one price)</option>
        <option value="product" ${type === 'product' ? 'selected' : ''}>Product (item you sell)</option>
      </select></div>
    <div class="field-2">
      <div class="field"><label>Price</label><input id="sv_price" type="number" inputmode="decimal" value="${sv?.price ?? ''}"></div>
      <div class="field"><label>Duration (min)</label><input id="sv_dur" type="number" inputmode="numeric" value="${sv?.duration ?? ''}"></div>
    </div>
    <div class="field"><label>Description / what's included</label><textarea id="sv_desc" placeholder="${type === 'package' ? 'e.g. Full interior + exterior detail, wax & polish' : ''}">${esc(sv?.desc || '')}</textarea></div>
    <label class="checkline"><input type="checkbox" id="sv_active" ${!sv || sv.active ? 'checked' : ''}><span>Active (show when booking and invoicing)</span></label>
    <div class="btnrow">
      <button class="btn block" onclick="saveService('${id || ''}')">Save</button>
      ${id ? `<button class="btn danger" onclick="deleteService('${id}')">Delete</button>` : ''}
    </div>`;
  openModal(id ? 'Edit item' : 'New item', body);
}

function saveService(id) {
  const name = document.getElementById('sv_name').value.trim();
  if (!name) { toast('Name is required'); return; }
  const data = {
    name,
    type: document.getElementById('sv_type').value,
    price: Number(document.getElementById('sv_price').value) || 0,
    duration: Number(document.getElementById('sv_dur').value) || 0,
    desc: document.getElementById('sv_desc').value.trim(),
    active: document.getElementById('sv_active').checked,
  };
  if (id) Object.assign(getService(id), data);
  else db.services.push({ id: uid(), ...data });
  save();
  closeModal();
  render();
  toast('Service saved');
}

function deleteService(id) {
  if (!confirm('Delete this service? Existing jobs keep their totals via custom items, but this service will no longer be selectable.')) return;
  db.services = db.services.filter((x) => x.id !== id);
  save();
  closeModal();
  render();
}

// Backup/restore follows the pattern proven in the Woovio receipts app:
// iOS standalone PWAs block blob-URL downloads, so export goes through the
// Web Share API (share sheet → Save to Files); desktop falls back to download.
async function exportData() {
  try {
    const payload = {
      app: 'fatoma-detailer',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: db,
    };
    const json = JSON.stringify(payload, null, 2);
    const filename = `fatoma-backup-${todayISO()}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Fatoma Autocare backup' });
      toast(`Backup shared — ${db.clients.length} clients, ${db.invoices.length} invoices`);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast(`Backup saved — ${db.clients.length} clients, ${db.invoices.length} invoices`);
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('Backup failed: ' + e.message);
  }
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      // new envelope format, or a legacy raw-state backup
      let data;
      if (payload.app === 'fatoma-detailer') data = payload.data;
      else if (payload.settings && Array.isArray(payload.clients)) data = payload;
      else { toast('This file is not a Fatoma Autocare backup'); return; }

      const when = payload.exportedAt ? payload.exportedAt.slice(0, 10) : 'unknown date';
      const summary = `${(data.clients || []).length} clients, ${(data.jobs || []).length} jobs, ${(data.invoices || []).length} invoices`;
      if (!confirm(`Restore backup from ${when}?\n(${summary})\n\nThis will REPLACE all current data.`)) return;

      db = data;
      db.settings = { ...freshState().settings, ...db.settings };
      db.services.forEach((s) => { if (!s.type) s.type = 'service'; });
      db.invoices.forEach((i) => {
        if (i.discountType === undefined) { i.discountType = 'amount'; i.discountValue = Number(i.discount) || 0; }
        if (i.amountPaid === undefined) i.amountPaid = i.status === 'paid' ? invoiceTotal(i) : 0;
      });
      save();
      render();
      toast('Backup restored ✓');
    } catch (e) {
      toast('Restore failed: invalid backup file');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function resetAll() {
  if (!confirm('Erase ALL clients, jobs, invoices and settings? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure? Consider exporting a backup first.')) return;
  db = freshState();
  save();
  render();
  toast('All data erased');
}

// ---------------------------------------------------------------- offline mode
// Ported from the Woovio receipts app: once everything is cached on the phone,
// the owner flips this on and the app never touches the network again until
// they deliberately turn it off to pick up an update.

function getOfflineMode() {
  return localStorage.getItem('offlineMode') === 'true';
}

async function setOfflineMode(on) {
  if (on) {
    // pull the on-demand PDF engine into the cache before we block the network
    toast('Preparing offline mode…');
    try {
      await Promise.all([fetch('lib/pdfmake.min.js'), fetch('lib/vfs_fonts.js')]);
    } catch (e) { /* already cached or unreachable — the SW lets these through anyway */ }
  }
  localStorage.setItem('offlineMode', on ? 'true' : 'false');
  sendOfflineModeToSW(on);
  toast(on ? 'Offline mode on — network blocked' : 'Update mode — network allowed');
  render();
}

function sendOfflineModeToSW(on) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SET_OFFLINE_MODE', value: on });
  }
}

// ---------------------------------------------------------------- quick add

function openQuickAdd() {
  if (currentTab === 'clients') { openClientForm(); return; }
  if (currentTab === 'invoices') { openInvoiceForm(); return; }
  if (currentTab === 'jobs') { openJobForm(); return; }
  const body = `
    <div class="btnrow" style="flex-direction:column">
      <button class="btn block" onclick="closeModal();openJobForm()">🧽 New job</button>
      <button class="btn block ghost" onclick="closeModal();openClientForm()">👤 New client</button>
      <button class="btn block ghost" onclick="closeModal();openInvoiceForm()">🧾 New invoice</button>
    </div>`;
  openModal('Quick add', body);
}

// ---------------------------------------------------------------- boot

window.addEventListener('error', (e) => {
  console.error('Global error:', e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

document.querySelectorAll('nav.tabbar button').forEach((b) => {
  b.onclick = () => nav(b.dataset.tab);
});
document.getElementById('fab').onclick = openQuickAdd;
document.getElementById('quickAddBtn').onclick = openQuickAdd;

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(() => {
    // re-send the offline preference every load — it survives SW updates/restarts
    navigator.serviceWorker.ready.then(() => sendOfflineModeToSW(getOfflineMode()));
  }).catch(() => {});
}

render();
