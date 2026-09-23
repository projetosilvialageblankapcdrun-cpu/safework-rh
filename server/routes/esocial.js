// ====================================================================
// SafeWork RH & SST - Rota: Central eSocial (SST & Trabalhista)
// Gerador oficial de XMLs para S-2210, S-2220, S-2240 e PPP Eletrônico
// ====================================================================

const { queryAll, queryOne, execute } = require('../../database/db.js');

function formatarCpf(cpf) {
    return (cpf || '').replace(/\D/g, '');
}

function formatarCnpj(cnpj) {
    return (cnpj || '').replace(/\D/g, '');
}

// 1. GERAR XML DO EVENTO S-2210 (Comunicação de Acidente de Trabalho)
function gerarXmlS2210(acidenteId) {
    const acid = queryOne(`
        SELECT a.*, c.nome as colab_nome, c.cpf, c.matricula, c.data_nascimento,
               e.cnpj as emp_cnpj, e.razao_social as emp_razao
        FROM acidentes_cat a
        JOIN colaboradores c ON c.id = a.colaborador_id
        JOIN empresas e ON e.id = c.empresa_id
        WHERE a.id = ?
    `, [acidenteId]);

    if (!acid) throw new Error('Acidente não encontrado');

    const cnpjFormatado = formatarCnpj(acid.emp_cnpj);
    const cpfFormatado = formatarCpf(acid.cpf);
    const dataHoraIso = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const idEvento = `ID1${cnpjFormatado.padStart(14, '0')}${dataHoraIso}00001`;

    const tpAcid = acid.tipo_acidente === 'Típico' ? '1' : (acid.tipo_acidente === 'Trajeto' ? '2' : '3');
    const hrAcid = (acid.hora_acidente || '08:00').replace(':', '');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_02_00">
  <evtCAT Id="${idEvento}">
    <ideEvento>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>SafeWork-1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjFormatado}</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>${cpfFormatado}</cpfTrab>
      <matricula>${acid.matricula}</matricula>
    </ideTrabalhador>
    <cat>
      <dtAcid>${acid.data_acidente}</dtAcid>
      <tpAcid>${tpAcid}</tpAcid>
      <hrAcid>${hrAcid}</hrAcid>
      <hrsTrabAntesAcid>0200</hrsTrabAntesAcid>
      <tpCat>1</tpCat>
      <indCatObito>${acid.houve_obito ? 'S' : 'N'}</indCatObito>
      <dtObito>${acid.data_obito || ''}</dtObito>
      <indComunPolicia>N</indComunPolicia>
      <codSitGeradora>200004000</codSitGeradora>
      <iniciatCAT>1</iniciatCAT>
      <localAcidente>
        <tpLocal>1</tpLocal>
        <dscLocal>${acid.local_acidente || 'Instalações do Empregador'}</dscLocal>
      </localAcidente>
      <parteAtingida>
        <codParteAting>704010000</codParteAting>
      </parteAtingida>
      <agenteCausador>
        <codAgntCausador>303030100</codAgntCausador>
      </agenteCausador>
      <atestado>
        <dtAtendimento>${acid.data_acidente}</dtAtendimento>
        <hrAtendimento>${hrAcid}</hrAtendimento>
        <indAfast>${acid.houve_afastamento ? 'S' : 'N'}</indAfast>
        <durTrat>${acid.dias_afastamento || 0}</durTrat>
        <codCID>S610</codCID>
        <nrCRM>${acid.medico_atendente_crm || '112440'}</nrCRM>
        <ufCRM>SP</ufCRM>
      </atestado>
    </cat>
  </evtCAT>
