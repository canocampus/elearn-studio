FROM php:8.2-apache

# ── System dependencies ────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        libfreetype6-dev libjpeg62-turbo-dev libpng-dev \
        libzip-dev libicu-dev libxml2-dev \
        libmariadb-dev-compat libmariadb-dev \
        libsodium-dev libonig-dev \
        curl unzip \
    && docker-php-ext-configure gd \
           --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
           bcmath gd intl mbstring pdo_mysql \
           simplexml soap sodium zip \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

# ── PHP settings for Moodle ────────────────────────────────────────────────
RUN { \
    echo 'upload_max_filesize = 256M'; \
    echo 'post_max_size = 256M'; \
    echo 'max_execution_time = 300'; \
    echo 'max_input_vars = 5000'; \
    echo 'memory_limit = 256M'; \
    echo 'opcache.enable = 1'; \
    echo 'opcache.memory_consumption = 128'; \
} > /usr/local/etc/php/conf.d/moodle.ini

# ── Download Moodle 4.5.0 from GitHub ─────────────────────────────────────
# Using GitHub archive — no redirect, deterministic, no login required
ARG MOODLE_TAG=v4.5.0
RUN curl -fsSL "https://github.com/moodle/moodle/archive/refs/tags/${MOODLE_TAG}.tar.gz" \
        -o /tmp/moodle.tar.gz \
    && tar -xzf /tmp/moodle.tar.gz -C /tmp/ \
    && mv /tmp/moodle-4.5.0 /var/www/moodle \
    && rm /tmp/moodle.tar.gz \
    && chown -R www-data:www-data /var/www/moodle

# ── Apache: point document root at Moodle, allow .htaccess ────────────────
RUN sed -i \
        -e 's|DocumentRoot /var/www/html|DocumentRoot /var/www/moodle|' \
        /etc/apache2/sites-available/000-default.conf \
    && printf '<Directory /var/www/moodle>\n  Options FollowSymLinks\n  AllowOverride All\n  Require all granted\n</Directory>\n' \
        >> /etc/apache2/sites-available/000-default.conf \
    && echo 'ServerName localhost' \
        > /etc/apache2/conf-available/servername.conf \
    && a2enconf servername

# ── Moodledata directory ───────────────────────────────────────────────────
RUN mkdir -p /var/www/moodledata \
    && chown www-data:www-data /var/www/moodledata \
    && chmod 0770 /var/www/moodledata

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["apache2-foreground"]
