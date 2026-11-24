FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# URL da API embutida no build (em producao: /api/, mesma origem via proxy reverso)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Dica de credenciais de demonstração na tela de login (somente desenvolvimento)
ARG NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=false
ENV NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=$NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
