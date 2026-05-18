<?php
/**
 * Plugin Name: CookieRadar
 * Plugin URI:  https://websait.com/cookieradar
 * Description: Détection automatique des cookies, banner de consentement granulaire et page politique auto-générée. Zéro configuration manuelle.
 * Version:     1.0.0
 * Author:      Hanane Risayindi — Websait Agency
 * Author URI:  https://websait.com
 * License:     GPL-2.0-or-later
 * Text Domain: cookie-radar
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'COOKIERADAR_VERSION', '1.0.0' );
define( 'COOKIERADAR_PATH',    plugin_dir_path( __FILE__ ) );
define( 'COOKIERADAR_URL',     plugin_dir_url( __FILE__ ) );

require_once COOKIERADAR_PATH . 'includes/class-scanner.php';
require_once COOKIERADAR_PATH . 'includes/class-policy-generator.php';
require_once COOKIERADAR_PATH . 'includes/class-admin.php';

register_activation_hook(   __FILE__, [ 'CookieRadar_Admin', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'CookieRadar_Admin', 'deactivate' ] );

add_action( 'plugins_loaded', function() {
    CookieRadar_Scanner::init();
    CookieRadar_Policy_Generator::init();
    CookieRadar_Admin::init();
} );

add_action( 'wp_enqueue_scripts', function() {
    wp_enqueue_style(
        'cookie-radar-css',
        COOKIERADAR_URL . 'assets/banner.css',
        [],
        COOKIERADAR_VERSION
    );
    wp_enqueue_script(
        'cookie-radar-js',
        COOKIERADAR_URL . 'assets/banner.js',
        [],
        COOKIERADAR_VERSION,
        true
    );
    wp_localize_script( 'cookie-radar-js', 'CookieRadarConfig', [
        'categories'  => CookieRadar_Scanner::get_detected_categories(),
        'policyUrl'   => CookieRadar_Policy_Generator::get_policy_url(),
        'texts'       => [
            'title'       => get_option( 'cookieradar_text_title',   'Ce site utilise des cookies' ),
            'description' => get_option( 'cookieradar_text_desc',    'Choisissez quels cookies vous autorisez.' ),
            'acceptAll'   => get_option( 'cookieradar_text_accept',  'Tout accepter' ),
            'saveChoice'  => get_option( 'cookieradar_text_save',    'Enregistrer mes choix' ),
            'decline'     => get_option( 'cookieradar_text_decline', 'Tout refuser' ),
            'settings'    => get_option( 'cookieradar_text_settings','Personnaliser' ),
            'policyLink'  => get_option( 'cookieradar_text_policy',  'Politique cookies' ),
        ],
    ] );
} );

add_action( 'activated_plugin',   [ 'CookieRadar_Scanner', 'on_plugin_change' ] );
add_action( 'deactivated_plugin', [ 'CookieRadar_Scanner', 'on_plugin_change' ] );
}
