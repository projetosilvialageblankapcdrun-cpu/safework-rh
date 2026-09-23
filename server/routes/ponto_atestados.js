// ====================================================================
// SafeWork RH & SST - Rota: Atestados Médicos, Afastamentos e Ponto
// Cruzamento de atestados com CID-10, INSS e saúde ocupacional (SST)
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function listAtestados(filters = {}) {
    let sql = `
        SELECT a.*, c.nome as colaborador_nome, c.matricula, car.titulo as cargo_nome, s.nome as setor_nome
        FROM atestados_afastamentos a
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
    if (filters.tipo_afastamento) {
        sql += ` AND a.tipo_afastamento = ?`;
        params.push(filters.tipo_afastamento);
    }

    sql += ` ORDER BY a.data_inicio DESC`;
    return queryAll(sql, params);
}

function createAtestado(data) {
    const dias = Number(data.dias_afastamento) || 1;
    // Se o afastamento for superior a 15 dias, sinaliza encaminhamento ao INSS
    const encaminhadoInss = dias > 15 ? 1 : (data.encaminhado_inss ? 1 : 0);

    execute(`
        INSERT INTO atestados_afastamentos (
            colaborador_id, data_emissao, data_inicio, data_fim, dias_afastamento,
            medico_nome, medico_crm, medico_uf, cid10, cid10_descricao,
            tipo_afastamento, encaminhado_inss, numero_beneficio_inss, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.colaborador_id,
        data.data_emissao || new Date().toISOString().split('T')[0],
        data.data_inicio,
        data.data_fim,
        dias,
        data.medico_nome,
        data.medico_crm,
        data.medico_uf || 'SP',
        data.cid10,
        data.cid10_descricao || null,
        data.tipo_afastamento || 'Doença Comum',
        encaminhadoInss,
        data.numero_beneficio_inss || null,
        data.observacoes || null
    ]);

    // Se o afastamento estiver ativo hoje, atualizar status do colaborador para "Afastado"
    const hoje = new Date().toISOString().split('T')[0];
    if (data.data_inicio <= hoje && data.data_fim >= hoje) {
        execute(`UPDATE colaboradores SET status = 'Afastado' WHERE id = ?`, [data.colaborador_id]);
    }

    return queryOne(`SELECT * FROM atestados_afastamentos WHERE rowid = last_insert_rowid()`);
}

function listPonto(filters = {}) {
    let sql = `
        SELECT p.*, c.nome as colaborador_nome, c.matricula
        FROM ponto_registros p
        JOIN colaboradores c ON c.id = p.colaborador_id
        WHERE 1=1
    `;
    const params = [];
    if (filters.colaborador_id) {
        sql += ` AND p.colaborador_id = ?`;
        params.push(filters.colaborador_id);
    }
    if (filters.data) {
        sql += ` AND p.data = ?`;
        params.push(filters.data);
    }
    sql += ` ORDER BY p.data DESC LIMIT 100`;
    return queryAll(sql, params);
}

function registrarPonto(data) {
    execute(`
        INSERT INTO ponto_registros (
            colaborador_id, data, entrada_1, saida_1, entrada_2, saida_2,
            horas_trabalhadas, horas_extras, atrasos_minutos, ocorrencia
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.colaborador_id,
        data.data || new Date().toISOString().split('T')[0],
        data.entrada_1 || '08:00',
        data.saida_1 || '12:00',
        data.entrada_2 || '13:00',
        data.saida_2 || '17:48',
        data.horas_trabalhadas || 8.8,
        data.horas_extras || 0.0,
        data.atrasos_minutos || 0,
        data.ocorrencia || 'Normal'
    ]);
    return queryOne(`SELECT * FROM ponto_registros WHERE rowid = last_insert_rowid()`);
}

module.exports = {
    listAtestados,
    createAtestado,
    listPonto,
    registrarPonto
};
