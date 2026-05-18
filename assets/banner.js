(function () {
  'use strict';

  const STORAGE_KEY = 'cookieradar_consent';
  const EXPIRY_DAYS = 180;

  // ─── Utilitaires storage ───────────────────────────────────────────────────

  function saveConsent(preferences) {
    const payload = {
      version:   '1.0',
      timestamp: new Date().toISOString(),
      expires:   new Date(Date.now() + EXPIRY_DAYS * 864e5).toISOString(),
      choices:   preferences,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function loadConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (new Date(data.expires) < new Date()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  // ─── Activation des scripts tiers ─────────────────────────────────────────

  function activateScripts(choices) {
    const categories = (CookieRadarConfig && CookieRadarConfig.categories) || {};
    Object.keys(choices).forEach(function (cat) {
      if (!choices[cat]) return;
      const services = (categories[cat] && categories[cat].services) || [];
      services.forEach(function (service) {
        fireService(service.name);
      });
    });
    document.dispatchEvent(new CustomEvent('cookieradar:consent', {
      detail: { choices: choices }
    }));
  }

  function fireService(name) {
    const lower = name.toLowerCase();
    if (lower.includes('google analytics')) {
      if (typeof gtag === 'function') gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    if (lower.includes('google ads')) {
      if (typeof gtag === 'function') gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
      });
    }
    if (lower.includes('meta pixel') || lower.includes('facebook')) {
      if (typeof fbq === 'function') fbq('consent', 'grant');
    }
    if (lower.includes('hotjar')) {
      if (typeof hj === 'function') hj('consent', true);
    }
    if (lower.includes('tiktok')) {
      if (typeof ttq !== 'undefined' && typeof ttq.load === 'function') {
        ttq.load(window._tiktok_pixel_id || '');
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function buildAllChoices(value) {
    const choices = {};
    const categories = (CookieRadarConfig && CookieRadarConfig.categories) || {};
    Object.keys(categories).forEach(function (cat) {
      choices[cat] = categories[cat].required ? true : value;
    });
    // Toujours forcer essential à true
    choices['essential'] = true;
    return choices;
  }

  function readToggles() {
    const choices = {};
    document.querySelectorAll('.cr-toggle-row').forEach(function (row) {
      const cat    = row.getAttribute('data-category');
      const toggle = row.querySelector('.cr-toggle');
      if (!toggle) return;
      choices[cat] = toggle.disabled
        ? true
        : toggle.getAttribute('aria-checked') === 'true';
    });
    choices['essential'] = true;
    return choices;
  }

  function setAllToggles(value) {
    document.querySelectorAll('.cr-toggle:not([disabled])').forEach(function (t) {
      t.setAttribute('aria-checked', value ? 'true' : 'false');
      t.classList.toggle('cr-toggle--on',  value);
      t.classList.toggle('cr-toggle--off', !value);
    });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── Construction du HTML ─────────────────────────────────────────────────

  function buildBanner() {
    const config     = CookieRadarConfig || {};
    const texts      = config.texts || {};
    const categories = config.categories || {};
    const policyUrl  = config.policyUrl || '#';
    const position   = config.bannerPosition || 'bottom';

    const toggleRows = Object.keys(categories).map(function (cat) {
      const data     = categories[cat];
      const required = data.required === true;
      const services = (data.services || []).map(function (s) {
        return '<span class="cr-service-tag">' + escHtml(s.name) + '</span>';
      }).join('');

      return '<div class="cr-toggle-row" data-category="' + escAttr(cat) + '">' +
        '<div class="cr-toggle-info">' +
          '<div class="cr-toggle-label">' + escHtml(data.label || cat) + '</div>' +
          '<div class="cr-toggle-desc">' + escHtml(data.description || '') + '</div>' +
          (services ? '<div class="cr-toggle-services">' + services + '</div>' : '') +
        '</div>' +
        '<button ' +
          'class="cr-toggle ' + (required ? 'cr-toggle--locked' : 'cr-toggle--on') + '" ' +
          'data-category="' + escAttr(cat) + '" ' +
          'role="switch" ' +
          'aria-checked="true" ' +
          'aria-label="' + escAttr(data.label || cat) + '" ' +
          (required ? 'disabled aria-disabled="true" ' : '') +
          'type="button">' +
          '<span class="cr-toggle__thumb"></span>' +
        '</button>' +
      '</div>';
    }).join('');

    return '<div id="cr-overlay" class="cr-overlay" aria-hidden="true"></div>' +
      '<div id="cr-banner" class="cr-banner cr-banner--' + escAttr(position) + '" ' +
        'role="dialog" aria-modal="true" aria-label="Gestion des cookies" aria-live="polite">' +

        '<div id="cr-view-bar" class="cr-view">' +
          '<div class="cr-bar__content">' +
            '<div class="cr-bar__text">' +
              '<strong>' + escHtml(texts.title || 'Ce site utilise des cookies') + '</strong>' +
              '<span>' + escHtml(texts.description || '') + '</span>' +
            '</div>' +
            '<div class="cr-bar__actions">' +
              '<button id="cr-btn-settings" class="cr-btn cr-btn--ghost" type="button">' +
                escHtml(texts.settings || 'Personnaliser') +
              '</button>' +
              '<button id="cr-btn-decline" class="cr-btn cr-btn--outline" type="button">' +
                escHtml(texts.decline || 'Tout refuser') +
              '</button>' +
              '<button id="cr-btn-accept-all" class="cr-btn cr-btn--primary" type="button">' +
                escHtml(texts.acceptAll || 'Tout accepter') +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="cr-bar__footer">' +
            '<a href="' + escAttr(policyUrl) + '" class="cr-policy-link">' +
              escHtml(texts.policyLink || 'Politique cookies') +
            '</a>' +
          '</div>' +
        '</div>' +

        '<div id="cr-view-settings" class="cr-view cr-view--hidden">' +
          '<div class="cr-modal__header">' +
            '<h2 class="cr-modal__title">Gestion des cookies</h2>' +
            '<button id="cr-btn-close" class="cr-btn-close" aria-label="Fermer" type="button">✕</button>' +
          '</div>' +
          '<div class="cr-modal__body">' +
            '<p class="cr-modal__intro">' + escHtml(texts.description || '') + '</p>' +
            '<div class="cr-toggles">' + toggleRows + '</div>' +
          '</div>' +
          '<div class="cr-modal__footer">' +
            '<a href="' + escAttr(policyUrl) + '" class="cr-policy-link">' +
              escHtml(texts.policyLink || 'Politique cookies') +
            '</a>' +
            '<div class="cr-modal__actions">' +
              '<button id="cr-btn-decline-modal" class="cr-btn cr-btn--outline" type="button">' +
                escHtml(texts.decline || 'Tout refuser') +
              '</button>' +
              '<button id="cr-btn-save" class="cr-btn cr-btn--primary" type="button">' +
                escHtml(texts.saveChoice || 'Enregistrer mes choix') +
              '</button>' +
              '<button id="cr-btn-accept-all-modal" class="cr-btn cr-btn--primary" type="button">' +
                escHtml(texts.acceptAll || 'Tout accepter') +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>';
  }

  // ─── Affichage ─────────────────────────────────────────────────────────────

  function showBar() {
    var bar      = document.getElementById('cr-view-bar');
    var modal    = document.getElementById('cr-view-settings');
    var overlay  = document.getElementById('cr-overlay');
    var banner   = document.getElementById('cr-banner');
    if (bar)     bar.classList.remove('cr-view--hidden');
    if (modal)   modal.classList.add('cr-view--hidden');
    if (overlay) overlay.classList.remove('cr-overlay--visible');
    if (banner)  banner.classList.remove('cr-banner--hidden');
  }

  function showSettings() {
    var bar     = document.getElementById('cr-view-bar');
    var modal   = document.getElementById('cr-view-settings');
    var overlay = document.getElementById('cr-overlay');
    var banner  = document.getElementById('cr-banner');
    if (bar)     bar.classList.add('cr-view--hidden');
    if (modal)   modal.classList.remove('cr-view--hidden');
    if (overlay) overlay.classList.add('cr-overlay--visible');
    if (banner)  banner.classList.remove('cr-banner--hidden');
    setTimeout(function () {
      var first = modal && modal.querySelector('button, [href]');
      if (first) first.focus();
    }, 50);
  }

  function hideBanner() {
    var banner  = document.getElementById('cr-banner');
    var overlay = document.getElementById('cr-overlay');
    if (banner)  banner.classList.add('cr-banner--hidden');
    if (overlay) overlay.classList.remove('cr-overlay--visible');
  }

  // ─── Binding des événements ────────────────────────────────────────────────

  function bindEvents() {

    var btnAcceptAll = document.getElementById('cr-btn-accept-all');
    if (btnAcceptAll) {
      btnAcceptAll.addEventListener('click', function () {
        var choices = buildAllChoices(true);
        saveConsent(choices);
        activateScripts(choices);
        hideBanner();
      });
    }

    var btnDecline = document.getElementById('cr-btn-decline');
    if (btnDecline) {
      btnDecline.addEventListener('click', function () {
        var choices = buildAllChoices(false);
        saveConsent(choices);
        hideBanner();
      });
    }

    var btnSettings = document.getElementById('cr-btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', showSettings);
    }

    var btnClose = document.getElementById('cr-btn-close');
    if (btnClose) {
      btnClose.addEventListener('click', showBar);
    }

    var btnAcceptAllModal = document.getElementById('cr-btn-accept-all-modal');
    if (btnAcceptAllModal) {
      btnAcceptAllModal.addEventListener('click', function () {
        var choices = buildAllChoices(true);
        saveConsent(choices);
        activateScripts(choices);
        hideBanner();
      });
    }

    var btnDeclineModal = document.getElementById('cr-btn-decline-modal');
    if (btnDeclineModal) {
      btnDeclineModal.addEventListener('click', function () {
        var choices = buildAllChoices(false);
        saveConsent(choices);
        hideBanner();
      });
    }

    var btnSave = document.getElementById('cr-btn-save');
    if (btnSave) {
      btnSave.addEventListener('click', function () {
        var choices = readToggles();
        saveConsent(choices);
        activateScripts(choices);
        hideBanner();
      });
    }

    // Toggles individuels
    document.querySelectorAll('.cr-toggle:not([disabled])').forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        var current = toggle.getAttribute('aria-checked') === 'true';
        toggle.setAttribute('aria-checked', current ? 'false' : 'true');
        toggle.classList.toggle('cr-toggle--on',  !current);
        toggle.classList.toggle('cr-toggle--off',  current);
      });
    });

    // Overlay
    var overlay = document.getElementById('cr-overlay');
    if (overlay) {
      overlay.addEventListener('click', showBar);
    }

    // Échap
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var modal = document.getElementById('cr-view-settings');
        if (modal && !modal.classList.contains('cr-view--hidden')) {
          showBar();
        }
      }
    });
  }

  // ─── API publique ──────────────────────────────────────────────────────────

  function exposePublicAPI() {
    window.CookieRadar = {
      openSettings: function () {
        var banner = document.getElementById('cr-banner');
        if (!banner) {
          var wrapper = document.createElement('div');
          wrapper.innerHTML = buildBanner();
          document.body.appendChild(wrapper);
          bindEvents();
        }
        showSettings();
      },
      getConsent: function () {
        return loadConsent();
      },
      resetConsent: function () {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      },
    };
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  function init() {
    var existing = loadConsent();
    if (existing) {
      activateScripts(existing.choices);
      exposePublicAPI();
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildBanner();
    document.body.appendChild(wrapper);

    // Vérification que le banner est bien dans le DOM
    var banner = document.getElementById('cr-banner');
    if (!banner) {
      console.error('CookieRadar : banner non trouvé dans le DOM après injection.');
      return;
    }

    showBar();
    bindEvents();
    exposePublicAPI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
