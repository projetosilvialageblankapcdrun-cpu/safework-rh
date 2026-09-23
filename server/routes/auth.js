// ====================================================================
// SafeWork RH & SST - Módulo de Autenticação, Usuários e Perfis de Acesso
// Criptografia nativa com PBKDF2 (SHA-512) e Tokens HMAC Seguros
// ====================================================================

const crypto = require('node:crypto');
const { queryAll, queryOne, execute, getDb } = require('../../database/db.js');

// Segredo do servidor para assinatura de tokens (gerado em runtime ou fixo por env)
const JWT_SECRET = process.env.JWT_SECRET || 'safework-enterprise-secret-key-2026-nr01-sst-dp';

// Utilitários de Hash e Criptografia
function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
    const { hash } = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

// Geração e Validação de Token de Sessão
function generateToken(user) {
    const payload = JSON.stringify({
        id: user.id,
        login: user.login,
        perfil: user.perfil,
        exp: Date.now() + (24 * 60 * 60 * 1000) // Válido por 24 horas
    });
    const base64Payload = Buffer.from(payload).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(base64Payload).digest('base64url');
    return `${base64Payload}.${signature}`;
}

function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [base64Payload, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(base64Payload).digest('base64url');

    try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return null;
        }
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'));
        if (payload.exp < Date.now()) {
            return null; // Expirado
        }
        return payload;
    } catch {
        return null;
    }
}

// Garantir que a tabela e o Super Administrador existam
function ensureAdminUser() {
    const db = getDb();
    db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            login TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            perfil TEXT NOT NULL DEFAULT 'Administrador' CHECK(perfil IN ('Administrador', 'Gestor DP', 'Técnico SST', 'Visualizador')),
            ativo INTEGER NOT NULL DEFAULT 1,
            ultimo_acesso DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const count = queryOne(`SELECT COUNT(*) as total FROM usuarios`)?.total || 0;
    if (count === 0) {
        console.log('[SafeWork Auth] Criando usuário Administrador Geral padrão...');
        const { hash, salt } = hashPassword('admin123');
        execute(`
            INSERT INTO usuarios (nome, email, login, senha_hash, salt, perfil, ativo)
            VALUES (?, ?, ?, ?, ?, 'Administrador', 1)
        `, ['Administrador Geral', 'admin@metalsul.com.br', 'admin', hash, salt]);
        console.log('[SafeWork Auth] Usuário admin criado! (Login: admin / Senha: admin123)');
    }
}

// LOGIN
function login(loginOuEmail, senha) {
    ensureAdminUser();

    const user = queryOne(`
        SELECT * FROM usuarios 
        WHERE (login = ? OR email = ?) AND ativo = 1
    `, [loginOuEmail, loginOuEmail]);

    if (!user) {
        throw new Error('Usuário ou senha inválidos, ou conta desativada.');
    }

    if (!verifyPassword(senha, user.senha_hash, user.salt)) {
        throw new Error('Usuário ou senha inválidos.');
    }

    // Atualizar último acesso
    execute(`UPDATE usuarios SET ultimo_acesso = datetime('now', 'localtime') WHERE id = ?`, [user.id]);

    const token = generateToken(user);
    return {
        token,
        usuario: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            login: user.login,
            perfil: user.perfil
        }
    };
}

// OBTER USUÁRIO ATUAL PELO TOKEN
function getCurrentUser(token) {
    const payload = verifyToken(token);
    if (!payload) return null;

    const user = queryOne(`SELECT id, nome, email, login, perfil, ativo, ultimo_acesso FROM usuarios WHERE id = ?`, [payload.id]);
    if (!user || user.ativo !== 1) return null;
    return user;
}

// LISTAGEM DE USUÁRIOS (Apenas Administrador)
function listUsuarios() {
    ensureAdminUser();
    return queryAll(`
        SELECT id, nome, email, login, perfil, ativo, ultimo_acesso, created_at
        FROM usuarios
        ORDER BY nome ASC
    `);
}

// CRIAÇÃO DE NOVO USUÁRIO (Apenas Administrador)
function createUsuario(data) {
    ensureAdminUser();

    if (!data.login || !data.senha || !data.nome || !data.email) {
        throw new Error('Campos obrigatórios: Nome, Email, Login e Senha.');
    }

    // Verificar unicidade de login e email
    const exists = queryOne(`SELECT id FROM usuarios WHERE login = ? OR email = ?`, [data.login, data.email]);
    if (exists) {
        throw new Error('Já existe um usuário com este login ou e-mail.');
    }

    const { hash, salt } = hashPassword(data.senha);
    const perfil = data.perfil || 'Gestor DP';

    execute(`
        INSERT INTO usuarios (nome, email, login, senha_hash, salt, perfil, ativo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        data.nome,
        data.email,
        data.login,
        hash,
        salt,
        perfil,
        data.ativo !== undefined ? (data.ativo ? 1 : 0) : 1
    ]);

    return queryOne(`SELECT id, nome, email, login, perfil, ativo, created_at FROM usuarios WHERE rowid = last_insert_rowid()`);
}

// ATUALIZAÇÃO DE USUÁRIO (Apenas Administrador)
function updateUsuario(id, data) {
    const user = queryOne(`SELECT * FROM usuarios WHERE id = ?`, [id]);
    if (!user) throw new Error('Usuário não encontrado');

    let senhaHash = user.senha_hash;
    let salt = user.salt;

    // Se forneceu nova senha, regerar hash
    const novaSenha = data.senha || data.nova_senha;
    if (novaSenha && novaSenha.trim()) {
        const h = hashPassword(novaSenha.trim());
        senhaHash = h.hash;
        salt = h.salt;
    }

    const novoNome = data.nome !== undefined ? data.nome : user.nome;
    const novoEmail = data.email !== undefined ? data.email : user.email;
    const novoPerfil = data.perfil !== undefined ? data.perfil : user.perfil;
    const novoAtivo = data.ativo !== undefined ? (data.ativo ? 1 : 0) : user.ativo;

    execute(`
        UPDATE usuarios SET
            nome = ?,
            email = ?,
            perfil = ?,
            ativo = ?,
            senha_hash = ?,
            salt = ?
        WHERE id = ?
    `, [
        novoNome,
        novoEmail,
        novoPerfil,
        novoAtivo,
        senhaHash,
        salt,
        id
    ]);

    return queryOne(`SELECT id, nome, email, login, perfil, ativo, ultimo_acesso FROM usuarios WHERE id = ?`, [id]);
}

// EXCLUIR USUÁRIO
function deleteUsuario(id, currentAdminId) {
    if (Number(id) === Number(currentAdminId)) {
        throw new Error('Você não pode excluir o seu próprio usuário administrador.');
    }
    execute(`DELETE FROM usuarios WHERE id = ?`, [id]);
    return { success: true };
}

module.exports = {
    ensureAdminUser,
    login,
    verifyToken,
    getCurrentUser,
    listUsuarios,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    hashPassword
};
