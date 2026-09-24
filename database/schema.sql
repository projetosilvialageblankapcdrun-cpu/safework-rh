-- ====================================================================
-- SafeWork RH & SST - Esquema de Banco de Dados SQLite
-- Módulos: Departamento Pessoal (DP), Segurança e Saúde no Trabalho (SST),
--          eSocial (S-2210, S-2220, S-2240) e Relatórios Regulamentares
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. EMPRESA / ESTABELECIMENTO
CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT NOT NULL UNIQUE,
    cnae TEXT NOT NULL,
    grau_risco INTEGER NOT NULL DEFAULT 1, -- NR-04 (Grau de risco 1 a 4)
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    cep TEXT,
    telefone TEXT,
    email TEXT,
    medico_coordenador_nome TEXT,
    medico_coordenador_crm TEXT,
    medico_coordenador_uf TEXT,
    responsavel_sst_nome TEXT,
    responsavel_sst_registro TEXT, -- Ex: MTE / Reg. Técnico
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. SETORES / DEPARTAMENTOS
CREATE TABLE IF NOT EXISTS setores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL DEFAULT 1,
    nome TEXT NOT NULL,
    descricao TEXT,
    responsavel TEXT,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- 3. CARGOS / FUNÇÕES
CREATE TABLE IF NOT EXISTS cargos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setor_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    cbo TEXT NOT NULL, -- Código Brasileiro de Ocupações
    descricao_atividades TEXT,
    requisitos TEXT,
    salario_base REAL DEFAULT 0.0,
    periculosidade INTEGER DEFAULT 0, -- 0 = Não, 1 = Sim (30%)
    insalubridade_grau INTEGER DEFAULT 0, -- 0 = Não, 10 = Mínimo, 20 = Médio, 40 = Máximo
    FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE CASCADE
);

-- 4. COLABORADORES (DEPARTAMENTO PESSOAL)
CREATE TABLE IF NOT EXISTS colaboradores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL DEFAULT 1,
    cargo_id INTEGER NOT NULL,
    setor_id INTEGER NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    rg TEXT,
    rg_orgao TEXT,
    pis TEXT,
    ctps_numero TEXT,
    ctps_serie TEXT,
    data_nascimento DATE NOT NULL,
    sexo TEXT CHECK(sexo IN ('M', 'F', 'O')),
    estado_civil TEXT,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    cep TEXT,
    tipo_contrato TEXT DEFAULT 'CLT' CHECK(tipo_contrato IN ('CLT', 'PJ', 'Estágio', 'Menor Aprendiz', 'Temporário')),
    data_admissao DATE NOT NULL,
    data_demissao DATE,
    salario REAL NOT NULL DEFAULT 0.0,
    jornada_semanal INTEGER DEFAULT 44,
    escala_trabalho TEXT DEFAULT '5x2 (Seg a Sex)',
    status TEXT DEFAULT 'Ativo' CHECK(status IN ('Ativo', 'Férias', 'Afastado', 'Demitido')),
    foto_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
    FOREIGN KEY (setor_id) REFERENCES setores(id)
);

-- 5. DEPENDENTES (IRRF / SALÁRIO FAMÍLIA)
CREATE TABLE IF NOT EXISTS dependentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    parentesco TEXT NOT NULL, -- Filho, Cônjuge, etc.
    cpf TEXT,
    data_nascimento DATE NOT NULL,
    para_irrf INTEGER DEFAULT 1,
    para_salario_familia INTEGER DEFAULT 0,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

-- 6. GESTÃO DE FÉRIAS (DP)
CREATE TABLE IF NOT EXISTS ferias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    periodo_aquisitivo_inicio DATE NOT NULL,
    periodo_aquisitivo_fim DATE NOT NULL,
    limite_concessivo DATE NOT NULL, -- Data limite antes da dobra
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    dias_gozo INTEGER NOT NULL DEFAULT 30,
    abono_pecuniario INTEGER DEFAULT 0, -- 1/3 vendido (0 = não, 1 = sim)
    adiantamento_13 INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Programada' CHECK(status IN ('Programada', 'Aprovada', 'Em Gozo', 'Concluída', 'Cancelada')),
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

