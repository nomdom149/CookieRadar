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

  function hasConsented() {
    return loadConsent() !== null;
  }

  // ─── Activation des scripts tiers ─────────────────────────────────────────

  function activateScripts(choices) {
    const categories = CookieRadarConfig.categories || {};

    Object.keys(choices).forEach(function (cat) {
      if (!choices[cat]) return;

      const services = (categories[cat] && categories[cat].services) || [];
      services.forEach(function (service) {
        fireService(cat, service.name);
      });
    });

    // Déclenche un événement DOM pour intégrations tierces (GTM, etc.)
    document.dispatchEvent(new CustomEvent('cookieradar:consent', {
      detail: { choices: choices }
    }));
  }

  function fireService(category, name) {
    const lower = name.toLowerCase();

    // Google Analytics / GA4
    if (lower.includes('google analytics')) {
      if (typeof gtag === 'function') {
        gtag('consent', 'update', {
          analytics_storage: 'granted',
        });
      }
      if (typeof ga === 'function') {
        ga('send', 'pageview');
      }
    }

    // Google Ads
    if (lower.includes('google ads')) {
      if (typeof gtag === 'function') {
        gtag('consent', 'update', {
          ad_storage:              'granted',
          ad_user_data:            'granted',
          ad_personalization:      'granted',
        });
      }
    }

    // Meta Pixel
    if (lower.includes('meta pixel') || lower.includes('facebook')) {
      if (typeof fbq === 'function') {
        fbq('consent', 'grant');
      }
    }

    // Hotjar
    if (lower.includes('hotjar')) {
      if (typeof hj === 'function') {
        hj('consent', true);
      }
    }

    // LinkedIn
    if (lower.includes('linkedin')) {
      if (typeof _linkedin_data_partner_ids !== 'undefined') {
        window._linkedin_partner_id = window._linkedin_partner_id || '';
      }
    }

    // TikTok Pixel
    if (lower.includes('tiktok')) {
      if (typeof ttq !== 'undefined' && typeof ttq.load === 'function') {
        ttq.load(window._tiktok_pixel_id || '');
      }
    }
  }

  // ─── Construction du HTML ─────────────────────────────────────────────────

  function buildBanner() {
    const config     = CookieRadarConfig || {};
    const texts      = config.texts || {};
    const categories = config.categories || {};
    const policyUrl  = config.policyUrl || '#';
    const position   = config.bannerPosition || 'bottom';

    const cats = Object.keys(categories);

    // Rows de toggles pour chaque catégorie non-essentielle
    const toggleRows = cats.map(function (cat) {
      const data     = categories[cat];
      const required = data.required === true;
      const services = (data.services || []).map(function (s) {
        return '<span class="cr-service-tag">' + escHtml(s.name) + '</span>';
      }).join('');

      return `
        <div class="cr-toggle-row" data-category="${escAttr(cat)}">
          <div class="cr-toggle-info">
            <div class="cr-toggle-label">${escHtml(data.label || cat)}</div>
            <div class="cr-toggle-desc">${escHtml(data.description || '')}</div>
            ${services ? '<div class="cr-toggle-services">' + services + '</div>' : ''}
          </div>
          <button
            class="cr-toggle ${required ? 'cr-toggle--locked' : 'cr-toggle--on'}"
            data-category="${escAttr(cat)}"
            role="switch"
            aria-checked="${required ? 'true' : 'true'}"
            aria-label="${escAttr(data.label || cat)}"
            ${required ? 'disabled aria-disabled="true"' : ''}
            type="button">
            <span class="cr-toggle__thumb"></span>
          </button>
        </div>`;
    }).join('');

    const html = `
      <div id="cr-overlay" class="cr-overlay" aria-hidden="true"></div>

      <div
        id="cr-banner"
        class="cr-banner cr-banner--${escAttr(position)}"
        role="dialog"
        aria-modal="true"
        aria-label="Gestion des cookies"
        aria-live="polite">

        <!-- Vue principale : barre courte -->
        <div id="cr-view-bar" class="cr-view">
          <div class="cr-bar__content">
            <div class="cr-bar__text">
              <strong>${escHtml(texts.title || 'Ce site utilise des cookies')}</strong>
              <span>${escHtml(texts.description || '')}</span>
            </div>
            <div class="cr-bar__actions">
              <button id="cr-btn-settings" class="cr-btn cr-btn--ghost" type="button">
                ${escHtml(texts.settings || 'Personnaliser')}
              </button>
              <button id="cr-btn-decline" class="cr-btn cr-btn--outline" type="button">
                ${escHtml(texts.decline || 'Tout refuser')}
              </button>
              <button id="cr-btn-accept-all" class="cr-btn cr-btn--primary" type="button">
                ${escHtml(texts.acceptAll || 'Tout accepter')}
              </button>
            </div>
          </div>
          <div class="cr-bar__footer">
            <a href="${escAttr(policyUrl)}" class="cr-policy-link">
              ${escHtml(texts.policyLink || 'Politique cookies')}
            </a>
          </div>
        </div>

        <!-- Vue détaillée : granularité par catégorie -->
        <div id="cr-view-settings" class="cr-view cr-view--hidden">
          <div class="cr-modal__header">
            <h2 class="cr-modal__title">Gestion des cookies</h2>
            <button id="cr-btn-close" class="cr-btn-close" aria-label="Fermer" type="button">✕</button>
          </div>
          <div class="cr-modal__body">
            <p class="cr-modal__intro">${escHtml(texts.description || '')}</p>
            <div class="cr-toggles">
              ${toggleRows}
            </div>
          </div>
          <div class="cr-modal__footer">
            <a href="${escAttr(policyUrl)}" class="cr-policy-link">
              ${escHtml(texts.policyLink || 'Politique cookies')}
            </a>
            <div class="cr-modal__actions">
              <button id="cr-btn-decline-modal" class="cr-btn cr-btn--outline" type="button">
                ${escHtml(texts.decline || 'Tout refuser')}
              </button>
              <button id="cr-btn-save" class="cr-btn cr-btn--primary" type="button">
                ${escHtml(texts.saveChoice || 'Enregistrer mes choix')}
              </button>
              <button id="cr-btn-accept-all-modal" class="cr-btn cr-btn--primary" type="button">
                ${escHtml(texts.acceptAll || 'Tout accepter')}
              </button>
            </div>
          </div>
        </div>

      </div>`;

    return html;
  }

  // ─── Logique d'affichage ───────────────────────────────────────────────────

  function showBar() {
    const el = document.getElementById('cr-view-bar');
    const modal = document.getElementById('cr-view-settings');
    const overlay = document.getElementById('cr-overlay');
    if (el)      el.classList.remove('cr-view--hidden');
    if (modal)   modal.classList.add('cr-view--hidden');
    if (overlay) overlay.classList.remove('cr-overlay--visible');
  }

  function showSettings() {
    const el = document.getElementById('cr-view-bar');
    const modal = document.getElementById('cr-view-settings');
    const overlay = document.getElementById('cr-overlay');
    if (el)      el.classList.add('cr-view--hidden');
    if (modal)   modal.classList.remove('cr-view--hidden');
    if (overlay) overlay.classList.add('cr-overlay--visible');

    // Focus trap accessibilité
    setTimeout(function () {
      const first = modal && modal.querySelector('button, [href], input');
      if (first) first.focus();
    }, 50);
  }

  function hideBanner() {
    const banner  = document.getElementById('cr-banner');
    const overlay = document.getElementById('cr-overlay');
    if (banner)  banner.classList.add('cr-banner--hidden');
    if (overlay) overlay.classList.remove('cr-overlay--visible');
  }

  // ─── Lecture des choix courants dans les toggles ───────────────────────────

  function readToggles() {
    const choices = {};
    document.querySelectorAll('.cr-toggle-row').forEach(function (row) {
      const cat    = row.getAttribute('data-category');
      const toggle = row.querySelector('.cr-toggle');
      if (!toggle) return;
      if (toggle.disabled) {
        choices[cat] = true;
      } else {
        choices[cat] = toggle.getAttribute('aria-checked') === 'true';
      }
    });
    return choices;
  }

  function setAllToggles(value) {
    document.querySelectorAll('.cr-toggle:not([disabled])').forEach(function (toggle) {
      toggle.setAttribute('aria-checked', value ? 'true' : 'false');
      toggle.classList.toggle('cr-toggle--on',  value);
      toggle.classList.toggle('cr-toggle--off', !value);
    });
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  function init() {
    // Si consentement déjà enregistré — activer les scripts et ne rien afficher
    const existing = loadConsent();
    if (existing) {
      activateScripts(existing.choices);
      exposePublicAPI();
      return;
    }

    // Injecter le banner dans le DOM
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildBanner();
    document.body.appendChild(wrapper);

    showBar();

    // ── Bouton : Tout accepter (barre)
    document.getElementById('cr-btn-accept-all').addEventListener('click', function () {
      const choices = buildAllChoices(true);
      saveConsent(choices);
      activateScripts(choices);
      hideBanner();
    });

    // ── Bouton : Tout refuser (barre)
    document.getElementById('cr-btn-decline').addEventListener('click', function () {
      const choices = buildAllChoices(false);
      saveConsent(choices);
      hideBanner();
    });

    // ── Bouton : Personnaliser
const btnSettings = document.getElementById('cr-btn-settings');
if (btnSettings) {
  btnSettings.addEventListener('click', function() {
    showSettings();
  });
}

    // ── Bouton : Fermer modal → retour à la barre
const btnClose = document.getElementById('cr-btn-close');
if (btnClose) {
  btnClose.addEventListener('click', function() {
    showBar();
  });
}

    // ── Bouton : Tout accepter (modal)
    document.getElementById('cr-btn-accept-all-modal').addEventListener('click', function () {
      const choices = buildAllChoices(true);
      saveConsent(choices);
      activateScripts(choices);
      hideBanner();
    });

    // ── Bouton : Tout refuser (modal)
    document.getElementById('cr-btn-decline-modal').addEventListener('click', function () {
      const choices = buildAllChoices(false);
      saveConsent(choices);
      hideBanner();
    });

    // ── Bouton : Enregistrer mes choix
    document.getElementById('cr-btn-save').addEventListener('click', function () {
      const choices = readToggles();
      saveConsent(choices);
      activateScripts(choices);
      hideBanner();
    });

    // ── Toggles individuels
    document.querySelectorAll('.cr-toggle:not([disabled])').forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        const current = toggle.getAttribute('aria-checked') === 'true';
        toggle.setAttribute('aria-checked', current ? 'false' : 'true');
        toggle.classList.toggle('cr-toggle--on',  !current);
        toggle.classList.toggle('cr-toggle--off',  current);
      });
    });

    // ── Overlay : clic ferme le modal → retour à la barre
    document.getElementById('cr-overlay').addEventListener('click', showBar);

    // ── Échap : ferme le modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('cr-view-settings');
        if (modal && !modal.classList.contains('cr-view--hidden')) {
          showBar();
        }
      }
    });

    exposePublicAPI();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function buildAllChoices(value) {
    const choices = {};
    const categories = CookieRadarConfig.categories || {};
    Object.keys(categories).forEach(function (cat) {
      choices[cat] = categories[cat].required ? true : value;
    });
    return choices;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── API publique ──────────────────────────────────────────────────────────

  function exposePublicAPI() {
    window.CookieRadar = {
      openSettings: function () {
        const banner = document.getElementById('cr-banner');
        if (banner) {
          banner.classList.remove('cr-banner--hidden');
          showSettings();
        } else {
          // Banner pas encore dans le DOM — le recréer
          const wrapper = document.createElement('div');
          wrapper.innerHTML = buildBanner();
          document.body.appendChild(wrapper);
          bindEvents();
          showSettings();
        }
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

  // ─── Lancement ────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
