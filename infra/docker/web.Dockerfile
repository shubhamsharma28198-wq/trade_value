FROM node:22-alpine
WORKDIR /app
COPY apps/web ./apps/web
ENV WEB_HOST=0.0.0.0
ENV WEB_PORT=3000
EXPOSE 3000
CMD ["node", "apps/web/server.mjs"]