</eSocial>`;

    // Gravar no histórico de eventos do eSocial
    execute(`
        INSERT INTO esocial_eventos (evento_tipo, referencia_id, colaborador_id, xml_conteudo, status, recibo_protocolo)
        VALUES ('S-2210', ?, ?, ?, 'Pronto para Envio', ?)
    `, [acid.id, acid.colaborador_id, xml, `PROT-S2210-${Date.now().toString().slice(-8)}`]);

    return { idEvento, xml, colaborador: acid.colab_nome };
}

// 2. GERAR XML DO EVENTO S-2220 (Monitoramento da Saúde do Trabalhador)
function gerarXmlS2220(asoId) {
    const aso = queryOne(`
        SELECT a.*, c.nome as colab_nome, c.cpf, c.matricula,
               e.cnpj as emp_cnpj, e.razao_social as emp_razao
        FROM asos a
        JOIN colaboradores c ON c.id = a.colaborador_id
        JOIN empresas e ON e.id = c.empresa_id
        WHERE a.id = ?
    `, [asoId]);

    if (!aso) throw new Error('ASO não encontrado');

    const cnpjFormatado = formatarCnpj(aso.emp_cnpj);
    const cpfFormatado = formatarCpf(aso.cpf);
    const dataHoraIso = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const idEvento = `ID1${cnpjFormatado.padStart(14, '0')}${dataHoraIso}00002`;

    // Mapeamento do tipo de ASO no eSocial
    const mapaTipoAso = {
        'Admissional': '0',
        'Periódico': '1',
        'Retorno ao Trabalho': '2',
        'Mudança de Riscos': '3',
        'Demissional': '4'
    };
    const tpAso = mapaTipoAso[aso.tipo_aso] || '1';
    const aptidaoCode = aso.aptidao === 'Apto' ? '1' : (aso.aptidao === 'Inapto' ? '2' : '3');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_02_00">
  <evtMonit Id="${idEvento}">
    <ideEvento>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>SafeWork-1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjFormatado}</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>${cpfFormatado}</cpfTrab>
    </ideTrabalhador>
    <exMedOcup>
      <tpExameOcup>${tpAso}</tpExameOcup>
      <aso>
        <dtAso>${aso.data_emissao}</dtAso>
        <resAso>${aptidaoCode}</resAso>
        <exame>
          <dtExm>${aso.data_emissao}</dtExm>
          <procRealizado>0001</procRealizado>
          <ordExame>1</ordExame>
          <indResult>1</indResult>
        </exame>
        <medico>
          <nmMed>${aso.medico_examinador_nome}</nmMed>
          <nrCRM>${aso.medico_examinador_crm}</nrCRM>
          <ufCRM>${aso.medico_examinador_uf}</ufCRM>
        </medico>
      </aso>
      <respMonit>
        <nmResp>${aso.medico_coordenador_nome || aso.medico_examinador_nome}</nmResp>
        <nrCRM>${aso.medico_coordenador_crm || aso.medico_examinador_crm}</nrCRM>
        <ufCRM>${aso.medico_coordenador_uf || aso.medico_examinador_uf}</ufCRM>
      </respMonit>
    </exMedOcup>
  </evtMonit>
</eSocial>`;

    // Gravar evento
    execute(`
        INSERT INTO esocial_eventos (evento_tipo, referencia_id, colaborador_id, xml_conteudo, status, recibo_protocolo)
        VALUES ('S-2220', ?, ?, ?, 'Pronto para Envio', ?)
    `, [aso.id, aso.colaborador_id, xml, `PROT-S2220-${Date.now().toString().slice(-8)}`]);

    // Marcar ASO como enviado
    execute(`UPDATE asos SET esocial_enviado = 1 WHERE id = ?`, [aso.id]);

    return { idEvento, xml, colaborador: aso.colab_nome };
}