-- 7. PONTO E REGISTRO DE FREQUÊNCIA (DP)
CREATE TABLE IF NOT EXISTS ponto_registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    data DATE NOT NULL,
    entrada_1 TIME,
    saida_1 TIME,
    entrada_2 TIME,
    saida_2 TIME,
    horas_trabalhadas REAL DEFAULT 0.0,
    horas_extras REAL DEFAULT 0.0,
    atrasos_minutos INTEGER DEFAULT 0,
    ocorrencia TEXT CHECK(ocorrencia IN ('Normal', 'Falta Justificada', 'Falta Injustificada', 'Atestado', 'Folga', 'Feriado')),
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

-- 8. ATESTADOS MÉDICOS E AFASTAMENTOS (DP & SST)
CREATE TABLE IF NOT EXISTS atestados_afastamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    data_emissao DATE NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    dias_afastamento INTEGER NOT NULL,
    medico_nome TEXT NOT NULL,
    medico_crm TEXT NOT NULL,
    medico_uf TEXT NOT NULL,
    cid10 TEXT NOT NULL, -- Código Internacional de Doenças
    cid10_descricao TEXT,
    tipo_afastamento TEXT NOT NULL CHECK(tipo_afastamento IN ('Doença Comum', 'Acidente de Trabalho', 'Doença Ocupacional', 'Licença Maternidade', 'Outros')),
    encaminhado_inss INTEGER DEFAULT 0, -- 1 se > 15 dias
    numero_beneficio_inss TEXT,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

-- 9. INVENTÁRIO DE RISCOS / PGR / GRO (NR-01)
CREATE TABLE IF NOT EXISTS riscos_ocupacionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setor_id INTEGER NOT NULL,
    cargo_id INTEGER,
    grupo_risco TEXT NOT NULL CHECK(grupo_risco IN ('Físico', 'Químico', 'Biológico', 'Ergonômico', 'Acidente/Mecânico')),
    perigo_fator TEXT NOT NULL, -- Ex: Ruído Contínuo, Vapores Orgânicos, Postura Inadequada
    fonte_geradora TEXT NOT NULL, -- Ex: Prensa Hidráulica, Torno, Computador
    danos_saude TEXT, -- Ex: Perda auditiva induzida por ruído (PAIR)
    esocial_codigo TEXT, -- Código na Tabela 24 do eSocial (ex: 01.01.001)
    tipo_avaliacao TEXT DEFAULT 'Qualitativa' CHECK(tipo_avaliacao IN ('Qualitativa', 'Quantitativa')),
    intensidade_concentracao TEXT, -- Ex: 87.5 dB(A)
    limite_tolerancia TEXT, -- Ex: 85 dB(A)
    nivel_acao TEXT, -- Ex: 80 dB(A)
    probabilidade INTEGER NOT NULL CHECK(probabilidade BETWEEN 1 AND 5),
    severidade INTEGER NOT NULL CHECK(severidade BETWEEN 1 AND 5),
    nivel_risco INTEGER GENERATED ALWAYS AS (probabilidade * severidade) STORED, -- 1 a 25
    classificacao_risco TEXT, -- Baixo (1-5), Médio (6-12), Alto (15-20), Crítico (25)
    medidas_preventivas_existentes TEXT,
    medidas_propostas TEXT,
    epc_eficaz INTEGER DEFAULT 0,
    epi_eficaz INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Ativo' CHECK(status IN ('Ativo', 'Controlado', 'Eliminado')),
    FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE CASCADE,
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE SET NULL
);

-- 10. PLANO DE AÇÃO 5W2H (NR-01 PGR)
CREATE TABLE IF NOT EXISTS planos_acao_5w2h (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risco_id INTEGER,
    setor_id INTEGER NOT NULL,
    o_que TEXT NOT NULL, -- What: Ação a ser executada
    por_que TEXT NOT NULL, -- Why: Justificativa / Redução de risco
    onde TEXT NOT NULL, -- Where: Local / Máquina
    quem TEXT NOT NULL, -- Who: Responsável pela execução
    quando_prazo DATE NOT NULL, -- When: Prazo limite
    como TEXT NOT NULL, -- How: Procedimento técnico
    quanto_custo REAL DEFAULT 0.0, -- How much: Custo estimado
    status TEXT DEFAULT 'Pendente' CHECK(status IN ('Pendente', 'Em Andamento', 'Concluído', 'Atrasado', 'Cancelado')),
    data_conclusao DATE,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (risco_id) REFERENCES riscos_ocupacionais(id) ON DELETE SET NULL,
    FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE CASCADE
);

