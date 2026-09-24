// ====================================================================
// SafeWork RH & SST - Canal de Denúncias & Linha Ética Externa
// Em conformidade com a Lei Federal nº 14.457/2022 (CIPA+A),
// Lei Anticorrupção nº 12.846/2013 e LGPD nº 13.709/2018
// ====================================================================

const crypto = require('node:crypto');
const { queryAll, queryOne, execute } = require('../../database/db.js');

function normalizarCategoria(cat) {
    if (!cat) return 'Outros';
    const c = cat.toLowerCase();
    if (c.includes('sexual')) return 'Assédio Sexual (Lei 14.457/22)';
    if (c.includes('moral')) return 'Assédio Moral';
    if (c.includes('discrimin') || c.includes('preconceito')) return 'Discriminação / Preconceito';
    if (c.includes('risco') || c.includes('insegur') || c.includes('acidente') || c.includes('sst') || c.includes('normas') || c.includes('clt')) return 'Risco Grave de Acidente / Descumprimento de SST';
    if (c.includes('fraude') || c.includes('corrup') || c.includes('desvio') || c.includes('conduta')) return 'Fraude / Corrupção / Desvio';
    return 'Outros';
}

// 1. CRIAR DENÚNCIA PÚBLICA (ANÔNIMA OU IDENTIFICADA)
function criarDenunciaPublica(data) {
    const descricao = data.descricao_fatos || data.descricao;
    if (!data.categoria || !descricao) {
        throw new Error('A categoria e a descrição detalhada dos fatos são obrigatórias.');
    }

    const categoriaNormalizada = normalizarCategoria(data.categoria);

    const ano = new Date().getFullYear();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const protocolo = `DEN-${ano}-${randNum}`;
    const chaveAcesso = `CHV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const tipoRaw = data.tipo_denuncia || data.tipo || 'anonima';
    const isAnonima = tipoRaw.toLowerCase() === 'anonima';

    const info = execute(`
        INSERT INTO denuncias (
            protocolo, chave_acesso, tipo_denuncia,
            denunciante_nome, denunciante_email, denunciante_telefone, denunciante_cargo_setor,
            categoria, descricao_fatos, data_ocorrencia, local_setor,
            pessoas_envolvidas, testemunhas, tem_provas, descricao_provas, status
        ) VALUES (
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, 'Recebida'
        )
    `, [
        protocolo,
        chaveAcesso,
        isAnonima ? 'Anonima' : 'Identificada',
        isAnonima ? null : (data.denunciante_nome || data.nome || null),
        isAnonima ? null : (data.denunciante_email || data.email || null),
        isAnonima ? null : (data.denunciante_telefone || data.telefone || null),
        isAnonima ? null : (data.denunciante_cargo_setor || data.setor || null),
        categoriaNormalizada,
        descricao.trim(),
        data.data_ocorrencia || data.data_fato || null,
        data.local_setor || data.local_fato || null,
        data.pessoas_envolvidas || data.envolvidos || null,
        data.testemunhas || null,
        (data.tem_provas || data.testemunhas) ? 1 : 0,
        data.descricao_provas || null
    ]);

    const resDenuncia = {
        id: info.lastInsertRowid,
        protocolo,
        chave_acesso: chaveAcesso,
        tipo_denuncia: isAnonima ? 'Anonima' : 'Identificada',
        tipo: isAnonima ? 'anonima' : 'identificada',
        categoria: data.categoria,
        status: 'Recebida',
        gravidade: data.gravidade || 'Média'
    };

    return {
        success: true,
        protocolo,
        chave_acesso: chaveAcesso,
        denuncia: resDenuncia,
        mensagem: 'Denúncia registrada com sucesso. Guarde o protocolo e a chave de acesso para consultar o andamento.'
    };
}

function normalizarStatus(st) {
    if (!st) return 'Recebida';
    const s = st.toLowerCase();
    if (s.includes('recebid')) return 'Recebida';
    if (s.includes('apura') || s.includes('investiga')) return 'Em Apuração';
    if (s.includes('medida') || s.includes('procedente')) return 'Medidas Adotadas';
    if (s.includes('conclu')) return 'Concluída';
    if (s.includes('arquiv') || s.includes('improcedente')) return 'Arquivada';
    return 'Recebida';
}

// 2. CONSULTAR DENÚNCIA PÚBLICA POR PROTOCOLO E CHAVE
function consultarDenunciaPublica(protocolo, chaveAcesso) {
    if (!protocolo || !chaveAcesso) {
        return null;
    }

    const denuncia = queryOne(`
        SELECT id, protocolo, tipo_denuncia, categoria, status, data_ocorrencia, local_setor,
               descricao_fatos, parecer_comite, medidas_adotadas, data_conclusao, created_at, updated_at
        FROM denuncias
        WHERE UPPER(protocolo) = UPPER(?) AND UPPER(chave_acesso) = UPPER(?)
    `, [protocolo.trim(), chaveAcesso.trim()]);

    if (!denuncia) {
        return null;
    }

    return {
        success: true,
        denuncia: {
            ...denuncia,
            tipo: denuncia.tipo_denuncia === 'Anonima' ? 'anonima' : 'identificada',
            descricao: denuncia.descricao_fatos,
            resposta_denunciante: denuncia.parecer_comite,
            medidas_tomadas: denuncia.medidas_adotadas,
            gravidade: 'Média'
        }
    };
}

// 3. LISTAR TODAS AS DENÚNCIAS (PAINEL INTERNO - ADMINISTRADOR / CIPAA)
function listDenuncias(filtroStatus = null) {
    let sql = `
        SELECT id, protocolo, tipo_denuncia, denunciante_nome, denunciante_email,
               categoria, local_setor, status, created_at, updated_at
        FROM denuncias
    `;
    const params = [];

    if (filtroStatus) {
        sql += ` WHERE status = ? `;
        params.push(filtroStatus);
    }

    sql += ` ORDER BY created_at DESC `;
    const rows = queryAll(sql, params).map(r => ({
        ...r,
        tipo: r.tipo_denuncia === 'Anonima' ? 'anonima' : 'identificada',
        gravidade: 'Média'
    }));

    const todos = queryAll(`SELECT status FROM denuncias`);
    const total = todos.length;
    const em_investigacao = todos.filter(t => t.status === 'Em Investigação').length;
    const procedentes = todos.filter(t => t.status === 'Procedente').length;
    const concluidas = todos.filter(t => t.status === 'Concluída' || t.status === 'Arquivada').length;

    return {
        denuncias: rows,
        estatisticas: { total, em_investigacao, procedentes, concluidas }
    };
}

// 4. DETALHES COMPLETOS DA DENÚNCIA (PAINEL INTERNO)
function getDenunciaDetalhes(id) {
    const d = queryOne(`SELECT * FROM denuncias WHERE id = ?`, [id]);
    if (!d) throw new Error('Denúncia não encontrada.');

    return {
        success: true,
        denuncia: {
            ...d,
            tipo: d.tipo_denuncia === 'Anonima' ? 'anonima' : 'identificada',
            gravidade: 'Média',
            descricao: d.descricao_fatos,
            resposta_denunciante: d.parecer_comite,
            medidas_tomadas: d.medidas_adotadas,
            nome: d.denunciante_nome,
            email: d.denunciante_email,
            telefone: d.denunciante_telefone,
            setor: d.denunciante_cargo_setor,
            data_fato: d.data_ocorrencia,
            local_fato: d.local_setor,
            envolvidos: d.pessoas_envolvidas
        }
    };
}

// 5. TRAMITAR / ATUALIZAR STATUS E PARECER (PAINEL INTERNO)
function tramitarDenuncia(id, data) {
    const d = queryOne(`SELECT * FROM denuncias WHERE id = ?`, [id]);
    if (!d) throw new Error('Denúncia não encontrada.');

    const status = normalizarStatus(data.status || d.status);
    const parecer = (data.parecer_comite !== undefined && data.parecer_comite !== null)
        ? data.parecer_comite 
        : (data.resposta_denunciante !== undefined ? data.resposta_denunciante : d.parecer_comite);
    const medidas = (data.medidas_adotadas !== undefined && data.medidas_adotadas !== null)
        ? data.medidas_adotadas 
        : (data.medidas_tomadas !== undefined ? data.medidas_tomadas : d.medidas_adotadas);
    
    let dataConclusao = d.data_conclusao;
    if (status === 'Concluída' || status === 'Arquivada') {
        dataConclusao = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    execute(`
        UPDATE denuncias SET
            status = ?,
            parecer_comite = ?,
            medidas_adotadas = ?,
            data_conclusao = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
    `, [status, parecer, medidas, dataConclusao, id]);

    return getDenunciaDetalhes(id);
}

module.exports = {
    criarDenunciaPublica,
    consultarDenunciaPublica,
    listDenuncias,
    getDenunciaDetalhes,
    tramitarDenuncia
};
