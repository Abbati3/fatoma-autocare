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
      instagram: 'fatoma_autocare',
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
delete db.settings.footerImg; // dropped feature — clear any stale stored image
// older data: catalog items default to plain services
db.services.forEach((s) => { if (!s.type) s.type = 'service'; });
// older invoices: flat items → vehicle sections, typed discount, payment tracking
function migrateInvoice(i) {
  if (!i.sections) {
    i.sections = [{ vehicleId: '', carName: '', img: '', label: '', discount: 0, items: i.items || [] }];
    delete i.items;
  }
  if (i.discountType === undefined) {
    i.discountType = 'amount';
    i.discountValue = Number(i.discount) || 0;
  }
  if (i.amountPaid === undefined) {
    i.amountPaid = i.status === 'paid' ? invoiceTotal(i) : 0;
  }
}
db.invoices.forEach(migrateInvoice);
// older jobs: single vehicleId/serviceIds/customItems/priceOverride → a vehicles[] array
function migrateJob(j) {
  if (!j.vehicles) {
    j.vehicles = [{ id: uid(), vehicleId: j.vehicleId || '', serviceIds: j.serviceIds || [], customItems: j.customItems || [], priceOverride: j.priceOverride ?? '' }];
    delete j.vehicleId; delete j.serviceIds; delete j.customItems; delete j.priceOverride;
  }
}
db.jobs.forEach(migrateJob);

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

