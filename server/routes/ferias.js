// ====================================================================
// SafeWork RH & SST - Rota: Gestão de Férias (Departamento Pessoal)
// CLT Art. 129 a 145: Período aquisitivo, concessivo, abono e dobro
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function listFerias(filters = {}) {
    let sql = `
        SELECT f.*, c.nome as colaborador_nome, c.matricula, car.titulo as cargo_nome, s.nome as setor_nome
        FROM ferias f
        JOIN colaboradores c ON c.id = f.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
        sql += ` AND f.status = ?`;
        params.push(filters.status);
    }
    if (filters.colaborador_id) {
        sql += ` AND f.colaborador_id = ?`;
        params.push(filters.colaborador_id);
    }

    sql += ` ORDER BY f.data_inicio DESC`;
    return queryAll(sql, params);
}

function createFerias(data) {
    // Calcular limite concessivo: término do período aquisitivo + 11 meses (CLT)
    let limiteConcessivo = data.limite_concessivo;
    if (!limiteConcessivo && data.periodo_aquisitivo_fim) {
        const d = new Date(data.periodo_aquisitivo_fim);
        d.setMonth(d.getMonth() + 11);
        limiteConcessivo = d.toISOString().split('T')[0];
    }

    execute(`
        INSERT INTO ferias (
            colaborador_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim,
            limite_concessivo, data_inicio, data_fim, dias_gozo,
            abono_pecuniario, adiantamento_13, status, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.colaborador_id,
        data.periodo_aquisitivo_inicio,
        data.periodo_aquisitivo_fim,
        limiteConcessivo,
        data.data_inicio,
        data.data_fim,
        data.dias_gozo || 30,
        data.abono_pecuniario ? 1 : 0,
        data.adiantamento_13 ? 1 : 0,
        data.status || 'Programada',
        data.observacoes || null
    ]);

    return queryOne(`SELECT * FROM ferias WHERE rowid = last_insert_rowid()`);
}

function updateStatusFerias(id, status) {
    execute(`UPDATE ferias SET status = ? WHERE id = ?`, [status, id]);
    
    // Se o status passar para "Em Gozo", atualizar também o status do colaborador
    if (status === 'Em Gozo') {
        const fer = queryOne(`SELECT colaborador_id FROM ferias WHERE id = ?`, [id]);
        if (fer) {
            execute(`UPDATE colaboradores SET status = 'Férias' WHERE id = ?`, [fer.colaborador_id]);
        }
    } else if (status === 'Concluída') {
        const fer = queryOne(`SELECT colaborador_id FROM ferias WHERE id = ?`, [id]);
        if (fer) {
            execute(`UPDATE colaboradores SET status = 'Ativo' WHERE id = ?`, [fer.colaborador_id]);
        }
    }

    return queryOne(`SELECT * FROM ferias WHERE id = ?`, [id]);
}

module.exports = {
    listFerias,
    createFerias,
    updateStatusFerias
};
