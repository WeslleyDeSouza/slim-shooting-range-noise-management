# syntax=docker/dockerfile:1
FROM node:24-alpine

WORKDIR /usr/src/app/

# curl for health checks, mariadb-client (incl. mysqldump) for backups
RUN apk add --no-cache curl mariadb-client

RUN npm install -g npm@^11 pm2 tslib --no-audit --no-fund

# Package files first for better layer caching. The committed .npmrc only
# maps @app-galaxy to the nexus registry; the token is never committed
# (GitHub push protection rejects it) — it arrives as BuildKit secret
# `npm_token` (CI) or build arg NPM_TOKEN (local) and is appended for the
# install layer only.
COPY package.json package-lock.json .npmrc ./

ARG NPM_TOKEN
RUN --mount=type=secret,id=npm_token,required=false \
    if [ -n "$NPM_TOKEN" ]; then \
        echo "//nexus-repository.revolvit.ch/repository/npm_hosted/:_authToken=${NPM_TOKEN}" >> .npmrc; \
    elif [ -f /run/secrets/npm_token ]; then \
        echo "//nexus-repository.revolvit.ch/repository/npm_hosted/:_authToken=$(cat /run/secrets/npm_token)" >> .npmrc; \
    fi && \
    npm install --ignore-engines --omit=dev --legacy-peer-deps && \
    sed -i '/_authToken/d' .npmrc

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=8192" \
    APP_NAME='slim' \
    PORT='3003' \
    APP_DEFAULT_USER='' \
    APP_DEFAULT_PASSWORD='' \
    APP_SECRET='' \
    APP_ENV='development' \
    APP_UI_PATH='app' \
    API_ACCESS_CONTROL_ORIGIN="*" \
    API_SWAGGER_ENABLED=0 \
    TZ='UTC' \
    LOG_LEVEL='0' \
    DB_TYPE='mysql' \
    DB_HOST='' \
    DB_PORT='' \
    DB_USERNAME='' \
    DB_PASSWORD='' \
    DB_DATABASE=''

COPY ./dist/apps/api ./dist/api/
COPY ./dist/apps/app ./dist/app/
COPY ./config ./config/
COPY ./ecosystem.config.js ./

RUN chown -R node:node /usr/src/app

USER node

EXPOSE 3003 80 443

CMD ["pm2-runtime", "start", "ecosystem.config.js"]
