# CookieRadar 🍪

**Le plugin WordPress qui scanne, détecte et s'adapte — sans que tu touches à quoi que ce soit.**

CookieRadar détecte automatiquement les plugins actifs sur ton site qui utilisent des cookies, 
génère une page politique à jour en temps réel, et affiche un banner de consentement granulaire 
conforme RGPD. Zéro configuration manuelle. Zéro prise de tête.

---

## Ce qui rend CookieRadar différent

La plupart des plugins de cookies te demandent de déclarer manuellement chaque cookie utilisé 
sur ton site. CookieRadar fait l'inverse : il scanne tes plugins actifs, identifie ceux qui 
déposent des cookies, et met à jour ta page politique automatiquement à chaque changement.

Tu actives Hotjar ? Ta page politique se met à jour.  
Tu désactives Meta Pixel ? Ta page politique se met à jour.  
Tu n'as rien à faire.

---

## Fonctionnalités

### 🔍 Détection dynamique
- Scan automatique de tes plugins actifs au démarrage et à chaque activation/désactivation
- Base de données interne de 50+ plugins WordPress connus (Google Analytics, Meta Pixel, 
  Hotjar, WooCommerce, Yoast, Mailchimp, HubSpot...)
- Mise à jour en temps réel sans action manuelle

### ✅ Banner de consentement granulaire
- Catégories séparées : Essentiels / Analytics / Marketing / Fonctionnels
- Consentement stocké en localStorage (horodaté, conforme RGPD)
- Scripts tiers bloqués jusqu'à acceptation explicite
- Activation dynamique après consentement
- Textes 100% personnalisables depuis le dashboard

### 📄 Page politique auto-générée
- Page "Politique de cookies" créée automatiquement à l'activation du plugin
- Contenu mis à jour dès qu'un nouveau plugin utilisant des cookies est détecté
- Shortcode `[cookieradar_policy]` pour intégrer la liste dans n'importe quelle page existante
- Lien vers la page injecté automatiquement dans le banner

### ⚙️ Dashboard WordPress
- Interface de configuration dans WP Admin > CookieRadar
- Personnalisation des textes du banner (sans toucher au code)
- Aperçu des cookies détectés par catégorie
- Bouton de rescan manuel si besoin

---

## Installation

1. Télécharger le ZIP depuis [websait.com/cookieradar](https://websait.com/cookieradar)
2. WordPress Admin > Extensions > Ajouter > Téléverser une extension
3. Activer CookieRadar
4. C'est tout — le scan se lance automatiquement

---

## Structure du plugin
cookie-radar/
├── cookie-radar.php                   # Bootstrap — point d'entrée du plugin
├── cookie-database.json               # Bibliothèque des plugins connus et leurs cookies
├── includes/
│   ├── class-scanner.php              # Détection dynamique des plugins actifs
│   ├── class-policy-generator.php     # Génération et mise à jour de la page politique
│   └── class-admin.php               # Dashboard WP Admin + options
└── assets/
├── banner.js                      # UI du banner + gestion localStorage
└── banner.css                     # Styles isolés du banner

---

## Compatibilité

- WordPress 6.0+
- PHP 7.4+
- Compatible tous thèmes (Divi 5, Elementor, Gutenberg, thèmes custom)
- Sans dépendance externe

---

## Roadmap

- [ ] Version HTML standalone (hors WordPress)
- [ ] Exportation du rapport de consentement (RGPD audit)
- [ ] Intégration Google Consent Mode v2
- [ ] Multisite WordPress
- [ ] Tableau de bord des statistiques de consentement

---

## Développé par

**Hanane Risayindi — Websait Agency**  
[websait.com](https://websait.com)

---

## Licence

GPL-2.0-or-later — voir [LICENSE](LICENSE)
