// ====================================================================
// SafeWork RH & SST - Suite de Verificação e Testes Unitários
// ====================================================================

const dashboard = require('./server/routes/dashboard.js');
const colaboradores = require('./server/routes/colaboradores.js');
const ferias = require('./server/routes/ferias.js');
const pontoAtestados = require('./server/routes/ponto_atestados.js');
const pgr = require('./server/routes/pgr.js');
const pcmso = require('./server/routes/pcmso.js');
const epis = require('./server/routes/epis.js');
const treinamentos = require('./server/routes/treinamentos.js');
const acidentes = require('./server/routes/acidentes.js');
const esocial = require('./server/routes/esocial.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        failed++;
    }
}

console.log('--- TESTANDO MÓDULOS DO SAFEWORK RH & SST ---');

// 1. Dashboard
const dashData = dashboard.getDashboardData();
assert(dashData.estatisticas.totalColaboradores >= 7, 'Dashboard: contagem de colaboradores');
assert(dashData.alertas.length > 0, 'Dashboard: alertas proativos gerados com sucesso');
assert(typeof dashData.estatisticas.taxaFrequencia === 'number', 'Dashboard: cálculo da Taxa de Frequência (TF)');

// 2. Colaboradores
const listaColabs = colaboradores.listColaboradores();
assert(listaColabs.length >= 7, 'Colaboradores: listagem com cargo e setor');
const colab1 = colaboradores.getColaboradorDetails(1);
assert(colab1 && colab1.nome.includes('João Carlos'), 'Colaboradores: detalhes completos de João Carlos');
assert(colab1.asos.length > 0, 'Colaboradores: histórico integrado de ASOs');
assert(colab1.epis.length > 0, 'Colaboradores: histórico integrado de EPIs entregues');

// 3. Férias
const listaFerias = ferias.listFerias();
assert(listaFerias.length >= 2, 'Férias: registros de programação e períodos aquisitivos');

// 4. Atestados & Absenteísmo
const listaAtestados = pontoAtestados.listAtestados();
assert(listaAtestados.length >= 2, 'Atestados: registros com CID-10 e cálculo de dias');
const atestadoInss = listaAtestados.find(a => a.encaminhado_inss === 1);
assert(atestadoInss !== undefined, 'Atestados: alerta automático de encaminhamento ao INSS (>15 dias)');

// 5. PGR / GRO (NR-01)
const listaRiscos = pgr.listRiscos();
assert(listaRiscos.length >= 7, 'PGR: inventário de riscos ocupacionais (físico, químico, mecânico, ergonômico)');
const planos = pgr.listPlanos5W2H();
assert(planos.length >= 3, 'PGR: planos de ação 5W2H');

// 6. PCMSO / ASO (NR-07)
const listaAsos = pcmso.listAsos();
assert(listaAsos.length >= 4, 'PCMSO: controle de exames e ASOs ocupacionais');
const vencimentos = pcmso.getVencimentosAsos();
assert(vencimentos.length > 0, 'PCMSO: controle de ASOs a vencer nos próximos 60 dias');

// 7. EPIs (NR-06)
const listaEpis = epis.listEpis();
assert(listaEpis.length >= 9, 'EPIs: catálogo com CA do Ministério do Trabalho');
const fichaJoao = epis.getFichaEpiColaborador(1);
assert(fichaJoao && fichaJoao.entregas.length >= 4, 'EPIs: ficha individual de entrega e termo de responsabilidade');

// 8. Treinamentos de NRs
const realizados = treinamentos.listTreinamentosRealizados();
assert(realizados.length >= 4, 'Treinamentos: capacitações de NR-01, 10, 11 e 35');

// 9. Acidentes & CAT (S-2210)
const acidentesList = acidentes.listAcidentes();
assert(acidentesList.length >= 1, 'Acidentes: registro com investigação e árvore de causas');

// 10. eSocial (XMLs)
const xml2210 = esocial.gerarXmlS2210(1);
assert(xml2210.xml.includes('<evtCAT') && xml2210.xml.includes('</evtCAT>'), 'eSocial: XML S-2210 válido gerado');

const xml2220 = esocial.gerarXmlS2220(1);
assert(xml2220.xml.includes('<evtMonit') && xml2220.xml.includes('</evtMonit>'), 'eSocial: XML S-2220 válido gerado');

const xml2240 = esocial.gerarXmlS2240(1);
assert(xml2240.xml.includes('<evtExpRisco') && xml2240.xml.includes('</evtExpRisco>'), 'eSocial: XML S-2240 válido gerado');

const pppData = esocial.getPppData(1);
assert(pppData && pppData.colaborador && pppData.riscos.length > 0, 'PPP Eletrônico: dados unificados de DP e SST extraídos com sucesso');

// 11. Autenticação & Usuários
const auth = require('./server/routes/auth.js');
const loginResult = auth.login('admin', 'admin123');
assert(loginResult && loginResult.token && loginResult.usuario.login === 'admin', 'Auth: Login do Administrador Geral bem-sucedido');
assert(loginResult.usuario.perfil === 'Administrador', 'Auth: Perfil de Administrador validado');

const tokenPayload = auth.verifyToken(loginResult.token);
assert(tokenPayload && tokenPayload.login === 'admin', 'Auth: Token de sessão validado com integridade');

const usuariosList = auth.listUsuarios();
assert(usuariosList.length >= 3, 'Auth: Listagem de usuários com perfis e permissões');

console.log(`\n===================================`);
console.log(`RESULTADO: ${passed} PASSOU, ${failed} FALHOU`);
console.log(`===================================`);

if (failed > 0) process.exit(1);
