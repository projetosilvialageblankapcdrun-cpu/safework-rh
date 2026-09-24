// ====================================================================
// SafeWork RH & SST - Módulo de Treinamentos EAD & Academia Corporativa
// Em conformidade com o Anexo II da NR-01 (Diretrizes para EAD em SST)
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

// 1. LISTAR CURSOS
function listCursos(colaboradorId = null) {
    const cursos = queryAll(`
        SELECT c.*, c.categoria_nr as categoria, c.carga_horaria_horas as carga_horaria,
               u.nome as instrutor_nome, u.email as instrutor_email,
               (SELECT COUNT(*) FROM ead_aulas WHERE curso_id = c.id) as total_aulas,
               (SELECT COUNT(*) FROM ead_matriculas WHERE curso_id = c.id) as total_matriculados
        FROM ead_cursos c
        JOIN usuarios u ON c.instrutor_id = u.id
        WHERE c.ativo = 1
        ORDER BY c.id ASC
    `);

    // Se fornecido colaborador_id, anexa dados da matrícula
    if (colaboradorId) {
        for (const curso of cursos) {
            const mat = queryOne(`
                SELECT id as matricula_id, progresso_pct, status, nota_final, data_matricula, data_conclusao, certificado_codigo
                FROM ead_matriculas
                WHERE curso_id = ? AND colaborador_id = ?
            `, [curso.id, colaboradorId]);
            curso.matricula = mat || null;
        }
    }

    return cursos;
}

// 2. DETALHES COMPLETOS DE UM CURSO
function getCurso(cursoId, colaboradorId = null) {
    const curso = queryOne(`
        SELECT c.*, c.categoria_nr as categoria, c.carga_horaria_horas as carga_horaria,
               u.nome as instrutor_nome, u.email as instrutor_email
        FROM ead_cursos c
        JOIN usuarios u ON c.instrutor_id = u.id
        WHERE c.id = ?
    `, [cursoId]);

    if (!curso) throw new Error('Curso não encontrado');

    // Aulas
    const aulas = queryAll(`
        SELECT id, curso_id, ordem, titulo, descricao as conteudo_texto,
               tipo_video, video_url as url_video, duracao_minutos, material_apoio, created_at
        FROM ead_aulas
        WHERE curso_id = ?
        ORDER BY ordem ASC, id ASC
    `, [cursoId]);

    // Matrícula do aluno se houver
    let matricula = null;
    let aulasConcluidasIds = [];
    if (colaboradorId) {
        matricula = queryOne(`
            SELECT * FROM ead_matriculas
            WHERE curso_id = ? AND colaborador_id = ?
        `, [cursoId, colaboradorId]);

        if (matricula) {
            const concluidas = queryAll(`
                SELECT aula_id FROM ead_aulas_concluidas
                WHERE matricula_id = ?
            `, [matricula.id]);
            aulasConcluidasIds = concluidas.map(c => c.aula_id);
        }
    }

    // Marca aulas concluídas
    for (const aula of aulas) {
        aula.concluida = aulasConcluidasIds.includes(aula.id);
    }

    // Avaliação
    const avaliacao = queryOne(`
        SELECT id, titulo, descricao, nota_minima, questoes_json
        FROM ead_avaliacoes
        WHERE curso_id = ?
    `, [cursoId]);

    let avaliacaoFormatada = null;
    if (avaliacao) {
        avaliacaoFormatada = {
            id: avaliacao.id,
            titulo: avaliacao.titulo,
            descricao: avaliacao.descricao,
            nota_minima: avaliacao.nota_minima,
            questoes: JSON.parse(avaliacao.questoes_json || '[]')
        };
    }

    // Mural
    const mural = queryAll(`
        SELECT m.*, m.importante as aviso_importante, u.nome as autor_nome
        FROM ead_mural m
        JOIN usuarios u ON m.autor_id = u.id
        WHERE m.curso_id = ?
        ORDER BY m.importante DESC, m.data_publicacao DESC
    `, [cursoId]);

    // Dúvidas
    const duvidas = queryAll(`
        SELECT d.*, c.nome as colaborador_nome, c.nome as aluno_nome, u.nome as instrutor_nome, u.nome as professor_nome
        FROM ead_duvidas d
        JOIN colaboradores c ON d.colaborador_id = c.id
        LEFT JOIN usuarios u ON d.respondida_por = u.id
        WHERE d.curso_id = ?
        ORDER BY d.data_pergunta DESC
    `, [cursoId]);

    // Lista de alunos matriculados
    const matriculados = queryAll(`
        SELECT m.*, c.nome as colaborador_nome, c.cpf, c.matricula as colaborador_matricula,
               car.titulo as cargo_nome, s.nome as setor_nome
        FROM ead_matriculas m
        JOIN colaboradores c ON m.colaborador_id = c.id
        JOIN cargos car ON c.cargo_id = car.id
        JOIN setores s ON c.setor_id = s.id
        WHERE m.curso_id = ?
        ORDER BY c.nome ASC
    `, [cursoId]);

    return {
        ...curso,
        aulas,
        avaliacao: avaliacaoFormatada,
        matricula,
        matriculados,
        mural,
        duvidas
    };
}

