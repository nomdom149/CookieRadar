<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class CookieRadar_Policy_Generator {

    const PAGE_OPTION = 'cookieradar_policy_page_id';

    public static function init() {
        add_shortcode( 'cookieradar_policy', array( __CLASS__, 'render_shortcode' ) );
    }

    public static function create_page_on_activation() {
        $page_id = get_option( self::PAGE_OPTION );

        if ( $page_id && get_post( $page_id ) ) {
            return;
        }

        $page_id = wp_insert_post( array(
            'post_title'   => 'Politique de cookies',
            'post_name'    => 'politique-cookies',
            'post_content' => '[cookieradar_policy]',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_author'  => 1,
        ) );

        if ( ! is_wp_error( $page_id ) ) {
            update_option( self::PAGE_OPTION, $page_id );
        }
    }

    public static function regenerate() {
        $page_id = get_option( self::PAGE_OPTION );

        if ( ! $page_id || ! get_post( $page_id ) ) {
            self::create_page_on_activation();
            return;
        }

        wp_update_post( array(
            'ID'                => $page_id,
            'post_modified'     => current_time( 'mysql' ),
            'post_modified_gmt' => current_time( 'mysql', true ),
        ) );

        self::purge_cache( $page_id );
    }

    public static function render_shortcode( $atts ) {
        $plugins   = CookieRadar_Scanner::get_detected_plugins();
        $last_scan = CookieRadar_Scanner::get_last_scan_date();
        $site_name = get_bloginfo( 'name' );
        $site_url  = get_bloginfo( 'url' );

        $by_category = array();
        foreach ( $plugins as $key => $plugin ) {
            $by_category[ $plugin['category'] ][] = $plugin;
        }

        $order = array( 'essential', 'functional', 'analytics', 'marketing' );

        $category_labels = array(
            'essential'  => 'Cookies essentiels',
            'functional' => 'Cookies fonctionnels',
            'analytics'  => 'Cookies analytiques',
            'marketing'  => 'Cookies marketing',
        );

        $category_descriptions = array(
            'essential'  => 'Ces cookies sont indispensables au fonctionnement du site. Ils ne peuvent pas être désactivés.',
            'functional' => 'Ces cookies améliorent votre expérience (chat en ligne, paiement sécurisé, formulaires avancés).',
            'analytics'  => 'Ces cookies nous aident à comprendre comment les visiteurs utilisent le site.',
            'marketing'  => 'Ces cookies sont utilisés pour vous proposer des publicités adaptées à vos centres d\'intérêt.',
        );

        ob_start();
        ?>
        <div class="cookieradar-policy">

            <p class="cookieradar-policy__intro">
                Ce document décrit les cookies utilisés sur <strong><?php echo esc_html( $site_name ); ?></strong>
                (<?php echo esc_url( $site_url ); ?>) et la manière dont vous pouvez gérer vos préférences.
                Cette page est mise à jour automatiquement dès qu'un service utilisant des cookies
                est ajouté ou retiré du site.
            </p>

            <?php if ( $last_scan ) : ?>
            <p class="cookieradar-policy__updated">
                <em>Dernière mise à jour : <?php echo esc_html( date_i18n( 'j F Y', strtotime( $last_scan ) ) ); ?></em>
            </p>
            <?php endif; ?>

            <h2>Qu'est-ce qu'un cookie ?</h2>
            <p>Un cookie est un petit fichier texte déposé sur votre appareil lors de votre visite
            sur un site web. Il permet au site de mémoriser vos actions et préférences sur une
            période donnée.</p>

            <h2>Les cookies utilisés sur ce site</h2>

            <?php foreach ( $order as $cat ) : ?>
                <?php if ( empty( $by_category[ $cat ] ) ) continue; ?>

                <h3><?php echo esc_html( $category_labels[ $cat ] ); ?></h3>
                <p><?php echo esc_html( $category_descriptions[ $cat ] ); ?></p>

                <?php foreach ( $by_category[ $cat ] as $plugin ) : ?>
                <div class="cookieradar-policy__service">
                    <h4>
                        <?php echo esc_html( $plugin['label'] ); ?>
                        <span class="cookieradar-policy__provider">
                            — <?php echo esc_html( $plugin['provider'] ); ?>
                            <?php if ( ! empty( $plugin['privacy_url'] ) ) : ?>
                                (<a href="<?php echo esc_url( $plugin['privacy_url'] ); ?>"
                                    target="_blank" rel="noopener noreferrer">Politique de confidentialité</a>)
                            <?php endif; ?>
                        </span>
                    </h4>
                    <table class="cookieradar-policy__table">
                        <thead>
                            <tr>
                                <th>Nom du cookie</th>
                                <th>Durée</th>
                                <th>Finalité</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ( $plugin['cookies'] as $cookie ) : ?>
                            <tr>
                                <td><code><?php echo esc_html( $cookie['name'] ); ?></code></td>
                                <td><?php echo esc_html( $cookie['duration'] ); ?></td>
                                <td><?php echo esc_html( $cookie['purpose'] ); ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endforeach; ?>

            <?php endforeach; ?>

            <h2>Gérer vos préférences</h2>
            <p>Vous pouvez modifier vos choix à tout moment en cliquant sur le bouton ci-dessous.</p>
            <button
                class="cookieradar-reopen-banner"
                onclick="if(window.CookieRadar){ window.CookieRadar.openSettings(); } return false;"
                type="button">
                Gérer mes préférences cookies
            </button>

            <h2>Vos droits</h2>
            <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de
            suppression des données vous concernant. Contactez-nous via la page de contact du site.</p>

        </div>
        <?php
        return ob_get_clean();
    }

    public static function get_policy_url() {
        $page_id = get_option( self::PAGE_OPTION );
        if ( $page_id && get_post( $page_id ) ) {
            return get_permalink( $page_id );
        }
        return '';
    }

    private static function purge_cache( $page_id ) {
        if ( function_exists( 'rocket_clean_post' ) )       rocket_clean_post( $page_id );
        if ( function_exists( 'w3tc_flush_post' ) )         w3tc_flush_post( $page_id );
        if ( function_exists( 'wpsc_delete_post_cache' ) )  wpsc_delete_post_cache( $page_id );
        if ( class_exists( 'LiteSpeed_Cache_API' ) )        LiteSpeed_Cache_API::purge( $page_id );
    }

    public static function delete_policy_page() {
        $page_id = get_option( self::PAGE_OPTION );
        if ( $page_id ) {
            wp_delete_post( $page_id, true );
            delete_option( self::PAGE_OPTION );
        }
    }
}
