// ====================================================================
// SafeWork RH & SST - Rota: Gestão de Colaboradores (Departamento Pessoal)
// Admissão digital, ficha funcional, histórico de ASO, EPIs e exames
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function listColaboradores(filters = {}) {
    let sql = `
        SELECT c.*, car.titulo as cargo_titulo, car.cbo, car.insalubridade_grau, car.periculosidade,
               s.nome as setor_nome
        FROM colaboradores c
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
        sql += ` AND c.status = ?`;
        params.push(filters.status);
    }
    if (filters.setor_id) {
        sql += ` AND c.setor_id = ?`;
        params.push(filters.setor_id);
    }
    if (filters.search) {
        sql += ` AND (c.nome LIKE ? OR c.cpf LIKE ? OR c.matricula LIKE ?)`;
        const s = `%${filters.search}%`;
        params.push(s, s, s);
    }

    sql += ` ORDER BY c.nome ASC`;
    return queryAll(sql, params);
}

function getColaboradorDetails(id) {
    const colab = queryOne(`
        SELECT c.*, car.titulo as cargo_titulo, car.cbo, car.descricao_atividades,
               car.insalubridade_grau, car.periculosidade, s.nome as setor_nome
        FROM colaboradores c
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        WHERE c.id = ?
    `, [id]);

    if (!colab) return null;

    // Dependentes
    colab.dependentes = queryAll(`SELECT * FROM dependentes WHERE colaborador_id = ?`, [id]);

    // Histórico de ASOs (SST)
    colab.asos = queryAll(`
        SELECT * FROM asos 
        WHERE colaborador_id = ? 
        ORDER BY data_emissao DESC
    `, [id]);

    // Histórico de EPIs entregues (NR-06)
    colab.epis = queryAll(`
        SELECT ent.*, e.nome as epi_nome, e.ca_numero, e.fabricante, e.tipo_protecao
        FROM epi_entregas ent
        JOIN epis e ON e.id = ent.epi_id
        WHERE ent.colaborador_id = ?
        ORDER BY ent.data_entrega DESC
    `, [id]);

    // Treinamentos de NRs
    colab.treinamentos = queryAll(`
        SELECT tr.*, tc.norma, tc.titulo, tc.carga_horaria_horas
        FROM treinamentos_realizados tr
        JOIN treinamentos_catalogo tc ON tc.id = tr.treinamento_id
        WHERE tr.colaborador_id = ?
        ORDER BY tr.data_realizacao DESC
    `, [id]);

    // Férias
    colab.ferias = queryAll(`
        SELECT * FROM ferias 
        WHERE colaborador_id = ? 
        ORDER BY periodo_aquisitivo_inicio DESC
    `, [id]);

    // Atestados médicos
    colab.atestados = queryAll(`
        SELECT * FROM atestados_afastamentos 
        WHERE colaborador_id = ? 
        ORDER BY data_inicio DESC
    `, [id]);

    return colab;
}

function createColaborador(data) {
    // Gerar matrícula automática se não fornecida
    if (!data.matricula) {
        const count = queryOne(`SELECT COUNT(*) as total FROM colaboradores`)?.total || 0;
        data.matricula = `MAT-${String(count + 101).padStart(5, '0')}`;
    }

    execute(`
        INSERT INTO colaboradores (
            empresa_id, cargo_id, setor_id, matricula, nome, cpf, rg, rg_orgao,
            pis, ctps_numero, ctps_serie, data_nascimento, sexo, estado_civil,
            telefone, email, endereco, cidade, uf, cep, tipo_contrato,
            data_admissao, salario, jornada_semanal, escala_trabalho, status
        ) VALUES (
            1, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        )
    `, [
        data.cargo_id,
        data.setor_id,
        data.matricula,
        data.nome,
        data.cpf,
        data.rg || null,
        data.rg_orgao || 'SSP/SP',
        data.pis || null,
        data.ctps_numero || null,
        data.ctps_serie || null,
        data.data_nascimento,
        data.sexo || 'M',
        data.estado_civil || 'Solteiro',
        data.telefone || null,
        data.email || null,
        data.endereco || null,
        data.cidade || 'Campinas',
        data.uf || 'SP',
        data.cep || null,
        data.tipo_contrato || 'CLT',
        data.data_admissao || new Date().toISOString().split('T')[0],
        data.salario || 0,
        data.jornada_semanal || 44,
        data.escala_trabalho || '5x2 (Seg a Sex)',
        data.status || 'Ativo'
    ]);

    const created = queryOne(`SELECT id FROM colaboradores WHERE matricula = ?`, [data.matricula]);
    return getColaboradorDetails(created.id);
}

function updateColaborador(id, data) {
    execute(`
        UPDATE colaboradores SET
            cargo_id = ?,
            setor_id = ?,
            nome = ?,
            cpf = ?,
            rg = ?,
            telefone = ?,
            email = ?,
            endereco = ?,
            salario = ?,
            jornada_semanal = ?,
            escala_trabalho = ?,
            status = ?
        WHERE id = ?
    `, [
        data.cargo_id,
        data.setor_id,
        data.nome,
        data.cpf,
        data.rg || null,
        data.telefone || null,
        data.email || null,
        data.endereco || null,
        data.salario,
        data.jornada_semanal || 44,
        data.escala_trabalho || '5x2 (Seg a Sex)',
        data.status,
        id
    ]);

    return getColaboradorDetails(id);
}

function deleteColaborador(id) {
    return execute(`DELETE FROM colaboradores WHERE id = ?`, [id]);
}

module.exports = {
    listColaboradores,
    getColaboradorDetails,
    createColaborador,
    updateColaborador,
    deleteColaborador
};