// 3. CRIAR CURSO
function createCurso(data, instrutorId) {
    const categoria = data.categoria_nr || data.categoria;
    if (!data.titulo || !categoria) {
        throw new Error('Título e Categoria NR são obrigatórios.');
    }

    const cargaHoraria = Number(data.carga_horaria_horas || data.carga_horaria) || 4;
    const notaMinima = Number(data.nota_aprovacao_minima || data.nota_minima) || 70.0;
    const ementa = data.conteudo_programatico || data.ementa || '';

    execute(`
        INSERT INTO ead_cursos (
            titulo, descricao, categoria_nr, carga_horaria_horas, instrutor_id,
            thumbnail_url, nota_aprovacao_minima, conteudo_programatico, publico_alvo, ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
        data.titulo,
        data.descricao || '',
        categoria,
        cargaHoraria,
        instrutorId,
        data.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600',
        notaMinima,
        ementa,
        data.publico_alvo || ''
    ]);

    const novo = queryOne(`SELECT * FROM ead_cursos WHERE rowid = last_insert_rowid()`);

    // Inserção automática de aulas se enviadas juntas
    if (Array.isArray(data.aulas) && data.aulas.length > 0) {
        for (const aula of data.aulas) {
            addAula(novo.id, aula);
        }
    }

    // Inserção automática de avaliação se enviada
    if (data.avaliacao) {
        saveAvaliacao(novo.id, data.avaliacao);
    }

    return {
        success: true,
        curso: {
            ...novo,
            categoria: novo.categoria_nr,
            carga_horaria: novo.carga_horaria_horas
        }
    };
}

// 4. ATUALIZAR CURSO
function updateCurso(id, data) {
    execute(`
        UPDATE ead_cursos SET
            titulo = COALESCE(?, titulo),
            descricao = COALESCE(?, descricao),
            categoria_nr = COALESCE(?, categoria_nr),
            carga_horaria_horas = COALESCE(?, carga_horaria_horas),
            thumbnail_url = COALESCE(?, thumbnail_url),
            nota_aprovacao_minima = COALESCE(?, nota_aprovacao_minima),
            conteudo_programatico = COALESCE(?, conteudo_programatico),
            publico_alvo = COALESCE(?, publico_alvo),
            ativo = COALESCE(?, ativo)
        WHERE id = ?
    `, [
        data.titulo,
        data.descricao,
        data.categoria_nr || data.categoria,
        data.carga_horaria_horas !== undefined ? Number(data.carga_horaria_horas) : (data.carga_horaria ? Number(data.carga_horaria) : null),
        data.thumbnail_url,
        data.nota_aprovacao_minima !== undefined ? Number(data.nota_aprovacao_minima) : (data.nota_minima ? Number(data.nota_minima) : null),
        data.conteudo_programatico,
        data.publico_alvo,
        data.ativo !== undefined ? (data.ativo ? 1 : 0) : null,
        id
    ]);

    return getCurso(id);
}

// 5. ADICIONAR AULA COM VÍDEO
function addAula(cursoId, data) {
    const videoUrl = data.video_url || data.url_video;
    if (!data.titulo || !videoUrl) {
        throw new Error('Título da aula e URL do vídeo são obrigatórios.');
    }

    const maxOrdem = queryOne(`SELECT MAX(ordem) as max_o FROM ead_aulas WHERE curso_id = ?`, [cursoId]);
    const ordem = (maxOrdem && maxOrdem.max_o) ? maxOrdem.max_o + 1 : 1;

    let tipoVideo = (data.tipo_video || 'link_externo').toLowerCase();
    if (tipoVideo === 'upload') {
        tipoVideo = 'upload';
    } else if (tipoVideo === 'incorporado') {
        tipoVideo = 'incorporado';
    } else {
        tipoVideo = 'link_externo';
    }

    execute(`
        INSERT INTO ead_aulas (curso_id, ordem, titulo, descricao, tipo_video, video_url, duracao_minutos, material_apoio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        cursoId,
        ordem,
        data.titulo,
        data.descricao || data.conteudo_texto || '',
        tipoVideo,
        videoUrl,
        Number(data.duracao_minutos) || 15,
        data.material_apoio || ''
    ]);

    return queryOne(`SELECT * FROM ead_aulas WHERE rowid = last_insert_rowid()`);
}

