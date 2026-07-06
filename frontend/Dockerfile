# Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency configs and shared types
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY shared ./shared/

# Install dependencies
RUN npm install --prefix frontend

# Copy frontend source code
COPY frontend ./frontend/

# Build production bundle
RUN npm run build --prefix frontend

# Production Stage (Nginx web server)
FROM nginx:alpine

# Copy compiled static site from build stage
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
