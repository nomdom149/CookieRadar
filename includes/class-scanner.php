<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class CookieRadar_Scanner {

    // URL de la base distante hébergée sur websait.com
    const REMOTE_DB_URL      = 'https://websait.com/cookieradar/cookie-database.json';
    const DB_OPTION_KEY      = 'cookieradar_remote_database';
    const DB_LAST_UPDATE_KEY = 'cookieradar_db_last_update';

    public static function init() {
        add_action( 'admin_init',            array( __CLASS__, 'run_scan_if_needed' ) );
        add_action( 'cookieradar_update_db', array( __CLASS__, 'fetch_remote_database' ) );

        // Planifier la vérification quotidienne
        if ( ! wp_next_scheduled( 'cookieradar_update_db' ) ) {
            wp_schedule_event( time(), 'daily', 'cookieradar_update_db' );
        }
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

        // 1. Essayer la base distante mise en cache
        $remote = get_option( self::DB_OPTION_KEY );
        if ( ! empty( $remote ) && is_array( $remote ) && ! empty( $remote['plugins'] ) ) {

            // Déclencher une mise à jour en arrière-plan si la base a plus de 24h
            $last_update = get_option( self::DB_LAST_UPDATE_KEY, 0 );
            if ( ( time() - $last_update ) > DAY_IN_SECONDS ) {
                if ( ! wp_next_scheduled( 'cookieradar_update_db' ) ) {
                    wp_schedule_single_event( time() + 10, 'cookieradar_update_db' );
                }
            }

            return $remote;
        }

        // 2. Fallback — base locale embarquée dans le plugin
        $path = COOKIERADAR_PATH . 'cookie-database.json';
        if ( ! file_exists( $path ) ) {
            return array();
        }
        $json   = file_get_contents( $path );
        $result = json_decode( $json, true );
        return is_array( $result ) ? $result : array();
    }

    /**
     * Télécharge la base distante depuis websait.com et la met en cache
     * Appelé par wp_cron toutes les 24h + manuellement depuis le dashboard
     */
    public static function fetch_remote_database() {
        $response = wp_remote_get( self::REMOTE_DB_URL, array(
            'timeout'    => 15,
            'user-agent' => 'CookieRadar/' . COOKIERADAR_VERSION . '; ' . get_bloginfo( 'url' ),
        ) );

        if ( is_wp_error( $response ) ) {
            update_option( 'cookieradar_db_last_error', $response->get_error_message() );
            return false;
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( $code !== 200 ) {
            update_option( 'cookieradar_db_last_error', 'HTTP ' . $code );
            return false;
        }

        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );

        if ( ! is_array( $data ) || empty( $data['plugins'] ) ) {
            update_option( 'cookieradar_db_last_error', 'JSON invalide ou vide' );
            return false;
        }

        // Vérification de version — ne mettre à jour que si la version distante est plus récente
        $current = get_option( self::DB_OPTION_KEY, array() );
        $current_version = isset( $current['version'] ) ? $current['version'] : '0';
        $remote_version  = isset( $data['version'] ) ? $data['version'] : '0';

        if ( version_compare( $remote_version, $current_version, '<=' ) ) {
            // Version identique — juste mettre à jour la date de vérification
            update_option( self::DB_LAST_UPDATE_KEY, time() );
            delete_option( 'cookieradar_db_last_error' );
            return true;
        }

        // Nouvelle version disponible — mettre en cache et relancer le scan
        update_option( self::DB_OPTION_KEY,      $data );
        update_option( self::DB_LAST_UPDATE_KEY, time() );
        delete_option( 'cookieradar_db_last_error' );

        // Relancer le scan avec la nouvelle base
        self::run_scan();
        CookieRadar_Policy_Generator::regenerate();

        return true;
    }

    /**
     * Retourne les infos sur la base de données pour le dashboard
     */
    public static function get_db_status() {
        $remote      = get_option( self::DB_OPTION_KEY, array() );
        $last_update = get_option( self::DB_LAST_UPDATE_KEY, 0 );
        $last_error  = get_option( 'cookieradar_db_last_error', '' );
        $local_path  = COOKIERADAR_PATH . 'cookie-database.json';
        $local_data  = array();

        if ( file_exists( $local_path ) ) {
            $local_data = json_decode( file_get_contents( $local_path ), true ) ?: array();
        }

        return array(
            'source'         => ! empty( $remote['plugins'] ) ? 'remote' : 'local',
            'version'        => ! empty( $remote['version'] )     ? $remote['version']     : ( isset( $local_data['version'] ) ? $local_data['version'] : '—' ),
            'plugin_count'   => ! empty( $remote['plugins'] )     ? count( $remote['plugins'] ) : ( isset( $local_data['plugins'] ) ? count( $local_data['plugins'] ) : 0 ),
            'last_update'    => $last_update ? date_i18n( 'j F Y à H:i', $last_update ) : 'Jamais',
            'next_update'    => wp_next_scheduled( 'cookieradar_update_db' ) ? date_i18n( 'j F Y à H:i', wp_next_scheduled( 'cookieradar_update_db' ) ) : '—',
            'last_error'     => $last_error,
            'remote_url'     => self::REMOTE_DB_URL,
        );
    }

    public static function get_last_scan_date() {
        return get_option( 'cookieradar_last_scan', null );
    }
}