// 6. EXCLUIR AULA
function deleteAula(aulaId) {
    execute(`DELETE FROM ead_aulas WHERE id = ?`, [aulaId]);
    return { success: true };
}

// 7. CADASTRAR OU ATUALIZAR AVALIAÇÃO / QUESTIONÁRIO
function saveAvaliacao(cursoId, data) {
    if (!data.questoes || !Array.isArray(data.questoes) || data.questoes.length === 0) {
        throw new Error('A avaliação deve conter pelo menos uma questão.');
    }

    // Normaliza questões com IDs sequenciais se ausentes
    const questoesFormatadas = data.questoes.map((q, idx) => ({
        id: q.id || (idx + 1),
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        correta: q.correta || 'A',
        pontos: q.pontos || Math.round(100 / data.questoes.length)
    }));

    const questoesJson = JSON.stringify(questoesFormatadas);
    const notaMinima = Number(data.nota_minima) || 70.0;
    const titulo = data.titulo || 'Avaliação Técnica e Prática';
    const descricao = data.descricao || 'Questionário de aproveitamento conforme NR-01 Anexo II.';

    const existente = queryOne(`SELECT id FROM ead_avaliacoes WHERE curso_id = ?`, [cursoId]);
    if (existente) {
        execute(`
            UPDATE ead_avaliacoes SET
                titulo = ?, descricao = ?, nota_minima = ?, questoes_json = ?
            WHERE id = ?
        `, [titulo, descricao, notaMinima, questoesJson, existente.id]);
        return queryOne(`SELECT * FROM ead_avaliacoes WHERE id = ?`, [existente.id]);
    } else {
        execute(`
            INSERT INTO ead_avaliacoes (curso_id, titulo, descricao, nota_minima, questoes_json)
            VALUES (?, ?, ?, ?, ?)
        `, [cursoId, titulo, descricao, notaMinima, questoesJson]);
        return queryOne(`SELECT * FROM ead_avaliacoes WHERE rowid = last_insert_rowid()`);
    }
}

