FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

# limpiar build previo SIEMPRE
RUN rm -rf .next

# build real de Next
RUN npm run build

EXPOSE 3000
CMD ["npm","run","start"]
