// ====================================================================
// SafeWork RH & SST - Entrada Principal do Sistema
// ====================================================================

const { getDb } = require('./database/db.js');
const { startServer } = require('./server/app.js');

// 1. Inicializar banco de dados SQLite
getDb();

// 2. Iniciar servidor HTTP na porta e host configurados
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
startServer(PORT, HOST);
