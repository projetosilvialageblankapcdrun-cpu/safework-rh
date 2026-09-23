// ====================================================================
// SafeWork RH & SST - Rota: PGR / GRO (NR-01) e Planos de Ação 5W2H
// Inventário de riscos ocupacionais, matriz 5x5 e ordens de serviço
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function classificarNivelRisco(score) {
    if (score <= 5) return 'Baixo';
    if (score <= 12) return 'Médio';
    if (score <= 20) return 'Alto';
    return 'Crítico';
}

function listRiscos(filters = {}) {
    let sql = `
        SELECT r.*, s.nome as setor_nome, car.titulo as cargo_nome
        FROM riscos_ocupacionais r
        JOIN setores s ON s.id = r.setor_id
        LEFT JOIN cargos car ON car.id = r.cargo_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.setor_id) {
        sql += ` AND r.setor_id = ?`;
        params.push(filters.setor_id);
    }
    if (filters.grupo_risco) {
        sql += ` AND r.grupo_risco = ?`;
        params.push(filters.grupo_risco);
    }
    if (filters.classificacao) {
        sql += ` AND r.classificacao_risco = ?`;
        params.push(filters.classificacao);
    }

    sql += ` ORDER BY r.nivel_risco DESC, r.id ASC`;
    return queryAll(sql, params);
}

function createRisco(data) {
    const prob = Number(data.probabilidade) || 1;
    const sev = Number(data.severidade) || 1;
    const score = prob * sev;
    const classificacao = classificarNivelRisco(score);

    execute(`
        INSERT INTO riscos_ocupacionais (
            setor_id, cargo_id, grupo_risco, perigo_fator, fonte_geradora,
            danos_saude, esocial_codigo, tipo_avaliacao, intensidade_concentracao,
            limite_tolerancia, nivel_acao, probabilidade, severidade, classificacao_risco,
            medidas_preventivas_existentes, medidas_propostas, epc_eficaz, epi_eficaz, status
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        )
    `, [
        data.setor_id,
        data.cargo_id || null,
        data.grupo_risco,
        data.perigo_fator,
        data.fonte_geradora,
        data.danos_saude || null,
        data.esocial_codigo || null,
        data.tipo_avaliacao || 'Qualitativa',
        data.intensidade_concentracao || null,
        data.limite_tolerancia || null,
        data.nivel_acao || null,
        prob,
        sev,
        classificacao,
        data.medidas_preventivas_existentes || null,
        data.medidas_propostas || null,
        data.epc_eficaz ? 1 : 0,
        data.epi_eficaz ? 1 : 0,
        data.status || 'Ativo'
    ]);

    return queryOne(`SELECT * FROM riscos_ocupacionais WHERE rowid = last_insert_rowid()`);
}

function listPlanos5W2H(filters = {}) {
    let sql = `
        SELECT p.*, s.nome as setor_nome, r.perigo_fator, r.grupo_risco, r.classificacao_risco
        FROM planos_acao_5w2h p
        JOIN setores s ON s.id = p.setor_id
        LEFT JOIN riscos_ocupacionais r ON r.id = p.risco_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
        sql += ` AND p.status = ?`;
        params.push(filters.status);
    }
    if (filters.setor_id) {
        sql += ` AND p.setor_id = ?`;
        params.push(filters.setor_id);
    }

    sql += ` ORDER BY p.quando_prazo ASC`;
    return queryAll(sql, params);
}

