# Preview deployment only: PHP CLI server, synthetic fixture data, no credentials.
FROM php:8.3-cli-alpine
WORKDIR /app
COPY . /app
ENV APP_MODE=demo APP_WRITE_ENABLED=0
EXPOSE 10000
CMD ["sh", "-c", "exec php -S 0.0.0.0:${PORT:-10000} -t public"]
