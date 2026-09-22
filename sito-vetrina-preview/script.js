const SB_URL = 'https://nxdrxhbpbcrefyxmuvsi.supabase.co';
const SB_KEY = 'sb_publishable_bJzQ8eVZ-GyQN1AYFGNKpA_mLID3o5W';
let defaultsData = null;
let remoteContent = null;
Promise.all([
  fetch('admin-defaults.json').then(r => r.json()).catch(() => null),
  fetch(SB_URL + '/rest/v1/site_content?content_key=eq.vetrina_content&select=content_value', {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
  }).then(r => r.json()).then(d => (d && d[0] && d[0].content_value) ? JSON.parse(d[0].content_value) : null).catch(() => null)
]).then(([d, remote]) => { defaultsData = d; remoteContent = remote; applyEdits(); });

// WhatsApp flottante + barra azioni mobile (presenti su tutte le pagine)
(function injectCta() {
  if (!document.getElementById('waFloat')) {
    const wa = document.createElement('a');
    wa.id = 'waFloat';
    wa.className = 'whatsapp-float';
    wa.href = 'https://wa.me/393514175117';
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.setAttribute('aria-label', 'WhatsApp');
    wa.innerHTML = '<i class="fab fa-whatsapp"></i>';
    document.body.appendChild(wa);
  }
  if (!document.getElementById('ctaBar')) {
    const bar = document.createElement('div');
    bar.id = 'ctaBar';
    bar.className = 'mobile-cta-bar';
    bar.innerHTML = '<a id="ctaCall" href="tel:0601905242"><i class="fas fa-phone"></i>Chiama</a>' +
      '<a id="ctaWa" class="cta-wa" href="https://wa.me/393514175117" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i>WhatsApp</a>' +
      '<a class="cta-req" href="https://app.abbracciocuredomiciliari.it/richiesta-assistenza"><i class="fas fa-paper-plane"></i>Richiedi</a>';
    document.body.appendChild(bar);
  }
})();

function deepMerge(base, over) {
  const r = JSON.parse(JSON.stringify(base));
  if (!over || typeof over !== 'object') return r;
  for (const k of Object.keys(over)) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && r[k] && typeof r[k] === 'object') {
      r[k] = deepMerge(r[k], over[k]);
    } else {
      r[k] = over[k];
    }
  }
  return r;
}

