# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Install exactly what package-lock.json pins
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build. No secrets are needed or used at build time:
# AI and job-search keys live in Supabase Edge Function secrets, not in this image.
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=build /app/dist ./
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# nginx:alpine's default CMD starts nginx in the foreground
