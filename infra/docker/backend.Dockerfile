FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV DATABASE_URL=postgresql://tradevault:tradevault@postgres:5432/tradevault
RUN npm install && npm run build
CMD ["npm", "run", "start", "-w", "api"]
