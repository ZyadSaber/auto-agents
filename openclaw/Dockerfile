FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json .
RUN npm install

COPY . .

RUN mkdir -p /app/data/whatsapp-session

EXPOSE 3100

CMD ["node", "index.js"]
