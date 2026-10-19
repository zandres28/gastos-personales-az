FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY schema.sql ./
COPY src ./src
EXPOSE 3000
CMD ["sh", "-c", "node src/scripts/migrate.js && node src/index.js"]
