# ====================================================================
# SafeWork RH & SST - Dockerfile de Produção (Node.js 24 Alpine)
# Imagem ultra-leve (~150MB), sem dependências pesadas, com SQLite nativo
# ====================================================================

FROM node:24-alpine

WORKDIR /app

# Criar diretório para persistência do banco de dados SQLite
RUN mkdir -p /app/data

# Copiar código-fonte da aplicação
COPY . .

# Variáveis de ambiente de produção
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/safework.db

# Expor a porta da aplicação
EXPOSE 3000

# Volume para manter os dados salvos mesmo se o container for atualizado
VOLUME ["/app/data"]

# Script de inicialização: copia o banco já populado ou roda o seed inicial, depois sobe o servidor
CMD ["sh", "-c", "if [ ! -f /app/data/safework.db ]; then echo '[SafeWork] Inicializando banco de dados...'; cp /app/safework.db /app/data/safework.db 2>/dev/null || node database/seed.js; fi && node server.js"]
