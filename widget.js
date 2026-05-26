(function () {
  'use strict';

  var MAGICUM_URL = 'https://magicum.netlify.app';
  var BTN_LABEL   = 'Активувати Око ✦';
  var BTN_STYLE   = [
    'display:inline-flex',
    'align-items:center',
    'gap:6px',
    'background:transparent',
    'border:1px solid rgba(201,168,76,0.6)',
    'color:#c9a84c',
    'font-size:11px',
    'letter-spacing:2px',
    'text-transform:uppercase',
    'padding:8px 16px',
    'cursor:pointer',
    'font-family:sans-serif',
    'transition:all 0.3s',
    'margin-top:8px'
  ].join(';');

  function getKey() {
    var scripts = document.querySelectorAll('script[data-key]');
    for (var i = 0; i < scripts.length; i++) {
      var k = scripts[i].getAttribute('data-key');
      if (k) return k;
    }
    return '';
  }

  function openRitual(productImgSrc) {
    var key = getKey();
    var popup = window.open(
      MAGICUM_URL + '?widget=1&key=' + encodeURIComponent(key) +
        (productImgSrc ? '&img=' + encodeURIComponent(productImgSrc) : ''),
      'magicum_ritual',
      'width=480,height=760,resizable=yes,scrollbars=yes'
    );
    if (!popup) {
      window.location.href = MAGICUM_URL + '?widget=1&key=' + encodeURIComponent(key);
    }
  }

  function attachToElement(el) {
    if (el.dataset.magicumAttached) return;
    el.dataset.magicumAttached = '1';

    var btn = document.createElement('button');
    btn.textContent = BTN_LABEL;
    btn.setAttribute('style', BTN_STYLE);
    btn.addEventListener('mouseenter', function () {
      btn.style.borderColor = '#c9a84c';
      btn.style.boxShadow   = '0 0 16px rgba(201,168,76,0.3)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.borderColor = 'rgba(201,168,76,0.6)';
      btn.style.boxShadow   = 'none';
    });
    btn.addEventListener('click', function () {
      var img = el.querySelector('img');
      openRitual(img ? img.src : '');
    });

    el.appendChild(btn);
  }

  function init() {
    var targets = document.querySelectorAll('[data-magicum]');
    for (var i = 0; i < targets.length; i++) attachToElement(targets[i]);

    // Watch for dynamically added elements (SPA / infinite scroll)
    if (window.MutationObserver) {
      var obs = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (node.matches('[data-magicum]')) attachToElement(node);
            node.querySelectorAll && node.querySelectorAll('[data-magicum]').forEach(attachToElement);
          });
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
