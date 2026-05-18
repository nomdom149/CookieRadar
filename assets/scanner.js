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

  // ─── Moteur de détection principal ────────────────────────────────────────

  function scan() {
    var cookies      = getCookies();
    var scriptSrcs   = getScriptSrcs();
    var inlineCode   = getInlineScripts();
    var detected     = [];

    Object.keys(signatures).forEach(function(key) {
      var sig    = signatures[key];
      var detect = sig.detect || {};
      var found  = false;

      // 1. Variables globales JavaScript
      if (!found && detect.globals) {
        found = detect.globals.some(function(g) {
          return globalExists(g);
        });
      }

      // 2. URLs de scripts chargés
      if (!found && detect.scripts) {
        found = detect.scripts.some(function(s) {
          return scriptMatches(s, scriptSrcs);
        });
      }

      // 3. Cookies présents dans le navigateur
      if (!found && detect.cookies) {
        found = detect.cookies.some(function(c) {
          return cookieMatches(c, cookies);
        });
      }

      // 4. Patterns regex dans le code inline
      if (!found && detect.patterns) {
        found = detect.patterns.some(function(p) {
          return matchPattern(p, inlineCode);
        });
      }

      if (found) {
        detected.push({
          key:         key,
          label:       sig.label       || key,
          category:    sig.category    || 'functional',
          provider:    sig.provider    || '',
          privacy_url: sig.privacy_url || '',
          cookies:     sig.cookies     || [],
        });
      }
    });

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