// "27TH JUNE, 2026" — the style used on the printed invoice
function fmtDateFancy(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  const n = d.getDate();
  const suf = n % 10 === 1 && n !== 11 ? 'ST' : n % 10 === 2 && n !== 12 ? 'ND' : n % 10 === 3 && n !== 13 ? 'RD' : 'TH';
  const month = d.toLocaleDateString('en', { month: 'long' }).toUpperCase();
  return `${n}${suf} ${month}, ${d.getFullYear()}`;
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

function isOpay(bank) {
  return /opay/i.test(bank || '');
}

// Nigerian local numbers (0801...) need the 234 country code for wa.me links
function waLink(phone, text) {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '234' + digits.slice(1);
  return `https://wa.me/${digits}` + (text ? `?text=${encodeURIComponent(text)}` : '');
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

function jobVehicleTotal(jv) {
  let t = 0;
  (jv.serviceIds || []).forEach((sid) => { t += Number(getService(sid)?.price) || 0; });
  (jv.customItems || []).forEach((it) => { t += Number(it.price) || 0; });
  if (jv.priceOverride !== '' && jv.priceOverride != null && !isNaN(jv.priceOverride)) {
    t = Number(jv.priceOverride);
  }
  return t;
}

function jobTotal(job) {
  return (job.vehicles || []).reduce((t, jv) => t + jobVehicleTotal(jv), 0);
}

function sectionSubtotal(sec) {
  return (sec.items || []).reduce((t, it) => t + (Number(it.qty) || 1) * (Number(it.price) || 0), 0);
}
function invoiceSubtotal(inv) {
  return (inv.sections || []).reduce((t, s) => t + sectionSubtotal(s), 0);
}
function invoiceDiscount(inv) {
  const sub = invoiceSubtotal(inv);
  // per-vehicle discounts plus the invoice-level one
  let d = (inv.sections || []).reduce((t, s) => t + (Number(s.discount) || 0), 0);
  if (inv.discountType === 'percent') d += sub * (Number(inv.discountValue) || 0) / 100;
  else d += Number(inv.discountValue ?? inv.discount) || 0;
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
        <a href="sms:${esc(c.phone)}${due ? `?&body=${smsBody}` : ''}"><span class="ico">💬</span>Text</a>
        <a href="${waLink(c.phone, due ? decodeURIComponent(smsBody) : '')}" target="_blank" rel="noopener"><img class="ico-img" src="icon-whatsapp.png" alt="">WhatsApp</a>` : ''}
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
        ${v.img ? `<img src="${esc(v.img)}" alt="" style="width:64px;height:44px;object-fit:cover;border-radius:8px;border:1px solid var(--line);flex-shrink:0">` : ''}
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
      <div class="row" style="gap:10px;margin-bottom:10px">
        ${v.img ? `<img src="${esc(v.img)}" alt="" style="width:72px;height:48px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">` : ''}
        <button class="btn small ghost" onclick="pickVehicleImg(${i})">${v.img ? 'Change photo' : '📷 Add photo'}</button>
        ${v.img ? `<button class="btn small danger" onclick="window._formVehicles[${i}].img='';renderVehicleRows()">✕</button>` : ''}
      </div>
      <button class="btn small danger" onclick="removeVehicleRow(${i})">Remove vehicle</button>
    </div>`).join('');
  host.querySelectorAll('input[data-vi]').forEach((inp) => {
    inp.oninput = () => { window._formVehicles[Number(inp.dataset.vi)][inp.dataset.vk] = inp.value; };
  });
}

function addVehicleRow() {
  window._formVehicles.push({ id: uid(), year: '', make: '', model: '', color: '', plate: '', notes: '', img: '' });
  renderVehicleRows();
}

// photo of the vehicle — shown on invoices, stored downscaled on-device
function pickVehicleImg(i) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 480 / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        window._formVehicles[i].img = c.toDataURL('image/jpeg', 0.82);
        renderVehicleRows();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
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
  const vehicles = j.vehicles || [];
  const carNames = vehicles.map((jv) => vehicleLabel(c, jv.vehicleId)).filter(Boolean);
  const allServices = vehicles.flatMap((jv) =>
    (jv.serviceIds || []).map((sid) => getService(sid)?.name).filter(Boolean).concat((jv.customItems || []).map((it) => it.name)));
  const summaryLine = carNames.length ? carNames.join(', ') : (allServices.join(', ') || 'No services listed');
  return `
    <div class="card tappable" onclick="openDetail('job','${j.id}')">
      <div class="row">
        <div class="grow">
          <div class="nowrap"><b>${esc(c?.name || 'Unknown client')}</b></div>
          <div class="muted nowrap">${esc(summaryLine)}</div>
          <div class="muted small">${withDate ? fmtDateShort(j.date) + (j.time ? ' · ' : '') : ''}${fmtTime(j.time)}${vehicles.length > 1 ? ' · ' + vehicles.length + ' vehicles' : ''}</div>
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
  const vehicles = j.vehicles || [];

  const vehBlocks = vehicles.map((jv, i) => {
    let lines = '';
    (jv.serviceIds || []).forEach((sid) => {
      const s = getService(sid);
      if (s) lines += `<div class="listline"><div class="grow">${esc(s.name)}</div><div class="amount">${money(s.price)}</div></div>`;
    });
    (jv.customItems || []).forEach((it) => {
      lines += `<div class="listline"><div class="grow">${esc(it.name)}</div><div class="amount">${money(it.price)}</div></div>`;
    });
    const label = vehicleLabel(c, jv.vehicleId);
    return `
      <div class="card">
        ${vehicles.length > 1
          ? `<b>🚙 ${esc(label || 'Vehicle ' + (i + 1))}</b><hr class="divider">`
          : (label ? `<div class="muted small">🚙 ${esc(label)}</div><hr class="divider">` : '')}
        ${lines || '<div class="muted">No services listed.</div>'}
        ${vehicles.length > 1 ? `<div class="row" style="margin-top:8px"><div class="grow muted small">Subtotal</div><b>${money(jobVehicleTotal(jv))}</b></div>` : ''}
      </div>`;
  }).join('');

  return `
    <button class="btn small ghost" onclick="nav('jobs')">‹ Jobs</button>
    <div class="card" style="margin-top:12px">
      <div class="row">
        <div class="grow">
          <b style="font-size:17px">${esc(c?.name || 'Unknown client')}</b>
          <div class="muted">${fmtDateShort(j.date)}${j.time ? ' · ' + fmtTime(j.time) : ''}</div>
        </div>
        <span class="pill ${st.cls}">${st.label}</span>
      </div>
    </div>

    ${vehBlocks}

    <div class="card">
      <div class="row"><div class="grow"><b>Total</b></div><div class="amount" style="font-size:18px">${money(jobTotal(j))}</div></div>
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
  window._formJobVehicles = j
    ? JSON.parse(JSON.stringify(j.vehicles || []))
    : [{ vehicleId: '', serviceIds: [], customItems: [], priceOverride: '' }];
  const selClient = j?.clientId || presetClientId || db.clients[0].id;

  const body = `
    <div class="field"><label>Client *</label>
      <select id="f_client" onchange="renderJobVehicles()">${db.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) =>
        `<option value="${c.id}" ${c.id === selClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="field-2">
      <div class="field"><label>Date *</label><input id="f_date" type="date" value="${j?.date || todayISO()}"></div>
      <div class="field"><label>Time</label><input id="f_time" type="time" value="${j?.time || ''}"></div>
    </div>
    <h2 class="section">Vehicles</h2>
    <div id="jobVehiclesHost"></div>
    <button class="btn small ghost" onclick="addJobVehicle()">＋ Add another vehicle</button>
    <div class="field" style="margin-top:14px"><label>Notes</label><textarea id="f_jnotes" placeholder="Special requests…">${esc(j?.notes || '')}</textarea></div>
    <div class="btnrow"><button class="btn block" onclick="saveJob('${id || ''}')">Save job</button></div>`;

  openModal(id ? 'Edit job' : 'New job', body, () => renderJobVehicles());
}

function renderJobVehicles() {
  const host = document.getElementById('jobVehiclesHost');
  if (!host) return;
  const client = getClient(document.getElementById('f_client').value);
  const clientVehicles = client?.vehicles || [];
  host.innerHTML = window._formJobVehicles.map((jv, vi) => jobVehicleBlockHTML(jv, vi, clientVehicles)).join('');
  window._formJobVehicles.forEach((_, vi) => renderJobCustomItems(vi));
}

function jobVehicleBlockHTML(jv, vi, clientVehicles) {
  // auto-pick the client's only vehicle so single-car jobs need no extra tap
  if (!jv.vehicleId && clientVehicles.length === 1) jv.vehicleId = clientVehicles[0].id;
  const catalog = CATALOG_TYPES.map(([type, label]) => {
    const items = db.services.filter((s) => s.active && (s.type || 'service') === type);
    if (!items.length) return '';
    return `<div class="muted small" style="text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin:10px 0 2px">${label}</div>
      ${items.map((s) => `
        <label class="checkline"><input type="checkbox" ${jv.serviceIds?.includes(s.id) ? 'checked' : ''}
          onchange="toggleJobService(${vi},'${s.id}',this.checked)">
        <span class="grow">${esc(s.name)}</span><b>${money(s.price)}</b></label>`).join('')}`;
  }).join('');
  return `
    <div class="card" style="padding:12px">
      <div class="row" style="margin-bottom:8px">
        <b class="grow">Vehicle ${vi + 1}</b>
        ${window._formJobVehicles.length > 1 ? `<button class="btn small danger" onclick="removeJobVehicle(${vi})">Remove</button>` : ''}
      </div>
      ${clientVehicles.length ? `<div class="field"><label>Vehicle</label>
        <select onchange="window._formJobVehicles[${vi}].vehicleId=this.value">
          <option value="">— none —</option>
          ${clientVehicles.map((v) => `<option value="${v.id}" ${jv.vehicleId === v.id ? 'selected' : ''}>${esc([v.year, v.make, v.model].filter(Boolean).join(' '))}</option>`).join('')}
        </select></div>` : '<div class="muted small">This client has no saved vehicles yet.</div>'}
      ${catalog}
      <div id="jvCustom${vi}" style="margin-top:8px"></div>
      <button class="btn small ghost" onclick="addJobCustomItem(${vi})">＋ Custom line item</button>
      <div class="field" style="margin-top:10px;margin-bottom:0"><label>Price override for this vehicle — leave blank to use the sum above</label>
        <input type="number" inputmode="decimal" value="${jv.priceOverride ?? ''}" placeholder="Auto" oninput="window._formJobVehicles[${vi}].priceOverride=this.value"></div>
    </div>`;
}

function toggleJobService(vi, sid, checked) {
  const jv = window._formJobVehicles[vi];
  jv.serviceIds = jv.serviceIds || [];
  if (checked) { if (!jv.serviceIds.includes(sid)) jv.serviceIds.push(sid); }
  else { jv.serviceIds = jv.serviceIds.filter((x) => x !== sid); }
}

function renderJobCustomItems(vi) {
  const host = document.getElementById('jvCustom' + vi);
  if (!host) return;
  const items = window._formJobVehicles[vi].customItems || [];
  host.innerHTML = items.map((it, ii) => `
    <div class="field-2" style="align-items:end">
      <div class="field"><label>Item</label><input value="${esc(it.name)}" placeholder="Odor removal"
        oninput="window._formJobVehicles[${vi}].customItems[${ii}].name=this.value"></div>
      <div class="field"><label>Price <button class="btn small danger" style="float:right;padding:0 6px" onclick="removeJobCustomItem(${vi},${ii})">✕</button></label>
        <input type="number" inputmode="decimal" value="${it.price}" oninput="window._formJobVehicles[${vi}].customItems[${ii}].price=this.value"></div>
    </div>`).join('');
}

function addJobVehicle() {
  window._formJobVehicles.push({ vehicleId: '', serviceIds: [], customItems: [], priceOverride: '' });
  renderJobVehicles();
}

function removeJobVehicle(vi) {
  window._formJobVehicles.splice(vi, 1);
  renderJobVehicles();
}

function addJobCustomItem(vi) {
  window._formJobVehicles[vi].customItems = window._formJobVehicles[vi].customItems || [];
  window._formJobVehicles[vi].customItems.push({ name: '', price: '' });
  renderJobCustomItems(vi);
}

function removeJobCustomItem(vi, ii) {
  window._formJobVehicles[vi].customItems.splice(ii, 1);
  renderJobCustomItems(vi);
}

function saveJob(id) {
  const date = document.getElementById('f_date').value;
  if (!date) { toast('Date is required'); return; }
  const vehicles = window._formJobVehicles.filter((jv) =>
    (jv.serviceIds && jv.serviceIds.length) || (jv.customItems && jv.customItems.some((it) => it.name)));
  if (!vehicles.length) { toast('Add at least one service'); return; }
  vehicles.forEach((jv) => { jv.customItems = (jv.customItems || []).filter((it) => it.name); });
  const data = {
    clientId: document.getElementById('f_client').value,
    date,
    time: document.getElementById('f_time').value,
    vehicles,
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

  const sections = inv.sections || [];

  return `
    <button class="btn small ghost no-print" onclick="nav('invoices')">‹ Invoices</button>
    <div class="inv-paper inv3" style="margin-top:12px">
      <div class="inv3-head">
        ${s.logoImg ? `<img class="inv3-logoimg" src="${esc(s.logoImg)}" alt="">` : `<div class="inv2-logo">${esc(s.logo)}</div>`}
        <div class="inv3-biz">
          <b>${esc(s.bizName).toUpperCase()}</b>
          ${s.address ? `<div>📍 ${esc(s.address)}</div>` : ''}
          ${s.phone ? `<div>📞 ${esc(s.phone)}</div>` : ''}
          ${s.instagram ? `<div><img class="brand-ico" src="icon-instagram.png" alt="">${esc(s.instagram)}</div>` : ''}
          ${s.tagline ? `<div class="inv3-tag">…${esc(s.tagline)}</div>` : ''}
        </div>
      </div>

      <div class="inv3-title">INVOICE</div>

      <div class="inv3-meta">
        <div class="inv3-metabox grow">
          <span>CUSTOMER NAME:</span>
          <b>${esc(c?.name || inv.billTo || '—')}</b>
        </div>
        <div class="inv3-metabox">
          <span>DATE:</span>
          <b>${fmtDateFancy(inv.dateIssued)}</b>
          <div class="inv3-invno">${esc(inv.number)}</div>
        </div>
      </div>

      <div style="overflow-x:auto">
      <table class="inv3-table">
        <thead><tr>
          <th>S/N</th><th>Car Details</th><th>Service(s) Provided</th>
          <th class="num">Total<br><span>(before discount)</span></th>
          <th class="num">Total<br><span>(after discount)</span></th>
        </tr></thead>
        <tbody>
          ${sections.map((sec, i) => {
            const before = sectionSubtotal(sec);
            const after = Math.max(0, before - (Number(sec.discount) || 0));
            const hasVehicleInfo = sec.carName || sec.img || sec.label;
            return `<tr>
              <td>${i + 1}.</td>
              <td class="inv3-car" data-label="${hasVehicleInfo ? 'CAR DETAILS' : ''}">
                ${sec.img ? `<img src="${esc(sec.img)}" alt="">` : ''}
                ${sec.carName ? `<div class="inv3-carname">${esc(sec.carName)}</div>` : ''}
                ${sec.label ? `<div class="inv3-carlabel">${esc(sec.label)}</div>` : ''}
              </td>
              <td class="inv3-svcs" data-label="ITEMS"><ul>${sec.items.map((it) =>
                `<li>${esc(it.name)}${(Number(it.qty) || 1) > 1 ? ` ×${it.qty}` : ''}</li>`).join('')}</ul></td>
              <td class="num" data-label="TOTAL (BEFORE DISCOUNT)">${cur} ${moneyBare(before)}</td>
              <td class="num" data-label="TOTAL (AFTER DISCOUNT)">${cur} ${moneyBare(after)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>

      <div class="inv3-totals">
        <div class="inv3-trow"><span>GRAND TOTAL (BEFORE DISCOUNT):</span><b>${cur} ${moneyBare(sub)}</b></div>
        <div class="inv3-trow"><span>TOTAL DISCOUNT:</span><b>${cur} ${moneyBare(disc)}</b></div>
        ${Number(inv.taxRate) ? `<div class="inv3-trow"><span>TAX (${inv.taxRate}%):</span><b>${cur} ${moneyBare(tax)}</b></div>` : ''}
        ${Number(delivery) ? `<div class="inv3-trow"><span>DELIVERY:</span><b>${cur} ${moneyBare(delivery)}</b></div>` : ''}
        <div class="inv3-trow inv3-grand"><span>GRAND TOTAL (AFTER DISCOUNT):</span><b>${cur} ${moneyBare(total)}</b></div>
        ${st === 'part' ? `
          <div class="inv3-trow"><span>AMOUNT PAID:</span><b>${cur} ${moneyBare(inv.amountPaid)}</b></div>
          <div class="inv3-trow inv3-due"><span>BALANCE DUE:</span><b>${cur} ${moneyBare(balance)}</b></div>` : ''}
        ${st === 'paid' ? `<div class="inv3-trow inv3-paid"><span>PAID:</span><b>${fmtDateFancy(inv.paidDate)}</b></div>` : ''}
      </div>

      ${hasPayInfo ? `
      <div class="inv3-paybox">
        <div class="inv3-payhead">PAYMENT DETAILS</div>
        <div class="inv3-paybody">
          ${s.payNumber ? `<div class="inv3-payitem"><span>ACCOUNT NUMBER:</span><b class="inv3-paynum">${esc(s.payNumber)}</b></div>` : ''}
          ${s.payBank ? `<div class="inv3-payitem"><span>PAYMENT METHOD:</span><b>${isOpay(s.payBank) ? `<img class="brand-ico" src="icon-opay.png" alt="">` : ''}${esc(s.payBank)}</b></div>` : ''}
          ${s.payName ? `<div class="inv3-payitem"><span>ACCOUNT NAME:</span><b>${esc(s.payName)}</b></div>` : ''}
        </div>
      </div>` : ''}

      <div class="inv3-thanks">
        <div class="inv3-script">Thank You!</div>
        ${s.invoiceFooter ? `<div class="inv3-thanksub">${esc(s.invoiceFooter).toUpperCase()}</div>` : ''}
      </div>
      ${inv.notes ? `<div class="inv3-notes">${esc(inv.notes)}</div>` : ''}

      ${s.signatureName || s.signatureImg ? `
      <div style="margin-top:14px">
        ${s.signatureImg
          ? `<img src="${esc(s.signatureImg)}" alt="" style="height:40px;max-width:160px;object-fit:contain;display:block">`
          : `<div style="width:160px;border-bottom:1px solid #c6cede;height:22px"></div>`}
        <b style="font-size:13px">${esc(s.signatureName)}</b>
        <div class="inv3-sigsub">Authorized signature</div>
      </div>` : ''}

      ${s.bottomTagline ? `<div class="inv3-tagbar">${esc(s.bottomTagline)}</div>` : ''}
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
  // backdated invoice → default the acknowledgment to the invoice date, not today
  const defaultDate = inv.dateIssued && inv.dateIssued < todayISO() ? inv.dateIssued : todayISO();
  const body = `
    <div class="muted" style="margin-bottom:12px">Total ${money(invoiceTotal(inv))} · already paid ${money(inv.amountPaid || 0)} · balance <b style="color:var(--danger)">${money(balance)}</b></div>
    <div class="field"><label>Amount received (${esc(db.settings.currency)})</label>
      <input id="pay_amount" type="number" inputmode="decimal" value="${balance}" min="0"></div>
    <div class="field"><label>Date payment was received</label>
      <input id="pay_date" type="date" value="${defaultDate}"></div>
    <div class="btnrow"><button class="btn block" onclick="recordPayment('${id}')">Record payment</button></div>`;
  openModal('Record payment — ' + inv.number, body);
}

function recordPayment(id) {
  const inv = getInvoice(id);
  const amt = Number(document.getElementById('pay_amount').value);
  const payDate = document.getElementById('pay_date').value || todayISO();
  if (!amt || amt <= 0) { toast('Enter a valid amount'); return; }
  inv.amountPaid = (Number(inv.amountPaid) || 0) + amt;
  if (inv.amountPaid >= invoiceTotal(inv) - 0.005) {
    inv.amountPaid = invoiceTotal(inv);
    inv.status = 'paid';
    inv.paidDate = payDate;
    toast('Fully paid 💰');
  } else {
    inv.status = 'unpaid';
    inv.paidDate = payDate; // date of the most recent part-payment
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
  const lines = (inv.sections || []).map((sec) => {
    const head = sec.carName ? `${sec.carName}${sec.label ? ' — ' + sec.label : ''}\n` : '';
    const items = sec.items.map((it) => `• ${it.name}${(Number(it.qty) || 1) > 1 ? ' ×' + it.qty : ''} — ${money((Number(it.qty) || 1) * (Number(it.price) || 0))}`).join('\n');
    const secDisc = Number(sec.discount) || 0;
    return head + items + (secDisc ? `\nDiscount: −${money(secDisc)}` : '');
  }).join('\n\n');
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
// Loads a bundled icon file (whatsapp/instagram/opay) as a data URI for pdfmake.
function iconFileDataURI(filename) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = filename;
  });
}

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
    const s = db.settings;
    const logo = await logoDataURI();
    const igIcon = s.instagram ? await iconFileDataURI('icon-instagram.png') : null;
    const opayIcon = isOpay(s.payBank) ? await iconFileDataURI('icon-opay.png') : null;

    const c = getClient(inv.clientId);
    const cur = s.currency;
    const NAVY = '#1c2b4a';
    const GOLD = '#e9a13b';
    const GREY = '#46506b';
    const LINE = '#c6cede';
    const noB = [false, false, false, false];

    const sub = invoiceSubtotal(inv);
    const disc = invoiceDiscount(inv);
    const tax = (sub - disc) * ((Number(inv.taxRate) || 0) / 100);
    const delivery = Number(inv.delivery) || 0;
    const total = invoiceTotal(inv);
    const st = invoiceStatus(inv);
    const nb = (n) => moneyBare(n);

    const secRows = (inv.sections || []).map((sec, i) => {
      const before = sectionSubtotal(sec);
      const after = Math.max(0, before - (Number(sec.discount) || 0));
      return [
        { text: (i + 1) + '.', style: 'cell', alignment: 'center' },
        {
          stack: [
            ...(sec.img ? [{ image: 'vimg' + i, fit: [84, 50], alignment: 'center', margin: [0, 0, 0, 3] }] : []),
            ...(sec.carName ? [{ text: sec.carName, bold: true, fontSize: 8, alignment: 'center' }] : []),
            ...(sec.label ? [{ text: sec.label, color: GOLD, bold: true, fontSize: 7, alignment: 'center', margin: [0, 1, 0, 0] }] : []),
          ],
          style: 'cell',
        },
        { ul: sec.items.map((it) => (it.name || '') + ((Number(it.qty) || 1) > 1 ? ' ×' + it.qty : '')), fontSize: 8, style: 'cell' },
        { text: cur + ' ' + nb(before), style: 'cell', alignment: 'right', bold: true },
        { text: cur + ' ' + nb(after), style: 'cell', alignment: 'right', bold: true },
      ];
    });

    const totalsBody = [];
    const trow = (label, value, opts = {}) => totalsBody.push([
      { text: label, color: '#fff', bold: true, fontSize: 9, fillColor: opts.fill || NAVY, margin: [10, 4, 4, 4], border: noB },
      { text: value, color: opts.gold ? GOLD : '#fff', bold: true, fontSize: opts.gold ? 13 : 10, alignment: 'right', fillColor: opts.fill || NAVY, margin: [4, opts.gold ? 3 : 4, 10, opts.gold ? 3 : 4], border: noB },
    ]);
    trow('GRAND TOTAL (BEFORE DISCOUNT):', cur + ' ' + nb(sub));
    trow('TOTAL DISCOUNT:', cur + ' ' + nb(disc));
    if (Number(inv.taxRate)) trow(`TAX (${inv.taxRate}%):`, cur + ' ' + nb(tax));
    if (delivery) trow('DELIVERY:', cur + ' ' + nb(delivery));
    trow('GRAND TOTAL (AFTER DISCOUNT):', cur + ' ' + nb(total), { gold: true });
    if (st === 'part') {
      trow('AMOUNT PAID:', cur + ' ' + nb(inv.amountPaid));
      trow('BALANCE DUE:', cur + ' ' + nb(invoiceBalance(inv)), { fill: '#7e1c1c' });
    }
    if (st === 'paid') trow('PAID:', fmtDateFancy(inv.paidDate), { fill: '#1a5c3c' });

    const hasPayInfo = s.payName || s.payNumber || s.payBank;

    const navyBox = { hLineWidth: () => 1.2, vLineWidth: () => 1.2, hLineColor: () => NAVY, vLineColor: () => NAVY };

    const dd = {
      pageSize: 'A4',
      pageMargins: [46, 36, 46, 34],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: NAVY },
      // register every picture by name — data URIs inside the dynamic footer
      // function get mis-resolved by pdfmake otherwise
      images: {
        ...(logo ? { logoimg: logo } : {}),
        ...(s.signatureImg ? { sigimg: s.signatureImg } : {}),
        ...(igIcon ? { igicon: igIcon } : {}),
        ...(opayIcon ? { opayicon: opayIcon } : {}),
        ...(inv.sections || []).reduce((acc, sec, i) => { if (sec.img) acc['vimg' + i] = sec.img; return acc; }, {}),
      },
      styles: {
        cell: { fontSize: 9, margin: [4, 4, 4, 4] },
        th: { fontSize: 8, bold: true, color: '#fff', fillColor: NAVY, margin: [4, 4, 4, 4] },
      },
      content: [
        // header: logo left, business details right
        {
          columns: [
            { width: 'auto', stack: logo ? [{ image: 'logoimg', fit: [120, 56] }] : [{ text: s.bizName, fontSize: 18, bold: true }] },
            {
              width: '*',
              stack: [
                { text: s.bizName.toUpperCase(), fontSize: 13, bold: true, alignment: 'right' },
                ...(s.address ? [{ text: s.address, fontSize: 8, color: GREY, alignment: 'right', margin: [0, 2, 0, 0] }] : []),
                ...(s.phone ? [{ text: s.phone, fontSize: 8, color: GREY, alignment: 'right', margin: [0, 1, 0, 0] }] : []),
                ...(s.instagram ? [{
                  columns: [
                    { width: '*', text: '' },
                    ...(igIcon ? [{ width: 10, image: 'igicon', fit: [10, 10], margin: [0, 1, 0, 0] }] : []),
                    { width: 'auto', text: s.instagram, fontSize: 8, color: GREY, margin: [igIcon ? 3 : 0, 1, 0, 0] },
                  ],
                }] : []),
                ...(s.tagline ? [{ text: '…' + s.tagline, fontSize: 8, italics: true, color: GOLD, alignment: 'right', margin: [0, 2, 0, 0] }] : []),
              ],
            },
          ],
          margin: [0, 0, 0, 8],
        },

        { text: 'INVOICE', fontSize: 24, bold: true, alignment: 'center', margin: [0, 2, 0, 8] },

        // customer name / date boxes
        {
          columns: [
            {
              width: '*',
              table: { widths: ['*'], body: [[{
                stack: [
                  { text: 'CUSTOMER NAME:', fontSize: 7, bold: true, color: GREY },
                  { text: c?.name || inv.billTo || '—', fontSize: 13, bold: true, margin: [0, 2, 0, 0] },
                ],
                margin: [8, 5, 8, 5], border: [true, true, true, true],
              }]] },
              layout: navyBox,
            },
            {
              width: 170,
              table: { widths: ['*'], body: [[{
                stack: [
                  { text: 'DATE:', fontSize: 7, bold: true, color: GREY },
                  { text: fmtDateFancy(inv.dateIssued), fontSize: 11, bold: true, margin: [0, 2, 0, 0] },
                  { text: inv.number, fontSize: 7, color: '#8a93ab', margin: [0, 2, 0, 0] },
                ],
                margin: [8, 5, 8, 5], border: [true, true, true, true],
              }]] },
              layout: navyBox,
            },
          ],
          columnGap: 10,
          margin: [0, 0, 0, 10],
        },

        // vehicles / services table
        {
          table: {
            headerRows: 1,
            widths: [22, 108, '*', 72, 72],
            body: [
              [
                { text: 'S/N', style: 'th', alignment: 'center' },
                { text: 'CAR DETAILS', style: 'th', alignment: 'center' },
                { text: 'SERVICE(S) PROVIDED', style: 'th' },
                { stack: [{ text: 'TOTAL' }, { text: '(BEFORE DISCOUNT)', fontSize: 6 }], style: 'th', alignment: 'center' },
                { stack: [{ text: 'TOTAL' }, { text: '(AFTER DISCOUNT)', fontSize: 6 }], style: 'th', alignment: 'center' },
              ],
              ...secRows,
            ],
          },
          layout: {
            hLineWidth: () => 0.7, vLineWidth: () => 0.7,
            hLineColor: () => LINE, vLineColor: () => LINE,
          },
          margin: [0, 0, 0, 8],
        },

        // totals bars
        {
          table: { widths: ['*', 130], body: totalsBody },
          layout: { hLineWidth: () => 2, hLineColor: () => '#fff', vLineWidth: () => 0 },
          margin: [30, 0, 30, 8],
        },

        // payment details box
        ...(hasPayInfo ? [{
          table: {
            widths: ['*'],
            body: [
              [{ text: 'PAYMENT DETAILS', fontSize: 8, bold: true, color: '#fff', fillColor: NAVY, alignment: 'center', margin: [4, 4, 4, 4], border: [true, true, true, true] }],
              [{
                columns: [
                  ...(s.payNumber ? [{ stack: [{ text: 'ACCOUNT NUMBER:', fontSize: 6.5, bold: true, color: GREY }, { text: s.payNumber, fontSize: 14, bold: true, margin: [0, 2, 0, 0] }] }] : []),
                  ...(s.payBank ? [{ stack: [
                      { text: 'PAYMENT METHOD:', fontSize: 6.5, bold: true, color: GREY },
                      opayIcon
                        ? { columns: [{ width: 12, image: 'opayicon', fit: [12, 12] }, { width: 'auto', text: s.payBank, fontSize: 11, bold: true, margin: [3, 1, 0, 0] }], margin: [0, 3, 0, 0] }
                        : { text: s.payBank, fontSize: 11, bold: true, margin: [0, 3, 0, 0] },
                    ] }] : []),
                  ...(s.payName ? [{ stack: [{ text: 'ACCOUNT NAME:', fontSize: 6.5, bold: true, color: GREY }, { text: s.payName, fontSize: 9, bold: true, margin: [0, 4, 0, 0] }] }] : []),
                ],
                columnGap: 12,
                margin: [8, 6, 8, 6], border: [true, true, true, true],
              }],
            ],
          },
          layout: navyBox,
          margin: [55, 0, 55, 8],
        }] : []),

        // thank you + notes
        { text: 'Thank You!', italics: true, bold: true, color: GOLD, fontSize: 16, margin: [0, 0, 0, 1] },
        ...(s.invoiceFooter ? [{ text: s.invoiceFooter.toUpperCase(), fontSize: 7.5, bold: true, color: GREY }] : []),
        ...(inv.notes ? [{ text: inv.notes, fontSize: 8, color: GREY, margin: [0, 6, 0, 0] }] : []),

        // signature
        ...(s.signatureName || s.signatureImg ? [
          ...(s.signatureImg
            ? [{ image: 'sigimg', fit: [110, 32], margin: [0, 6, 0, 2] }]
            : [{
                table: { widths: [140], heights: [1], body: [[{ text: '', fontSize: 1, fillColor: LINE, border: [false, false, false, false] }]] },
                layout: 'noBorders',
                margin: [0, 26, 0, 2],
              }]),
          { text: s.signatureName || '', fontSize: 9, bold: true },
          { text: 'Authorized signature', fontSize: 7, color: GREY, margin: [0, 1, 0, 0] },
        ] : []),

      ],

      footer: () => ({
        table: {
          widths: ['*'],
          heights: [3, 26],
          body: [
            [{ text: '', fontSize: 1, fillColor: GOLD, border: [false, false, false, false] }],
            [{ text: s.bottomTagline || '', italics: true, color: '#fff', fillColor: NAVY, alignment: 'center', fontSize: 9, margin: [0, 8, 0, 8], border: [false, false, false, false] }],
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
  const client = getClient(j.clientId);
  const sections = (j.vehicles || []).map((jv) => {
    const items = [];
    let label = '';
    (jv.serviceIds || []).forEach((sid) => {
      const s = getService(sid);
      if (s) {
        items.push({ name: s.name, qty: 1, price: s.price });
        if (s.type === 'package' && !label) label = s.name.toUpperCase();
      }
    });
    (jv.customItems || []).forEach((it) => items.push({ name: it.name, qty: 1, price: Number(it.price) || 0 }));
    if (jv.priceOverride !== '' && jv.priceOverride != null && !isNaN(jv.priceOverride)) {
      items.length = 0;
      items.push({ name: 'Detailing service', qty: 1, price: Number(jv.priceOverride) });
    }
    const v = getVehicle(client, jv.vehicleId);
    return {
      vehicleId: jv.vehicleId || '',
      carName: v ? [v.year, v.make, v.model].filter(Boolean).join(' ').toUpperCase() : '',
      img: v?.img || '',
      label,
      discount: 0,
      items,
    };
  });
  // a backdated job produces an invoice dated the day the work was done
  const issued = j.date || todayISO();
  const inv = {
    id: uid(),
    number: nextInvoiceNumber(),
    clientId: j.clientId,
    jobId: j.id,
    dateIssued: issued,
    dueDate: addDays(issued, 14),
    sections,
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

function catalogOptionsHTML() {
  return CATALOG_TYPES.map(([type, label]) => {
    const items = db.services.filter((s) => s.active && (s.type || 'service') === type);
    if (!items.length) return '';
    return `<optgroup label="${label}">${items.map((s) => `<option value="${s.id}">${esc(s.name)} — ${money(s.price)}</option>`).join('')}</optgroup>`;
  }).join('');
}

function blankSection() {
  return { vehicleId: '', carName: '', img: '', label: '', discount: 0, items: [] };
}

function openInvoiceForm(id, presetClientId) {
  const inv = id ? getInvoice(id) : null;
  window._formSections = inv ? JSON.parse(JSON.stringify(inv.sections || [])) : [blankSection()];
  const selClient = inv?.clientId || presetClientId || (db.clients[0] && db.clients[0].id) || '';

  const body = `
    <div class="field"><label>Client</label>
      <select id="fi_client" onchange="renderSections()">
        <option value="">— no client —</option>
        ${db.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) =>
          `<option value="${c.id}" ${c.id === selClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select></div>
    <div class="field-2">
      <div class="field"><label>Issue date</label><input id="fi_date" type="date" value="${inv?.dateIssued || todayISO()}"></div>
      <div class="field"><label>Due date</label><input id="fi_due" type="date" value="${inv?.dueDate || addDays(todayISO(), 14)}"></div>
    </div>
    <h2 class="section">Vehicles / items on this invoice</h2>
    <div id="sectionsHost"></div>
    <button class="btn small ghost" onclick="addSection()">＋ Add another vehicle</button>
    <div class="field-2" style="margin-top:14px">
      <div class="field"><label>Extra discount type</label>
        <select id="fi_discType">
          <option value="amount" ${(inv?.discountType || 'amount') === 'amount' ? 'selected' : ''}>Amount (${esc(db.settings.currency)})</option>
          <option value="percent" ${inv?.discountType === 'percent' ? 'selected' : ''}>Percent (%)</option>
        </select></div>
      <div class="field"><label>Extra discount value</label><input id="fi_disc" type="number" inputmode="decimal" value="${inv?.discountValue ?? 0}"></div>
    </div>
    <div class="field-2">
      <div class="field"><label>Delivery fee (${esc(db.settings.currency)})</label><input id="fi_delivery" type="number" inputmode="decimal" value="${inv?.delivery ?? 0}"></div>
      <div class="field"><label>Tax rate %</label><input id="fi_tax" type="number" inputmode="decimal" value="${inv ? inv.taxRate : db.settings.taxRate}"></div>
    </div>
    <div class="field"><label>Notes on invoice</label><textarea id="fi_notes">${esc(inv?.notes || '')}</textarea></div>
    <div class="btnrow"><button class="btn block" onclick="saveInvoice('${id || ''}')">Save invoice</button></div>`;

  openModal(id ? 'Edit ' + inv.number : 'New invoice ' + nextInvoiceNumber(), body, () => renderSections());
}

function renderSections() {
  const host = document.getElementById('sectionsHost');
  if (!host) return;
  const client = getClient(document.getElementById('fi_client').value);
  host.innerHTML = window._formSections.map((sec, si) => `
    <div class="card" style="padding:12px">
      <div class="row" style="margin-bottom:8px">
        <b class="grow">Item ${si + 1}</b>
        ${window._formSections.length > 1 ? `<button class="btn small danger" onclick="removeSection(${si})">Remove</button>` : ''}
      </div>
      ${(client?.vehicles || []).length ? `
      <div class="field"><label>Pick from ${esc(client.name.split(' ')[0])}'s vehicles</label>
        <select onchange="sectionVehicleChanged(${si}, this.value)">
          <option value="">— custom / no vehicle —</option>
          ${client.vehicles.map((v) => `<option value="${v.id}" ${sec.vehicleId === v.id ? 'selected' : ''}>${esc([v.year, v.make, v.model].filter(Boolean).join(' '))}</option>`).join('')}
        </select></div>` : ''}
      <div class="row" style="gap:10px;margin-bottom:10px">
        ${sec.img ? `<img src="${esc(sec.img)}" alt="" style="width:80px;height:52px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">` : ''}
        <div class="grow">
          <div class="field" style="margin-bottom:8px"><label>Car name on invoice</label>
            <input value="${esc(sec.carName)}" placeholder="MERCEDES BENZ E350" oninput="window._formSections[${si}].carName=this.value"></div>
          <div class="field" style="margin-bottom:0"><label>Package label</label>
            <input value="${esc(sec.label)}" placeholder="VIP EXCLUSIVE CAR WASH" oninput="window._formSections[${si}].label=this.value"></div>
        </div>
      </div>
      <div>
        ${sec.items.map((it, ii) => `
        <div class="row" style="gap:6px;margin-bottom:8px">
          <input value="${esc(it.name)}" placeholder="Service" oninput="window._formSections[${si}].items[${ii}].name=this.value"
            style="flex:3;font-family:inherit;font-size:14px;background:var(--bg-raised);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px">
          <input type="number" inputmode="numeric" value="${it.qty ?? 1}" title="Qty" oninput="window._formSections[${si}].items[${ii}].qty=this.value"
            style="flex:1;min-width:0;font-family:inherit;font-size:14px;background:var(--bg-raised);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px">
          <input type="number" inputmode="decimal" value="${it.price}" title="Price" oninput="window._formSections[${si}].items[${ii}].price=this.value"
            style="flex:1.4;min-width:0;font-family:inherit;font-size:14px;background:var(--bg-raised);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px">
          <button class="btn small danger" style="padding:8px" onclick="removeSectionItem(${si},${ii})">✕</button>
        </div>`).join('') || '<div class="muted small" style="margin-bottom:8px">No services yet.</div>'}
      </div>
      <div class="row" style="gap:8px">
        <button class="btn small ghost" onclick="addSectionItem(${si})">＋ Blank</button>
        <select style="flex:1;font-family:inherit;font-size:14px;background:var(--bg-raised);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:9px" onchange="addSectionCatalogItem(${si}, this)">
          <option value="">＋ Add from catalog…</option>
          ${catalogOptionsHTML()}
        </select>
      </div>
      <div class="field" style="margin-top:10px;margin-bottom:0"><label>Discount for this line (${esc(db.settings.currency)})</label>
        <input type="number" inputmode="decimal" value="${sec.discount || 0}" oninput="window._formSections[${si}].discount=this.value"></div>
    </div>`).join('');
}

function sectionVehicleChanged(si, vid) {
  const client = getClient(document.getElementById('fi_client').value);
  const sec = window._formSections[si];
  sec.vehicleId = vid;
  const v = getVehicle(client, vid);
  if (v) {
    sec.carName = [v.year, v.make, v.model].filter(Boolean).join(' ').toUpperCase();
    sec.img = v.img || '';
  }
  renderSections();
}

function addSection() {
  window._formSections.push(blankSection());
  renderSections();
}

function removeSection(si) {
  window._formSections.splice(si, 1);
  renderSections();
}

function addSectionItem(si) {
  window._formSections[si].items.push({ name: '', qty: 1, price: '' });
  renderSections();
}

function addSectionCatalogItem(si, sel) {
  const s = getService(sel.value);
  if (s) {
    if (s.type === 'package' && !window._formSections[si].label) {
      window._formSections[si].label = s.name.toUpperCase();
    }
    window._formSections[si].items.push({ name: s.name, qty: 1, price: s.price });
    renderSections();
  }
  sel.value = '';
}

function removeSectionItem(si, ii) {
  window._formSections[si].items.splice(ii, 1);
  renderSections();
}

function saveInvoice(id) {
  const sections = window._formSections
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => it.name) }))
    .filter((sec) => sec.items.length || sec.carName);
  if (!sections.some((sec) => sec.items.length)) { toast('Add at least one service or item'); return; }
  const data = {
    clientId: document.getElementById('fi_client').value,
    dateIssued: document.getElementById('fi_date').value || todayISO(),
    dueDate: document.getElementById('fi_due').value,
    sections,
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
        <div class="field"><label>Phone(s)</label><input id="s_phone" value="${esc(s.phone)}" placeholder="08105952108 | 08059604694" onchange="setSetting('phone',this.value)"></div>
        <div class="field"><label>Email</label><input id="s_email" value="${esc(s.email)}" onchange="setSetting('email',this.value)"></div>
      </div>
      <div class="field-2">
        <div class="field"><label>Address (shown on invoices)</label><input id="s_address" value="${esc(s.address)}" onchange="setSetting('address',this.value)"></div>
        <div class="field"><label><img class="brand-ico" src="icon-instagram.png" alt="">Instagram handle</label><input value="${esc(s.instagram)}" placeholder="fatoma_autocare" onchange="setSetting('instagram',this.value)"></div>
      </div>
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
        <div class="field"><label>${isOpay(s.payBank) ? `<img class="brand-ico" src="icon-opay.png" alt="">` : ''}Bank / wallet</label><input value="${esc(s.payBank)}" placeholder="OPay" onchange="setSetting('payBank',this.value);render()"></div>
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
        <span class="grow">Offline mode<div class="muted small">On: the app runs entirely from this phone and never touches the internet. To update the app: turn this off, then tap Restart below.</div></span></label>
      <div class="btnrow"><button class="btn ghost block" onclick="restartApp()">⟳ Restart app</button></div>
      <div class="muted small" style="margin-top:6px">Restarts in place — no need to close the app. With Offline mode off, it also checks for a new version.</div>
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
      db.invoices.forEach(migrateInvoice);
      db.jobs.forEach(migrateJob);
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

// Reload without leaving the app (standalone PWAs have no refresh button).
// When online, also ask the service worker to fetch any newer version first,
// so one restart is enough to pick up an update.
async function restartApp() {
  toast('Restarting…');
  try {
    if (!getOfflineMode() && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        // give a freshly-found worker a moment to install and take over
        if (reg.installing || reg.waiting) await new Promise((r) => setTimeout(r, 1500));
      }
    }
  } catch (e) { /* offline or no SW — plain reload below */ }
  location.reload();
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
