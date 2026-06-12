FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY gc-client.js .
CMD ["node", "gc-client.js"]
