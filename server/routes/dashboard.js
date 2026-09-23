// ====================================================================
// SafeWork RH & SST - Rota: Dashboard e Indicadores Executivos
// Métricas consolidadas de DP, SST, eSocial, TF/TG e Absenteísmo
// ====================================================================

const { queryAll, queryOne } = require('../../database/db.js');

function getDashboardData() {
    const hoje = new Date().toISOString().split('T')[0];

    // 1. Estatísticas de Pessoal (DP)
    const colaboradoresPorStatus = queryAll(`
        SELECT status, COUNT(*) as total 
        FROM colaboradores 
        GROUP BY status
    `);

    const totalColaboradores = queryOne(`SELECT COUNT(*) as total FROM colaboradores`)?.total || 0;
    const ativos = queryOne(`SELECT COUNT(*) as total FROM colaboradores WHERE status = 'Ativo'`)?.total || 0;
    const emFerias = queryOne(`SELECT COUNT(*) as total FROM colaboradores WHERE status = 'Férias'`)?.total || 0;
    const afastados = queryOne(`SELECT COUNT(*) as total FROM colaboradores WHERE status = 'Afastado'`)?.total || 0;

    // 2. Estatísticas de Riscos Ocupacionais (PGR / NR-01)
    const riscosPorClassificacao = queryAll(`
        SELECT classificacao_risco, COUNT(*) as total
        FROM riscos_ocupacionais
        GROUP BY classificacao_risco
    `);

    const totalRiscos = queryOne(`SELECT COUNT(*) as total FROM riscos_ocupacionais`)?.total || 0;
    const riscosCriticosAltos = queryOne(`
        SELECT COUNT(*) as total 
        FROM riscos_ocupacionais 
        WHERE classificacao_risco IN ('Alto', 'Crítico')
    `)?.total || 0;

    // 3. Planos de Ação 5W2H (NR-01)
    const planosPorStatus = queryAll(`
        SELECT status, COUNT(*) as total
        FROM planos_acao_5w2h
        GROUP BY status
    `);

    // 4. Indicadores de Acidentes e Absenteísmo (SST)
    const acidentesAno = queryOne(`
        SELECT COUNT(*) as total, 
               COALESCE(SUM(dias_afastamento), 0) as dias_perdidos,
               COALESCE(SUM(CASE WHEN tipo_acidente = 'Típico' THEN 1 ELSE 0 END), 0) as tipicos
        FROM acidentes_cat
    `);

    // Cálculo estimado da Taxa de Frequência (TF) e Gravidade (TG) conforme NBR 14280
    // TF = (Nº de acidentes com afastamento * 1.000.000) / Horas-Homem Trabalhadas (HHT)
    // Estimando HHT mensal = colaboradores ativos * 176 horas * 12 meses
    const hhtEstimado = Math.max(ativos * 176 * 6, 1000);
    const taxaFrequencia = Number(((acidentesAno.total * 1000000) / hhtEstimado).toFixed(2));
    const taxaGravidade = Number(((acidentesAno.dias_perdidos * 1000000) / hhtEstimado).toFixed(2));

    // Absenteísmo estimado com base em dias de atestado nos últimos 30 dias
    const totalDiasAtestado = queryOne(`
        SELECT COALESCE(SUM(dias_afastamento), 0) as total_dias 
        FROM atestados_afastamentos
    `)?.total_dias || 0;
    const taxaAbsenteismo = Number(((totalDiasAtestado / Math.max(ativos * 22, 1)) * 100).toFixed(2));

    // 5. Alertas Proativos do Sistema
    const alertas = [];

    // Alerta 1: ASOs vencendo em até 30 dias ou já vencidos
    const asosVencendo = queryAll(`
        SELECT a.id, a.tipo_aso, a.data_validade, c.nome as colaborador_nome, c.matricula, car.titulo as cargo_nome
        FROM asos a
        JOIN colaboradores c ON c.id = a.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        WHERE a.data_validade <= date('now', '+30 days')
        ORDER BY a.data_validade ASC
    `);
    for (const a of asosVencendo) {
        const isVencido = a.data_validade < hoje;
        alertas.push({
            tipo: isVencido ? 'danger' : 'warning',
            modulo: 'SST / PCMSO',
            titulo: isVencido ? `ASO Vencido: ${a.colaborador_nome}` : `ASO a Vencer: ${a.colaborador_nome}`,
            mensagem: `O ASO ${a.tipo_aso} de ${a.colaborador_nome} (${a.cargo_nome}) ${isVencido ? 'venceu em' : 'vence em'} ${a.data_validade}. Agendar exame clínico ocupacional.`,
            link: '#pcmso'
        });
    }

    // Alerta 2: EPIs com troca recomendada expirada ou CA a vencer
    const episTrocaExpirada = queryAll(`
        SELECT e.nome as epi_nome, e.ca_numero, ent.data_prevista_troca, c.nome as colaborador_nome
        FROM epi_entregas ent
        JOIN epis e ON e.id = ent.epi_id
        JOIN colaboradores c ON c.id = ent.colaborador_id
        WHERE ent.devolvido = 0 AND ent.data_prevista_troca <= date('now')
        LIMIT 5
    `);
    for (const epi of episTrocaExpirada) {
        alertas.push({
            tipo: 'warning',
            modulo: 'SST / NR-06',
            titulo: `Troca de EPI Pendente: ${epi.colaborador_nome}`,
            mensagem: `O EPI "${epi.epi_nome}" (CA ${epi.ca_numero}) atingiu a data limite de troca (${epi.data_prevista_troca}). Realizar entrega e colher assinatura.`,
            link: '#epis'
        });
    }

    // Alerta 3: Férias com período concessivo a vencer (risco de férias em dobro - CLT Art. 137)
    const feriasLimite = queryAll(`
        SELECT f.id, f.limite_concessivo, c.nome as colaborador_nome, c.matricula
        FROM ferias f
        JOIN colaboradores c ON c.id = f.colaborador_id
        WHERE f.status = 'Programada' AND f.limite_concessivo <= date('now', '+60 days')
        LIMIT 5
    `);
    for (const fer of feriasLimite) {
        alertas.push({
            tipo: 'danger',
            modulo: 'DP / Férias',
            titulo: `Alerta de Dobra de Férias: ${fer.colaborador_nome}`,
            mensagem: `O período concessivo de férias encerra em ${fer.limite_concessivo}. Evite passivo trabalhista de pagamento em dobro.`,
            link: '#ferias'
        });
    }

    // Alerta 4: Treinamentos de NRs vencidos
    const treinamentosVencidos = queryAll(`
        SELECT tc.norma, tc.titulo, tr.data_vencimento, c.nome as colaborador_nome
        FROM treinamentos_realizados tr
        JOIN treinamentos_catalogo tc ON tc.id = tr.treinamento_id
        JOIN colaboradores c ON c.id = tr.colaborador_id
        WHERE tr.data_vencimento <= date('now')
        LIMIT 5
    `);
    for (const t of treinamentosVencidos) {
        alertas.push({
            tipo: 'danger',
            modulo: 'SST / Treinamentos',
            titulo: `Certificação Vencida: ${t.norma} - ${t.colaborador_nome}`,
            mensagem: `Treinamento obrigatório de ${t.norma} (${t.titulo}) expirou em ${t.data_vencimento}. Agendar reciclagem com urgência.`,
            link: '#treinamentos'
        });
    }

    // Alerta 5: Atestados médicos com encaminhamento ao INSS
    const atestadosInss = queryAll(`
        SELECT a.id, a.dias_afastamento, a.cid10, a.data_fim, c.nome as colaborador_nome
        FROM atestados_afastamentos a
        JOIN colaboradores c ON c.id = a.colaborador_id
        WHERE a.encaminhado_inss = 1
        LIMIT 5
    `);
    for (const at of atestadosInss) {
        alertas.push({
            tipo: 'info',
            modulo: 'DP & SST / INSS',
            titulo: `Afastamento Previdenciário (INSS): ${at.colaborador_nome}`,
            mensagem: `Colaborador com afastamento de ${at.dias_afastamento} dias (CID ${at.cid10}). Monitorar perícia médica e retorno ao trabalho.`,
            link: '#atestados'
        });
    }

    return {
        estatisticas: {
            totalColaboradores,
            ativos,
            emFerias,
            afastados,
            totalRiscos,
            riscosCriticosAltos,
            totalAcidentes: acidentesAno.total,
            diasPerdidosAcidentes: acidentesAno.dias_perdidos,
            taxaFrequencia,
            taxaGravidade,
            taxaAbsenteismo
        },
        riscosPorClassificacao,
        planosPorStatus,
        colaboradoresPorStatus,
        alertas
    };
}

module.exports = { getDashboardData };