-- 11. CATÁLOGO DE EPIS (NR-06)
CREATE TABLE IF NOT EXISTS epis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL, -- Ex: Protetor Auditivo Plug de Silicone
    ca_numero TEXT NOT NULL, -- Certificado de Aprovação Ministério do Trabalho
    ca_validade DATE NOT NULL,
    fabricante TEXT NOT NULL,
    tipo_protecao TEXT NOT NULL, -- Auditiva, Respiratória, Olhos/Face, Cabeça, Mãos, Pés, Altura
    descricao TEXT,
    periodicidade_troca_dias INTEGER DEFAULT 180, -- Dias recomendados para troca
    estoque_atual INTEGER DEFAULT 0,
    estoque_minimo INTEGER DEFAULT 5,
    custo_unitario REAL DEFAULT 0.0,
    instrucoes_uso TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. FICHA DE ENTREGA E DEVOLUÇÃO DE EPI (NR-06)
CREATE TABLE IF NOT EXISTS epi_entregas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    epi_id INTEGER NOT NULL,
    data_entrega DATE NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    motivo TEXT DEFAULT 'Admissão' CHECK(motivo IN ('Admissão', 'Troca Periódica', 'Substituição por Danos', 'Perda', 'Nova Função')),
    data_prevista_troca DATE,
    termo_responsabilidade_aceito INTEGER DEFAULT 1,
    assinado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    devolvido INTEGER DEFAULT 0,
    data_devolucao DATE,
    motivo_devolucao TEXT,
    observacoes TEXT,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE,
    FOREIGN KEY (epi_id) REFERENCES epis(id) ON DELETE RESTRICT
);

-- 13. PCMSO E GESTÃO DE ASOS (NR-07)
CREATE TABLE IF NOT EXISTS asos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    tipo_aso TEXT NOT NULL CHECK(tipo_aso IN ('Admissional', 'Periódico', 'Retorno ao Trabalho', 'Mudança de Riscos', 'Demissional')),
    data_emissao DATE NOT NULL,
    data_validade DATE NOT NULL, -- Geralmente 1 ano ou conforme PCMSO
    aptidao TEXT NOT NULL CHECK(aptidao IN ('Apto', 'Inapto', 'Apto com Restrição')),
    restricoes_detalhes TEXT,
    medico_examinador_nome TEXT NOT NULL,
    medico_examinador_crm TEXT NOT NULL,
    medico_examinador_uf TEXT NOT NULL,
    medico_coordenador_nome TEXT,
    medico_coordenador_crm TEXT,
    medico_coordenador_uf TEXT,
    exames_realizados TEXT, -- JSON ou texto: Clínico, Audiometria, etc.
    observacoes TEXT,
    esocial_enviado INTEGER DEFAULT 0,
    esocial_recibo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

-- 14. CATÁLOGO DE TREINAMENTOS E CERTIFICAÇÕES DE NRS
CREATE TABLE IF NOT EXISTS treinamentos_catalogo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    norma TEXT NOT NULL, -- Ex: NR-01, NR-05, NR-06, NR-10, NR-12, NR-35
    titulo TEXT NOT NULL, -- Ex: Trabalho em Altura - Básico
    carga_horaria_horas INTEGER NOT NULL,
    validade_meses INTEGER NOT NULL DEFAULT 24, -- Validade para reciclagem
    conteudo_programatico TEXT,
    obrigatorio_para_cargos TEXT -- Lista ou descrição
);

