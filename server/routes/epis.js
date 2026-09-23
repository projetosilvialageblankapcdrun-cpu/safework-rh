// ====================================================================
// SafeWork RH & SST - Rota: Gestão de EPIs e Ficha de Entrega (NR-06)
// Catálogo com CA do MTE, controle de estoque, ficha individual e trocas
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function listEpis() {
    return queryAll(`
        SELECT *, 
               CASE 
                   WHEN ca_validade < date('now') THEN 'CA Vencido'
                   WHEN ca_validade <= date('now', '+60 days') THEN 'CA a Vencer'
                   ELSE 'CA Válido'
               END as status_ca,
               CASE
                   WHEN estoque_atual <= estoque_minimo THEN 'Estoque Baixo'
                   ELSE 'Estoque Regular'
               END as status_estoque
        FROM epis
        ORDER BY nome ASC
    `);
}

function createEpi(data) {
    execute(`
        INSERT INTO epis (
            nome, ca_numero, ca_validade, fabricante, tipo_protecao,
            descricao, periodicidade_troca_dias, estoque_atual, estoque_minimo,
            custo_unitario, instrucoes_uso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.nome,
        data.ca_numero,
        data.ca_validade,
        data.fabricante,
        data.tipo_protecao,
        data.descricao || null,
        data.periodicidade_troca_dias || 180,
        data.estoque_atual || 0,
        data.estoque_minimo || 5,
        data.custo_unitario || 0.0,
        data.instrucoes_uso || null
    ]);

    return queryOne(`SELECT * FROM epis WHERE rowid = last_insert_rowid()`);
}

function listEntregasEpi(filters = {}) {
    let sql = `
        SELECT ent.*, e.nome as epi_nome, e.ca_numero, e.fabricante, e.tipo_protecao,
               c.nome as colaborador_nome, c.matricula, car.titulo as cargo_nome, s.nome as setor_nome,
               CASE
                   WHEN ent.devolvido = 1 THEN 'Devolvido'
                   WHEN ent.data_prevista_troca < date('now') THEN 'Troca Vencida'
                   WHEN ent.data_prevista_troca <= date('now', '+15 days') THEN 'Troca Próxima'
                   ELSE 'Em Uso Normal'
               END as status_troca
        FROM epi_entregas ent
        JOIN epis e ON e.id = ent.epi_id
        JOIN colaboradores c ON c.id = ent.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.colaborador_id) {
        sql += ` AND ent.colaborador_id = ?`;
        params.push(filters.colaborador_id);
    }
    if (filters.epi_id) {
        sql += ` AND ent.epi_id = ?`;
        params.push(filters.epi_id);
    }

    sql += ` ORDER BY ent.data_entrega DESC`;
    return queryAll(sql, params);
}

function registrarEntregaEpi(data) {
    const qtd = Number(data.quantidade) || 1;
    const epi = queryOne(`SELECT * FROM epis WHERE id = ?`, [data.epi_id]);
    
    // Calcular data prevista de troca
    let dataTroca = data.data_prevista_troca;
    if (!dataTroca && epi && epi.periodicidade_troca_dias) {
        const d = new Date(data.data_entrega || new Date());
        d.setDate(d.getDate() + epi.periodicidade_troca_dias);
        dataTroca = d.toISOString().split('T')[0];
    }

    execute(`
        INSERT INTO epi_entregas (
            colaborador_id, epi_id, data_entrega, quantidade, motivo,
            data_prevista_troca, termo_responsabilidade_aceito, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `, [
        data.colaborador_id,
        data.epi_id,
        data.data_entrega || new Date().toISOString().split('T')[0],
        qtd,
        data.motivo || 'Troca Periódica',
        dataTroca,
        data.observacoes || null
    ]);

    // Baixa automática no estoque do EPI
    execute(`UPDATE epis SET estoque_atual = MAX(0, estoque_atual - ?) WHERE id = ?`, [qtd, data.epi_id]);

    return queryOne(`SELECT * FROM epi_entregas WHERE rowid = last_insert_rowid()`);
}

function registrarDevolucaoEpi(id, data = {}) {
    execute(`
        UPDATE epi_entregas SET
            devolvido = 1,
            data_devolucao = ?,
            motivo_devolucao = ?
        WHERE id = ?
    `, [
        data.data_devolucao || new Date().toISOString().split('T')[0],
        data.motivo_devolucao || 'Substituição / Desgaste natural',
        id
    ]);

    return queryOne(`SELECT * FROM epi_entregas WHERE id = ?`, [id]);
}

function getFichaEpiColaborador(colaboradorId) {
    const colaborador = queryOne(`
        SELECT c.*, car.titulo as cargo_nome, car.cbo, s.nome as setor_nome, e.razao_social as empresa_nome, e.cnpj as empresa_cnpj
        FROM colaboradores c
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        JOIN empresas e ON e.id = c.empresa_id
        WHERE c.id = ?
    `, [colaboradorId]);

    if (!colaborador) return null;

    const entregas = queryAll(`
        SELECT ent.*, ep.nome as epi_nome, ep.ca_numero, ep.fabricante, ep.tipo_protecao
        FROM epi_entregas ent
        JOIN epis ep ON ep.id = ent.epi_id
        WHERE ent.colaborador_id = ?
        ORDER BY ent.data_entrega ASC
    `, [colaboradorId]);

    return { colaborador, entregas };
}

module.exports = {
    listEpis,
    createEpi,
    listEntregasEpi,
    registrarEntregaEpi,
    registrarDevolucaoEpi,
    getFichaEpiColaborador
};
