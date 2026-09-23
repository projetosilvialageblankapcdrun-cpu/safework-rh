// ====================================================================
// SafeWork RH & SST - Script de Carga Inicial (Seed Data Realista)
// Dados simulando uma indústria modelo brasileira com conformidade CLT e SST
// ====================================================================

const { getDb, execute, queryOne } = require('./db.js');
const { hashPassword } = require('../server/routes/auth.js');

function runSeed() {
    const db = getDb();
    console.log('[SafeWork Seed] Iniciando povoamento de dados...');

    // Limpar tabelas existentes para garantir um estado limpo
    db.exec(`
        DELETE FROM usuarios;
        DELETE FROM esocial_eventos;
        DELETE FROM ordens_servico_nr01;
        DELETE FROM acidentes_cat;
        DELETE FROM treinamentos_realizados;
        DELETE FROM treinamentos_catalogo;
        DELETE FROM asos;
        DELETE FROM epi_entregas;
        DELETE FROM epis;
        DELETE FROM planos_acao_5w2h;
        DELETE FROM riscos_ocupacionais;
        DELETE FROM atestados_afastamentos;
        DELETE FROM ponto_registros;
        DELETE FROM ferias;
        DELETE FROM dependentes;
        DELETE FROM colaboradores;
        DELETE FROM cargos;
        DELETE FROM setores;
        DELETE FROM empresas;
        DELETE FROM sqlite_sequence;
    `);

    // 1. EMPRESA MODELO
    db.prepare(`
        INSERT INTO empresas (
            id, razao_social, nome_fantasia, cnpj, cnae, grau_risco,
            endereco, cidade, uf, cep, telefone, email,
            medico_coordenador_nome, medico_coordenador_crm, medico_coordenador_uf,
            responsavel_sst_nome, responsavel_sst_registro
        ) VALUES (
            1, 'MetalSul Estruturas Metálicas e Caldeiraria S/A', 'MetalSul Indústria',
            '18.234.567/0001-89', '25.11-0/00', 3,
            'Av. Industrial das Américas, 4500 - Distrito Industrial', 'Campinas', 'SP', '13080-000',
            '(19) 3455-8000', 'contato@metalsul.com.br',
            'Dra. Camila Sampaio Nogueira', '145890', 'SP',
            'Eng. Marcos Vinícius Prado', 'CREA/SP 5061234567 - MTE 003421'
        )
    `).run();

    // 2. SETORES
    const setores = [
        [1, 'Produção e Caldeiraria', 'Fabricação, corte, dobra e montagem pesada', 'Eng. Fábio Arruda'],
        [2, 'Usinagem CNC', 'Tornos, centros de usinagem e fresadoras', 'Carlos Eduardo Vilela'],
        [3, 'Logística e Expedição', 'Movimentação, almoxarifado e estocagem', 'Renata Queiroz'],
        [4, 'Manutenção Mecânica & Elétrica', 'Manutenção preventiva e corretiva fabril', 'Gerson Nogueira'],
        [5, 'Administração e RH', 'Recursos Humanos, DP, Financeiro e Comercial', 'Helena Batista']
    ];
    for (const [id, nome, desc, resp] of setores) {
        db.prepare('INSERT INTO setores (id, empresa_id, nome, descricao, responsavel) VALUES (?, 1, ?, ?, ?)').run(id, nome, desc, resp);
    }

    // 3. CARGOS
    const cargos = [
        [1, 1, 'Soldador Mig/Mag e Eletrodo Revestido', '7243-15', 'Executa soldagens em estruturas de aço, corte oxiacetilênico e preparação de chapas.', 'Ensino Médio + Certificação AWS', 3850.00, 0, 20],
        [2, 1, 'Caldeireiro Industrial', '7244-10', 'Traçagem, conformação mecânica e montagem de estruturas pesadas.', 'Ensino Técnico em Mecânica', 4200.00, 0, 20],
        [3, 2, 'Operador de Centro de Usinagem CNC', '7214-05', 'Programação e operação de fresas e tornos CNC de alta precisão.', 'Técnico em Usinagem / Mecatrônica', 3600.00, 0, 20],
        [4, 3, 'Operador de Empilhadeira', '7822-20', 'Operação de empilhadeiras elétricas e a combustão para movimentação de cargas.', 'Ensino Médio + CNH B + Curso Operador NR-11', 2950.00, 0, 0],
        [5, 4, 'Eletricista de Manutenção Industrial', '7156-15', 'Manutenção preventiva e preditiva de subestações e painéis 380V/440V.', 'Técnico em Eletrotécnica + NR-10 + SEP', 4500.00, 1, 0],
        [6, 5, 'Analista de Departamento Pessoal Pleno', '2524-05', 'Fechamento de folha, controle de férias, admissões e gestão de ponto.', 'Superior em RH ou Administração', 4100.00, 0, 0],
        [7, 5, 'Técnico em Segurança do Trabalho', '3516-05', 'Inspeções de campo, controle de EPIs, emissão de ASOs, PGR e eSocial.', 'Curso Técnico em SST com Registro MTE', 3900.00, 0, 0]
    ];
    for (const [id, setor_id, titulo, cbo, desc, req, sal, peric, insalub] of cargos) {
        db.prepare(`
            INSERT INTO cargos (id, setor_id, titulo, cbo, descricao_atividades, requisitos, salario_base, periculosidade, insalubridade_grau)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, setor_id, titulo, cbo, desc, req, sal, peric, insalub);
    }

    // 4. COLABORADORES
    const colaboradores = [
        [1, 1, 1, 'MAT-00101', 'João Carlos da Silva', '214.582.938-11', '32.411.902-8', 'SSP/SP', '124.58912.45-8', '045982', '0041', '1988-04-15', 'M', 'Casado', '(19) 98112-3344', 'joao.silva@metalsul.com.br', 'Rua das Palmeiras, 120', 'Campinas', 'SP', '13060-100', 'CLT', '2021-03-01', 3850.00, 44, 'Ativo'],
        [2, 2, 1, 'MAT-00102', 'Roberto de Albuquerque', '319.458.741-22', '41.229.831-4', 'SSP/SP', '133.45612.33-1', '089412', '0032', '1992-08-20', 'M', 'Solteiro', '(19) 98223-4455', 'roberto.albuquerque@metalsul.com.br', 'Av. Brasil, 890 - Apto 34', 'Campinas', 'SP', '13070-020', 'CLT', '2022-06-15', 4200.00, 44, 'Ativo'],
        [3, 3, 2, 'MAT-00103', 'Ana Paula Ferreira', '405.129.873-55', '38.991.240-1', 'SSP/SP', '142.99120.11-9', '091244', '0055', '1995-11-10', 'F', 'Solteira', '(19) 98774-1234', 'ana.ferreira@metalsul.com.br', 'Rua São Paulo, 405', 'Hortolândia', 'SP', '13184-000', 'CLT', '2023-01-10', 3600.00, 44, 'Ativo'],
        [4, 4, 3, 'MAT-00104', 'Carlos Eduardo dos Santos', '189.324.718-99', '28.110.392-5', 'SSP/SP', '118.44102.77-3', '077812', '0021', '1985-02-28', 'M', 'Casado', '(19) 99182-7788', 'carlos.santos@metalsul.com.br', 'Rua 7 de Setembro, 201', 'Sumaré', 'SP', '13170-150', 'CLT', '2020-08-01', 2950.00, 44, 'Afastado'],
        [5, 5, 4, 'MAT-00105', 'Marcos Vinicius de Oliveira', '334.871.290-04', '35.401.882-7', 'SSP/SP', '155.80123.44-0', '102938', '0019', '1990-07-04', 'M', 'Casado', '(19) 98822-9900', 'marcos.oliveira@metalsul.com.br', 'Av. Saudade, 1250', 'Campinas', 'SP', '13041-320', 'CLT', '2021-11-15', 4500.00, 44, 'Ativo'],
        [6, 6, 5, 'MAT-00106', 'Beatriz Cristina Menezes', '298.412.569-80', '42.119.800-9', 'SSP/SP', '160.29103.88-5', '118273', '0044', '1994-09-18', 'F', 'Casada', '(19) 99654-3210', 'beatriz.menezes@metalsul.com.br', 'Rua Barão de Jaguara, 780', 'Campinas', 'SP', '13015-001', 'CLT', '2022-02-01', 4100.00, 44, 'Férias'],
        [7, 7, 5, 'MAT-00107', 'Lucas Ramos de Almeida', '420.918.334-12', '46.102.394-0', 'SSP/SP', '171.88290.41-2', '129481', '0060', '1996-12-05', 'M', 'Solteiro', '(19) 99781-4433', 'lucas.almeida@metalsul.com.br', 'Rua Culto à Ciência, 310', 'Campinas', 'SP', '13020-060', 'CLT', '2023-05-15', 3900.00, 44, 'Ativo']
    ];

    for (const c of colaboradores) {
        db.prepare(`
            INSERT INTO colaboradores (
                id, cargo_id, setor_id, matricula, nome, cpf, rg, rg_orgao,
                pis, ctps_numero, ctps_serie, data_nascimento, sexo, estado_civil,
                telefone, email, endereco, cidade, uf, cep, tipo_contrato,
                data_admissao, salario, jornada_semanal, status
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?
            )
        `).run(...c);
    }

    // 5. DEPENDENTES
    db.prepare(`INSERT INTO dependentes (colaborador_id, nome, parentesco, cpf, data_nascimento, para_irrf, para_salario_familia) VALUES (1, 'Enzo Gabriel da Silva', 'Filho', '540.119.283-01', '2016-08-12', 1, 1)`).run();
    db.prepare(`INSERT INTO dependentes (colaborador_id, nome, parentesco, cpf, data_nascimento, para_irrf, para_salario_familia) VALUES (1, 'Mariana Gomes da Silva', 'Cônjuge', '312.981.442-90', '1990-03-22', 1, 0)`).run();
    db.prepare(`INSERT INTO dependentes (colaborador_id, nome, parentesco, cpf, data_nascimento, para_irrf, para_salario_familia) VALUES (4, 'Matheus dos Santos', 'Filho', '610.228.331-40', '2018-05-14', 1, 1)`).run();
    db.prepare(`INSERT INTO dependentes (colaborador_id, nome, parentesco, cpf, data_nascimento, para_irrf, para_salario_familia) VALUES (5, 'Sophia de Oliveira', 'Filha', '650.339.442-19', '2021-09-30', 1, 1)`).run();

    // 6. GESTÃO DE FÉRIAS
    // Beatriz em gozo de férias atualmente
    db.prepare(`
        INSERT INTO ferias (colaborador_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, limite_concessivo, data_inicio, data_fim, dias_gozo, abono_pecuniario, adiantamento_13, status, observacoes)
        VALUES (6, '2024-02-01', '2025-01-31', '2025-12-31', '2026-09-10', '2026-09-29', 20, 1, 1, 'Em Gozo', 'Abono pecuniário de 10 dias vendido conforme CLT.')
    `).run();

    // João Silva com férias a vencer em breve (alerta concessivo!)
    db.prepare(`
        INSERT INTO ferias (colaborador_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, limite_concessivo, data_inicio, data_fim, dias_gozo, abono_pecuniario, adiantamento_13, status, observacoes)
        VALUES (1, '2024-03-01', '2025-02-28', '2026-01-28', '2026-10-15', '2026-11-13', 30, 0, 0, 'Programada', 'Aviso de férias assinado com 30 dias de antecedência.')
    `).run();

    // 7. ATESTADOS MÉDICOS E AFASTAMENTOS (DP + SST)
    // Carlos Eduardo (Operador de empilhadeira) afastado por lesão na coluna > 15 dias -> INSS
    db.prepare(`
        INSERT INTO atestados_afastamentos (
            colaborador_id, data_emissao, data_inicio, data_fim, dias_afastamento,
            medico_nome, medico_crm, medico_uf, cid10, cid10_descricao,
            tipo_afastamento, encaminhado_inss, numero_beneficio_inss, observacoes
        ) VALUES (
            4, '2026-09-12', '2026-09-12', '2026-09-29', 18,
            'Dr. Paulo Henrique Souza', '98124', 'SP', 'M54.5', 'Dor lombar baixa (Lumbago)',
            'Doença Comum', 1, 'NB-648.912.441-0', 'Encaminhado ao INSS devido a afastamento superior a 15 dias consecutivos. Acompanhamento pelo SESMT.'
        )
    `).run();

    // Roberto Albuquerque (afastamento por acidente recente)
    db.prepare(`
        INSERT INTO atestados_afastamentos (
            colaborador_id, data_emissao, data_inicio, data_fim, dias_afastamento,
            medico_nome, medico_crm, medico_uf, cid10, cid10_descricao,
            tipo_afastamento, encaminhado_inss, observacoes
        ) VALUES (
            2, '2026-09-16', '2026-09-16', '2026-09-19', 4,
            'Dr. Arnaldo Silveira', '112440', 'SP', 'S61.0', 'Ferimento de dedo(s) sem lesão da unha',
            'Acidente de Trabalho', 0, 'Corte superficial na mão esquerda durante manuseio de chapa. Emitida CAT S-2210.'
        )
    `).run();

    // 8. CATÁLOGO DE EPIS (NR-06) COM C.A. OFICIAIS DO MTE
    const catalogoEpis = [
        [1, 'Protetor Auditivo tipo Concha Muff 3M', '14235', '2028-11-20', '3M do Brasil Ltda', 'Auditiva', 'Atenuação de 22 dB NRRsf, conchas acolchoadas confortáveis.', 365, 45, 10, 68.50],
        [2, 'Protetor Auditivo de Inserção Pré-Moldado Silicone', '11512', '2027-05-15', 'Carbografite', 'Auditiva', 'Atenuação de 16 dB, lavável com cordão de algodão.', 90, 250, 50, 3.20],
        [3, 'Óculos de Segurança Antirrisco e Antiembaçante Incolor', '27552', '2028-04-10', 'Kalipso Equipamentos', 'Olhos/Face', 'Lentes em policarbonato com proteção UVA/UVB.', 180, 80, 20, 14.90],
        [4, 'Máscara de Solda com Escurecimento Automático Tonalidade 9-13', '38221', '2029-01-30', 'Esab Indústria', 'Olhos/Face', 'Filtro solar automático para radiação infravermelha e ultravioleta.', 730, 12, 3, 380.00],
        [5, 'Respirador Semi-Facial PFF2 com Válvula de Exalação', '38504', '2027-08-12', 'Delta Plus', 'Respiratória', 'Proteção contra fumos metálicos, poeiras e névoas.', 15, 300, 60, 6.80],
        [6, 'Luva de Raspa e Vaqueta para Soldador Cano Longo', '15640', '2028-09-25', 'Volk do Brasil', 'Mãos', 'Resistência mecânica e térmica contra projeção de partículas incandescentes.', 45, 95, 25, 29.00],
        [7, 'Calçado de Segurança em Couro com Bico de Composite e Palmilha Antiperfuro', '43123', '2028-06-18', 'Marluvas Calçados', 'Pés', 'Solado bidensidade antiderrapante com absorção de impacto.', 180, 40, 10, 145.00],
        [8, 'Cinto de Segurança tipo Paraquedista 4 Pontos com Talabarte Duplo em Y', '36676', '2028-10-05', 'Degomaster', 'Altura', 'Para retenção de quedas em trabalhos acima de 2 metros (NR-35).', 365, 18, 5, 220.00],
        [9, 'Luva Isolante de Borracha Classe 2 (17.000V) para Eletricista', '29810', '2027-12-01', 'Orion S/A', 'Mãos', 'Rigidez dielétrica conforme exigências da NR-10.', 180, 8, 2, 450.00]
    ];

    for (const epi of catalogoEpis) {
        db.prepare(`
            INSERT INTO epis (id, nome, ca_numero, ca_validade, fabricante, tipo_protecao, descricao, periodicidade_troca_dias, estoque_atual, estoque_minimo, custo_unitario)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...epi);
    }

    // 9. ENTREGAS DE EPIS AOS COLABORADORES (Ficha de EPI Digital)
    const entregas = [
        [1, 1, '2026-03-01', 1, 'Admissão', '2027-03-01'],
        [1, 4, '2026-03-01', 1, 'Admissão', '2028-03-01'],
        [1, 5, '2026-09-10', 10, 'Troca Periódica', '2026-09-25'],
        [1, 6, '2026-08-15', 2, 'Troca Periódica', '2026-09-30'],
        [1, 7, '2026-03-01', 1, 'Admissão', '2026-08-28'], // Expirado troca periódica! Alerta SST!
        [3, 1, '2026-01-10', 1, 'Admissão', '2027-01-10'],
        [3, 3, '2026-06-15', 1, 'Troca Periódica', '2026-12-15'],
        [5, 9, '2026-04-01', 1, 'Admissão', '2026-10-01'], // Perto de vencer (alerta!)
        [5, 7, '2026-04-01', 1, 'Admissão', '2026-09-28']
    ];

    for (const [colab_id, epi_id, data_ent, qtd, motivo, data_troca] of entregas) {
        db.prepare(`
            INSERT INTO epi_entregas (colaborador_id, epi_id, data_entrega, quantidade, motivo, data_prevista_troca, termo_responsabilidade_aceito)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(colab_id, epi_id, data_ent, qtd, motivo, data_troca);
    }

    // 10. RISCOS OCUPACIONAIS / PGR / GRO (NR-01)
    const riscos = [
        [1, 1, 'Físico', 'Ruído Contínuo / Intermitente', 'Operação de lixadeiras, corte a plasma e prensas', 'Perda Auditiva Induzida por Ruído (PAIR) e estresse', '01.01.001', 'Quantitativa', '88.4 dB(A)', '85.0 dB(A)', '80.0 dB(A)', 4, 3, 'Médio', 'Enclausuramento parcial e manutenção das máquinas', 'Implantar barreiras acústicas móveis', 0, 1],
        [1, 1, 'Químico', 'Fumos Metálicos de Solda (Manganês, Ferro, Ozônio)', 'Processo de soldagem MIG/MAG em aço carbono', 'Febre dos fumos metálicos, irritação de vias aéreas', '02.01.014', 'Quantitativa', '0.08 mg/m³', '0.10 mg/m³', '0.05 mg/m³', 3, 4, 'Alto', 'Exaustores pontuais e ventilação geral da nave', 'Instalação de braço exaustor articulado sobre cada bancada', 1, 1],
        [1, 1, 'Físico', 'Radiação Não Ionizante (Ultravioleta e Infravermelha)', 'Arco elétrico de soldagem', 'Queimaduras de pele e ceratite ocular', '01.01.018', 'Qualitativa', 'Presente no arco elétrico', 'N/A', 'N/A', 3, 3, 'Médio', 'Biombos de proteção de solda com PVC verde anti-UV', 'Substituição de biombos danificados', 1, 1],
        [2, 3, 'Físico', 'Ruído Intermitente', 'Usinagem de peças metálicas em centros CNC', 'Fadiga, cefaleia e perda auditiva gradual', '01.01.001', 'Quantitativa', '82.5 dB(A)', '85.0 dB(A)', '80.0 dB(A)', 3, 2, 'Baixo', 'Portas dos centros de usinagem com isolamento sonoro', 'Monitoramento semestral com dosimetria de ruído', 1, 1],
        [2, 3, 'Químico', 'Névoas de Óleo Solúvel / Fluido de Corte', 'Refrigeração de ferramentas durante usinagem', 'Dermatites de contato e afecções respiratórias', '02.01.025', 'Qualitativa', 'Névoa controlada', '5.0 mg/m³', '2.5 mg/m³', 2, 3, 'Médio', 'Cabines fechadas e filtros de retenção de névoa', 'Manutenção preventiva de filtros eletrostáticos', 1, 1],
        [4, 5, 'Acidente/Mecânico', 'Eletricidade em Alta/Baixa Tensão (Choque Elétrico e Arco)', 'Painéis de comando, disjuntores e subestações 440V', 'Fibrilação ventricular, queimaduras graves e óbito', '05.01.001', 'Qualitativa', 'Até 440 Volts', 'N/A', 'N/A', 2, 5, 'Alto', 'Procedimento de Bloqueio e Etiquetagem (LOTO), aterramento', 'Auditoria mensal do prontuário das instalações elétricas NR-10', 1, 1],
        [3, 4, 'Ergonômico', 'Vibração de Corpo Inteiro (VCI) e Postura Sentada Prolongada', 'Condução de empilhadeira em pisos irregulares', 'Dores lombares crônicas, hérnia de disco', '04.01.001', 'Quantitativa', '0.42 m/s²', '1.1 m/s²', '0.5 m/s²', 3, 3, 'Médio', 'Assentos ergonômicos com amortecimento pneumático', 'Pausas programadas e ginástica laboral', 0, 0]
    ];

    for (const r of riscos) {
        db.prepare(`
            INSERT INTO riscos_ocupacionais (
                setor_id, cargo_id, grupo_risco, perigo_fator, fonte_geradora,
                danos_saude, esocial_codigo, tipo_avaliacao, intensidade_concentracao,
                limite_tolerancia, nivel_acao, probabilidade, severidade, classificacao_risco,
                medidas_preventivas_existentes, medidas_propostas, epc_eficaz, epi_eficaz
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?
            )
        `).run(...r);
    }

    // 11. PLANO DE AÇÃO 5W2H (NR-01 PGR)
    const planos = [
        [2, 1, 'Instalar 3 braços articulados de exaustão localizada nas bancadas de solda', 'Reduzir concentração de fumos metálicos de manganês abaixo do nível de ação', 'Galpão 1 - Bancadas de Solda 01 a 03', 'Eng. Fábio Arruda / Manutenção', '2026-10-30', 'Aquisição de sistemas Nederman com filtros coalescentes', 35000.00, 'Em Andamento', 'Em fase de cotação final com fornecedor especializado.'],
        [1, 1, 'Substituir biombos de proteção de solda rasgados por cortinas anti-UV', 'Eliminar reflexo e dispersão de raios ultravioleta para pedestres no corredor', 'Corredor lateral da Caldeiraria', 'Téc. Lucas Almeida (SST)', '2026-09-15', 'Substituição das tiras de PVC verde especial com solda a quente', 3200.00, 'Concluído', 'Instalação concluída e validada pelo SESMT.'],
        [6, 4, 'Renovação do Prontuário das Instalações Elétricas conforme NR-10', 'Atendimento aos requisitos legais e garantia de segurança nas manobras', 'Subestação principal e CCMs', 'Eng. Marcos Vinícius Prado', '2026-11-15', 'Laudo pericial e ensaios dielétricos de EPIs e ferramentas', 12000.00, 'Pendente', 'Aguardando agendamento da empresa de ensaios dielétricos.']
    ];

    for (const p of planos) {
        db.prepare(`
            INSERT INTO planos_acao_5w2h (risco_id, setor_id, o_que, por_que, onde, quem, quando_prazo, como, quanto_custo, status, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...p);
    }

    // 12. PCMSO E EMISSÃO DE ASOS (NR-07)
    // João Silva: ASO Periódico válido
    db.prepare(`
        INSERT INTO asos (colaborador_id, tipo_aso, data_emissao, data_validade, aptidao, medico_examinador_nome, medico_examinador_crm, medico_examinador_uf, medico_coordenador_nome, medico_coordenador_crm, medico_coordenador_uf, exames_realizados, esocial_enviado, esocial_recibo)
        VALUES (1, 'Periódico', '2026-03-05', '2027-03-05', 'Apto', 'Dr. Henrique Cavalcanti', '182390', 'SP', 'Dra. Camila Sampaio Nogueira', '145890', 'SP', 'Avaliação Clínica Geral, Audiometria Tonal Ocupacional, Espirometria, Raio-X de Tórax Padrão OIT', 1, 'REC-ESOCIAL-20260305-18239')
    `).run();

    // Marcos Vinicius (Eletricista): ASO a vencer em breve! Alerta médico!
    db.prepare(`
        INSERT INTO asos (colaborador_id, tipo_aso, data_emissao, data_validade, aptidao, medico_examinador_nome, medico_examinador_crm, medico_examinador_uf, medico_coordenador_nome, medico_coordenador_crm, medico_coordenador_uf, exames_realizados, esocial_enviado, esocial_recibo)
        VALUES (5, 'Periódico', '2025-10-10', '2026-10-10', 'Apto', 'Dr. Henrique Cavalcanti', '182390', 'SP', 'Dra. Camila Sampaio Nogueira', '145890', 'SP', 'Exame Clínico Ocupacional, Eletrocardiograma (ECG), Eletroencefalograma (EEG), Glicemia de Jejum', 1, 'REC-ESOCIAL-20251010-44910')
    `).run();

    // Ana Paula: ASO Periódico válido
    db.prepare(`
        INSERT INTO asos (colaborador_id, tipo_aso, data_emissao, data_validade, aptidao, medico_examinador_nome, medico_examinador_crm, medico_examinador_uf, medico_coordenador_nome, medico_coordenador_crm, medico_coordenador_uf, exames_realizados, esocial_enviado)
        VALUES (3, 'Periódico', '2026-01-15', '2027-01-15', 'Apto', 'Dra. Camila Sampaio Nogueira', '145890', 'SP', 'Dra. Camila Sampaio Nogueira', '145890', 'SP', 'Avaliação Clínica, Audiometria Tonal, Acuidade Visual Snellen', 1)
    `).run();

    // Roberto Albuquerque: ASO de Retorno ao Trabalho agendado após afastamento
    db.prepare(`
        INSERT INTO asos (colaborador_id, tipo_aso, data_emissao, data_validade, aptidao, medico_examinador_nome, medico_examinador_crm, medico_examinador_uf, medico_coordenador_nome, medico_coordenador_crm, medico_coordenador_uf, exames_realizados, esocial_enviado)
        VALUES (2, 'Retorno ao Trabalho', '2026-09-20', '2027-09-20', 'Apto', 'Dra. Camila Sampaio Nogueira', '145890', 'SP', 'Dra. Camila Sampaio Nogueira', '145890', 'SP', 'Avaliação Clínica Ocupacional e Inspeção de Cicatriz Cirúrgica da mão esquerda.', 0)
    `).run();

    // 13. CATÁLOGO DE TREINAMENTOS DE NRS
    const treinamentos = [
        [1, 'NR-01', 'Treinamento Admissional e de Integração em SST', 4, 24, 'Direitos e deveres, perigos da fábrica, rotas de fuga, uso de EPI e comunicação de acidentes.'],
        [2, 'NR-06', 'Uso, Higienização, Guarda e Conservação de EPIs', 2, 24, 'Instruções práticas de uso de protetores auriculares, respiradores e calçados de segurança.'],
        [3, 'NR-10', 'Segurança em Instalações e Serviços em Eletricidade - Básico', 40, 24, 'Riscos em eletricidade, medidas de controle, combate a incêndio e primeiros socorros.'],
        [4, 'NR-11', 'Operação Segura de Empilhadeiras e Equipamentos de Guindar', 16, 12, 'Equilíbrio da carga, centro de gravidade, checklist diário e regras de circulação.'],
        [5, 'NR-12', 'Segurança no Trabalho em Máquinas e Equipamentos', 16, 24, 'Sistemas de parada de emergência, zonas de perigo, intertravamentos e procedimentos seguros.'],
        [6, 'NR-35', 'Trabalho em Altura - Capacitação Básica', 8, 24, 'Análise de Risco, linhas de vida, inspeção de cinturões e procedimentos em emergências.']
    ];

    for (const t of treinamentos) {
        db.prepare(`
            INSERT INTO treinamentos_catalogo (id, norma, titulo, carga_horaria_horas, validade_meses, conteudo_programatico)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(...t);
    }

    // 14. REGISTRO DE TREINAMENTOS REALIZADOS
    db.prepare(`
        INSERT INTO treinamentos_realizados (treinamento_id, colaborador_id, data_realizacao, data_vencimento, instrutor_nome, instrutor_qualificacao, entidade_formadora, aproveitamento_nota, status, certificado_numero)
        VALUES (1, 1, '2024-03-01', '2026-03-01', 'Eng. Marcos Vinicius Prado', 'Engenheiro de Segurança', 'SESMT MetalSul', 9.5, 'Vencido', 'CERT-NR01-2024-0101')
    `).run();

    db.prepare(`
        INSERT INTO treinamentos_realizados (treinamento_id, colaborador_id, data_realizacao, data_vencimento, instrutor_nome, instrutor_qualificacao, entidade_formadora, aproveitamento_nota, status, certificado_numero)
        VALUES (3, 5, '2024-11-20', '2026-11-20', 'Prof. Ricardo Mendes', 'Engenheiro Eletricista e Perito', 'SENAI Campinas', 10.0, 'A Vencer', 'CERT-NR10-SENAI-88192')
    `).run();

    db.prepare(`
        INSERT INTO treinamentos_realizados (treinamento_id, colaborador_id, data_realizacao, data_vencimento, instrutor_nome, instrutor_qualificacao, entidade_formadora, aproveitamento_nota, status, certificado_numero)
        VALUES (4, 4, '2025-10-15', '2026-10-15', 'Instrutor Carlos Alberto Ramos', 'Instrutor Técnico Homologado', 'SEST/SENAT', 9.0, 'A Vencer', 'CERT-NR11-SEST-33019')
    `).run();

    db.prepare(`
        INSERT INTO treinamentos_realizados (treinamento_id, colaborador_id, data_realizacao, data_vencimento, instrutor_nome, instrutor_qualificacao, entidade_formadora, aproveitamento_nota, status, certificado_numero)
        VALUES (6, 1, '2025-05-10', '2027-05-10', 'Téc. Lucas Ramos de Almeida', 'Técnico de Segurança do Trabalho', 'SESMT MetalSul', 9.8, 'Válido', 'CERT-NR35-2025-0012')
    `).run();

    // 15. ACIDENTES DE TRABALHO E CAT (S-2210)
    db.prepare(`
        INSERT INTO acidentes_cat (
            id, colaborador_id, data_acidente, hora_acidente, tipo_acidente,
            houve_afastamento, dias_afastamento, houve_obito, local_acidente,
            parte_corpo_atingida, agente_causador, situacao_geradora,
            descricao_acidente, investigacao_arvore_causas, medidas_corretivas_adotadas,
            atendimento_medico_local, medico_atendente_crm, numero_cat, data_emissao_cat,
            esocial_enviado, esocial_recibo
        ) VALUES (
            1, 2, '2026-09-16', '10:45', 'Típico',
            1, 4, 0, 'Setor de Produção e Caldeiraria - Mesa de Corte 02',
            'Dedo indicador da mão esquerda', 'Chapa de aço com rebarba cortante', 'Manuseio manual de peças após corte a plasma',
            'Durante o descarregamento da chapa cortada na mesa da máquina plasma, o colaborador retirou as luvas para desatar amarra e foi atingido pela aresta viva da chapa.',
            'Árvore de Causas: Não utilização contínua da luva de vaqueta -> Peça com rebarba cortante não desbastada -> Pressa no descarregamento -> Falta de dispositivo pega-chapa magnético.',
            'Disponibilizado suporte magnético de arraste para chapas; Realizado DDS extraordinário com a equipe sobre a obrigatoriedade inegociável do uso das luvas de couro.',
            'Pronto Atendimento Municipal de Campinas', '112440', 'CAT-2026-09-00142', '2026-09-17',
            1, 'REC-ESOCIAL-S2210-20260917-8831'
        )
    `).run();

    // 16. ORDENS DE SERVIÇO NR-01
    db.prepare(`
        INSERT INTO ordens_servico_nr01 (cargo_id, atividades_desenvolvidas, riscos_funcao, epis_obrigatorios, medidas_preventivas, normas_proibicoes, punicoes_previstas, revisao, data_aprovacao)
        VALUES (
            1,
            'Preparação, traçagem, corte e soldagem elétrica e a gás em peças metálicas, montagem de gabaritos e união de estruturas.',
            'Físicos: Ruído, calor radiante, radiação ultravioleta. Químicos: Fumos de solda e ozônio. Acidentes: Projeção de fagulhas, queimaduras.',
            'Óculos de ampla visão incolor, Máscara de solda automática, Protetor auditivo concha, Respirador PFF2 valvulado, Luva de vaqueta/raspa cano longo, Avental e perneira de raspa, Botina com bico composite.',
            'Ligar sistema de exaustão móvel antes de iniciar o arco; Utilizar biombos para proteger colegas circundantes; Inspecionar cabos de aterramento e tochas.',
            'É terminantemente proibido soldar sem máscara de proteção, fumar na área fabril, ou operar maçarico sem válvula corta-chama.',
            'Advertência verbal, advertência formal por escrito, suspensão disciplinar e demissão por justa causa (Art. 158 da CLT).',
            '03', '2026-01-10'
        )
    `).run();

    // 17. CENTRAL ESOCIAL - EVENTOS ARMAZENADOS
    const xmlS2210Exemplo = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_02_00">
  <evtCAT Id="ID11823456700018920260917104500001">
    <ideEvento>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>SafeWork-1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>18234567000189</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>31945874122</cpfTrab>
      <matricula>MAT-00102</matricula>
    </ideTrabalhador>
    <cat>
      <dtAcid>2026-09-16</dtAcid>
      <tpAcid>1</tpAcid>
      <hrAcid>1045</hrAcid>
      <tpCat>1</tpCat>
      <localAcidente>
        <tpLocal>1</tpLocal>
        <dscLocal>Setor de Produção e Caldeiraria - Mesa de Corte 02</dscLocal>
      </localAcidente>
      <parteAtingida>
        <codParteAting>704010000</codParteAting>
      </parteAtingida>
      <agenteCausador>
        <codAgntCausador>303030100</codAgntCausador>
      </agenteCausador>
      <atestado>
        <dtAtendimento>2026-09-16</dtAtendimento>
        <hrAtendimento>1130</hrAtendimento>
        <durTrat>4</durTrat>
        <codCID>S610</codCID>
        <nrCRM>112440</nrCRM>
        <ufCRM>SP</ufCRM>
      </atestado>
    </cat>
  </evtCAT>
</eSocial>`;

    db.prepare(`
        INSERT INTO esocial_eventos (evento_tipo, referencia_id, colaborador_id, xml_conteudo, status, recibo_protocolo, mensagem_retorno)
        VALUES ('S-2210', 1, 2, ?, 'Transmitido', 'REC-ESOCIAL-S2210-20260917-8831', 'Lote processado com sucesso pelo ambiente de produção do eSocial.')
    `).run(xmlS2210Exemplo);

    // 18. USUÁRIOS E CONTROLE DE ACESSO
    const uAdmin = hashPassword('admin123');
    db.prepare(`
        INSERT INTO usuarios (nome, email, login, senha_hash, salt, perfil, ativo)
        VALUES ('Administrador Geral', 'admin@metalsul.com.br', 'admin', ?, ?, 'Administrador', 1)
    `).run(uAdmin.hash, uAdmin.salt);

    const uDp = hashPassword('carlos123');
    db.prepare(`
        INSERT INTO usuarios (nome, email, login, senha_hash, salt, perfil, ativo)
        VALUES ('Carlos Eduardo Vilela', 'carlos.dp@metalsul.com.br', 'carlos.dp', ?, ?, 'Gestor DP', 1)
    `).run(uDp.hash, uDp.salt);

    const uSst = hashPassword('marcos123');
    db.prepare(`
        INSERT INTO usuarios (nome, email, login, senha_hash, salt, perfil, ativo)
        VALUES ('Eng. Marcos Vinícius Prado', 'marcos.sst@metalsul.com.br', 'marcos.sst', ?, ?, 'Técnico SST', 1)
    `).run(uSst.hash, uSst.salt);

    console.log('[SafeWork Seed] Carga inicial concluída com sucesso!');
}

if (require.main === module) {
    runSeed();
}

module.exports = { runSeed };