function createPlano5W2H(data) {
    execute(`
        INSERT INTO planos_acao_5w2h (
            risco_id, setor_id, o_que, por_que, onde, quem,
            quando_prazo, como, quanto_custo, status, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.risco_id || null,
        data.setor_id,
        data.o_que,
        data.por_que,
        data.onde,
        data.quem,
        data.quando_prazo,
        data.como,
        data.quanto_custo || 0.0,
        data.status || 'Pendente',
        data.observacoes || null
    ]);

    return queryOne(`SELECT * FROM planos_acao_5w2h WHERE rowid = last_insert_rowid()`);
}

function updateStatusPlano5W2H(id, status, observacoes = null) {
    const dataConclusao = status === 'Concluído' ? new Date().toISOString().split('T')[0] : null;
    execute(`
        UPDATE planos_acao_5w2h 
        SET status = ?, data_conclusao = ?, observacoes = COALESCE(?, observacoes)
        WHERE id = ?
    `, [status, dataConclusao, observacoes, id]);

    return queryOne(`SELECT * FROM planos_acao_5w2h WHERE id = ?`, [id]);
}

function listOrdensServico() {
    return queryAll(`
        SELECT os.*, car.titulo as cargo_nome, car.cbo, s.nome as setor_nome
        FROM ordens_servico_nr01 os
        JOIN cargos car ON car.id = os.cargo_id
        JOIN setores s ON s.id = car.setor_id
        ORDER BY car.titulo ASC
    `);
}

function getOrdemServicoTemplate(cargoId) {
    const existing = queryOne(`
        SELECT os.*, car.titulo as cargo_nome, car.cbo, s.nome as setor_nome, s.id as setor_id
        FROM ordens_servico_nr01 os
        JOIN cargos car ON car.id = os.cargo_id
        JOIN setores s ON s.id = car.setor_id
        WHERE os.cargo_id = ?
    `, [cargoId]);

    if (existing) return existing;

    // Buscar dados do cargo e setor
    const cargo = queryOne(`
        SELECT car.*, s.nome as setor_nome
        FROM cargos car
        JOIN setores s ON s.id = car.setor_id
        WHERE car.id = ?
    `, [cargoId]);

    if (!cargo) return null;

    // Buscar riscos vinculados ao setor ou cargo
    const riscos = queryAll(`
        SELECT * FROM riscos_ocupacionais 
        WHERE setor_id = ? AND (cargo_id = ? OR cargo_id IS NULL)
    `, [cargo.setor_id, cargoId]);

    let riscosTexto = riscos.map(r => `• ${r.grupo_risco}: ${r.perigo_fator} (Fonte: ${r.fonte_geradora}) - Danos: ${r.danos_saude || 'Não especificado'}`).join('\n');
    if (!riscosTexto) {
        riscosTexto = '• Riscos Físicos: Ruído intermitente de máquinas e equipamentos no ambiente.\n• Riscos Ergonômicos: Postura de trabalho e movimentação de materiais.\n• Riscos de Acidentes: Queda de materiais, escorregões e cortes em arestas vivas.';
    }

    let medidasTexto = riscos.map(r => `• ${r.medidas_preventivas_existentes || 'Uso contínuo de EPI e atenção às sinalizações'}`).join('\n');
    if (!medidasTexto) {
        medidasTexto = '• Manter o posto de trabalho sempre limpo e organizado (5S);\n• Inspecionar ferramentas e maquinários antes do início das operações;\n• Cumprir rigorosamente os procedimentos operacionais padrão (POP);\n• Utilizar todos os EPIs fornecidos pela empresa durante toda a jornada.';
    }

    return {
        cargo_id: cargo.id,
        cargo_nome: cargo.titulo,
        cbo: cargo.cbo,
        setor_id: cargo.setor_id,
        setor_nome: cargo.setor_nome,
        atividades_desenvolvidas: cargo.descricao_atividades || 'Execução de rotinas e tarefas operacionais inerentes ao cargo.',
        riscos_funcao: riscosTexto,
        epis_obrigatorios: '• Calçado de segurança com biqueira e solado antiderrapante (CA válido);\n• Óculos de proteção ampla visão com proteção lateral;\n• Protetor auditivo tipo plug ou concha;\n• Luvas de segurança adequadas à atividade mecânica ou manuseio.',
        medidas_preventivas: medidasTexto,
        normas_proibicoes: '• É expressamente proibido operar qualquer máquina ou equipamento sem habilitação, treinamento e autorização prévia;\n• É proibido remover proteções coletivas de segurança (EPC) de máquinas;\n• Proibido realizar manutenção com equipamentos energizados (sem bloqueio LOTO);\n• Proibido fumar ou consumir alimentos nas áreas operacionais de trabalho.',
        punicoes_previstas: 'O não cumprimento das disposições desta Ordem de Serviço sujeita o trabalhador às penalidades da CLT (Art. 158 e 482):\n1. Advertência verbal;\n2. Advertência por escrito;\n3. Suspensão disciplinar de 1 a 3 dias;\n4. Rescisão do contrato de trabalho por Justa Causa.',
        revisao: '01',
        data_aprovacao: new Date().toISOString().split('T')[0]
    };
}

function salvarOrdemServico(data) {
    const existing = queryOne(`SELECT id FROM ordens_servico_nr01 WHERE cargo_id = ?`, [data.cargo_id]);

    if (existing) {
        execute(`
            UPDATE ordens_servico_nr01 SET
                atividades_desenvolvidas = ?,
                riscos_funcao = ?,
                epis_obrigatorios = ?,
                medidas_preventivas = ?,
                normas_proibicoes = ?,
                punicoes_previstas = ?,
                revisao = ?,
                data_aprovacao = ?
            WHERE id = ?
        `, [
            data.atividades_desenvolvidas,
            data.riscos_funcao,
            data.epis_obrigatorios,
            data.medidas_preventivas,
            data.normas_proibicoes,
            data.punicoes_previstas,
            data.revisao || '01',
            data.data_aprovacao || new Date().toISOString().split('T')[0],
            existing.id
        ]);
        return queryOne(`SELECT * FROM ordens_servico_nr01 WHERE id = ?`, [existing.id]);
    } else {
        execute(`
            INSERT INTO ordens_servico_nr01 (
                cargo_id, atividades_desenvolvidas, riscos_funcao,
                epis_obrigatorios, medidas_preventivas, normas_proibicoes,
                punicoes_previstas, revisao, data_aprovacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.cargo_id,
            data.atividades_desenvolvidas,
            data.riscos_funcao,
            data.epis_obrigatorios,
            data.medidas_preventivas,
            data.normas_proibicoes,
            data.punicoes_previstas,
            data.revisao || '01',
            data.data_aprovacao || new Date().toISOString().split('T')[0]
        ]);
        return queryOne(`SELECT * FROM ordens_servico_nr01 WHERE rowid = last_insert_rowid()`);
    }
}

module.exports = {
    listRiscos,
    createRisco,
    listPlanos5W2H,
    createPlano5W2H,
    updateStatusPlano5W2H,
    listOrdensServico,
    getOrdemServicoByCargo: getOrdemServicoTemplate,
    getOrdemServicoTemplate,
    salvarOrdemServico
};
