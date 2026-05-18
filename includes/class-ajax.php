<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class CookieRadar_Ajax {

    public static function init() {
        // Endpoint accessible visiteurs connectés et non connectés
        add_action( 'wp_ajax_cookieradar_report_scan',        array( __CLASS__, 'handle_scan_report' ) );
        add_action( 'wp_ajax_nopriv_cookieradar_report_scan', array( __CLASS__, 'handle_scan_report' ) );
    }

    /**
     * Reçoit la liste des services détectés par scanner.js
     * Fusionne avec les plugins déjà connus et ajoute les inconnus en "functional"
     */
    public static function handle_scan_report() {

        // Vérification nonce
        if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( $_POST['nonce'] ), 'cookieradar_scan_nonce' ) ) {
            wp_send_json_error( 'Invalid nonce', 403 );
            return;
        }

        // Récupération et décodage des données
        $raw = isset( $_POST['detected'] ) ? stripslashes( $_POST['detected'] ) : '';
        if ( empty( $raw ) ) {
            wp_send_json_error( 'No data', 400 );
            return;
        }

        $detected_from_js = json_decode( $raw, true );
        if ( ! is_array( $detected_from_js ) || empty( $detected_from_js ) ) {
            wp_send_json_error( 'Invalid data', 400 );
            return;
        }

        // Charger les détections actuelles
        $current_detected = get_option( 'cookieradar_detected_plugins', array() );
        $new_services     = array();
        $updated          = false;

        foreach ( $detected_from_js as $service ) {

            // Validation minimale
            if ( empty( $service['key'] ) || empty( $service['label'] ) ) {
                continue;
            }

            $key = sanitize_key( $service['key'] );

            // Déjà connu — ignorer
            if ( isset( $current_detected[ $key ] ) ) {
                continue;
            }

            // Nouveau service détecté — ajouter avec catégorie fournie ou "functional" par défaut
            $cookies = array();
            if ( ! empty( $service['cookies'] ) && is_array( $service['cookies'] ) ) {
                foreach ( $service['cookies'] as $cookie ) {
                    if ( ! empty( $cookie['name'] ) ) {
                        $cookies[] = array(
                            'name'     => sanitize_text_field( $cookie['name'] ),
                            'duration' => sanitize_text_field( isset( $cookie['duration'] ) ? $cookie['duration'] : 'Variable' ),
                            'purpose'  => sanitize_text_field( isset( $cookie['purpose'] )  ? $cookie['purpose']  : 'Détecté automatiquement' ),
                        );
                    }
                }
            }

            $new_entry = array(
                'label'       => sanitize_text_field( $service['label'] ),
                'category'    => in_array( $service['category'], array( 'essential', 'functional', 'analytics', 'marketing' ), true )
                                    ? $service['category']
                                    : 'functional',
                'cookies'     => $cookies,
                'provider'    => sanitize_text_field( isset( $service['provider'] )    ? $service['provider']    : '' ),
                'privacy_url' => esc_url_raw( isset( $service['privacy_url'] )         ? $service['privacy_url'] : '' ),
                'source'      => 'scanner', // Marqueur — détecté par scanner JS
            );

            $current_detected[ $key ] = $new_entry;
            $new_services[]           = $service['label'];
            $updated                  = true;
        }

        if ( $updated ) {
            update_option( 'cookieradar_detected_plugins', $current_detected );
            update_option( 'cookieradar_last_scan', current_time( 'mysql' ) );

            // Régénérer la page politique avec les nouveaux services
            CookieRadar_Policy_Generator::regenerate();

            // Logger les nouveaux services pour le dashboard
            $log   = get_option( 'cookieradar_scan_log', array() );
            $log[] = array(
                'date'     => current_time( 'mysql' ),
                'services' => $new_services,
                'source'   => 'visitor_scan',
            );
            // Garder uniquement les 20 dernières entrées
            if ( count( $log ) > 20 ) {
                $log = array_slice( $log, -20 );
            }
            update_option( 'cookieradar_scan_log', $log );
        }

        wp_send_json_success( array(
            'updated'      => $updated,
            'new_services' => $new_services,
            'total'        => count( $current_detected ),
        ) );
    }

    /**
     * Vide les détections issues du scanner (remet à zéro les services "source: scanner")
     * Accessible depuis le dashboard admin
     */
    public static function clear_scanner_detections() {
        $detected = get_option( 'cookieradar_detected_plugins', array() );
        $cleared  = 0;

        foreach ( $detected as $key => $plugin ) {
            if ( isset( $plugin['source'] ) && $plugin['source'] === 'scanner' ) {
                unset( $detected[ $key ] );
                $cleared++;
            }
        }

        if ( $cleared > 0 ) {
            update_option( 'cookieradar_detected_plugins', $detected );
            CookieRadar_Policy_Generator::regenerate();
        }

        return $cleared;
    }
}