// 8. MATRICULAR COLABORADORES
function matricularColaboradores(cursoId, colaboradorIds) {
    const ids = Array.isArray(colaboradorIds) ? colaboradorIds : [colaboradorIds].filter(Boolean);
    if (ids.length === 0) {
        throw new Error('Selecione pelo menos um colaborador para matricular.');
    }

    let matriculadosNovos = 0;
    let ultimaMatricula = null;

    for (const cId of ids) {
        let existente = queryOne(`SELECT * FROM ead_matriculas WHERE curso_id = ? AND colaborador_id = ?`, [cursoId, cId]);
        if (!existente) {
            execute(`
                INSERT INTO ead_matriculas (curso_id, colaborador_id, progresso_pct, status)
                VALUES (?, ?, 0.0, 'Em Andamento')
            `, [cursoId, cId]);
            matriculadosNovos++;
            existente = queryOne(`SELECT * FROM ead_matriculas WHERE rowid = last_insert_rowid()`);
        }
        ultimaMatricula = existente;
    }

    return {
        success: true,
        matriculadosNovos,
        matricula: ultimaMatricula
    };
}

// 9. CONCLUIR AULA (ALUNO) E ATUALIZAR PROGRESSO
function concluirAula(matriculaId, aulaId) {
    const matricula = queryOne(`SELECT * FROM ead_matriculas WHERE id = ?`, [matriculaId]);
    if (!matricula) throw new Error('Matrícula não encontrada.');

    // Registra conclusão se ainda não tiver
    const jaConcluida = queryOne(`SELECT id FROM ead_aulas_concluidas WHERE matricula_id = ? AND aula_id = ?`, [matriculaId, aulaId]);
    if (!jaConcluida) {
        execute(`INSERT INTO ead_aulas_concluidas (matricula_id, aula_id) VALUES (?, ?)`, [matriculaId, aulaId]);
    }

    // Recalcula progresso
    const totalAulasRow = queryOne(`SELECT COUNT(*) as total FROM ead_aulas WHERE curso_id = ?`, [matricula.curso_id]);
    const concluidasRow = queryOne(`SELECT COUNT(*) as concluidas FROM ead_aulas_concluidas WHERE matricula_id = ?`, [matriculaId]);

    const totalAulas = totalAulasRow ? totalAulasRow.total : 1;
    const concluidas = concluidasRow ? concluidasRow.concluidas : 0;
    const pct = Math.min(100, Math.round((concluidas / totalAulas) * 100));

    let novoStatus = matricula.status;
    if (pct === 100 && matricula.status === 'Em Andamento') {
        const temProva = queryOne(`SELECT id FROM ead_avaliacoes WHERE curso_id = ?`, [matricula.curso_id]);
        novoStatus = temProva ? 'Pendente Prova' : 'Aprovado';
    }

    execute(`
        UPDATE ead_matriculas SET
            progresso_pct = ?,
            status = ?
        WHERE id = ?
    `, [pct, novoStatus, matriculaId]);

    return {
        success: true,
        progresso: {
            matricula_id: matriculaId,
            progresso_pct: pct,
            status: novoStatus,
            concluidas,
            total_aulas: totalAulas
        }
    };
}

