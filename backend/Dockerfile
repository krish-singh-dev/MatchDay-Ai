FROM node:20-alpine

WORKDIR /app

# Copy dependencies and shared types
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared ./shared/

# Install backend dependencies
RUN npm install --prefix backend

# Copy backend source code
COPY backend ./backend/

# Generate Prisma client and compile TypeScript
RUN npm run prisma:generate --prefix backend
RUN npm run build --prefix backend

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["npm", "start", "--prefix", "backend"]
