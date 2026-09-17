const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('navMenu');
if (hamburger && nav) {
  hamburger.addEventListener('click', () => {
    nav.classList.toggle('open');
  });
}

// Popola galleria
const galleryGrid = document.getElementById('galleryGrid');
if (galleryGrid) {
  fetch('images.json')
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
    if (e.heroTitle && document.querySelector('.hero h1')) document.querySelector('.hero h1').innerHTML = e.heroTitle;
    if (e.heroSubtitle && document.querySelector('.hero p')) document.querySelector('.hero p').innerHTML = e.heroSubtitle;
    if (e.phone) {
      document.querySelectorAll('.topbar .fa-phone').forEach(el => { el.parentNode.innerHTML = `<i class="fas fa-phone"></i> ${e.phone}`; });
      document.querySelector('.hero-ctas .btn-primary').innerHTML = `<i class="fas fa-phone"></i> Chiama ora: ${e.phone}`;
    }
    if (e.whatsapp && document.querySelector('.topbar .fa-whatsapp')) document.querySelector('.topbar .fa-whatsapp').parentNode.innerHTML = `<i class="fab fa-whatsapp"></i> ${e.whatsapp}`;
    if (e.email && document.querySelector('.footer .fa-envelope')) document.querySelector('.footer .fa-envelope').parentNode.innerHTML = `<i class="fas fa-envelope"></i> ${e.email}`;
    if (e.address && document.querySelector('.footer .fa-map-marker-alt')) document.querySelector('.footer .fa-map-marker-alt').parentNode.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${e.address}`;
  } catch (err) {}
}
applyEdits();
