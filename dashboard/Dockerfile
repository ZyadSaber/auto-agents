FROM node:20-alpine

# Install build tools for sqlite3
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy server package files
COPY package.json ./

# Install server dependencies
RUN npm install

# Copy client and build
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client ./client
RUN cd client && npm run build

# Move build to public directory of server
RUN mkdir -p public && cp -r client/dist/* public/ && rm -rf client/node_modules

# Copy the rest of the server files
COPY server.js database.js ./

# Data volume for DB
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
