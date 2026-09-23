// ====================================================================
// SafeWork RH & SST - Servidor HTTP Nativo (Node.js 24)
// Roteador RESTful de Alta Performance + Servidor de Arquivos Estáticos
// ====================================================================

const http = require('node:http');
const url = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

// Importação das rotas de negócio
const dashboard = require('./routes/dashboard.js');
const colaboradores = require('./routes/colaboradores.js');
const cargosSetores = require('./routes/cargos_setores.js');
const ferias = require('./routes/ferias.js');
const pontoAtestados = require('./routes/ponto_atestados.js');
const pgr = require('./routes/pgr.js');
const pcmso = require('./routes/pcmso.js');
const epis = require('./routes/epis.js');
const treinamentos = require('./routes/treinamentos.js');
const acidentes = require('./routes/acidentes.js');
const esocial = require('./routes/esocial.js');
const auth = require('./routes/auth.js');

function getAuthUser(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    return auth.getCurrentUser(token);
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// MIME types para arquivos estáticos
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Limite de segurança de 10MB
            if (body.length > 10 * 1024 * 1024) {
                reject(new Error('Payload Too Large'));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                resolve(body);
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function serveStatic(req, res, pathname) {
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Proteção contra Directory Traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('403 Acesso Negado');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Se for rota de SPA ou arquivo não encontrado, servir index.html
            filePath = path.join(PUBLIC_DIR, 'index.html');
        }

        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                return res.end('Erro interno ao ler arquivo');
            }
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });
            res.end(content);
        });
    });
}

