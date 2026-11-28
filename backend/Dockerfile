
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./
COPY backend ./backend
COPY shared ./shared
COPY tests ./tests

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
