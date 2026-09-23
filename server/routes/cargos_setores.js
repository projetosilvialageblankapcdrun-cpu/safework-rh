// ====================================================================
// SafeWork RH & SST - Rota: Setores, Cargos e Perfil da Empresa
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function getEmpresa() {
    return queryOne(`SELECT * FROM empresas WHERE id = 1`);
}

function updateEmpresa(data) {
    execute(`
        UPDATE empresas SET
            razao_social = ?,
            nome_fantasia = ?,
            cnpj = ?,
            cnae = ?,
            grau_risco = ?,
            endereco = ?,
            cidade = ?,
            uf = ?,
            cep = ?,
            telefone = ?,
            email = ?,
            medico_coordenador_nome = ?,
            medico_coordenador_crm = ?,
            medico_coordenador_uf = ?,
            responsavel_sst_nome = ?,
            responsavel_sst_registro = ?
        WHERE id = 1
    `, [
        data.razao_social,
        data.nome_fantasia,
        data.cnpj,
        data.cnae,
        data.grau_risco,
        data.endereco,
        data.cidade,
        data.uf,
        data.cep,
        data.telefone,
        data.email,
        data.medico_coordenador_nome,
        data.medico_coordenador_crm,
        data.medico_coordenador_uf,
        data.responsavel_sst_nome,
        data.responsavel_sst_registro
    ]);
    return getEmpresa();
}

function listSetores() {
    return queryAll(`
        SELECT s.*, COUNT(c.id) as total_colaboradores
        FROM setores s
        LEFT JOIN colaboradores c ON c.setor_id = s.id AND c.status = 'Ativo'
        GROUP BY s.id
        ORDER BY s.nome ASC
    `);
}

function createSetor(data) {
    execute(`
        INSERT INTO setores (empresa_id, nome, descricao, responsavel)
        VALUES (1, ?, ?, ?)
    `, [data.nome, data.descricao || null, data.responsavel || null]);
    return queryOne(`SELECT * FROM setores WHERE rowid = last_insert_rowid()`);
}

function listCargos() {
    return queryAll(`
        SELECT car.*, s.nome as setor_nome, COUNT(c.id) as total_colaboradores
        FROM cargos car
        JOIN setores s ON s.id = car.setor_id
        LEFT JOIN colaboradores c ON c.cargo_id = car.id AND c.status = 'Ativo'
        GROUP BY car.id
        ORDER BY car.titulo ASC
    `);
}

function createCargo(data) {
    execute(`
        INSERT INTO cargos (
            setor_id, titulo, cbo, descricao_atividades, requisitos,
            salario_base, periculosidade, insalubridade_grau
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.setor_id,
        data.titulo,
        data.cbo,
        data.descricao_atividades || null,
        data.requisitos || null,
        data.salario_base || 0.0,
        data.periculosidade ? 1 : 0,
        data.insalubridade_grau || 0
    ]);
    return queryOne(`SELECT * FROM cargos WHERE rowid = last_insert_rowid()`);
}

module.exports = {
    getEmpresa,
    updateEmpresa,
    listSetores,
    createSetor,
    listCargos,
    createCargo
};
