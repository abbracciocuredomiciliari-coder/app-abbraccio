// Popola galleria
const galleryGrid = document.getElementById('galleryGrid');
if (galleryGrid) {
  fetch('gallery-images.json')
    .then(r => r.json())
    .then(images => {
      images.forEach((name, i) => {
        const div = document.createElement('div');
        div.className = 'gallery-item' + (i === 0 ? ' gallery-wide' : '');
        const img = document.createElement('img');
        img.src = 'images/' + name;
        img.alt = 'Abbraccio Cure Domiciliari';
        img.loading = 'lazy';
        div.appendChild(img);
        galleryGrid.appendChild(div);
      });
    })
    .catch(() => {});
}

// Applica modifiche salvate dall'area riservata
function applyEdits() {
  const saved = localStorage.getItem('vetrina-edits');
  if (!saved) return;
  try {
    const e = JSON.parse(saved);
    const heroH1 = document.querySelector('.hero h1');
    if (e.heroTitle && heroH1) heroH1.innerHTML = e.heroTitle;
    const heroP = document.querySelector('.hero p');
    if (e.heroSubtitle && heroP) heroP.innerHTML = e.heroSubtitle;
    if (e.phone) {
      document.querySelectorAll('.topbar .fa-phone').forEach(el => { el.parentNode.innerHTML = `<i class="fas fa-phone"></i> ${e.phone}`; });
      const heroBtn = document.querySelector('.hero-ctas .btn-primary');
      if (heroBtn) heroBtn.innerHTML = `<i class="fas fa-phone"></i> Chiama ora: ${e.phone}`;
    }
    const wa = document.querySelector('.topbar .fa-whatsapp');
    if (e.whatsapp && wa) wa.parentNode.innerHTML = `<i class="fab fa-whatsapp"></i> ${e.whatsapp}`;
    const email = document.querySelector('.footer .fa-envelope');
    if (e.email && email) email.parentNode.innerHTML = `<i class="fas fa-envelope"></i> ${e.email}`;
    const addr = document.querySelector('.footer .fa-map-marker-alt');
    if (e.address && addr) addr.parentNode.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${e.address}`;
  } catch (err) {}
}
applyEdits();
