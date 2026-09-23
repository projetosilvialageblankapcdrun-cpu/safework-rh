// ====================================================================
// SafeWork RH & SST - Módulo de Impressão de Documentos Oficiais (A4)
// Emissão de ASO (2 vias), Ficha de EPI (NR-06), O.S. (NR-01) e PPP
// ====================================================================

const PrintService = {
    // 1. IMPRIMIR ASO OFICIAL (NR-07) - 2 VIAS
    imprimirAso(aso) {
        const printContainer = document.getElementById('print-container');
        if (!printContainer) return;

        const renderVia = (viaTitulo) => `
            <div class="print-doc">
                <div class="print-header">
                    <div style="font-size: 16pt; font-weight: bold;">${aso.empresa_nome || 'METAL SUL INDÚSTRIA METALÚRGICA S/A'}</div>
                    <div style="font-size: 9pt; color: #555;">CNPJ: ${aso.empresa_cnpj || '18.234.567/0001-89'} | ${aso.empresa_endereco || 'Av. Industrial das Américas, 4500 - Campinas/SP'}</div>
                    <div class="print-title" style="margin-top: 10px;">ATESTADO DE SAÚDE OCUPACIONAL - ASO</div>
                    <div style="font-size: 10pt; font-weight: bold; color: #333;">(${viaTitulo} - NR-07 / Portaria MTP nº 6734)</div>
                </div>

                <div class="print-section">
                    <div class="print-section-title">1. Dados do Trabalhador</div>
                    <table style="width: 100%; font-size: 10pt;">
                        <tr>
                            <td><strong>Nome:</strong> ${aso.colaborador_nome}</td>
                            <td><strong>CPF:</strong> ${aso.cpf}</td>
                            <td><strong>Matrícula:</strong> ${aso.matricula}</td>
                        </tr>
                        <tr>
                            <td><strong>Função / Cargo:</strong> ${aso.cargo_nome}</td>
                            <td><strong>CBO:</strong> ${aso.cbo}</td>
                            <td><strong>Setor:</strong> ${aso.setor_nome}</td>
                        </tr>
                        <tr>
                            <td><strong>Tipo de Exame:</strong> <span style="text-decoration: underline; font-weight: bold;">${aso.tipo_aso.toUpperCase()}</span></td>
                            <td><strong>Data do Exame:</strong> ${aso.data_emissao}</td>
                            <td><strong>Validade:</strong> ${aso.data_validade}</td>
                        </tr>
                    </table>
                </div>

                <div class="print-section">
                    <div class="print-section-title">2. Riscos Ocupacionais Identificados no PGR</div>
                    <p style="font-size: 9.5pt; margin-bottom: 5px;">Riscos Físicos, Químicos, Biológicos, Ergonômicos e de Acidentes mapeados no Programa de Gerenciamento de Riscos (NR-01):</p>
                    <p style="font-size: 9.5pt; font-style: italic;">• Ruído Contínuo/Intermitente; Fumos Metálicos de Soldagem; Radiação Não-Ionizante; Posturas Inadequadas.</p>
                </div>

                <div class="print-section">
                    <div class="print-section-title">3. Procedimentos Médicos e Exames Complementares Realizados</div>
                    <p style="font-size: 9.5pt;">${aso.exames_realizados || 'Avaliação Clínica Geral e Anamnese Ocupacional.'}</p>
                </div>

                <div class="print-section" style="border: 2px solid #000; text-align: center; padding: 15px;">
                    <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase;">4. Conclusão Diagnóstica de Aptidão</div>
                    <div style="font-size: 16pt; font-weight: 900; margin: 10px 0; color: ${aso.aptidao === 'Apto' ? '#047857' : '#b91c1c'};">
                        [ ${aso.aptidao.toUpperCase()} ] PARA A FUNÇÃO
                    </div>
                    ${aso.restricoes_detalhes ? `<div style="font-size: 9pt; color: #b91c1c;"><strong>Restrições:</strong> ${aso.restricoes_detalhes}</div>` : ''}
                </div>

                <div class="print-section">
                    <div class="print-section-title">5. Responsáveis Médicos</div>
                    <table style="width: 100%; font-size: 9.5pt;">
                        <tr>
                            <td><strong>Médico Examinador:</strong> ${aso.medico_examinador_nome}</td>
                            <td><strong>CRM:</strong> ${aso.medico_examinador_crm}/${aso.medico_examinador_uf}</td>
                        </tr>
                        <tr>
                            <td><strong>Médico Coordenador do PCMSO:</strong> ${aso.medico_coordenador_nome || 'Dra. Camila Sampaio Nogueira'}</td>
                            <td><strong>CRM:</strong> ${aso.medico_coordenador_crm || '145890'}/${aso.medico_coordenador_uf || 'SP'}</td>
                        </tr>
                    </table>
                </div>

                <div class="print-signatures">
                    <div class="signature-line">
                        <strong>${aso.medico_examinador_nome}</strong><br>
                        CRM/${aso.medico_examinador_uf} nº ${aso.medico_examinador_crm}<br>
                        Médico Examinador
                    </div>
                    <div class="signature-line">
                        <strong>${aso.colaborador_nome}</strong><br>
                        Assinatura do Trabalhador<br>
                        Declaro ter recebido a 2ª via deste ASO
                    </div>
                </div>
            </div>
        `;

        printContainer.innerHTML = renderVia('1ª VIA - EMPREGADOR') + renderVia('2ª VIA - EMPREGADO');
        window.print();
    },

    // 2. IMPRIMIR FICHA INDIVIDUAL DE EPI (NR-06)
    imprimirFichaEpi(data) {
        const printContainer = document.getElementById('print-container');
        if (!printContainer) return;

        const { colaborador, entregas } = data;

        let linhasTabela = '';
        entregas.forEach((ent, idx) => {
            linhasTabela += `
                <tr>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #333; padding: 6px;">${ent.epi_nome}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center; font-weight: bold;">${ent.ca_numero}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${ent.data_entrega}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${ent.quantidade}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${ent.motivo}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center; font-size: 8pt;">Assinado Digitalmente</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${ent.devolvido ? ent.data_devolucao : '-'}</td>
                </tr>
            `;
        });

        printContainer.innerHTML = `
            <div class="print-doc">
                <div class="print-header">
                    <div style="font-size: 15pt; font-weight: bold;">${colaborador.empresa_nome || 'METAL SUL INDÚSTRIA METALÚRGICA S/A'}</div>
                    <div style="font-size: 9pt; color: #555;">CNPJ: ${colaborador.empresa_cnpj || '18.234.567/0001-89'}</div>
                    <div class="print-title" style="margin-top: 10px;">FICHA DE CONTROLE E ENTREGA DE EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPI)</div>
                    <div style="font-size: 9.5pt; font-weight: bold; color: #333;">(Em conformidade com a Norma Regulamentadora NR-06 da Portaria MTP nº 4.219 e Art. 158 da CLT)</div>
                </div>

                <div class="print-section">
                    <div class="print-section-title">Dados do Colaborador</div>
                    <table style="width: 100%; font-size: 10pt;">
                        <tr>
                            <td><strong>Colaborador:</strong> ${colaborador.nome}</td>
                            <td><strong>Matrícula:</strong> ${colaborador.matricula}</td>
                            <td><strong>CPF:</strong> ${colaborador.cpf}</td>
                        </tr>
                        <tr>
                            <td><strong>Função / Cargo:</strong> ${colaborador.cargo_nome}</td>
                            <td><strong>CBO:</strong> ${colaborador.cbo}</td>
                            <td><strong>Setor:</strong> ${colaborador.setor_nome}</td>
                        </tr>
                        <tr>
                            <td><strong>Data de Admissão:</strong> ${colaborador.data_admissao}</td>
                            <td><strong>Jornada:</strong> ${colaborador.jornada_semanal}h semanais</td>
                            <td><strong>Status:</strong> ${colaborador.status}</td>
                        </tr>
                    </table>
                </div>

                <div class="print-section" style="background: #fafafa; font-size: 8.5pt; text-align: justify; line-height: 1.3;">
                    <div class="print-section-title">Termo de Responsabilidade e Ciência (Art. 158 da CLT e NR-06)</div>
                    Recebi da empresa os Equipamentos de Proteção Individual (EPI) constantes nesta ficha, novos e em perfeito estado de conservação, com os respectivos Certificados de Aprovação (CA) válidos. Declaro ter recebido treinamento adequado e orientação teórica e prática para a guarda, higienização, conservação e uso obrigatório durante todo o exercício de minhas funções. Comprometo-me a:
                    <ol style="margin-left: 20px; margin-top: 4px;">
                        <li>Usar o EPI fornecido exclusivamente para a finalidade a que se destina;</li>
                        <li>Responsabilizar-me pela guarda, conservação e limpeza periódica do equipamento;</li>
                        <li>Comunicar imediatamente ao SESMT/Chefia qualquer alteração ou dano que o torne impróprio para uso;</li>
                        <li>Devolver o EPI usado quando da substituição ou no término do contrato de trabalho;</li>
                        <li>Estar ciente de que a recusa injustificada em usar o EPI constitui falta grave sujeita a demissão por justa causa (Art. 158 e 482 da CLT).</li>
                    </ol>
                </div>

                <div class="print-section">
                    <div class="print-section-title">Histórico de Equipamentos Fornecidos</div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
                        <thead>
                            <tr style="background: #eee;">
                                <th style="border: 1px solid #333; padding: 5px;">Item</th>
                                <th style="border: 1px solid #333; padding: 5px;">Descrição do EPI</th>
                                <th style="border: 1px solid #333; padding: 5px;">Nº CA</th>
                                <th style="border: 1px solid #333; padding: 5px;">Data Entrega</th>
                                <th style="border: 1px solid #333; padding: 5px;">Qtd</th>
                                <th style="border: 1px solid #333; padding: 5px;">Motivo</th>
                                <th style="border: 1px solid #333; padding: 5px;">Assinatura Recebimento</th>
                                <th style="border: 1px solid #333; padding: 5px;">Devolução</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasTabela}
                        </tbody>
                    </table>
                </div>

                <div class="print-signatures" style="margin-top: 30px;">
                    <div class="signature-line">
                        <strong>Responsável SESMT / Almoxarifado</strong><br>
                        Entrega e Controle de EPI
                    </div>
                    <div class="signature-line">
                        <strong>${colaborador.nome}</strong><br>
                        Assinatura do Trabalhador
                    </div>
                </div>
            </div>
        `;

        window.print();
    },

    // 3. IMPRIMIR ORDEM DE SERVIÇO NR-01
    imprimirOrdemServico(os, colaborador = null) {
        const printContainer = document.getElementById('print-container');
        if (!printContainer) return;

        const formatarTexto = (txt) => {
            if (!txt) return 'Não aplicável.';
            return txt.replace(/\n/g, '<br>');
        };

        const nomeColab = os.colaborador_nome || colaborador?.nome || '__________________________________________________';
        const cpfColab = os.colaborador_cpf || colaborador?.cpf || '___.___.___-__';
        const matColab = os.colaborador_matricula || colaborador?.matricula || 'MAT-______';
        const setorNome = os.setor_nome || colaborador?.setor_nome || 'Operacional';
        const cargoNome = os.cargo_nome || colaborador?.cargo_nome || 'Função Operacional';
        const cbo = os.cbo || colaborador?.cbo || 'N/A';
        const dataEmissao = os.data_aprovacao || new Date().toISOString().split('T')[0];
        const revisao = os.revisao || '01';

        printContainer.innerHTML = `
            <div class="print-doc">
                <div class="print-header">
                    <div style="font-size: 15pt; font-weight: bold;">${os.empresa_nome || 'METAL SUL INDÚSTRIA METALÚRGICA S/A'}</div>
                    <div style="font-size: 8.5pt; color: #555;">CNPJ: ${os.empresa_cnpj || '18.234.567/0001-89'} | CNAE: 25.11-0 | Grau de Risco: 3 (NR-04)</div>
                    <div class="print-title" style="margin-top: 8px;">ORDEM DE SERVIÇO DE SEGURANÇA E SAÚDE DO TRABALHO (O.S.)</div>
                    <div style="font-size: 9.5pt; font-weight: bold; color: #333;">(Em conformidade com a Norma Regulamentadora NR-01, Portaria MTP nº 6.730 e Art. 157 da CLT)</div>
                </div>

                <div class="print-section">
                    <div class="print-section-title">Identificação do Trabalhador e da Atividade</div>
                    <table style="width: 100%; font-size: 9.5pt; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 3px 0;"><strong>Trabalhador:</strong> ${nomeColab}</td>
                            <td style="padding: 3px 0;"><strong>CPF:</strong> ${cpfColab}</td>
                            <td style="padding: 3px 0;"><strong>Matrícula:</strong> ${matColab}</td>
                        </tr>
                        <tr>
                            <td style="padding: 3px 0;"><strong>Função / Cargo:</strong> ${cargoNome}</td>
                            <td style="padding: 3px 0;"><strong>CBO:</strong> ${cbo}</td>
                            <td style="padding: 3px 0;"><strong>Setor:</strong> ${setorNome}</td>
                        </tr>
                        <tr>
                            <td style="padding: 3px 0;"><strong>Data de Emissão:</strong> ${dataEmissao}</td>
                            <td style="padding: 3px 0;"><strong>Revisão:</strong> Rev. ${revisao}</td>
                            <td style="padding: 3px 0;"><strong>Status:</strong> Aprovada pelo SESMT</td>
                        </tr>
                        <tr>
                            <td colspan="3" style="padding-top: 6px; border-top: 1px dotted #ccc;">
                                <strong>Descrição Sumária das Atividades:</strong><br>
                                <span style="font-size: 9pt;">${formatarTexto(os.atividades_desenvolvidas)}</span>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="print-section">
                    <div class="print-section-title">1. Riscos Ocupacionais Identificados no PGR (NR-01)</div>
                    <div style="font-size: 9pt; line-height: 1.4;">${formatarTexto(os.riscos_funcao)}</div>
                </div>

                <div class="print-section">
                    <div class="print-section-title">2. Equipamentos de Proteção Individual (EPIs) de Uso Obrigatório (NR-06)</div>
                    <div style="font-size: 9pt; line-height: 1.4;">${formatarTexto(os.epis_obrigatorios)}</div>
                </div>

                <div class="print-section">
                    <div class="print-section-title">3. Medidas Preventivas e Procedimentos Operacionais Seguros</div>
                    <div style="font-size: 9pt; line-height: 1.4;">${formatarTexto(os.medidas_preventivas)}</div>
                </div>

                <div class="print-section">
                    <div class="print-section-title">4. Proibições Expressas e Obrigações Legais</div>
                    <div style="font-size: 9pt; line-height: 1.4;">${formatarTexto(os.normas_proibicoes)}</div>
                </div>

                ${os.procedimentos_acidente ? `
                <div class="print-section">
                    <div class="print-section-title">5. Procedimentos em Caso de Acidente ou Emergência</div>
                    <div style="font-size: 9pt; line-height: 1.4;">${formatarTexto(os.procedimentos_acidente)}</div>
                </div>` : ''}

                <div class="print-section">
                    <div class="print-section-title">${os.procedimentos_acidente ? '6' : '5'}. Punições Disciplinares pelo Descumprimento das Normas</div>
                    <div style="font-size: 9pt; line-height: 1.4;">${formatarTexto(os.punicoes_previstas)}</div>
                </div>

                <div class="print-section" style="font-size: 8.5pt; background: #fafafa; line-height: 1.3;">
                    <div class="print-section-title">Termo de Recebimento, Ciência e Compromisso (Art. 158 da CLT)</div>
                    Declaro que recebi uma via da presente Ordem de Serviço de Segurança e Saúde no Trabalho da NR-01, tendo sido devidamente orientado, capacitado e instruído sobre os perigos, riscos, medidas de controle e uso obrigatório de EPIs inerentes à minha atividade. Comprometo-me a cumprir integralmente todas as determinações de segurança e estou ciente de que o descumprimento injustificado constitui ato faltoso passível de punição disciplinar conforme a CLT.
                </div>

                <div class="print-signatures" style="margin-top: 35px;">
                    <div class="signature-line">
                        <strong>SESMT / Engenharia de Segurança</strong><br>
                        Responsável pela Emissão
                    </div>
                    <div class="signature-line">
                        <strong>${nomeColab}</strong><br>
                        Assinatura do Trabalhador<br>
                        Data: ____/____/________
                    </div>
                </div>
            </div>
        `;

        window.print();
    },

    // 4. IMPRIMIR PPP ELETRÔNICO (PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO)
    imprimirPpp(data) {
        const printContainer = document.getElementById('print-container');
        if (!printContainer) return;

        const { colaborador, riscos, epis, asos } = data;

        let riscosRows = '';
        riscos.forEach(r => {
            riscosRows += `
                <tr>
                    <td style="border: 1px solid #333; padding: 4px;">${r.grupo_risco}</td>
                    <td style="border: 1px solid #333; padding: 4px;">${r.perigo_fator}</td>
                    <td style="border: 1px solid #333; padding: 4px; text-align: center;">${r.tipo_avaliacao}</td>
                    <td style="border: 1px solid #333; padding: 4px; text-align: center;">${r.intensidade_concentracao || 'N/A'}</td>
                    <td style="border: 1px solid #333; padding: 4px; text-align: center;">${r.epc_eficaz ? 'Sim' : 'Não'}</td>
                    <td style="border: 1px solid #333; padding: 4px; text-align: center;">${r.epi_eficaz ? 'Sim' : 'Não'}</td>
                    <td style="border: 1px solid #333; padding: 4px; text-align: center;">${r.esocial_codigo || '01.01.001'}</td>
                </tr>
            `;
        });

        printContainer.innerHTML = `
            <div class="print-doc">
                <div class="print-header">
                    <div style="font-size: 15pt; font-weight: bold;">MINISTÉRIO DA PREVIDÊNCIA SOCIAL - INSS</div>
                    <div class="print-title" style="margin-top: 5px;">PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO - PPP</div>
                    <div style="font-size: 8.5pt; color: #555;">(Instrução Normativa PRES/INSS nº 128/2022 e Evento S-2240 eSocial)</div>
                </div>

                <div class="print-section">
                    <div class="print-section-title">Seção I - Dados Administrativos</div>
                    <table style="width: 100%; font-size: 9pt;">
                        <tr>
                            <td><strong>Empresa:</strong> ${colaborador.empresa_nome}</td>
                            <td><strong>CNPJ:</strong> ${colaborador.empresa_cnpj}</td>
                            <td><strong>CNAE:</strong> ${colaborador.empresa_cnae}</td>
                            <td><strong>Grau de Risco:</strong> ${colaborador.empresa_grau_risco}</td>
                        </tr>
                        <tr>
                            <td><strong>Trabalhador:</strong> ${colaborador.nome}</td>
                            <td><strong>CPF:</strong> ${colaborador.cpf}</td>
                            <td><strong>Matrícula:</strong> ${colaborador.matricula}</td>
                            <td><strong>CTPS:</strong> ${colaborador.ctps_numero || 'N/A'}/${colaborador.ctps_serie || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Setor:</strong> ${colaborador.setor_nome}</td>
                            <td><strong>Cargo:</strong> ${colaborador.cargo_nome}</td>
                            <td><strong>CBO:</strong> ${colaborador.cbo}</td>
                            <td><strong>Data Admissão:</strong> ${colaborador.data_admissao}</td>
                        </tr>
                    </table>
                </div>

                <div class="print-section">
                    <div class="print-section-title">Seção II - Registros Ambientais e Fatores de Risco (S-2240)</div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
                        <thead>
                            <tr style="background: #eee;">
                                <th style="border: 1px solid #333; padding: 4px;">Tipo</th>
                                <th style="border: 1px solid #333; padding: 4px;">Fator de Risco / Agente Nocivo</th>
                                <th style="border: 1px solid #333; padding: 4px;">Avaliação</th>
                                <th style="border: 1px solid #333; padding: 4px;">Intensidade/Conc.</th>
                                <th style="border: 1px solid #333; padding: 4px;">EPC Eficaz</th>
                                <th style="border: 1px solid #333; padding: 4px;">EPI Eficaz</th>
                                <th style="border: 1px solid #333; padding: 4px;">Cód eSocial</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${riscosRows || '<tr><td colspan="7" style="text-align: center; padding: 8px;">Ausência de agentes nocivos.</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div class="print-section">
                    <div class="print-section-title">Seção III - Responsáveis pelos Registros Ambientais e Monitoramento Biológico</div>
                    <table style="width: 100%; font-size: 8.5pt;">
                        <tr>
                            <td><strong>Responsável SST:</strong> ${colaborador.responsavel_sst_nome || 'Eng. Marcos Vinicius Prado'}</td>
                            <td><strong>Registro Profissional:</strong> ${colaborador.responsavel_sst_registro || 'CREA/SP 5061234567'}</td>
                        </tr>
                    </table>
                </div>

                <div class="print-signatures" style="margin-top: 40px;">
                    <div class="signature-line">
                        <strong>Representante Legal da Empresa</strong><br>
                        Assinatura com Certificado Digital
                    </div>
                </div>
            </div>
        `;

        window.print();
    },

    // 5. IMPRIMIR CERTIFICADO DE TREINAMENTO OFICIAL EAD (NR-01 ANEXO II)
    imprimirCertificadoTreinamentoEad(cert) {
        const printContainer = document.getElementById('print-container');
        if (!printContainer) return;

        const dataConclusaoFmt = cert.data_conclusao ? new Date(cert.data_conclusao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
        const dataMatriculaFmt = cert.data_matricula ? new Date(cert.data_matricula).toLocaleDateString('pt-BR') : dataConclusaoFmt;

        const programaLinhas = (cert.conteudo_programatico || '')
            .split('\n')
            .filter(l => l.trim())
            .map(l => `<li style="margin-bottom: 4px;">${l}</li>`)
            .join('');

        printContainer.innerHTML = `
            <div class="print-doc" style="border: 6px double #0284c7; padding: 25px 30px; background: #ffffff; min-height: 980px; position: relative;">
                <!-- Cabeçalho -->
                <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="font-size: 20pt; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
                        ${cert.empresa_razao || 'MetalSul Estruturas Metálicas e Caldeiraria S/A'}
                    </div>
                    <div style="font-size: 8.5pt; color: #64748b; margin-top: 3px;">
                        CNPJ: ${cert.empresa_cnpj || '18.234.567/0001-89'} | CNAE: ${cert.empresa_cnae || '25.11-0'} | ${cert.empresa_cidade || 'Campinas'}/${cert.empresa_uf || 'SP'}
                    </div>
                    <div style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 14px; border-radius: 20px; font-weight: 700; font-size: 8.5pt; margin-top: 8px;">
                        SISTEMA DE GESTÃO DE SEGURANÇA E SAÚDE NO TRABALHO - ACADEMIA CORPORATIVA
                    </div>
                </div>

                <!-- Título do Certificado -->
                <div style="text-align: center; margin: 25px 0 20px;">
                    <div style="font-size: 26pt; font-weight: 900; color: #0284c7; letter-spacing: 0.08em; font-family: 'Times New Roman', serif;">
                        CERTIFICADO
                    </div>
                    <div style="font-size: 10pt; font-weight: bold; color: #334155; text-transform: uppercase; margin-top: 4px;">
                        DE CAPACITAÇÃO E TREINAMENTO PROFISSIONAL EM SEGURANÇA DO TRABALHO
                    </div>
                    <div style="font-size: 8.5pt; color: #64748b; font-style: italic;">
                        Conforme requisitos legais do Anexo II da Norma Regulamentadora NR-01 (Portaria SEPRT nº 6.730)
                    </div>
                </div>

                <!-- Texto de Conclusão -->
                <div style="font-size: 11.5pt; line-height: 1.8; text-align: justify; margin: 25px 10px; color: #1e293b;">
                    Certificamos que o(a) colaborador(a) <strong>${cert.colaborador_nome.toUpperCase()}</strong>, 
                    inscrito(a) no CPF sob o nº <strong>${cert.colaborador_cpf}</strong>, 
                    matrícula <strong>${cert.colaborador_matricula || 'MAT-00000'}</strong>, ocupante da função de 
                    <strong>${cert.cargo_nome}</strong> (CBO: ${cert.cbo || '---'}), lotado(a) no setor <strong>${cert.setor_nome}</strong>, 
                    concluiu com êxito na modalidade <strong>Ensino a Distância (EAD) / Rastreável</strong> o treinamento:
                </div>

                <!-- Destaque do Curso -->
                <div style="background: #f8fafc; border-left: 5px solid #0284c7; border-right: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 14px 20px; border-radius: 6px; margin: 15px 10px 25px; text-align: center;">
                    <div style="font-size: 15pt; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                        ${cert.curso_titulo}
                    </div>
                    <div style="display: flex; justify-content: center; gap: 25px; margin-top: 8px; font-size: 9.5pt; color: #475569;">
                        <span><strong>Carga Horária:</strong> ${cert.carga_horaria_horas} horas</span>
                        <span><strong>Período:</strong> ${dataMatriculaFmt} a ${dataConclusaoFmt}</span>
                        <span><strong>Aproveitamento Final:</strong> ${cert.nota_final ? cert.nota_final.toFixed(1) + '%' : '100%'}</span>
                        <span><strong>Classificação:</strong> <span style="color: #16a34a; font-weight: bold;">APROVADO</span></span>
                    </div>
                </div>

                <!-- Conteúdo Programático -->
                <div style="margin: 20px 10px; font-size: 9pt;">
                    <div style="font-weight: bold; color: #0f172a; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">
                        Conteúdo Programático Cumprido (NR-01 Anexo II):
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.5;">
                        ${programaLinhas || '<li>Conceitos gerais de segurança e saúde ocupacional da respectiva Norma Regulamentadora.</li>'}
                    </ul>
                </div>

                <!-- Autenticidade & Validação -->
                <div style="margin: 25px 10px 15px; background: #f1f5f9; padding: 8px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 8pt; color: #475569;">
                    <div>
                        <strong>Código de Autenticação Digital:</strong> <code>${cert.certificado_codigo || 'CERT-AUTENTICO-2026'}</code>
                    </div>
                    <div>
                        <strong>Registro no Sistema SafeWork:</strong> Válido em todo o território nacional
                    </div>
                </div>

                <!-- Assinaturas Regulamentares -->
                <div class="print-signatures" style="margin-top: 45px; display: flex; justify-content: space-around; text-align: center;">
                    <div class="signature-line" style="width: 42%; border-top: 1px solid #000; padding-top: 6px; font-size: 8.5pt;">
                        <strong>${cert.colaborador_nome}</strong><br>
                        CPF: ${cert.colaborador_cpf}<br>
                        <span style="font-size: 7.5pt; color: #64748b;">Assinatura do Trabalhador / Aluno</span>
                    </div>
                    <div class="signature-line" style="width: 42%; border-top: 1px solid #000; padding-top: 6px; font-size: 8.5pt;">
                        <strong>${cert.instrutor_nome || 'Prof. Ricardo Santos'}</strong><br>
                        Engenheiro de Segurança / Instrutor Habilitado<br>
                        <span style="font-size: 7.5pt; color: #64748b;">Responsável Técnico pelo Treinamento (NR-01 Anexo II)</span>
                    </div>
                </div>

                <!-- Rodapé -->
                <div style="position: absolute; bottom: 12px; left: 30px; right: 30px; text-align: center; font-size: 7pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                    Documento gerado eletronicamente pela plataforma SafeWork RH & SST em conformidade com as Portarias MTP e diretrizes da NR-01 Anexo II. A validade deste documento pode ser confirmada junto ao SESMT da empresa.
                </div>
            </div>
        `;

        window.print();
    }
};
