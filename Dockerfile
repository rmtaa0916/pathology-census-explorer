# Render Free web-service image: synthetic demo only by default.
FROM php:8.3-apache-bookworm
ENV PORT=10000 APP_MODE=demo APP_WRITE_ENABLED=0
RUN set -eu; sed -ri 's!DocumentRoot /var/www/html!DocumentRoot /var/www/html/public!g' /etc/apache2/sites-available/000-default.conf; a2enmod headers >/dev/null
WORKDIR /var/www/html
COPY src/ /var/www/html/src/
COPY public/ /var/www/html/public/
EXPOSE 10000
CMD ["sh", "-c", "set -eu; port=\"${PORT:-10000}\"; sed -ri \"s/^Listen [0-9]+$/Listen ${port}/\" /etc/apache2/ports.conf; sed -ri \"s/:80>/:${port}>/g\" /etc/apache2/sites-available/000-default.conf; exec apache2-foreground"]
