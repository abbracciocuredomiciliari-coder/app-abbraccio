let defaultsData = null;
fetch('admin-defaults.json')
  .then(r => r.json())
  .then(d => { defaultsData = d; applyEdits(); })
  .catch(() => applyEdits());

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
  if (!saved && !defaultsData) return;
  try {
    const c = saved ? deepMerge(defaultsData || {}, JSON.parse(saved)) : defaultsData;
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
    const addr = document.querySelector('.footer .fa-map-marker-alt');
    if (g.address && addr) addr.parentNode.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${g.address}`;

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

    // news
    if (c.news && c.news.length) {
      const list = document.getElementById('newsList');
      if (list) {
        list.innerHTML = c.news.map(n => `<div class="news-card"><h3>${n.title || ''}</h3><small>${n.date || ''} ${n.category ? '- '+n.category : ''}</small><p>${n.body || ''}</p></div>`).join('');
      }
      const blog = document.querySelector('.blog-grid');
      if (blog) {
        blog.innerHTML = c.news.slice(0,3).map(n => `<article class="blog-card"><div class="blog-img" style="background:#c9a227;"></div><div class="blog-body"><span class="blog-cat">${n.category || 'News'}</span><h3>${n.title || ''}</h3><p>${n.body ? n.body.slice(0,120) : ''}</p></div></article>`).join('');
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
        img.src = name.startsWith('data:') ? name : 'images/' + name;
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