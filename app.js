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
const ead = require('./routes/ead.js');
const denuncias = require('./routes/denuncias.js');
const db = require('../database/db.js');

function getAuthUser(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    return auth.getCurrentUser(token);
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// MIME types para arquivos estáticos
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
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
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
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
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Instrutor / Professor')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador Geral ou Instrutor' });
            }
            const body = await readBody(req);
            if (currentUser.perfil === 'Instrutor / Professor') {
                body.perfil = 'Colaborador / Aluno';
            }
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

        // ====================================================================
        // CANAL DE DENÚNCIAS & LINHA ÉTICA (LEI 14.457/2022 - CIPA+A / LGPD)
        // ====================================================================

        // PÚBLICO: Registrar Denúncia (Anônima ou Identificada)
        if ((pathname === '/api/denuncias' || pathname === '/api/denuncias/publica') && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, denuncias.criarDenunciaPublica(body));
        }

        // PÚBLICO: Consultar Status por Protocolo e Chave Secreta
        if (pathname === '/api/denuncias/consultar') {
            let item = null;
            if (method === 'GET') {
                item = denuncias.consultarDenunciaPublica(query.protocolo, query.chave_acesso || query.chave);
            } else if (method === 'POST') {
                const body = await readBody(req);
                item = denuncias.consultarDenunciaPublica(body.protocolo, body.chave_acesso || body.chave);
            }
            if (!item) {
                return sendJson(res, 404, { error: 'Nenhuma denúncia encontrada com o protocolo e chave informados.' });
            }
            return sendJson(res, 200, item);
        }

        // INTERNO: Listar Denúncias (Administrador ou Técnico SST / CIPAA)
        if (pathname === '/api/denuncias' && method === 'GET') {
            const currentUser = getAuthUser(req);
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Técnico SST')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Comitê de Ética / CIPAA' });
            }
            return sendJson(res, 200, denuncias.listDenuncias(query.status));
        }

        // INTERNO: Detalhes da Denúncia
        const denunciaMatch = pathname.match(/^\/api\/denuncias\/(\d+)$/);
        if (denunciaMatch && method === 'GET') {
            const id = Number(denunciaMatch[1]);
            const currentUser = getAuthUser(req);
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Técnico SST')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Comitê de Ética / CIPAA' });
            }
            return sendJson(res, 200, denuncias.getDenunciaDetalhes(id));
        }

        // INTERNO: Tramitar Denúncia (Parecer e Medidas)
        const denunciaTramitarMatch = pathname.match(/^\/api\/denuncias\/(\d+)\/(tramitar|tramitacao)$/);
        if (denunciaTramitarMatch && method === 'PUT') {
            const id = Number(denunciaTramitarMatch[1]);
            const currentUser = getAuthUser(req);
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Técnico SST')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Comitê de Ética / CIPAA' });
            }
            const body = await readBody(req);
            return sendJson(res, 200, denuncias.tramitarDenuncia(id, body));
        }

        // ====================================================================
        // ACADEMIA EAD & TREINAMENTOS NR-01 ANEXO II
        // ====================================================================

        // Listar Cursos (se query.colaborador_id informado, anexa dados da matrícula)
        if (pathname === '/api/ead/cursos' && method === 'GET') {
            return sendJson(res, 200, ead.listCursos(query.colaborador_id));
        }

        // Criar Curso (Instrutor ou Administrador)
        if (pathname === '/api/ead/cursos' && method === 'POST') {
            const currentUser = getAuthUser(req);
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Instrutor / Professor')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador ou Instrutor' });
            }
            const body = await readBody(req);
            return sendJson(res, 201, ead.createCurso(body, currentUser.id));
        }

        // Detalhes e Atualização de Curso
        const cursoMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)$/);
        if (cursoMatch) {
            const id = Number(cursoMatch[1]);
            if (method === 'GET') {
                return sendJson(res, 200, ead.getCurso(id, query.colaborador_id));
            }
            if (method === 'PUT') {
                const currentUser = getAuthUser(req);
                if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Instrutor / Professor')) {
                    return sendJson(res, 403, { error: 'Acesso restrito ao Administrador ou Instrutor' });
                }
                const body = await readBody(req);
                return sendJson(res, 200, ead.updateCurso(id, body));
            }
        }

        // Adicionar Aula ao Curso
        const cursoAulasMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)\/aulas$/);
        if (cursoAulasMatch && method === 'POST') {
            const id = Number(cursoAulasMatch[1]);
            const currentUser = getAuthUser(req);
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Instrutor / Professor')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador ou Instrutor' });
            }
            const body = await readBody(req);
            return sendJson(res, 201, ead.addAula(id, body));
        }

        // Excluir Aula
        const aulaMatch = pathname.match(/^\/api\/ead\/aulas\/(\d+)$/);
        if (aulaMatch && method === 'DELETE') {
            const id = Number(aulaMatch[1]);
            const currentUser = getAuthUser(req);
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Instrutor / Professor')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador ou Instrutor' });
            }
            return sendJson(res, 200, ead.deleteAula(id));
        }

        // Salvar Avaliação / Questionário
        const cursoAvaliacaoMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)\/avaliacoes$/);
        if (cursoAvaliacaoMatch && method === 'POST') {
            const id = Number(cursoAvaliacaoMatch[1]);
            const currentUser = getAuthUser(req);
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Instrutor / Professor')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador ou Instrutor' });
            }
            const body = await readBody(req);
            return sendJson(res, 200, ead.saveAvaliacao(id, body));
        }

        // Meus Cursos / Matrículas do Aluno
        if (pathname === '/api/ead/meus-cursos' && method === 'GET') {
            const currentUser = getAuthUser(req);
            return sendJson(res, 200, ead.getMeusCursos(currentUser ? currentUser.id : null));
        }

        // Matricular Colaborador (Rota genérica ou por curso)
        if (pathname === '/api/ead/matriculas' && method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 201, ead.matricularColaboradores(body.curso_id, body.colaborador_id || body.colaborador_ids));
        }

        const cursoMatricularMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)\/matricular$/);
        if (cursoMatricularMatch && method === 'POST') {
            const id = Number(cursoMatricularMatch[1]);
            const body = await readBody(req);
            return sendJson(res, 201, ead.matricularColaboradores(id, body.colaborador_id || body.colaborador_ids));
        }

        // Progresso das Aulas da Matrícula
        const matProgressoMatch = pathname.match(/^\/api\/ead\/matriculas\/(\d+)\/progresso$/);
        if (matProgressoMatch && method === 'GET') {
            const matId = Number(matProgressoMatch[1]);
            const concluidas = db.queryAll(`SELECT aula_id FROM ead_aulas_concluidas WHERE matricula_id = ?`, [matId]);
            return sendJson(res, 200, { success: true, matricula_id: matId, aulasConcluidas: concluidas.map(c => c.aula_id) });
        }

        // Marcar Aula como Concluída (Aluno)
        const aulaConcluirMatch = pathname.match(/^\/api\/ead\/matriculas\/(\d+)\/aulas\/(\d+)\/concluir$/);
        if (aulaConcluirMatch && method === 'POST') {
            const matId = Number(aulaConcluirMatch[1]);
            const aulaId = Number(aulaConcluirMatch[2]);
            return sendJson(res, 200, ead.concluirAula(matId, aulaId));
        }

        // Obter Avaliação do Curso
        const cursoAvaliacaoGetMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)\/avaliacao$/);
        if (cursoAvaliacaoGetMatch && method === 'GET') {
            const id = Number(cursoAvaliacaoGetMatch[1]);
            const cursoInfo = ead.getCurso(id);
            if (!cursoInfo || !cursoInfo.avaliacao) {
                return sendJson(res, 404, { error: 'Avaliação não cadastrada para este treinamento' });
            }
            return sendJson(res, 200, cursoInfo.avaliacao);
        }

        // Submeter Respostas da Avaliação (Aluno)
        const matAvaliacaoPostMatch = pathname.match(/^\/api\/ead\/matriculas\/(\d+)\/(avaliacao|avaliacoes\/\d+\/responder)$/);
        if (matAvaliacaoPostMatch && method === 'POST') {
            const matId = Number(matAvaliacaoPostMatch[1]);
            const body = await readBody(req);
            return sendJson(res, 200, ead.submeterAvaliacao(matId, null, body.respostas));
        }

        // Obter Dados para Certificado NR-01 Anexo II
        const certificadoMatch = pathname.match(/^\/api\/ead\/matriculas\/(\d+)\/certificado$/);
        if (certificadoMatch && method === 'GET') {
            const matId = Number(certificadoMatch[1]);
            return sendJson(res, 200, ead.getCertificadoData(matId));
        }

        // Mural: Listar Recados
        const cursoMuralGetMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)\/mural$/);
        if (cursoMuralGetMatch && method === 'GET') {
            const id = Number(cursoMuralGetMatch[1]);
            const mural = db.queryAll(`
                SELECT m.*, m.importante as aviso_importante, u.nome as autor_nome
                FROM ead_mural m
                JOIN usuarios u ON m.autor_id = u.id
                WHERE m.curso_id = ?
                ORDER BY m.importante DESC, m.data_publicacao DESC
            `, [id]);
            return sendJson(res, 200, mural);
        }

        // Mural: Publicar Recado
        const cursoMuralMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)\/mural$/);
        if (cursoMuralMatch && method === 'POST') {
            const id = Number(cursoMuralMatch[1]);
            const currentUser = getAuthUser(req);
            const autorId = currentUser ? currentUser.id : 1;
            const body = await readBody(req);
            return sendJson(res, 201, ead.postMural(id, autorId, body.titulo, body.mensagem, body.aviso_importante || body.importante));
        }

        // Dúvidas: Listar Dúvidas
        const cursoDuvidasGetMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)\/duvidas$/);
        if (cursoDuvidasGetMatch && method === 'GET') {
            const id = Number(cursoDuvidasGetMatch[1]);
            const duvidas = db.queryAll(`
                SELECT d.*, c.nome as aluno_nome, c.nome as colaborador_nome, u.nome as professor_nome, u.nome as instrutor_nome
                FROM ead_duvidas d
                JOIN colaboradores c ON d.colaborador_id = c.id
                LEFT JOIN usuarios u ON d.respondida_por = u.id
                WHERE d.curso_id = ?
                ORDER BY d.data_pergunta DESC
            `, [id]);
            return sendJson(res, 200, duvidas);
        }

        // Dúvidas: Enviar Dúvida (Aluno)
        const cursoDuvidaMatch = pathname.match(/^\/api\/ead\/cursos\/(\d+)\/duvidas$/);
        if (cursoDuvidaMatch && method === 'POST') {
            const id = Number(cursoDuvidaMatch[1]);
            const body = await readBody(req);
            return sendJson(res, 201, ead.enviarDuvida(id, body.colaborador_id, body.pergunta, body.aula_id));
        }

        // Dúvidas: Responder Dúvida (Instrutor ou Administrador)
        const responderDuvidaMatch = pathname.match(/^\/api\/ead\/duvidas\/(\d+)\/resposta$/);
        if (responderDuvidaMatch && (method === 'POST' || method === 'PUT')) {
            const id = Number(responderDuvidaMatch[1]);
            const currentUser = getAuthUser(req);
            const body = await readBody(req);
            return sendJson(res, 200, ead.responderDuvida(id, body.resposta, currentUser ? currentUser.id : 1));
        }

        // Upload de Mídia / Arquivos em Base64
        if (pathname === '/api/ead/upload' && method === 'POST') {
            const currentUser = getAuthUser(req);
            if (!currentUser || (currentUser.perfil !== 'Administrador' && currentUser.perfil !== 'Instrutor / Professor')) {
                return sendJson(res, 403, { error: 'Acesso restrito ao Administrador ou Instrutor' });
            }
            const body = await readBody(req);
            if (!body.nome || !body.base64) {
                return sendJson(res, 400, { error: 'Envie o nome do arquivo e conteúdo em base64' });
            }
            const ext = path.extname(body.nome).toLowerCase() || '.mp4';
            const safeName = `media_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}${ext}`;
            const targetPath = path.join(UPLOADS_DIR, safeName);
            const buffer = Buffer.from(body.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
            fs.writeFileSync(targetPath, buffer);
            return sendJson(res, 201, {
                success: true,
                url: `/uploads/${safeName}`,
                nome: body.nome,
                tamanho_bytes: buffer.length
            });
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
