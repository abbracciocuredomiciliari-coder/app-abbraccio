/* ═══ ABABRACCINO FACE — il cuoricino originale, animato ═══
   Mantiene l'immagine abbraccino.jpg (cuore in casa) e ci aggiunge:
   - occhi aperti che seguono il puntatore e sbattono (chiudendosi
     riappaiono le curve chiuse del logo originale)
   - braccia bianche (stesso stile del logo) che si alzano ad abbraccio
   - bocca aperta che si muove quando parla, sorrisone quando la chat si apre
   Uso: AbbraccinoFace.mount(el, { img: 'abbraccino.jpg' })
*/
(function () {
  'use strict';
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var faces = [];
  var cssInjected = false;

  function injectCss() {
    if (cssInjected) return; cssInjected = true;
    var s = document.createElement('style');
    s.textContent =
      '.abf-svg{display:block;width:100%;height:100%;overflow:visible}' +
      '.abf-eyes{transition:opacity .09s ease-in}' +
      '.abf-look{transition:transform .12s ease-out}' +
      '.abf-arm{transform-box:fill-box;transition:transform .5s cubic-bezier(.34,1.56,.64,1)}' +
      '.abf-al{transform-origin:96% 0%}' +
      '.abf-ar{transform-origin:4% 0%}' +
      '.abf-svg.abf-hug .abf-al{transform:rotate(70deg)}' +
      '.abf-svg.abf-hug .abf-ar{transform:rotate(-70deg)}' +
      '.abf-mouth-open,.abf-smile-big{transform-box:fill-box;transform-origin:center top;opacity:0;transition:opacity .12s}' +
      '.abf-svg.abf-talk .abf-mouth-open{opacity:1;animation:abfTalk .26s ease-in-out infinite alternate}' +
      '.abf-svg.abf-talk .abf-smile-big{opacity:1}' +
      '.abf-svg.abf-big .abf-smile-big{opacity:1}' +
      '@keyframes abfTalk{from{transform:scaleY(.35)}to{transform:scaleY(1.05)}}' +
      '@media (prefers-reduced-motion:reduce){.abf-eyes,.abf-look,.abf-arm,.abf-mouth-open{transition:none}.abf-svg.abf-talk .abf-mouth-open{animation:none}}';
    document.head.appendChild(s);
  }

  function buildSvg(imgUrl) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="abf-svg" aria-hidden="true">' +
      '<image href="' + imgUrl + '" x="0" y="0" width="120" height="120" preserveAspectRatio="xMidYMid slice"/>' +
      /* braccia bianche lungo i fianchi del cuore — si alzano ad abbraccio */
      '<g class="abf-arm abf-al">' +
      '<path d="M30 70 Q22 82 24 94" stroke="#fdfdf8" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<circle cx="24" cy="97" r="7" fill="#fdfdf8"/>' +
      '<path d="M19 100 Q24 104 29 100 M21 103 Q24 105 27 103" stroke="#e8d9b0" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</g>' +
      '<g class="abf-arm abf-ar">' +
      '<path d="M90 70 Q98 82 96 94" stroke="#fdfdf8" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<circle cx="96" cy="97" r="7" fill="#fdfdf8"/>' +
      '<path d="M101 100 Q96 104 91 100 M99 103 Q96 105 93 103" stroke="#e8d9b0" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</g>' +
      /* occhi aperti sopra le curve chiuse del logo */
      '<g class="abf-eyes"><g class="abf-look">' +
      '<ellipse cx="48.5" cy="54" rx="6.6" ry="6.9" fill="#fff"/>' +
      '<ellipse cx="71.5" cy="53" rx="6.6" ry="6.9" fill="#fff"/>' +
      '<circle cx="48.5" cy="55.3" r="3.1" fill="#6b3d0e"/>' +
      '<circle cx="71.5" cy="54.3" r="3.1" fill="#6b3d0e"/>' +
      '<circle cx="49.6" cy="53.9" r="1.05" fill="#fff"/>' +
      '<circle cx="72.6" cy="52.9" r="1.05" fill="#fff"/>' +
      '</g></g>' +
      /* sorrisone aperto (chat aperta) e bocca parlante */
      '<path class="abf-smile-big" d="M47 66 Q60 86 73 66 Q60 73 47 66 Z" fill="#8a4a12"/>' +
      '<ellipse class="abf-mouth-open" cx="60" cy="72" rx="6.2" ry="4.4" fill="#8a4a12"/>' +
      '</svg>';
  }

  function mount(container, opts) {
    injectCss();
    var wrap = document.createElement('div');
    wrap.innerHTML = buildSvg((opts && opts.img) || 'abbraccino.jpg');
    var svg = wrap.firstChild;
    container.appendChild(svg);

    var look = svg.querySelector('.abf-look');
    var eyes = svg.querySelector('.abf-eyes');
    var face = { svg: svg };

    /* occhi che seguono il puntatore */
    function onPointer(e) {
      if (reduce) return;
      var r = svg.getBoundingClientRect();
      if (!r.width) return;
      var cx = r.left + r.width / 2, cy = r.top + r.height * .44;
      var dx = (e.clientX - cx) / 150, dy = (e.clientY - cy) / 150;
      var tx = Math.max(-2.6, Math.min(2.6, dx * 2.6));
      var ty = Math.max(-1.8, Math.min(1.8, dy * 1.8));
      look.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
    }
    document.addEventListener('pointermove', onPointer, { passive: true });

    /* deriva dolce degli occhi su touch (nessun puntatore) */
    var idleT = 0;
    var idleInt = setInterval(function () {
      if (reduce || Date.now() - idleT < 2600) return;
      idleT = Date.now();
      look.style.transform = 'translate(' + (Math.random() * 3.4 - 1.7) + 'px,' + (Math.random() * 1.6 - .8) + 'px)';
    }, 2500);

    /* battito di ciglia: gli occhi aperti svaniscono e riappaiono le curve del logo */
    function blink() {
      if (reduce || !svg.isConnected) return;
      eyes.style.opacity = '0';
      setTimeout(function () { eyes.style.opacity = '1'; }, 160);
    }
    var blinkInt = setInterval(function () { if (Math.random() < .8) blink(); }, 3400);
    setTimeout(blink, 800);

    /* abbraccio: le braccia si alzano — ogni tanto da solo + al passaggio del mouse */
    function hug() {
      if (reduce || !svg.isConnected) return;
      svg.classList.add('abf-hug');
      setTimeout(function () { svg.classList.remove('abf-hug'); }, 1200);
    }
    var hugInt = setInterval(hug, 9000);
    container.addEventListener('pointerenter', hug);
    setTimeout(hug, 1300);

    face.hug = hug;
    face.setSmile = function (big) {
      svg.classList.toggle('abf-big', !!big);
      if (big) hug();
    };
    face.setTalking = function (on) { svg.classList.toggle('abf-talk', !!on); };
    face.destroy = function () {
      document.removeEventListener('pointermove', onPointer);
      clearInterval(idleInt); clearInterval(blinkInt); clearInterval(hugInt);
      svg.remove();
      var i = faces.indexOf(face); if (i > -1) faces.splice(i, 1);
    };
    faces.push(face);
    return face;
  }

  window.AbbraccinoFace = {
    mount: mount,
    setTalking: function (on) { faces.forEach(function (f) { f.setTalking(on); }); },
    hug: function () { faces.forEach(function (f) { f.hug(); }); },
    setSmile: function (big) { faces.forEach(function (f) { f.setSmile(big); }); }
  };
})();
