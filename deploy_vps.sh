#!/bin/bash
# ====================================================================
# SafeWork RH & SST - Script de Instalação e Deploy 24/7 em Servidor VPS
# Compatível com Ubuntu 22.04 / 24.04 LTS e Debian 12
# ====================================================================

set -e

echo "=========================================================="
echo "🛡️  SafeWork RH & SST - Instalador Automático de Produção"
echo "=========================================================="

# 1. Atualizar pacotes do sistema
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx

# 2. Instalar Node.js 24 LTS via NodeSource
echo "--> Instalando Node.js 24..."
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Instalar PM2 para gerenciamento contínuo (24/7)
sudo npm install -g pm2

# 4. Criar pasta da aplicação se não existir
APP_DIR="/var/www/safework-rh"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

echo "--> Copie os arquivos do sistema para $APP_DIR"
cd $APP_DIR

# 5. Inicializar banco e iniciar com PM2
if [ ! -f "safework.db" ]; then
    echo "--> Inicializando banco de dados..."
    node database/seed.js
fi

echo "--> Iniciando serviço com PM2..."
pm2 start server.js --name "safework-rh"
pm2 save
pm2 startup | tail -n 1 | sudo bash || true

# 6. Configurar Firewall UFW
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

echo "=========================================================="
echo "✅ SafeWork instalado e rodando 24 horas por dia com PM2!"
echo "Comandos úteis:"
echo "  pm2 status          - Ver status do sistema"
echo "  pm2 logs safework-rh - Ver logs em tempo real"
echo "  pm2 restart safework-rh - Reiniciar"
echo "=========================================================="
