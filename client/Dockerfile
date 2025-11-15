# Build stage
FROM node:alpine AS build

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV BROWSER=none
ENV NODE_OPTIONS=--require=/app/mock-localstorage.js
# ENV CI=true

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]