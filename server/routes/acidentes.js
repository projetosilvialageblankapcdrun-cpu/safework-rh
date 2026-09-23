// ====================================================================
// SafeWork RH & SST - Rota: Acidentes de Trabalho, Investigação e CAT (S-2210)
// Registro regulamentar, árvore de causas, emissão da CAT e prazo legal
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function listAcidentes(filters = {}) {
    let sql = `
        SELECT a.*, c.nome as colaborador_nome, c.cpf, c.matricula, car.titulo as cargo_nome, s.nome as setor_nome
        FROM acidentes_cat a
        JOIN colaboradores c ON c.id = a.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.tipo_acidente) {
        sql += ` AND a.tipo_acidente = ?`;
        params.push(filters.tipo_acidente);
    }
    if (filters.colaborador_id) {
        sql += ` AND a.colaborador_id = ?`;
        params.push(filters.colaborador_id);
    }

    sql += ` ORDER BY a.data_acidente DESC`;
    return queryAll(sql, params);
}

function getAcidenteDetails(id) {
    return queryOne(`
        SELECT a.*, c.nome as colaborador_nome, c.cpf, c.rg, c.matricula, c.ctps_numero, c.ctps_serie,
               c.data_nascimento, c.sexo, c.estado_civil, c.salario,
               car.titulo as cargo_nome, car.cbo, s.nome as setor_nome,
               e.razao_social as empresa_nome, e.cnpj as empresa_cnpj, e.cnae as empresa_cnae,
               e.endereco as empresa_endereco, e.cidade as empresa_cidade, e.uf as empresa_uf
        FROM acidentes_cat a
        JOIN colaboradores c ON c.id = a.colaborador_id
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        JOIN empresas e ON e.id = c.empresa_id
        WHERE a.id = ?
    `, [id]);
}

function registrarAcidente(data) {
    const numCat = data.numero_cat || `CAT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const dataEmissao = data.data_emissao_cat || new Date().toISOString().split('T')[0];

    execute(`
        INSERT INTO acidentes_cat (
            colaborador_id, data_acidente, hora_acidente, tipo_acidente,
            houve_afastamento, dias_afastamento, houve_obito, data_obito,
            local_acidente, parte_corpo_atingida, agente_causador, situacao_geradora,
            descricao_acidente, investigacao_arvore_causas, medidas_corretivas_adotadas,
            atendimento_medico_local, medico_atendente_crm, numero_cat, data_emissao_cat,
            esocial_enviado
        ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            0
        )
    `, [
        data.colaborador_id,
        data.data_acidente,
        data.hora_acidente || '08:00',
        data.tipo_acidente || 'Típico',
        data.houve_afastamento ? 1 : 0,
        Number(data.dias_afastamento) || 0,
        data.houve_obito ? 1 : 0,
        data.data_obito || null,
        data.local_acidente,
        data.parte_corpo_atingida,
        data.agente_causador,
        data.situacao_geradora || null,
        data.descricao_acidente,
        data.investigacao_arvore_causas || null,
        data.medidas_corretivas_adotadas || null,
        data.atendimento_medico_local || null,
        data.medico_atendente_crm || null,
        numCat,
        dataEmissao
    ]);

    const createdId = queryOne(`SELECT id FROM acidentes_cat WHERE numero_cat = ?`, [numCat]);

    // Se houve afastamento, registrar também automaticamente na tabela de atestados
    if (data.houve_afastamento && Number(data.dias_afastamento) > 0) {
        const dias = Number(data.dias_afastamento);
        const dFim = new Date(data.data_acidente);
        dFim.setDate(dFim.getDate() + dias);
        
        execute(`
            INSERT INTO atestados_afastamentos (
                colaborador_id, data_emissao, data_inicio, data_fim, dias_afastamento,
                medico_nome, medico_crm, medico_uf, cid10, cid10_descricao,
                tipo_afastamento, encaminhado_inss, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Acidente de Trabalho', ?, ?)
        `, [
            data.colaborador_id,
            dataEmissao,
            data.data_acidente,
            dFim.toISOString().split('T')[0],
            dias,
            'Médico Atendente Pronto Socorro',
            data.medico_atendente_crm || '99999',
            'SP',
            'S69.9',
            'Traumatismo não especificado de membro',
            dias > 15 ? 1 : 0,
            `Gerado automaticamente pelo registro de Acidente / CAT ${numCat}`
        ]);
    }

    return getAcidenteDetails(createdId.id);
}

module.exports = {
    listAcidentes,
    getAcidenteDetails,
    registrarAcidente
};