// 3. GERAR XML DO EVENTO S-2240 (Condições Ambientais do Trabalho - Agentes Nocivos / PPP)
function gerarXmlS2240(colaboradorId) {
    const colab = queryOne(`
        SELECT c.*, car.titulo as cargo_titulo, car.cbo, car.descricao_atividades,
               s.nome as setor_nome, s.id as setor_id,
               e.cnpj as emp_cnpj, e.razao_social as emp_razao,
               e.responsavel_sst_nome, e.responsavel_sst_registro
        FROM colaboradores c
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        JOIN empresas e ON e.id = c.empresa_id
        WHERE c.id = ?
    `, [colaboradorId]);

    if (!colab) throw new Error('Colaborador não encontrado');

    const cnpjFormatado = formatarCnpj(colab.emp_cnpj);
    const cpfFormatado = formatarCpf(colab.cpf);
    const dataHoraIso = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const idEvento = `ID1${cnpjFormatado.padStart(14, '0')}${dataHoraIso}00003`;

    // Riscos do setor e cargo
    const riscos = queryAll(`
        SELECT * FROM riscos_ocupacionais 
        WHERE setor_id = ? AND (cargo_id = ? OR cargo_id IS NULL)
    `, [colab.setor_id, colab.cargo_id]);

    // EPIs vinculados
    const epis = queryAll(`
        SELECT DISTINCT e.ca_numero, e.nome
        FROM epi_entregas ent
        JOIN epis e ON e.id = ent.epi_id
        WHERE ent.colaborador_id = ? AND ent.devolvido = 0
    `, [colaboradorId]);

    let agentesNocivosXml = '';
    if (riscos.length === 0) {
        // Código de ausência de risco: 09.01.001
        agentesNocivosXml = `
      <agNoc>
        <codAgNoc>09.01.001</codAgNoc>
        <dscAgNoc>Ausência de agente nocivo ou atividades não contempladas na Tabela 24</dscAgNoc>
      </agNoc>`;
    } else {
        for (const r of riscos) {
            const codAgNoc = r.esocial_codigo || '01.01.001';
            let episXml = '';
            for (const ep of epis) {
                episXml += `
          <epi>
            <docAval>${ep.ca_numero}</docAval>
          </epi>`;
            }

            agentesNocivosXml += `
      <agNoc>
        <codAgNoc>${codAgNoc}</codAgNoc>
        <dscAgNoc>${r.perigo_fator} - ${r.fonte_geradora}</dscAgNoc>
        <tpAval>${r.tipo_avaliacao === 'Quantitativa' ? '2' : '1'}</tpAval>
        <intConc>${r.intensidade_concentracao || '0'}</intConc>
        <limTol>${r.limite_tolerancia || '0'}</limTol>
        <epcEpi>
          <utilizEPC>${r.epc_eficaz ? '2' : '1'}</utilizEPC>
          <utilizEPI>${r.epi_eficaz ? '2' : '1'}</utilizEPI>
          ${episXml}
        </epcEpi>
      </agNoc>`;
        }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_02_00">
  <evtExpRisco Id="${idEvento}">
    <ideEvento>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>SafeWork-1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjFormatado}</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>${cpfFormatado}</cpfTrab>
    </ideTrabalhador>
    <infoExpRisco>
      <dtIniCondicao>${colab.data_admissao}</dtIniCondicao>
      <infoAmb>
        <localAmb>1</localAmb>
        <dscSetor>${colab.setor_nome}</dscSetor>
      </infoAmb>
      <infoAtiv>
        <dscAtivDes>${colab.descricao_atividades || 'Atividades operacionais e técnicas de sua função.'}</dscAtivDes>
      </infoAtiv>
      <fatorRisco>
        ${agentesNocivosXml.trim()}
      </fatorRisco>
      <responsavelRegistro>
        <cpfResp>${formatarCpf('33487129004')}</cpfResp>
        <ideOC>4</ideOC>
        <dscOC>CREA</dscOC>
        <nrOC>5061234567</nrOC>
        <ufOC>SP</ufOC>
      </responsavelRegistro>
    </infoExpRisco>
  </evtExpRisco>
</eSocial>`;

    // Gravar no histórico
    execute(`
        INSERT INTO esocial_eventos (evento_tipo, referencia_id, colaborador_id, xml_conteudo, status, recibo_protocolo)
        VALUES ('S-2240', ?, ?, ?, 'Pronto para Envio', ?)
    `, [colab.id, colab.id, xml, `PROT-S2240-${Date.now().toString().slice(-8)}`]);

    return { idEvento, xml, colaborador: colab.nome };
}

// 4. PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO (PPP Eletrônico)
function getPppData(colaboradorId) {
    const colab = queryOne(`
        SELECT c.*, car.titulo as cargo_nome, car.cbo, car.descricao_atividades,
               s.nome as setor_nome, e.razao_social as empresa_nome, e.cnpj as empresa_cnpj,
               e.cnae as empresa_cnae, e.grau_risco as empresa_grau_risco,
               e.responsavel_sst_nome, e.responsavel_sst_registro
        FROM colaboradores c
        JOIN cargos car ON car.id = c.cargo_id
        JOIN setores s ON s.id = c.setor_id
        JOIN empresas e ON e.id = c.empresa_id
        WHERE c.id = ?
    `, [colaboradorId]);

    if (!colab) return null;

    const riscos = queryAll(`
        SELECT * FROM riscos_ocupacionais 
        WHERE setor_id = ? AND (cargo_id = ? OR cargo_id IS NULL)
    `, [colab.setor_id, colab.cargo_id]);

    const epis = queryAll(`
        SELECT ent.*, ep.nome as epi_nome, ep.ca_numero, ep.fabricante, ep.tipo_protecao
        FROM epi_entregas ent
        JOIN epis ep ON ep.id = ent.epi_id
        WHERE ent.colaborador_id = ?
    `, [colaboradorId]);

    const asos = queryAll(`
        SELECT * FROM asos 
        WHERE colaborador_id = ? 
        ORDER BY data_emissao ASC
    `, [colaboradorId]);

    return {
        colaborador: colab,
        riscos,
        epis,
        asos
    };
}

function listEventosEsocial() {
    return queryAll(`
        SELECT ev.*, c.nome as colaborador_nome, c.cpf, c.matricula
        FROM esocial_eventos ev
        JOIN colaboradores c ON c.id = ev.colaborador_id
        ORDER BY ev.data_geracao DESC
        LIMIT 50
    `);
}

module.exports = {
    gerarXmlS2210,
    gerarXmlS2220,
    gerarXmlS2240,
    getPppData,
    listEventosEsocial
};
