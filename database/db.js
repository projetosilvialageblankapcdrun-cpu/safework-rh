// ====================================================================
// SafeWork RH & SST - Módulo de Conexão com SQLite nativo (node:sqlite)
// ====================================================================

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'safework.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

function getDb() {
    if (!dbInstance) {
        const isNewDb = !fs.existsSync(DB_PATH);
        dbInstance = new DatabaseSync(DB_PATH);
        dbInstance.exec('PRAGMA foreign_keys = ON;');
        dbInstance.exec('PRAGMA journal_mode = WAL;');

        // Sempre executar o schema com IF NOT EXISTS para aplicar novas tabelas (ex: usuarios)
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        dbInstance.exec(schemaSql);
        if (isNewDb) {
            console.log('[SafeWork DB] Novo banco de dados SQLite inicializado.');
        }
    }
    return dbInstance;
}

// Helpers seguros para consultas (com sanitização de undefined -> null)
function sanitize(params = []) {
    return params.map(p => p === undefined ? null : p);
}

function queryAll(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.all(...sanitize(params));
}

function queryOne(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.get(...sanitize(params));
}

function execute(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.run(...sanitize(params));
}

module.exports = {
    getDb,
    queryAll,
    queryOne,
    execute,
    DB_PATH
};
