/* global CookieRadarScannerConfig */
(function () {
  'use strict';

  var config     = window.CookieRadarScannerConfig || {};
  var signatures = config.signatures || {};
  var ajaxUrl    = config.ajaxUrl   || '';
  var nonce      = config.nonce     || '';
  var isAdmin    = config.isAdmin   === true;
  var triggered  = false;

  // ─── Lecture des cookies navigateur ───────────────────────────────────────

  function getCookies() {
    var result = {};
    try {
      document.cookie.split(';').forEach(function(c) {
        var parts = c.trim().split('=');
        if (parts[0]) result[parts[0].trim()] = parts[1] || '';
      });
    } catch(e) {}
    return result;
  }

  // ─── Lecture des scripts chargés dans la page ─────────────────────────────

  function getScriptSrcs() {
    var srcs = [];
    try {
      var tags = document.querySelectorAll('script[src]');
      tags.forEach(function(tag) {
        srcs.push(tag.getAttribute('src') || '');
      });
    } catch(e) {}
    return srcs;
  }

  // ─── Lecture du HTML de la page (head + body inline scripts) ──────────────

  function getInlineScripts() {
    var content = '';
    try {
      var tags = document.querySelectorAll('script:not([src])');
      tags.forEach(function(tag) {
        content += ' ' + (tag.textContent || '');
      });
    } catch(e) {}
    return content;
  }

  // ─── Vérification d'une variable globale ──────────────────────────────────

  function globalExists(name) {
    try {
      return typeof window[name] !== 'undefined';
    } catch(e) {
      return false;
    }
  }

  // ─── Correspondance d'un pattern regex ────────────────────────────────────

  function matchPattern(pattern, content) {
    try {
      return new RegExp(pattern).test(content);
    } catch(e) {
      return false;
    }
  }

  // ─── Correspondance cookie (supporte les wildcards *) ─────────────────────

  function cookieMatches(cookieName, jar) {
    var name = cookieName.replace(/\*/g, '');
    return Object.keys(jar).some(function(k) {
      return k.indexOf(name) === 0;
    });
  }

  // ─── Correspondance URL de script (partielle) ─────────────────────────────

  function scriptMatches(pattern, srcs) {
    return srcs.some(function(src) {
      return src.indexOf(pattern) !== -1;
    });
  }

  // ─── Moteur de détection principal — système de score ────────────────────
  // Chaque type de correspondance rapporte des points :
  //   script src  = 3 points (très fiable)
  //   cookie      = 3 points (très fiable)
  //   pattern     = 2 points (fiable)
  //   global JS   = 1 point  (peu fiable seul — trop de faux positifs)
  // Seuil minimum : 3 points pour valider la détection

  var SCORE_THRESHOLD = 3;

  function scan() {
    var cookies      = getCookies();
    var scriptSrcs   = getScriptSrcs();
    var inlineCode   = getInlineScripts();
    var detected     = [];

    Object.keys(signatures).forEach(function(key) {
      var sig    = signatures[key];
      var detect = sig.detect || {};
      var score  = 0;

      // Scripts chargés — 3 points (signature la plus fiable)
      if (detect.scripts) {
        var scriptHit = detect.scripts.some(function(s) {
          return scriptMatches(s, scriptSrcs);
        });
        if (scriptHit) score += 3;
      }

      // Cookies présents — 3 points (preuve directe)
      if (detect.cookies) {
        var cookieHit = detect.cookies.some(function(c) {
          return cookieMatches(c, cookies);
        });
        if (cookieHit) score += 3;
      }

      // Patterns inline — 2 points (code spécifique détecté)
      if (detect.patterns) {
        var patternHit = detect.patterns.some(function(p) {
          return matchPattern(p, inlineCode);
        });
        if (patternHit) score += 2;
      }

      // Variables globales — 1 point seulement (trop génériques seules)
      // Ex: window.google présent sur tout site avec Google Fonts
      if (detect.globals) {
        var globalHit = detect.globals.some(function(g) {
          return globalExists(g);
        });
        if (globalHit) score += 1;
      }

      // Validation : score minimum requis pour confirmer la détection
      if (score >= SCORE_THRESHOLD) {
        detected.push({
          key:         key,
          label:       sig.label       || key,
          category:    sig.category    || 'functional',
          provider:    sig.provider    || '',
          privacy_url: sig.privacy_url || '',
          cookies:     sig.cookies     || [],
          score:       score,
        });
      }
    });

    // Trier par score décroissant
    detected.sort(function(a, b) { return b.score - a.score; });

    return detected;
  }

  // ─── Envoi des résultats à WordPress via AJAX ──────────────────────────────

  function sendResults(detected) {
    if (!ajaxUrl || !nonce || detected.length === 0) return;

    var payload = JSON.stringify(detected);

    // Utiliser fetch si disponible, sinon XMLHttpRequest
    if (typeof fetch === 'function') {
      fetch(ajaxUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    'action=cookieradar_report_scan&nonce=' + encodeURIComponent(nonce) + '&detected=' + encodeURIComponent(payload),
        keepalive: true,
      }).catch(function() {});
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ajaxUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.send('action=cookieradar_report_scan&nonce=' + encodeURIComponent(nonce) + '&detected=' + encodeURIComponent(payload));
    }
  }

  // ─── Déduplication — éviter d'envoyer trop souvent ────────────────────────

  function shouldScan() {
    if (isAdmin) return true; // Admin : toujours scanner

    try {
      var last = parseInt(sessionStorage.getItem('cr_scan_ts') || '0', 10);
      var now  = Date.now();
      // Visiteur : scanner au maximum 1 fois par session par page
      if (now - last < 30000) return false; // 30s minimum entre deux scans
      sessionStorage.setItem('cr_scan_ts', String(now));
      return true;
    } catch(e) {
      return true;
    }
  }

  // ─── API publique pour le bouton admin "Scanner cette page" ───────────────

  window.CookieRadarScanner = {
    run: function(callback) {
      var detected = scan();
      sendResults(detected);
      if (typeof callback === 'function') callback(detected);
      return detected;
    },
  };

  // ─── Lancement automatique ─────────────────────────────────────────────────

  function init() {
    if (triggered) return;
    triggered = true;

    if (!shouldScan()) return;

    // Délai court pour laisser les scripts tiers se charger
    setTimeout(function() {
      var detected = scan();
      if (detected.length > 0) {
        sendResults(detected);
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