// 10. SUBMETER RESPOSTAS DA PROVA & CORREÇÃO AUTOMÁTICA
function submeterAvaliacao(matriculaId, avaliacaoId, respostasUsuario) {
    const matricula = queryOne(`SELECT * FROM ead_matriculas WHERE id = ?`, [matriculaId]);
    if (!matricula) throw new Error('Matrícula não encontrada.');

    let avaliacao = null;
    if (avaliacaoId) {
        avaliacao = queryOne(`SELECT * FROM ead_avaliacoes WHERE id = ?`, [avaliacaoId]);
    } else {
        avaliacao = queryOne(`SELECT * FROM ead_avaliacoes WHERE curso_id = ?`, [matricula.curso_id]);
    }

    if (!avaliacao) throw new Error('Avaliação não encontrada.');

    const questoes = JSON.parse(avaliacao.questoes_json || '[]');
    if (questoes.length === 0) throw new Error('A avaliação não possui questões.');

    // Normaliza mapa de respostas
    const mapaRespostas = {};
    if (Array.isArray(respostasUsuario)) {
        respostasUsuario.forEach(r => {
            mapaRespostas[r.questao_id] = r.resposta_aluno || r.resposta;
        });
    } else if (typeof respostasUsuario === 'object') {
        Object.assign(mapaRespostas, respostasUsuario);
    }

    const letraParaIndice = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
    const indiceParaLetra = ['A', 'B', 'C', 'D', 'E'];

    let acertos = 0;
    const feedbackQuestoes = [];

    for (let i = 0; i < questoes.length; i++) {
        const q = questoes[i];
        const qId = q.id || (i + 1);
        const respostaDada = mapaRespostas[qId] !== undefined ? mapaRespostas[qId] : mapaRespostas[i];

        let corretaLetra = typeof q.correta === 'string' && isNaN(q.correta) ? q.correta.toUpperCase() : indiceParaLetra[Number(q.correta) || 0];
        let dadaLetra = typeof respostaDada === 'string' && isNaN(respostaDada) ? respostaDada.toUpperCase() : indiceParaLetra[Number(respostaDada) || 0];

        const acertou = (dadaLetra === corretaLetra);
        if (acertou) acertos++;

        feedbackQuestoes.push({
            id: qId,
            enunciado: q.enunciado,
            resposta_dada: dadaLetra,
            resposta_correta: corretaLetra,
            acertou
        });
    }

    const notaCalculada = Math.round((acertos / questoes.length) * 100);
    const notaMinima = avaliacao.nota_minima || 70.0;
    const aprovado = notaCalculada >= notaMinima;

    let certificadoCodigo = matricula.certificado_codigo;
    let dataConclusao = matricula.data_conclusao;

    if (aprovado) {
        if (!certificadoCodigo) {
            const curso = queryOne(`SELECT categoria_nr FROM ead_cursos WHERE id = ?`, [matricula.curso_id]);
            const cat = (curso && curso.categoria_nr) ? curso.categoria_nr.replace(/[^a-zA-Z0-9]/g, '') : 'NR';
            certificadoCodigo = `EAD-${cat}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        }
        dataConclusao = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    // Salva histórico de resposta
    execute(`
        INSERT INTO ead_respostas (matricula_id, avaliacao_id, respostas_json, nota_obtida, aprovado)
        VALUES (?, ?, ?, ?, ?)
    `, [matriculaId, avaliacao.id, JSON.stringify(feedbackQuestoes), notaCalculada, aprovado ? 1 : 0]);

    // Atualiza status e nota na matrícula
    execute(`
        UPDATE ead_matriculas SET
            nota_final = ?,
            status = ?,
            certificado_codigo = ?,
            data_conclusao = ?
        WHERE id = ?
    `, [notaCalculada, aprovado ? 'Aprovado' : 'Reprovado', certificadoCodigo, dataConclusao, matriculaId]);

    return {
        success: true,
        aprovado,
        nota: notaCalculada,
        nota_obtida: notaCalculada,
        nota_minima: notaMinima,
        status: aprovado ? 'Aprovado' : 'Reprovado',
        certificado_codigo: certificadoCodigo,
        total_questoes: questoes.length,
        acertos,
        feedback: feedbackQuestoes
    };
}

// 11. DADOS COMPLETOS PARA IMPRESSÃO DO CERTIFICADO (NR-01 ANEXO II)
function getCertificadoData(matriculaId) {
    const mat = queryOne(`
        SELECT m.*, c.nome as colaborador_nome, c.cpf as colaborador_cpf, c.matricula as colaborador_matricula,
               car.titulo as cargo_nome, car.cbo, s.nome as setor_nome,
               cur.titulo as curso_titulo, cur.descricao as curso_descricao, cur.categoria_nr, cur.carga_horaria_horas,
               cur.conteudo_programatico,
               u.nome as instrutor_nome, u.email as instrutor_email,
               emp.razao_social as empresa_razao, emp.cnpj as empresa_cnpj, emp.cnae as empresa_cnae, emp.cidade as empresa_cidade, emp.uf as empresa_uf
        FROM ead_matriculas m
        JOIN colaboradores c ON m.colaborador_id = c.id
        JOIN cargos car ON c.cargo_id = car.id
        JOIN setores s ON c.setor_id = s.id
        JOIN ead_cursos cur ON m.curso_id = cur.id
        JOIN usuarios u ON cur.instrutor_id = u.id
        CROSS JOIN empresas emp
        WHERE m.id = ?
    `, [matriculaId]);

    if (!mat) throw new Error('Certificado não encontrado para esta matrícula.');

    return {
        success: true,
        certificado: {
            ...mat,
            codigo_validacao: mat.certificado_codigo || `EAD-NR-${Date.now().toString(36).toUpperCase()}`,
            data_emissao: mat.data_conclusao || new Date().toISOString().substring(0, 10),
            nota_final: mat.nota_final || 100
        }
    };
}

// 12. POSTAR NO MURAL
function postMural(cursoId, autorId, titulo, mensagem, importante = 0) {
    if (!titulo || !mensagem) throw new Error('Título e mensagem são obrigatórios.');

    execute(`
        INSERT INTO ead_mural (curso_id, autor_id, titulo, mensagem, importante)
        VALUES (?, ?, ?, ?, ?)
    `, [cursoId, autorId, titulo, mensagem, importante ? 1 : 0]);

    return {
        success: true,
        mural: queryOne(`SELECT * FROM ead_mural WHERE rowid = last_insert_rowid()`)
    };
}

// 13. ENVIAR DÚVIDA AO INSTRUTOR (ALUNO)
function enviarDuvida(cursoId, colaboradorId, pergunta, aulaId = null) {
    if (!pergunta || !pergunta.trim()) throw new Error('Digite a sua dúvida para o professor.');

    const colabId = colaboradorId || 1; // Default para primeiro colaborador se teste

    execute(`
        INSERT INTO ead_duvidas (curso_id, colaborador_id, pergunta)
        VALUES (?, ?, ?)
    `, [cursoId, colabId, pergunta.trim()]);

    return {
        success: true,
        duvida: queryOne(`SELECT * FROM ead_duvidas WHERE rowid = last_insert_rowid()`)
    };
}

// 14. RESPONDER DÚVIDA (INSTRUTOR / ADMIN)
function responderDuvida(duvidaId, resposta, instrutorId) {
    if (!resposta || !resposta.trim()) throw new Error('Digite a resposta para o aluno.');

    execute(`
        UPDATE ead_duvidas SET
            resposta = ?,
            respondida_por = ?,
            data_resposta = datetime('now', 'localtime')
        WHERE id = ?
    `, [resposta.trim(), instrutorId, duvidaId]);

    return {
        success: true,
        duvida: queryOne(`SELECT * FROM ead_duvidas WHERE id = ?`, [duvidaId])
    };
}

// 15. LISTAR MATRÍCULAS DO ALUNO / USUÁRIO
function getMeusCursos(usuarioId, colaboradorId = null) {
    let colabId = colaboradorId;
    if (!colabId && usuarioId) {
        const user = queryOne(`SELECT email FROM usuarios WHERE id = ?`, [usuarioId]);
        if (user && user.email) {
            const col = queryOne(`SELECT id FROM colaboradores WHERE email = ?`, [user.email]);
            if (col) colabId = col.id;
        }
    }
    if (!colabId) colabId = 1; // Fallback para demonstração

    return queryAll(`
        SELECT m.*, c.titulo, c.categoria_nr as categoria, c.carga_horaria_horas as carga_horaria,
               u.nome as instrutor_nome,
               (SELECT COUNT(*) FROM ead_aulas WHERE curso_id = c.id) as total_aulas
        FROM ead_matriculas m
        JOIN ead_cursos c ON m.curso_id = c.id
        JOIN usuarios u ON c.instrutor_id = u.id
        WHERE m.colaborador_id = ?
        ORDER BY m.id DESC
    `, [colabId]);
}

module.exports = {
    listCursos,
    getCurso,
    createCurso,
    updateCurso,
    addAula,
    deleteAula,
    saveAvaliacao,
    matricularColaboradores,
    concluirAula,
    submeterAvaliacao,
    getCertificadoData,
    postMural,
    enviarDuvida,
    responderDuvida,
    getMeusCursos
};
