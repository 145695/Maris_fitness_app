FROM node:20-alpine

WORKDIR /app

# Dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Application code
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]