-- 15. REGISTRO DE TREINAMENTOS REALIZADOS (NRs)
CREATE TABLE IF NOT EXISTS treinamentos_realizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    treinamento_id INTEGER NOT NULL,
    colaborador_id INTEGER NOT NULL,
    data_realizacao DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    instrutor_nome TEXT NOT NULL,
    instrutor_qualificacao TEXT,
    entidade_formadora TEXT,
    aproveitamento_nota REAL DEFAULT 10.0,
    status TEXT DEFAULT 'Válido' CHECK(status IN ('Válido', 'A Vencer', 'Vencido')),
    certificado_numero TEXT,
    FOREIGN KEY (treinamento_id) REFERENCES treinamentos_catalogo(id) ON DELETE RESTRICT,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

-- 16. ACIDENTES DE TRABALHO E INVESTIGAÇÃO (CAT - S-2210)
CREATE TABLE IF NOT EXISTS acidentes_cat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    data_acidente DATE NOT NULL,
    hora_acidente TIME NOT NULL,
    tipo_acidente TEXT NOT NULL CHECK(tipo_acidente IN ('Típico', 'Trajeto', 'Doença Ocupacional')),
    houve_afastamento INTEGER DEFAULT 0,
    dias_afastamento INTEGER DEFAULT 0,
    houve_obito INTEGER DEFAULT 0,
    data_obito DATE,
    local_acidente TEXT NOT NULL,
    parte_corpo_atingida TEXT NOT NULL,
    agente_causador TEXT NOT NULL,
    situacao_geradora TEXT,
    descricao_acidente TEXT NOT NULL,
    investigacao_arvore_causas TEXT,
    medidas_corretivas_adotadas TEXT,
    atendimento_medico_local TEXT,
    medico_atendente_crm TEXT,
    numero_cat TEXT, -- Número da CAT no sistema ou eSocial
    data_emissao_cat DATE,
    esocial_enviado INTEGER DEFAULT 0,
    esocial_recibo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

-- 17. ORDENS DE SERVIÇO (NR-01)
CREATE TABLE IF NOT EXISTS ordens_servico_nr01 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cargo_id INTEGER NOT NULL,
    atividades_desenvolvidas TEXT NOT NULL,
    riscos_funcao TEXT NOT NULL,
    epis_obrigatorios TEXT NOT NULL,
    medidas_preventivas TEXT NOT NULL,
    normas_proibicoes TEXT NOT NULL,
    punicoes_previstas TEXT NOT NULL,
    revisao TEXT DEFAULT '01',
    data_aprovacao DATE NOT NULL,
    FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE CASCADE
);

-- 18. CENTRAL ESOCIAL (LOG DE TRANSMISSÕES SST E TRABALHISTAS)
CREATE TABLE IF NOT EXISTS esocial_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_tipo TEXT NOT NULL CHECK(evento_tipo IN ('S-2210', 'S-2220', 'S-2240', 'S-2200')),
    referencia_id INTEGER NOT NULL, -- ID do ASO, Acidente ou Colaborador
    colaborador_id INTEGER NOT NULL,
    xml_conteudo TEXT NOT NULL,
    data_geracao DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Pronto para Envio' CHECK(status IN ('Pendente', 'Pronto para Envio', 'Transmitido', 'Rejeitado', 'Processado')),
    recibo_protocolo TEXT,
    mensagem_retorno TEXT,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

-- 19. USUÁRIOS E CONTROLE DE ACESSO (AUTENTICAÇÃO & SEGURANÇA)
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    login TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'Administrador' CHECK(perfil IN ('Administrador', 'Gestor DP', 'Técnico SST', 'Visualizador', 'Instrutor / Professor', 'Colaborador / Aluno')),
    ativo INTEGER NOT NULL DEFAULT 1,
    ultimo_acesso DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 20. ACADEMIA CORPORATIVA & CURSOS EAD (NR-01 ANEXO II)
