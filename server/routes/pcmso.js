// ====================================================================
// SafeWork RH & SST - Rota: PCMSO e Gestão de ASOs (NR-07)
// Exames admissionais, periódicos, aptidão e controle de vencimentos
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function listAsos(filters = {}) {
    let sql = `
        SELECT a.*, c.nome as colaborador_nome, c.cpf, c.matricula, c.data_nascimento,
               car.titulo as cargo_nome, car.cbo, s.nome as setor_nome
        FROM asos a
        JOIN colaboradores c ON c.id = a.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.colaborador_id) {
        sql += ` AND a.colaborador_id = ?`;
        params.push(filters.colaborador_id);
    }
    if (filters.tipo_aso) {
        sql += ` AND a.tipo_aso = ?`;
        params.push(filters.tipo_aso);
    }
    if (filters.aptidao) {
        sql += ` AND a.aptidao = ?`;
        params.push(filters.aptidao);
    }

    sql += ` ORDER BY a.data_emissao DESC`;
    return queryAll(sql, params);
}

function getAsoDetails(id) {
    return queryOne(`
        SELECT a.*, c.nome as colaborador_nome, c.cpf, c.rg, c.matricula, c.data_nascimento, c.sexo,
               car.titulo as cargo_nome, car.cbo, car.insalubridade_grau, car.periculosidade,
               s.nome as setor_nome, e.razao_social as empresa_nome, e.cnpj as empresa_cnpj, e.endereco as empresa_endereco
        FROM asos a
        JOIN colaboradores c ON c.id = a.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        JOIN empresas e ON e.id = c.empresa_id
        WHERE a.id = ?
    `, [id]);
}

function createAso(data) {
    // Validade padrão: 1 ano a partir da data de emissão se não fornecido
    let dataValidade = data.data_validade;
    if (!dataValidade && data.data_emissao) {
        const d = new Date(data.data_emissao);
        d.setFullYear(d.getFullYear() + 1);
        dataValidade = d.toISOString().split('T')[0];
    }

    execute(`
        INSERT INTO asos (
            colaborador_id, tipo_aso, data_emissao, data_validade, aptidao,
            restricoes_detalhes, medico_examinador_nome, medico_examinador_crm, medico_examinador_uf,
            medico_coordenador_nome, medico_coordenador_crm, medico_coordenador_uf,
            exames_realizados, observacoes, esocial_enviado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
        data.colaborador_id,
        data.tipo_aso,
        data.data_emissao || new Date().toISOString().split('T')[0],
        dataValidade,
        data.aptidao || 'Apto',
        data.restricoes_detalhes || null,
        data.medico_examinador_nome,
        data.medico_examinador_crm,
        data.medico_examinador_uf || 'SP',
        data.medico_coordenador_nome || 'Dra. Camila Sampaio Nogueira',
        data.medico_coordenador_crm || '145890',
        data.medico_coordenador_uf || 'SP',
        data.exames_realizados || 'Avaliação Clínica Geral Ocupacional',
        data.observacoes || null
    ]);

    return queryOne(`SELECT * FROM asos WHERE rowid = last_insert_rowid()`);
}

function getVencimentosAsos() {
    return queryAll(`
        SELECT a.id, a.tipo_aso, a.data_validade, a.aptidao,
               c.nome as colaborador_nome, c.matricula, car.titulo as cargo_nome, s.nome as setor_nome,
               CASE 
                   WHEN a.data_validade < date('now') THEN 'Vencido'
                   WHEN a.data_validade <= date('now', '+30 days') THEN 'Crítico (30 dias)'
                   ELSE 'A Vencer (60 dias)'
               END as status_vencimento
        FROM asos a
        JOIN colaboradores c ON c.id = a.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        WHERE a.data_validade <= date('now', '+60 days')
        ORDER BY a.data_validade ASC
    `);
}

module.exports = {
    listAsos,
    getAsoDetails,
    createAso,
    getVencimentosAsos
};
