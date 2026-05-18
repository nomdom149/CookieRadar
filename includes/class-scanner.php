<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class CookieRadar_Scanner {

    public static function init() {
        add_action( 'admin_init', array( __CLASS__, 'run_scan_if_needed' ) );
    }

    public static function on_plugin_change() {
        self::run_scan();
        CookieRadar_Policy_Generator::regenerate();
    }

    public static function run_scan_if_needed() {
        $last = get_option( 'cookieradar_last_scan' );
        if ( ! $last ) {
            self::run_scan();
        }
    }

    public static function run_scan() {
        $active_plugins = get_option( 'active_plugins', array() );
        $database       = self::load_database();

        if ( empty( $database['plugins'] ) ) {
            return;
        }

        $detected = array();

        // Cookies WordPress natifs — toujours présents
        $detected['wordpress-core'] = array(
            'label'       => 'WordPress',
            'category'    => 'essential',
            'cookies'     => array(
                array( 'name' => 'wordpress_*',       'duration' => 'Session', 'purpose' => 'Authentification et sécurité WordPress' ),
                array( 'name' => 'wp-settings-*',     'duration' => '1 an',   'purpose' => 'Préférences interface utilisateur connecté' ),
                array( 'name' => 'wordpress_test_cookie', 'duration' => 'Session', 'purpose' => 'Vérifie que les cookies sont activés' ),
            ),
            'provider'    => 'WordPress / Automattic',
            'privacy_url' => 'https://automattic.com/privacy',
        );

        // Scan des plugins actifs
        foreach ( $active_plugins as $plugin_path ) {
            $plugin_slug = explode( '/', $plugin_path );
            $plugin_slug = $plugin_slug[0];

            foreach ( $database['plugins'] as $key => $plugin_data ) {
                if ( in_array( $plugin_slug, $plugin_data['names'], true ) ) {
                    $detected[ $key ] = array(
                        'label'       => $plugin_data['label'],
                        'category'    => $plugin_data['category'],
                        'cookies'     => $plugin_data['cookies'],
                        'provider'    => $plugin_data['provider'],
                        'privacy_url' => $plugin_data['privacy_url'],
                    );
                }
            }
        }

        update_option( 'cookieradar_detected_plugins', $detected );
        update_option( 'cookieradar_last_scan', current_time( 'mysql' ) );
    }

    public static function get_detected_categories() {
        $detected   = get_option( 'cookieradar_detected_plugins', array() );
        $database   = self::load_database();
        $cat_defs   = isset( $database['categories'] ) ? $database['categories'] : array();

        // Si aucun scan encore — lancer le scan maintenant
        if ( empty( $detected ) ) {
            self::run_scan();
            $detected = get_option( 'cookieradar_detected_plugins', array() );
        }

        $result = array();

        // Essentiels en premier — toujours présents
        $result['essential'] = array(
            'label'       => isset( $cat_defs['essential']['label'] )       ? $cat_defs['essential']['label']       : 'Essentiels',
            'description' => isset( $cat_defs['essential']['description'] ) ? $cat_defs['essential']['description'] : '',
            'required'    => true,
            'services'    => array(),
        );

        foreach ( $detected as $key => $plugin ) {
            $cat = $plugin['category'];

            if ( ! isset( $result[ $cat ] ) ) {
                $result[ $cat ] = array(
                    'label'       => isset( $cat_defs[ $cat ]['label'] )       ? $cat_defs[ $cat ]['label']       : ucfirst( $cat ),
                    'description' => isset( $cat_defs[ $cat ]['description'] ) ? $cat_defs[ $cat ]['description'] : '',
                    'required'    => isset( $cat_defs[ $cat ]['required'] )    ? $cat_defs[ $cat ]['required']    : false,
                    'services'    => array(),
                );
            }

            $cookie_names = array();
            foreach ( $plugin['cookies'] as $c ) {
                $cookie_names[] = $c['name'];
            }

            $result[ $cat ]['services'][] = array(
                'name'        => $plugin['label'],
                'provider'    => $plugin['provider'],
                'privacy_url' => $plugin['privacy_url'],
                'cookies'     => $cookie_names,
            );
        }

        return $result;
    }

    public static function get_detected_plugins() {
        $detected = get_option( 'cookieradar_detected_plugins', array() );
        if ( empty( $detected ) ) {
            self::run_scan();
            $detected = get_option( 'cookieradar_detected_plugins', array() );
        }
        return $detected;
    }

    private static function load_database() {
        $path = COOKIERADAR_PATH . 'cookie-database.json';
        if ( ! file_exists( $path ) ) {
            return array();
        }
        $json   = file_get_contents( $path );
        $result = json_decode( $json, true );
        return is_array( $result ) ? $result : array();
    }

    public static function get_last_scan_date() {
        return get_option( 'cookieradar_last_scan', null );
    }
}