CREATE TABLE IF NOT EXISTS ead_cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    categoria_nr TEXT NOT NULL, -- Ex: 'NR-35', 'NR-10', 'NR-01', 'CIPA+A'
    carga_horaria_horas INTEGER NOT NULL DEFAULT 4,
    instrutor_id INTEGER NOT NULL,
    thumbnail_url TEXT,
    nota_aprovacao_minima REAL DEFAULT 70.0,
    conteudo_programatico TEXT,
    publico_alvo TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instrutor_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS ead_aulas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 1,
    titulo TEXT NOT NULL,
    descricao TEXT,
    tipo_video TEXT NOT NULL DEFAULT 'link_externo' CHECK(tipo_video IN ('link_externo', 'upload', 'incorporado')),
    video_url TEXT NOT NULL,
    duracao_minutos INTEGER DEFAULT 15,
    material_apoio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curso_id) REFERENCES ead_cursos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ead_matriculas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    colaborador_id INTEGER NOT NULL,
    progresso_pct REAL DEFAULT 0.0,
    status TEXT DEFAULT 'Em Andamento' CHECK(status IN ('Em Andamento', 'Pendente Prova', 'Aprovado', 'Reprovado')),
    nota_final REAL,
    data_matricula DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_conclusao DATETIME,
    certificado_codigo TEXT UNIQUE,
    FOREIGN KEY (curso_id) REFERENCES ead_cursos(id) ON DELETE CASCADE,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ead_aulas_concluidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricula_id INTEGER NOT NULL,
    aula_id INTEGER NOT NULL,
    data_conclusao DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(matricula_id, aula_id),
    FOREIGN KEY (matricula_id) REFERENCES ead_matriculas(id) ON DELETE CASCADE,
    FOREIGN KEY (aula_id) REFERENCES ead_aulas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ead_avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    nota_minima REAL DEFAULT 70.0,
    questoes_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curso_id) REFERENCES ead_cursos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ead_respostas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricula_id INTEGER NOT NULL,
    avaliacao_id INTEGER NOT NULL,
    respostas_json TEXT NOT NULL,
    nota_obtida REAL NOT NULL,
    aprovado INTEGER NOT NULL DEFAULT 0,
    tentativa_numero INTEGER DEFAULT 1,
    data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (matricula_id) REFERENCES ead_matriculas(id) ON DELETE CASCADE,
    FOREIGN KEY (avaliacao_id) REFERENCES ead_avaliacoes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ead_mural (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    autor_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    importante INTEGER DEFAULT 0,
    data_publicacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curso_id) REFERENCES ead_cursos(id) ON DELETE CASCADE,
    FOREIGN KEY (autor_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS ead_duvidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    colaborador_id INTEGER NOT NULL,
    pergunta TEXT NOT NULL,
    resposta TEXT,
    respondida_por INTEGER,
    data_pergunta DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_resposta DATETIME,
    FOREIGN KEY (curso_id) REFERENCES ead_cursos(id) ON DELETE CASCADE,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE,
    FOREIGN KEY (respondida_por) REFERENCES usuarios(id)
);

-- 21. CANAL DE DENÚNCIAS & LINHA ÉTICA (LEI 14.457/2022 - CIPA+A / LGPD / COMPLIANCE)
CREATE TABLE IF NOT EXISTS denuncias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    protocolo TEXT UNIQUE NOT NULL,
    chave_acesso TEXT NOT NULL,
    tipo_denuncia TEXT NOT NULL CHECK(tipo_denuncia IN ('Anonima', 'Identificada')),
    denunciante_nome TEXT,
    denunciante_email TEXT,
    denunciante_telefone TEXT,
    denunciante_cargo_setor TEXT,
    categoria TEXT NOT NULL CHECK(categoria IN (
        'Assédio Sexual (Lei 14.457/22)',
        'Assédio Moral',
        'Discriminação / Preconceito',
        'Risco Grave de Acidente / Descumprimento de SST',
        'Fraude / Corrupção / Desvio',
        'Outros'
    )),
    descricao_fatos TEXT NOT NULL,
    data_ocorrencia TEXT,
    local_setor TEXT,
    pessoas_envolvidas TEXT,
    testemunhas TEXT,
    tem_provas INTEGER DEFAULT 0,
    descricao_provas TEXT,
    status TEXT DEFAULT 'Recebida' CHECK(status IN ('Recebida', 'Em Apuração', 'Medidas Adotadas', 'Concluída', 'Arquivada')),
    parecer_comite TEXT,
    medidas_adotadas TEXT,
    data_conclusao DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
