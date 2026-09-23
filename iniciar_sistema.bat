@echo off
chcp 65001 > nul
title SafeWork RH & SST - Sistema Integrado

echo ========================================================
echo    🛡️ SafeWork RH & SST - Sistema Corporativo Integrado
echo ========================================================
echo.
echo Verificando integridade do banco de dados SQLite...

if not exist "safework.db" (
    echo Criando banco de dados e dados regulamentares de exemplo...
    agy-node database/seed.js
)

echo.
echo Iniciando servidor SafeWork na porta 3000...
start "" http://localhost:3000

echo O sistema foi aberto no seu navegador padrao!
echo Pressione CTRL+C nesta janela para encerrar o servidor.
echo.

agy-node server.js
