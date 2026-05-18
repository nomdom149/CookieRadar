<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class CookieRadar_Scanner {

    private static $detected = [];

    public static function init() {
        add_action( 'admin_init', [ __CLASS__, 'run_scan' ] );
    }

    /**
     * Déclenché à chaque activation/désactivation d'un plugin
     */
    public static function on_plugin_change() {
        self::run_scan();
        CookieRadar_Policy_Generator::regenerate();
    }

    /**
     * Scan principal — compare les plugins actifs avec la base de données
     */
    public static function run_scan() {
        $active_plugins = get_option( 'active_plugins', [] );
        $database       = self::load_database();

        if ( empty( $database['plugins'] ) ) {
            return;
        }

        $detected = [];

        foreach ( $active_plugins as $plugin_path ) {
            $plugin_slug = explode( '/', $plugin_path )[0];

            foreach ( $database['plugins'] as $key => $plugin_data ) {
                if ( in_array( $plugin_slug, $plugin_data['names'], true ) ) {
                    $detected[ $key ] = [
                        'label'       => $plugin_data['label'],
                        'category'    => $plugin_data['category'],
                        'cookies'     => $plugin_data['cookies'],
                        'provider'    => $plugin_data['provider'],
                        'privacy_url' => $plugin_data['privacy_url'],
                    ];
                }
            }
        }

        // Toujours ajouter les cookies WordPress essentiels natifs
        $detected['wordpress-core'] = [
            'label'       => 'WordPress',
            'category'    => 'essential',
            'cookies'     => [
                [
                    'name'    => 'wordpress_*',
                    'duration'=> 'Session',
                    'purpose' => 'Authentification et sécurité WordPress',
                ],
                [
                    'name'    => 'wp-settings-*',
                    'duration'=> '1 an',
                    'purpose' => 'Préférences interface utilisateur connecté',
                ],
                [
                    'name'    => 'wordpress_test_cookie',
                    'duration'=> 'Session',
                    'purpose' => 'Vérifie que les cookies sont activés dans le navigateur',
                ],
            ],
            'provider'    => 'WordPress / Automattic',
            'privacy_url' => 'https://automattic.com/privacy',
        ];

        self::$detected = $detected;
        update_option( 'cookieradar_detected_plugins', $detected );
        update_option( 'cookieradar_last_scan', current_time( 'mysql' ) );
    }

    /**
     * Retourne les catégories détectées formatées pour le JS du banner
     */
    public static function get_detected_categories() {
        $detected   = get_option( 'cookieradar_detected_plugins', [] );
        $database   = self::load_database();
        $categories = $database['categories'] ?? [];
        $result     = [];

        // Essentiels toujours présents en premier
        $result['essential'] = [
            'label'       => $categories['essential']['label'] ?? 'Essentiels',
            'description' => $categories['essential']['description'] ?? '',
            'required'    => true,
            'services'    => [],
        ];

        foreach ( $detected as $key => $plugin ) {
            $cat = $plugin['category'];

            if ( ! isset( $result[ $cat ] ) ) {
                $result[ $cat ] = [
                    'label'       => $categories[ $cat ]['label']       ?? ucfirst( $cat ),
                    'description' => $categories[ $cat ]['description'] ?? '',
                    'required'    => $categories[ $cat ]['required']    ?? false,
                    'services'    => [],
                ];
            }

            $result[ $cat ]['services'][] = [
                'name'        => $plugin['label'],
                'provider'    => $plugin['provider'],
                'privacy_url' => $plugin['privacy_url'],
                'cookies'     => array_column( $plugin['cookies'], 'name' ),
            ];
        }

        return $result;
    }

    /**
     * Retourne tous les plugins détectés (pour la page politique)
     */
    public static function get_detected_plugins() {
        return get_option( 'cookieradar_detected_plugins', [] );
    }

    /**
     * Charge le fichier JSON de la base de données
     */
    private static function load_database() {
        $path = COOKIERADAR_PATH . 'cookie-database.json';

        if ( ! file_exists( $path ) ) {
            return [];
        }

        $json = file_get_contents( $path );
        return json_decode( $json, true ) ?? [];
    }

    /**
     * Retourne la date du dernier scan
     */
    public static function get_last_scan_date() {
        return get_option( 'cookieradar_last_scan', null );
    }
}
