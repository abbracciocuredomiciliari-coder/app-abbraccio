function initNav() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('navMenu');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  }

  document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = toggle.closest('.dropdown');
      document.querySelectorAll('.dropdown').forEach(d => {
        if (d !== current) d.classList.remove('open');
      });
      current.classList.toggle('open');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
  });

  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

const headerPlaceholder = document.getElementById('site-header');
if (headerPlaceholder) {
  fetch('header.html')
    .then(r => r.text())
    .then(html => {
      headerPlaceholder.innerHTML = html;
      initNav();
    })
    .catch(() => {});
} else {
  initNav();
}
