// ====================================================================
// SafeWork RH & SST - Rota: Treinamentos e Capacitações de NRs
// Controle de vencimentos, reciclagens, certificados e lista de presença
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function listCatalogo() {
    return queryAll(`
        SELECT tc.*, COUNT(tr.id) as total_capacitados
        FROM treinamentos_catalogo tc
        LEFT JOIN treinamentos_realizados tr ON tr.treinamento_id = tc.id
        GROUP BY tc.id
        ORDER BY tc.norma ASC
    `);
}

function createTreinamentoCatalogo(data) {
    execute(`
        INSERT INTO treinamentos_catalogo (norma, titulo, carga_horaria_horas, validade_meses, conteudo_programatico, obrigatorio_para_cargos)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        data.norma,
        data.titulo,
        data.carga_horaria_horas,
        data.validade_meses || 24,
        data.conteudo_programatico || null,
        data.obrigatorio_para_cargos || null
    ]);

    return queryOne(`SELECT * FROM treinamentos_catalogo WHERE rowid = last_insert_rowid()`);
}

function listTreinamentosRealizados(filters = {}) {
    let sql = `
        SELECT tr.*, tc.norma, tc.titulo as curso_nome, tc.carga_horaria_horas,
               c.nome as colaborador_nome, c.matricula, car.titulo as cargo_nome, s.nome as setor_nome,
               CASE
                   WHEN tr.data_vencimento < date('now') THEN 'Vencido'
                   WHEN tr.data_vencimento <= date('now', '+30 days') THEN 'A Vencer (30 dias)'
                   ELSE 'Válido'
               END as status_calculado
        FROM treinamentos_realizados tr
        JOIN treinamentos_catalogo tc ON tc.id = tr.treinamento_id
        JOIN colaboradores c ON c.id = tr.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.colaborador_id) {
        sql += ` AND tr.colaborador_id = ?`;
        params.push(filters.colaborador_id);
    }
    if (filters.treinamento_id) {
        sql += ` AND tr.treinamento_id = ?`;
        params.push(filters.treinamento_id);
    }

    sql += ` ORDER BY tr.data_vencimento ASC`;
    return queryAll(sql, params);
}

function registrarTreinamento(data) {
    const catalogo = queryOne(`SELECT * FROM treinamentos_catalogo WHERE id = ?`, [data.treinamento_id]);
    
    // Calcular vencimento com base na periodicidade da norma
    let dataVencimento = data.data_vencimento;
    if (!dataVencimento && catalogo) {
        const d = new Date(data.data_realizacao || new Date());
        d.setMonth(d.getMonth() + catalogo.validade_meses);
        dataVencimento = d.toISOString().split('T')[0];
    }

    const certNumero = data.certificado_numero || `CERT-${catalogo?.norma || 'NR'}-${Date.now().toString().slice(-6)}`;

    execute(`
        INSERT INTO treinamentos_realizados (
            treinamento_id, colaborador_id, data_realizacao, data_vencimento,
            instrutor_nome, instrutor_qualificacao, entidade_formadora,
            aproveitamento_nota, status, certificado_numero
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Válido', ?)
    `, [
        data.treinamento_id,
        data.colaborador_id,
        data.data_realizacao || new Date().toISOString().split('T')[0],
        dataVencimento,
        data.instrutor_nome,
        data.instrutor_qualificacao || null,
        data.entidade_formadora || 'SESMT Interno',
        data.aproveitamento_nota || 10.0,
        certNumero
    ]);

    return queryOne(`SELECT * FROM treinamentos_realizados WHERE rowid = last_insert_rowid()`);
}

module.exports = {
    listCatalogo,
    createTreinamentoCatalogo,
    listTreinamentosRealizados,
    registrarTreinamento
};