const server = http.createServer(async (req, res) => {
    // Tratamento de CORS Pre-flight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const query = Object.fromEntries(parsedUrl.searchParams);
    const method = req.method;

    try {
        // --- 1. ROTAS REST /api/* ---
        auth.ensureAdminUser();

        // AUTENTICAÇÃO E SESSÃO
        if (pathname === '/api/auth/login' && method === 'POST') {
            const body = await readBody(req);
            try {
                return sendJson(res, 200, auth.login(body.login, body.senha));
            } catch (err) {
                return sendJson(res, 401, { error: err.message });
            }
        }
        if (pathname === '/api/auth/me' && method === 'GET') {
            const currentUser = getAuthUser(req);
            if (!currentUser) return sendJson(res, 401, { error: 'Não autenticado' });
            return sendJson(res, 200, { usuario: currentUser });
        }
        if (pathname === '/api/auth/logout' && method === 'POST') {
            return sendJson(res, 200, { success: true });
        }

        // GESTÃO DE USUÁRIOS (ADMINISTRADOR GERAL)
        if (pathname === '/api/usuarios' && method === 'GET') {
            const currentUser = getAuthUser(req);
            if (!currentUser || currentUser.perfil !== 'Administrador') {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador Geral' });
            }
            return sendJson(res, 200, auth.listUsuarios());
        }
        if (pathname === '/api/usuarios' && method === 'POST') {
            const currentUser = getAuthUser(req);
            if (!currentUser || currentUser.perfil !== 'Administrador') {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador Geral' });
            }
            const body = await readBody(req);
            return sendJson(res, 201, auth.createUsuario(body));
        }
        const userMatch = pathname.match(/^\/api\/usuarios\/(\d+)$/);
        if (userMatch) {
            const id = Number(userMatch[1]);
            const currentUser = getAuthUser(req);
            if (!currentUser || currentUser.perfil !== 'Administrador') {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador Geral' });
            }
            if (method === 'PUT') {
                const body = await readBody(req);
                return sendJson(res, 200, auth.updateUsuario(id, body));
            }
            if (method === 'DELETE') {
                return sendJson(res, 200, auth.deleteUsuario(id, currentUser.id));
            }
        }
        if (pathname === '/api/dashboard' && method === 'GET') {
            return sendJson(res, 200, dashboard.getDashboardData());
        }

        // COLABORADORES
        if (pathname === '/api/colaboradores' && method === 'GET') {
            return sendJson(res, 200, colaboradores.listColaboradores(query));
        }
        if (pathname === '/api/colaboradores' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, colaboradores.createColaborador(body));
        }
        const colabMatch = pathname.match(/^\/api\/colaboradores\/(\d+)$/);
        if (colabMatch) {
            const id = Number(colabMatch[1]);
            if (method === 'GET') {
                const item = colaboradores.getColaboradorDetails(id);
                return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: 'Colaborador não encontrado' });
            }
            if (method === 'PUT') {
                const body = await readBody(req);
                return sendJson(res, 200, colaboradores.updateColaborador(id, body));
            }
            if (method === 'DELETE') {
                colaboradores.deleteColaborador(id);
                return sendJson(res, 200, { success: true });
            }
        }

        // CARGOS, SETORES & EMPRESA
        if (pathname === '/api/empresa' && method === 'GET') {
            return sendJson(res, 200, cargosSetores.getEmpresa());
        }
        if (pathname === '/api/empresa' && method === 'PUT') {
            const body = await readBody(req);
            return sendJson(res, 200, cargosSetores.updateEmpresa(body));
        }
        if (pathname === '/api/setores' && method === 'GET') {
            return sendJson(res, 200, cargosSetores.listSetores());
        }
        if (pathname === '/api/setores' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, cargosSetores.createSetor(body));
        }
        if (pathname === '/api/cargos' && method === 'GET') {
            return sendJson(res, 200, cargosSetores.listCargos());
        }
        if (pathname === '/api/cargos' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, cargosSetores.createCargo(body));
        }

        // FÉRIAS
        if (pathname === '/api/ferias' && method === 'GET') {
            return sendJson(res, 200, ferias.listFerias(query));
        }
        if (pathname === '/api/ferias' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, ferias.createFerias(body));
        }
        const feriasMatch = pathname.match(/^\/api\/ferias\/(\d+)\/status$/);
        if (feriasMatch && method === 'PUT') {
            const id = Number(feriasMatch[1]);
            const body = await readBody(req);
            return sendJson(res, 200, ferias.updateStatusFerias(id, body.status));
        }

        // ATESTADOS & PONTO
        if (pathname === '/api/atestados' && method === 'GET') {
            return sendJson(res, 200, pontoAtestados.listAtestados(query));
        }
        if (pathname === '/api/atestados' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, pontoAtestados.createAtestado(body));
        }
        if (pathname === '/api/ponto' && method === 'GET') {
            return sendJson(res, 200, pontoAtestados.listPonto(query));
        }
        if (pathname === '/api/ponto' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, pontoAtestados.registrarPonto(body));
        }

        // PGR / NR-01 (Riscos, Planos 5W2H e Ordens de Serviço)
        if (pathname === '/api/pgr/riscos' && method === 'GET') {
            return sendJson(res, 200, pgr.listRiscos(query));
        }
        if (pathname === '/api/pgr/riscos' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, pgr.createRisco(body));
        }
        if (pathname === '/api/pgr/planos' && method === 'GET') {
            return sendJson(res, 200, pgr.listPlanos5W2H(query));
        }
        if (pathname === '/api/pgr/planos' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, pgr.createPlano5W2H(body));
        }
        const planoMatch = pathname.match(/^\/api\/pgr\/planos\/(\d+)\/status$/);
        if (planoMatch && method === 'PUT') {
            const id = Number(planoMatch[1]);
            const body = await readBody(req);
            return sendJson(res, 200, pgr.updateStatusPlano5W2H(id, body.status, body.observacoes));
        }
        if (pathname === '/api/pgr/ordens-servico' && method === 'GET') {
            return sendJson(res, 200, pgr.listOrdensServico());
        }
        if (pathname === '/api/pgr/ordens-servico' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, pgr.salvarOrdemServico(body));
        }
        const osTemplateMatch = pathname.match(/^\/api\/pgr\/ordens-servico\/template\/(\d+)$/);
        if (osTemplateMatch && method === 'GET') {
            const cargoId = Number(osTemplateMatch[1]);
            const template = pgr.getOrdemServicoTemplate(cargoId);
            return template ? sendJson(res, 200, template) : sendJson(res, 404, { error: 'Cargo não encontrado' });
        }

        // PCMSO / NR-07 (ASOs e Vencimentos)
        if (pathname === '/api/pcmso/asos' && method === 'GET') {
            return sendJson(res, 200, pcmso.listAsos(query));
        }
        if (pathname === '/api/pcmso/asos' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, pcmso.createAso(body));
        }
        if (pathname === '/api/pcmso/vencimentos' && method === 'GET') {
            return sendJson(res, 200, pcmso.getVencimentosAsos());
        }
        const asoMatch = pathname.match(/^\/api\/pcmso\/asos\/(\d+)$/);
        if (asoMatch && method === 'GET') {
            const id = Number(asoMatch[1]);
            const item = pcmso.getAsoDetails(id);
            return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: 'ASO não encontrado' });
        }

        // EPIS / NR-06
        if (pathname === '/api/epis' && method === 'GET') {
            return sendJson(res, 200, epis.listEpis());
        }
        if (pathname === '/api/epis' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, epis.createEpi(body));
        }
        if (pathname === '/api/epis/entregas' && method === 'GET') {
            return sendJson(res, 200, epis.listEntregasEpi(query));
        }
        if (pathname === '/api/epis/entregas' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, epis.registrarEntregaEpi(body));
        }
        const devMatch = pathname.match(/^\/api\/epis\/entregas\/(\d+)\/devolucao$/);
        if (devMatch && method === 'PUT') {
            const id = Number(devMatch[1]);
            const body = await readBody(req);
            return sendJson(res, 200, epis.registrarDevolucaoEpi(id, body));
        }
        const fichaMatch = pathname.match(/^\/api\/epis\/ficha\/(\d+)$/);
        if (fichaMatch && method === 'GET') {
            const id = Number(fichaMatch[1]);
            const item = epis.getFichaEpiColaborador(id);
            return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: 'Colaborador não encontrado' });
        }

        // TREINAMENTOS / NRs
        if (pathname === '/api/treinamentos/catalogo' && method === 'GET') {
            return sendJson(res, 200, treinamentos.listCatalogo());
        }
        if (pathname === '/api/treinamentos/catalogo' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, treinamentos.createTreinamentoCatalogo(body));
        }
        if (pathname === '/api/treinamentos/realizados' && method === 'GET') {
            return sendJson(res, 200, treinamentos.listTreinamentosRealizados(query));
        }
        if (pathname === '/api/treinamentos/realizados' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, treinamentos.registrarTreinamento(body));
        }

        // ACIDENTES & CAT (S-2210)
        if (pathname === '/api/acidentes' && method === 'GET') {
            return sendJson(res, 200, acidentes.listAcidentes(query));
        }
        if (pathname === '/api/acidentes' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, acidentes.registrarAcidente(body));
        }
        const acidMatch = pathname.match(/^\/api\/acidentes\/(\d+)$/);
        if (acidMatch && method === 'GET') {
            const id = Number(acidMatch[1]);
            const item = acidentes.getAcidenteDetails(id);
            return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: 'Acidente não encontrado' });
        }

        // CENTRAL ESOCIAL
        if (pathname === '/api/esocial/eventos' && method === 'GET') {
            return sendJson(res, 200, esocial.listEventosEsocial());
        }
        if (pathname === '/api/esocial/gerar-s2210' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 200, esocial.gerarXmlS2210(body.acidente_id));
        }
        if (pathname === '/api/esocial/gerar-s2220' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 200, esocial.gerarXmlS2220(body.aso_id));
        }
        if (pathname === '/api/esocial/gerar-s2240' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 200, esocial.gerarXmlS2240(body.colaborador_id));
        }
        const pppMatch = pathname.match(/^\/api\/esocial\/ppp\/(\d+)$/);
        if (pppMatch && method === 'GET') {
            const id = Number(pppMatch[1]);
            const item = esocial.getPppData(id);
            return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: 'Colaborador não encontrado' });
        }

        // --- 2. ARQUIVOS ESTÁTICOS DO FRONTEND ---
        if (!pathname.startsWith('/api/')) {
            return serveStatic(req, res, pathname);
        }

        // Rota API não encontrada
        return sendJson(res, 404, { error: 'Endpoint não encontrado', pathname });

    } catch (err) {
        console.error(`[SafeWork Server Erro] ${req.method} ${pathname}:`, err);
        return sendJson(res, 500, { error: err.message || 'Erro interno do servidor' });
    }
});

function startServer(port = 3000, host = '0.0.0.0') {
    server.listen(port, host, () => {
        console.log(`\n======================================================`);
        console.log(`🛡️  SafeWork RH & SST - Sistema Integrado DP e SST`);
        console.log(`🚀  Servidor rodando em: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
        console.log(`======================================================\n`);
    });
    return server;
}

module.exports = { server, startServer };
