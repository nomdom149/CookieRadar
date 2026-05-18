/* global CookieRadarConfig */
(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  var STORAGE_KEY = 'cookieradar_consent';
  var EXPIRY_DAYS = 180;
  var config      = window.CookieRadarConfig || {};
  var texts       = config.texts      || {};
  var categories  = config.categories || {};
  var policyUrl   = config.policyUrl  || '#';
  var position    = config.bannerPosition || 'bottom';

  // ─── Storage ───────────────────────────────────────────────────────────────

  function saveConsent(choices) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version:   '1.0',
        timestamp: new Date().toISOString(),
        expires:   new Date(Date.now() + EXPIRY_DAYS * 86400000).toISOString(),
        choices:   choices,
      }));
    } catch(e) {}
  }

  function loadConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.expires) return null;
      if (new Date(data.expires) < new Date()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch(e) {
      return null;
    }
  }

  // ─── Choix ─────────────────────────────────────────────────────────────────

  function buildAllChoices(value) {
    var choices = {};
    Object.keys(categories).forEach(function(cat) {
      choices[cat] = (categories[cat] && categories[cat].required) ? true : value;
    });
    choices.essential = true;
    return choices;
  }

  function readToggles() {
    var choices = {};
    var rows = document.querySelectorAll('#cr-banner .cr-toggle-row');
    rows.forEach(function(row) {
      var cat    = row.getAttribute('data-category');
      var toggle = row.querySelector('.cr-toggle');
      if (!cat || !toggle) return;
      choices[cat] = toggle.disabled
        ? true
        : (toggle.getAttribute('aria-checked') === 'true');
    });
    choices.essential = true;
    return choices;
  }

  // ─── Scripts tiers ─────────────────────────────────────────────────────────

  function activateScripts(choices) {
    Object.keys(choices).forEach(function(cat) {
      if (!choices[cat]) return;
      var services = (categories[cat] && categories[cat].services) || [];
      services.forEach(function(s) { fireService(s.name); });
    });
    try {
      document.dispatchEvent(new CustomEvent('cookieradar:consent', { detail: { choices: choices } }));
    } catch(e) {}
  }

  function fireService(name) {
    var n = (name || '').toLowerCase();
    if (n.indexOf('google analytics') !== -1) {
      if (typeof gtag === 'function') gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    if (n.indexOf('google ads') !== -1) {
      if (typeof gtag === 'function') gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    }
    if (n.indexOf('meta pixel') !== -1 || n.indexOf('facebook') !== -1) {
      if (typeof fbq === 'function') fbq('consent', 'grant');
    }
    if (n.indexOf('hotjar') !== -1) {
      if (typeof hj === 'function') hj('consent', true);
    }
  }

  // ─── HTML ──────────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function buildHTML() {
    var rows = Object.keys(categories).map(function(cat) {
      var data     = categories[cat] || {};
      var required = data.required === true;
      var services = (data.services || []).map(function(s) {
        return '<span class="cr-service-tag">' + esc(s.name) + '</span>';
      }).join('');

      return '<div class="cr-toggle-row" data-category="' + esc(cat) + '">' +
        '<div class="cr-toggle-info">' +
          '<div class="cr-toggle-label">' + esc(data.label || cat) + '</div>' +
          '<div class="cr-toggle-desc">' + esc(data.description || '') + '</div>' +
          (services ? '<div class="cr-toggle-services">' + services + '</div>' : '') +
        '</div>' +
        '<button type="button"' +
          ' class="cr-toggle ' + (required ? 'cr-toggle--locked' : 'cr-toggle--on') + '"' +
          ' data-category="' + esc(cat) + '"' +
          ' role="switch"' +
          ' aria-checked="true"' +
          ' aria-label="' + esc(data.label || cat) + '"' +
          (required ? ' disabled aria-disabled="true"' : '') + '>' +
          '<span class="cr-toggle__thumb"></span>' +
        '</button>' +
      '</div>';
    }).join('');

    return '<div id="cr-overlay" class="cr-overlay"></div>' +
      '<div id="cr-banner" class="cr-banner cr-banner--' + esc(position) + '" role="dialog" aria-modal="true" aria-label="Gestion des cookies">' +

        // Vue barre
        '<div id="cr-view-bar" class="cr-view">' +
          '<div class="cr-bar__content">' +
            '<div class="cr-bar__text">' +
              '<strong>' + esc(texts.title || 'Ce site utilise des cookies') + '</strong>' +
              '<span>' + esc(texts.description || '') + '</span>' +
            '</div>' +
            '<div class="cr-bar__actions">' +
              '<button id="cr-btn-settings"   type="button" class="cr-btn cr-btn--ghost">'   + esc(texts.settings  || 'Personnaliser')    + '</button>' +
              '<button id="cr-btn-decline"    type="button" class="cr-btn cr-btn--outline">' + esc(texts.decline   || 'Tout refuser')      + '</button>' +
              '<button id="cr-btn-accept-all" type="button" class="cr-btn cr-btn--primary">' + esc(texts.acceptAll || 'Tout accepter')     + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="cr-bar__footer">' +
            '<a href="' + esc(policyUrl) + '" class="cr-policy-link">' + esc(texts.policyLink || 'Politique cookies') + '</a>' +
          '</div>' +
        '</div>' +

        // Vue modal
        '<div id="cr-view-settings" class="cr-view cr-view--hidden">' +
          '<div class="cr-modal__header">' +
            '<h2 class="cr-modal__title">Gestion des cookies</h2>' +
            '<button id="cr-btn-close" type="button" class="cr-btn-close" aria-label="Fermer">&#10005;</button>' +
          '</div>' +
          '<div class="cr-modal__body">' +
            '<p class="cr-modal__intro">' + esc(texts.description || '') + '</p>' +
            '<div class="cr-toggles">' + rows + '</div>' +
          '</div>' +
          '<div class="cr-modal__footer">' +
            '<a href="' + esc(policyUrl) + '" class="cr-policy-link">' + esc(texts.policyLink || 'Politique cookies') + '</a>' +
            '<div class="cr-modal__actions">' +
              '<button id="cr-btn-decline-modal"    type="button" class="cr-btn cr-btn--outline">' + esc(texts.decline    || 'Tout refuser')      + '</button>' +
              '<button id="cr-btn-save"             type="button" class="cr-btn cr-btn--primary">' + esc(texts.saveChoice || 'Enregistrer mes choix') + '</button>' +
              '<button id="cr-btn-accept-all-modal" type="button" class="cr-btn cr-btn--primary">' + esc(texts.acceptAll  || 'Tout accepter')     + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>';
  }

  // ─── Affichage ─────────────────────────────────────────────────────────────

  function getBanner()  { return document.getElementById('cr-banner'); }
  function getOverlay() { return document.getElementById('cr-overlay'); }
  function getBar()     { return document.getElementById('cr-view-bar'); }
  function getModal()   { return document.getElementById('cr-view-settings'); }

  function showBanner() {
    var b = getBanner();
    if (b) b.classList.remove('cr-banner--hidden');
  }

  function hideBanner() {
    var b = getBanner();
    var o = getOverlay();
    if (b) b.classList.add('cr-banner--hidden');
    if (o) o.classList.remove('cr-overlay--visible');
  }

  function showBar() {
    var bar   = getBar();
    var modal = getModal();
    var ov    = getOverlay();
    if (bar)   bar.classList.remove('cr-view--hidden');
    if (modal) modal.classList.add('cr-view--hidden');
    if (ov)    ov.classList.remove('cr-overlay--visible');
    showBanner();
  }

  function showSettings() {
    var bar   = getBar();
    var modal = getModal();
    var ov    = getOverlay();
    if (bar)   bar.classList.add('cr-view--hidden');
    if (modal) modal.classList.remove('cr-view--hidden');
    if (ov)    ov.classList.add('cr-overlay--visible');
    showBanner();
    setTimeout(function() {
      var first = modal && modal.querySelector('button:not([disabled])');
      if (first) first.focus();
    }, 60);
  }

  // ─── Binding ───────────────────────────────────────────────────────────────

  function on(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  function bindEvents() {

    on('cr-btn-accept-all', function() {
      var c = buildAllChoices(true);
      saveConsent(c);
      activateScripts(c);
      hideBanner();
    });

    on('cr-btn-decline', function() {
      saveConsent(buildAllChoices(false));
      hideBanner();
    });

    on('cr-btn-settings', showSettings);
    on('cr-btn-close',    showBar);

    on('cr-btn-accept-all-modal', function() {
      var c = buildAllChoices(true);
      saveConsent(c);
      activateScripts(c);
      hideBanner();
    });

    on('cr-btn-decline-modal', function() {
      saveConsent(buildAllChoices(false));
      hideBanner();
    });

    on('cr-btn-save', function() {
      var c = readToggles();
      saveConsent(c);
      activateScripts(c);
      hideBanner();
    });

    // Toggles individuels
    var toggles = document.querySelectorAll('#cr-banner .cr-toggle:not([disabled])');
    toggles.forEach(function(t) {
      t.addEventListener('click', function() {
        var checked = t.getAttribute('aria-checked') === 'true';
        t.setAttribute('aria-checked', checked ? 'false' : 'true');
        t.classList.toggle('cr-toggle--on',   !checked);
        t.classList.toggle('cr-toggle--off',   checked);
      });
    });

    // Overlay → retour barre
    var ov = getOverlay();
    if (ov) ov.addEventListener('click', showBar);

    // Échap → retour barre
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      var modal = getModal();
      if (modal && !modal.classList.contains('cr-view--hidden')) {
        showBar();
      }
    });
  }

  // ─── Injection ─────────────────────────────────────────────────────────────

  function injectBanner() {
    // Éviter la double injection
    if (document.getElementById('cr-banner')) return;
    var wrap = document.createElement('div');
    wrap.id  = 'cr-banner-wrap';
    wrap.innerHTML = buildHTML();
    document.body.appendChild(wrap);
  }

  // ─── API publique ──────────────────────────────────────────────────────────

  function exposeAPI() {
    window.CookieRadar = {
      openSettings: function() {
        if (!document.getElementById('cr-banner')) {
          injectBanner();
          bindEvents();
        }
        showSettings();
      },
      getConsent: function() {
        return loadConsent();
      },
      resetConsent: function() {
        try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
        window.location.reload();
      },
    };
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    exposeAPI();

    var existing = loadConsent();
    if (existing && existing.choices) {
      activateScripts(existing.choices);
      return; // Banner déjà validé — ne pas afficher
    }

    injectBanner();
    showBar();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
