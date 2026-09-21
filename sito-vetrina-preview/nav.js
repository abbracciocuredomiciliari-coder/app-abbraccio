function initNav() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('navMenu');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
      hamburger.classList.toggle('active');
      document.body.classList.toggle('menu-open', nav.classList.contains('open'));
    });
    // chiudi il menu quando si clicca una voce
    nav.querySelectorAll('a:not(.dropdown-toggle)').forEach(a => {
      a.addEventListener('click', () => {
        nav.classList.remove('open');
        hamburger.classList.remove('active');
        document.body.classList.remove('menu-open');
      });
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
}

initNav();