function applyEdits() {
  const saved = localStorage.getItem('vetrina-content');
  const source = remoteContent || (saved ? JSON.parse(saved) : null);
  if (!source && !defaultsData) return;
  try {
    const c = source ? deepMerge(defaultsData || {}, source) : defaultsData;
    const path = location.pathname.replace(/^\//, '').replace(/\.html$/, '') || 'index';
    const key = path.split('/').pop();

    // global
    const g = c.global || {};
    const h1 = document.querySelector('.hero h1');
    if (g.heroTitle && h1) h1.innerHTML = g.heroTitle;
    const heroP = document.querySelector('.hero p');
    if (g.heroSubtitle && heroP) heroP.innerHTML = g.heroSubtitle;
    const eyeb = document.querySelector('.hero .eyebrow');
    if (g.eyebrow && eyeb) eyeb.innerHTML = g.eyebrow;
    const heroImg = document.querySelector('.hero-image-wrap img') || document.querySelector('.hero-image img');
    if (g.heroImage && heroImg) heroImg.src = g.heroImage;
    const logo = document.querySelector('.logo img');
    if (g.logo && logo) logo.src = g.logo;
    if (g.phone) {
      document.querySelectorAll('.topbar .fa-phone').forEach(el => { el.parentNode.innerHTML = `<i class="fas fa-phone"></i> ${g.phone}`; });
      const heroBtn = document.querySelector('.hero-ctas .btn-primary');
      if (heroBtn) heroBtn.innerHTML = `<i class="fas fa-phone"></i> Chiama ora: ${g.phone}`;
      document.querySelectorAll('a[href^="tel:"]').forEach(a => a.href = 'tel:' + g.phone.replace(/\s/g,''));
    }
    const wa = document.querySelector('.topbar .fa-whatsapp');
    if (g.whatsapp && wa) wa.parentNode.innerHTML = `<i class="fab fa-whatsapp"></i> ${g.whatsapp}`;
    const email = document.querySelector('.footer .fa-envelope');
    if (g.email && email) email.parentNode.innerHTML = `<i class="fas fa-envelope"></i> ${g.email}`;
    if (g.email) document.querySelectorAll('a[href^="mailto:"]').forEach(a => a.href = 'mailto:' + g.email);
    const addr = document.querySelector('.footer .fa-map-marker-alt');
    if (g.address && addr) addr.parentNode.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${g.address}`;
    const waNum = (g.whatsappNumber || '').replace(/\D/g, '');
    if (waNum) document.querySelectorAll('a[href*="wa.me/"]').forEach(a => a.href = 'https://wa.me/' + waNum);
    if (g.address) {
      const map = document.getElementById('sedeMap');
      if (map) map.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(g.address) + '&z=14&output=embed';
      const sa = document.getElementById('sedeAddr');
      if (sa) sa.textContent = g.address;
      const addrLink = document.querySelector('.footer-contacts a[href*="maps.google"]');
      if (addrLink) addrLink.href = 'https://maps.google.com/?q=' + encodeURIComponent(g.address);
    }
    const jobsImg = document.getElementById('jobsImage');
    if (jobsImg && g.jobsImage) jobsImg.src = g.jobsImage;
    const shopImg = document.getElementById('shopImage');
    if (shopImg && g.shopImage) shopImg.src = g.shopImage;

    // pages
    const p = (c.pages || {})[key];
    if (p) {
      const h1el = document.querySelector('section.service-hero h1');
      if (h1el && p.h1) h1el.innerHTML = p.h1;
      const lead = document.querySelector('section.service-hero .lead');
      if (lead && p.lead) lead.innerHTML = p.lead;
      const txt = document.querySelector('section.service-hero .detail-text p:not(.lead)');
      if (txt && p.text) txt.innerHTML = p.text;
      const img = document.querySelector('section.service-hero .detail-image img');
      if (img && p.image) img.src = p.image;
      const actTitle = document.querySelector('section.service-activities h2');
      if (actTitle && p.activitiesTitle) actTitle.textContent = p.activitiesTitle;
      const ul = document.querySelector('section.service-activities .activities-list');
      if (ul && p.activities && p.activities.length) {
        ul.innerHTML = p.activities.map(a => `<li>${a}</li>`).join('');
      }
    }

    // overview pages
    if (key === 'servizi') {
      const sh = document.querySelector('#tutti-i-servizi .section-header h2');
      const sp = document.querySelector('#tutti-i-servizi .section-header p');
      const se = document.querySelector('#tutti-i-servizi .section-header .eyebrow');
      const data = c.pages && c.pages.servizi ? c.pages.servizi : {};
      if (sh && data.h2) sh.innerHTML = data.h2;
      if (sp && data.subtitle) sp.innerHTML = data.subtitle;
      if (se && data.eyebrow) se.innerHTML = data.eyebrow;
    }
    if (key === 'esami-strumentali') {
      const sh = document.querySelector('#tutti-gli-esami .section-header h2');
      const sp = document.querySelector('#tutti-gli-esami .section-header p');
      const se = document.querySelector('#tutti-gli-esami .section-header .eyebrow');
      const data = c.pages && c.pages['esami-strumentali'] ? c.pages['esami-strumentali'] : {};
      if (sh && data.h2) sh.innerHTML = data.h2;
      if (sp && data.subtitle) sp.innerHTML = data.subtitle;
      if (se && data.eyebrow) se.innerHTML = data.eyebrow;
    }

    // foto card servizi/esami sincronizzate con le immagini scelte nell'admin
    document.querySelectorAll('.service-thumb[data-page], .service-item[data-page]').forEach(el => {
      const pg = (c.pages || {})[el.getAttribute('data-page')];
      const img = el.querySelector('.thumb-media img');
      if (pg && pg.image && img) img.src = pg.image;
    });

    // news
    if (c.news && c.news.length) {
      const list = document.getElementById('newsList');
      if (list) {
        list.innerHTML = c.news.map(n => `<div class="news-card">${n.image ? `<div class="news-img" style="background-image:url('${n.image}')"></div>` : ''}<h3>${n.title || ''}</h3><small>${n.date || ''} ${n.category ? '- '+n.category : ''}</small><p>${n.body || ''}</p></div>`).join('');
      }
      const blog = document.querySelector('.blog-grid');
      if (blog) {
        blog.innerHTML = c.news.slice(0,3).map(n => `<article class="blog-card"><div class="blog-img" style="${n.image ? `background-image:url('${n.image}');background-size:cover;background-position:center;` : 'background:#c9a227;'}"></div><div class="blog-body"><span class="blog-cat">${n.category || 'News'}</span><h3>${n.title || ''}</h3><p>${n.body ? n.body.slice(0,120) : ''}</p></div></article>`).join('');
      }
    }

    // gallery
    if (c.gallery && c.gallery.length && document.getElementById('galleryGrid')) {
      const grid = document.getElementById('galleryGrid');
      grid.innerHTML = '';
      c.gallery.forEach((name, i) => {
        const div = document.createElement('div');
        div.className = 'gallery-item' + (i === 0 ? ' gallery-wide' : '');
        const img = document.createElement('img');
        img.src = /^(data:|https?:)/.test(name) ? name : 'images/' + name;
        img.alt = 'Abbraccio Cure Domiciliari';
        img.loading = 'lazy';
        div.appendChild(img);
        grid.appendChild(div);
      });
    }

    // modifiche libere (admin → Modifica libera): valgono per qualsiasi elemento
    const pageFile = location.pathname.split('/').pop() || 'index.html';
    const ov = (c.overrides || {})[pageFile];
    if (ov) ov.forEach(o => {
      try {
        const el = document.querySelector(o.sel);
        if (!el) return;
        if (o.type === 'src') el.src = o.value; else el.innerHTML = o.value;
      } catch (e) {}
    });
  } catch (err) {}
}
applyEdits();

// ===== Recensioni pubbliche (approvate dall'admin) =====
(function initReviews() {
  const list = document.getElementById('reviewsList');
  if (!list) return;
  const form = document.getElementById('reviewForm');
  const openBtn = document.getElementById('reviewOpenBtn');
  const msg = document.getElementById('reviewMsg');
  const starsBox = document.getElementById('reviewStars');
  let rating = 5;

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function starRow(n) {
    let out = '';
    for (let i = 0; i < 5; i++) out += i < n ? '★' : '<span style="opacity:.25">★</span>';
    return out;
  }
  function paintStars() {
    if (!starsBox) return;
    starsBox.querySelectorAll('i').forEach((s, i) => { s.style.opacity = i < rating ? '1' : '.25'; });
  }

  fetch(SB_URL + '/rest/v1/site_reviews?approved=eq.true&order=created_at.desc&limit=12&select=nome,testo,rating', {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
  }).then(r => r.ok ? r.json() : []).then(rows => {
    if (!rows || !rows.length) {
      list.innerHTML = '<div class="reviews-empty">Nessuna recensione ancora: racconta tu per primo la tua esperienza.</div>';
      return;
    }
    list.innerHTML = rows.map(r =>
      `<div class="review-card"><div class="review-stars">${starRow(r.rating)}</div><h4>${esc(r.nome)}</h4><p>${esc(r.testo)}</p></div>`
    ).join('');
  }).catch(() => { list.innerHTML = ''; });

  if (openBtn && form) openBtn.addEventListener('click', () => form.classList.toggle('hidden'));
  if (starsBox) {
    starsBox.querySelectorAll('i').forEach((s, i) => s.addEventListener('click', () => { rating = i + 1; paintStars(); }));
    paintStars();
  }
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const nome = document.getElementById('reviewNome').value.trim();
    const testo = document.getElementById('reviewTesto').value.trim();
    if (!nome || !testo) { msg.textContent = 'Compila nome e recensione.'; msg.style.color = '#b42318'; return; }
    msg.textContent = 'Invio in corso...'; msg.style.color = 'var(--text-light)';
    fetch(SB_URL + '/rest/v1/site_reviews', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ nome: nome, testo: testo, rating: rating })
    }).then(r => {
      if (!r.ok) throw new Error('insert failed');
      msg.textContent = 'Grazie! La recensione sarà visibile dopo l\'approvazione.';
      msg.style.color = 'var(--green)';
      form.reset(); rating = 5; paintStars();
    }).catch(() => {
      msg.textContent = 'Errore durante l\'invio. Riprova più tardi.';
      msg.style.color = '#b42318';
    });
  });
})();