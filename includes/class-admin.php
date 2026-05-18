<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class CookieRadar_Admin {

    public static function init() {
        add_action( 'admin_menu',            array( __CLASS__, 'register_menu' ) );
        add_action( 'admin_init',            array( __CLASS__, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_assets' ) );
    }

    public static function activate() {
        CookieRadar_Scanner::run_scan();
        CookieRadar_Policy_Generator::create_page_on_activation();
        flush_rewrite_rules();
    }

    public static function deactivate() {
        flush_rewrite_rules();
    }

    public static function uninstall() {
        CookieRadar_Policy_Generator::delete_policy_page();
        $options = array(
            'cookieradar_detected_plugins',
            'cookieradar_last_scan',
            'cookieradar_text_title',
            'cookieradar_text_desc',
            'cookieradar_text_accept',
            'cookieradar_text_save',
            'cookieradar_text_decline',
            'cookieradar_text_settings',
            'cookieradar_text_policy',
            'cookieradar_banner_position',
            'cookieradar_primary_color',
            'cookieradar_policy_page_id',
        );
        foreach ( $options as $option ) {
            delete_option( $option );
        }
    }

    public static function register_menu() {
        add_menu_page(
            'CookieRadar',
            'CookieRadar',
            'manage_options',
            'cookie-radar',
            array( __CLASS__, 'render_dashboard' ),
            'dashicons-shield',
            80
        );
        add_submenu_page(
            'cookie-radar',
            'Tableau de bord',
            'Tableau de bord',
            'manage_options',
            'cookie-radar',
            array( __CLASS__, 'render_dashboard' )
        );
        add_submenu_page(
            'cookie-radar',
            'Personnalisation',
            'Personnalisation',
            'manage_options',
            'cookie-radar-settings',
            array( __CLASS__, 'render_settings' )
        );
    }

    public static function register_settings() {
        $fields = array(
            'cookieradar_text_title'      => 'Ce site utilise des cookies',
            'cookieradar_text_desc'       => 'Choisissez quels cookies vous autorisez.',
            'cookieradar_text_accept'     => 'Tout accepter',
            'cookieradar_text_save'       => 'Enregistrer mes choix',
            'cookieradar_text_decline'    => 'Tout refuser',
            'cookieradar_text_settings'   => 'Personnaliser',
            'cookieradar_text_policy'     => 'Politique cookies',
            'cookieradar_banner_position' => 'bottom',
            'cookieradar_primary_color'   => '#233038',
        );
        foreach ( $fields as $option => $default ) {
            register_setting( 'cookieradar_options', $option, array(
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => $default,
            ) );
        }
    }

    public static function enqueue_admin_assets( $hook ) {
        if ( strpos( $hook, 'cookie-radar' ) === false ) return;
        wp_enqueue_style(
            'cookie-radar-admin',
            COOKIERADAR_URL . 'assets/admin.css',
            array(),
            COOKIERADAR_VERSION
        );
    }

    public static function render_dashboard() {

        // Traitement rescan manuel
        if (
            isset( $_POST['cookieradar_action'] ) &&
            $_POST['cookieradar_action'] === 'rescan' &&
            check_admin_referer( 'cookieradar_rescan', 'cookieradar_nonce' )
        ) {
            CookieRadar_Scanner::run_scan();
            CookieRadar_Policy_Generator::regenerate();
            echo '<div class="notice notice-success is-dismissible"><p>Scan terminé — page politique mise à jour.</p></div>';
        }

        $detected   = CookieRadar_Scanner::get_detected_plugins();
        $last_scan  = CookieRadar_Scanner::get_last_scan_date();
        $policy_url = CookieRadar_Policy_Generator::get_policy_url();

        $counts = array( 'essential' => 0, 'functional' => 0, 'analytics' => 0, 'marketing' => 0 );
        foreach ( $detected as $plugin ) {
            $cat = $plugin['category'];
            if ( isset( $counts[ $cat ] ) ) $counts[ $cat ]++;
        }
        ?>
        <div class="wrap cr-wrap">
            <div class="cr-header">
                <div>
                    <h1 class="cr-header__title">CookieRadar</h1>
                    <p class="cr-tagline">Scan automatique · Consentement granulaire · Page politique auto-générée</p>
                </div>
            </div>

            <div class="cr-cards">
                <div class="cr-card cr-card--essential">
                    <div class="cr-card__number"><?php echo (int) $counts['essential']; ?></div>
                    <div class="cr-card__label">Essentiels</div>
                </div>
                <div class="cr-card cr-card--functional">
                    <div class="cr-card__number"><?php echo (int) $counts['functional']; ?></div>
                    <div class="cr-card__label">Fonctionnels</div>
                </div>
                <div class="cr-card cr-card--analytics">
                    <div class="cr-card__number"><?php echo (int) $counts['analytics']; ?></div>
                    <div class="cr-card__label">Analytiques</div>
                </div>
                <div class="cr-card cr-card--marketing">
                    <div class="cr-card__number"><?php echo (int) $counts['marketing']; ?></div>
                    <div class="cr-card__label">Marketing</div>
                </div>
            </div>

            <div class="cr-section">
                <div class="cr-section__header">
                    <h2>Plugins détectés</h2>
                    <div class="cr-meta">
                        <?php if ( $last_scan ) : ?>
                            <span class="cr-badge cr-badge--info">
                                Dernier scan : <?php echo esc_html( date_i18n( 'j F Y à H:i', strtotime( $last_scan ) ) ); ?>
                            </span>
                        <?php endif; ?>
                        <form method="post" style="display:inline-block;">
                            <?php wp_nonce_field( 'cookieradar_rescan', 'cookieradar_nonce' ); ?>
                            <input type="hidden" name="cookieradar_action" value="rescan">
                            <button type="submit" class="button button-secondary">Relancer le scan</button>
                        </form>
                    </div>
                </div>

                <?php if ( empty( $detected ) ) : ?>
                    <p class="cr-empty">Aucun plugin utilisant des cookies n'a été détecté.</p>
                <?php else : ?>
                    <table class="cr-table widefat">
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Fournisseur</th>
                                <th>Catégorie</th>
                                <th>Cookies</th>
                                <th>Politique</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ( $detected as $plugin ) : ?>
                            <tr>
                                <td><strong><?php echo esc_html( $plugin['label'] ); ?></strong></td>
                                <td><?php echo esc_html( $plugin['provider'] ); ?></td>
                                <td><span class="cr-badge cr-badge--<?php echo esc_attr( $plugin['category'] ); ?>"><?php echo esc_html( $plugin['category'] ); ?></span></td>
                                <td>
                                    <?php foreach ( $plugin['cookies'] as $cookie ) : ?>
                                        <code><?php echo esc_html( $cookie['name'] ); ?></code>
                                    <?php endforeach; ?>
                                </td>
                                <td>
                                    <?php if ( ! empty( $plugin['privacy_url'] ) ) : ?>
                                        <a href="<?php echo esc_url( $plugin['privacy_url'] ); ?>" target="_blank" rel="noopener">↗ Voir</a>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>

                <?php if ( $policy_url ) : ?>
                    <p class="cr-policy-link">
                        Page politique : <a href="<?php echo esc_url( $policy_url ); ?>" target="_blank"><?php echo esc_url( $policy_url ); ?> ↗</a>
                    </p>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }

    public static function render_settings() {
        ?>
        <div class="wrap cr-wrap">
            <div class="cr-header">
                <div>
                    <h1 class="cr-header__title">Personnalisation</h1>
                    <p class="cr-tagline">Adaptez les textes et l'apparence du banner à votre identité.</p>
                </div>
            </div>

            <form method="post" action="options.php">
                <?php settings_fields( 'cookieradar_options' ); ?>

                <div class="cr-section">
                    <h2>Textes du banner</h2>
                    <table class="form-table cr-form-table">
                        <?php
                        $fields = array(
                            'cookieradar_text_title'    => array( 'label' => 'Titre',                    'default' => 'Ce site utilise des cookies' ),
                            'cookieradar_text_desc'     => array( 'label' => 'Description',              'default' => 'Choisissez quels cookies vous autorisez.' ),
                            'cookieradar_text_accept'   => array( 'label' => 'Bouton "Tout accepter"',   'default' => 'Tout accepter' ),
                            'cookieradar_text_save'     => array( 'label' => 'Bouton "Enregistrer"',     'default' => 'Enregistrer mes choix' ),
                            'cookieradar_text_decline'  => array( 'label' => 'Bouton "Tout refuser"',    'default' => 'Tout refuser' ),
                            'cookieradar_text_settings' => array( 'label' => 'Bouton "Personnaliser"',   'default' => 'Personnaliser' ),
                            'cookieradar_text_policy'   => array( 'label' => 'Lien politique cookies',   'default' => 'Politique cookies' ),
                        );
                        foreach ( $fields as $key => $field ) :
                        ?>
                        <tr>
                            <th><?php echo esc_html( $field['label'] ); ?></th>
                            <td>
                                <input type="text"
                                    name="<?php echo esc_attr( $key ); ?>"
                                    value="<?php echo esc_attr( get_option( $key, $field['default'] ) ); ?>"
                                    class="regular-text">
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </table>
                </div>

                <div class="cr-section">
                    <h2>Apparence</h2>
                    <table class="form-table cr-form-table">
                        <tr>
                            <th>Position du banner</th>
                            <td>
                                <select name="cookieradar_banner_position">
                                    <?php
                                    $pos = get_option( 'cookieradar_banner_position', 'bottom' );
                                    $positions = array( 'bottom' => 'Barre basse', 'top' => 'Barre haute', 'modal' => 'Modal centré' );
                                    foreach ( $positions as $val => $label ) :
                                    ?>
                                    <option value="<?php echo esc_attr( $val ); ?>" <?php selected( $pos, $val ); ?>><?php echo esc_html( $label ); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>Couleur principale</th>
                            <td>
                                <input type="color"
                                    name="cookieradar_primary_color"
                                    value="<?php echo esc_attr( get_option( 'cookieradar_primary_color', '#233038' ) ); ?>">
                                <p class="description">Couleur de fond du banner.</p>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php submit_button( 'Enregistrer les modifications' ); ?>
            </form>
        </div>
        <?php
    }
}
