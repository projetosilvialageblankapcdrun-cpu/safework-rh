# 🛡️ SafeWork RH & SST - Sistema Corporativo Integrado

Sistema completo de gestão empresarial unificando **Departamento Pessoal (DP)** e **Segurança e Saúde no Trabalho (SST)**, modelado a partir das melhores práticas dos líderes de mercado no Brasil: **SOC**, **Senior Sistemas (HCM)**, **SGG** e **TOTVS RH**.

---

## 📌 Por que unificar DP e SST?

Na maioria das empresas, o Departamento Pessoal e o SESMT trabalham em sistemas isolados. Isso acarreta:
1. **Multas pelo eSocial**: Descumprimento do prazo de envio de CAT (S-2210) no 1º dia útil seguinte ou atraso em exames do ASO (S-2220).
2. **Passivos Trabalhistas**: Férias vencidas em dobro (CLT Art. 137), afastamentos por doença sem controle previdenciário e falta de comprovante de entrega de EPIs (NR-06 / CLT Art. 158).
3. **Falta de Gestão Preventiva**: Riscos ergonômicos e mecânicos que geram absenteísmo sem que o DP compreenda a causa raiz.

O **SafeWork RH & SST** foi projetado para eliminar esses gargalos integrando os dois setores em um único banco de dados de alta velocidade.

---

## 🚀 Como Iniciar o Sistema (1 Clique no Windows)

O sistema foi construído sobre uma arquitetura leve, moderna e de **zero dependências externas**:
- **Banco de Dados**: SQLite 3 nativo (`safework.db`).
- **Runtime**: `agy-node` (Node.js 24 com suporte nativo a SQLite).
- **Interface**: Single Page Application (SPA) responsiva com suporte a impressão A4 regulamentar.

### Passo Rápido:
1. Navegue até a pasta do projeto:
   `C:\Users\LENOVO\.gemini\antigravity\scratch\safework-rh`
2. Dê um duplo-clique no arquivo:
   `iniciar_sistema.bat`
3. O servidor será iniciado automaticamente na porta **3000** e abrirá o seu navegador em:
   `http://localhost:3000`

Ou pelo terminal:
```bash
agy-node server.js
```

---

## 🏛️ Módulos e Recursos do Sistema

### 1. 📊 Dashboard Executivo e Inteligência de Negócio (BI)
- **KPIs em Tempo Real**:
  - Total de Colaboradores Ativos, em Férias e Afastados.
  - **Taxa de Frequência (TF)** e **Taxa de Gravidade (TG)** conforme a norma NBR 14280.
  - **Taxa de Absenteísmo** (% de horas de trabalho perdidas por atestados).
  - Contagem de riscos críticos e altos mapeados no inventário.
- **Central de Alertas Proativos**:
  - Alerta de ASOs vencidos ou prestes a vencer em até 30 dias.
  - Alerta de EPIs com data limite de troca periódica expirada ou CA a vencer.
  - Alerta de Férias com período concessivo próximo ao limite de dobra (CLT Art. 137).
  - Alerta de Certificações de NRs vencidas ou a reciclar.
  - Alerta de Afastamentos médicos superiores a 15 dias para encaminhamento ao INSS.

---

### 2. 👥 Departamento Pessoal (DP)
- **Ficha Cadastral e Funcional**:
  - Dados pessoais, CPF, RG, PIS, CTPS, Matrícula, Endereço e Contato.
  - Dados contratuais: Cargo, CBO, Setor, Salário Base, Admissão, Regime (CLT, Estágio, Menor Aprendiz, PJ).
  - Identificação de adicionais legais: Insalubridade (10%, 20%, 40%) e Periculosidade (30%).
- **Prontuário 360° do Colaborador**:
  - Painel unificado que exibe, em uma única tela: dados pessoais, dependentes para IRRF/Salário Família, histórico de ASOs, lista de EPIs recebidos, certificados de treinamento de NRs e afastamentos médicos.
- **Controle de Férias**:
  - Período aquisitivo e concessivo calculados automaticamente.
  - Programação de gozo com opção de abono pecuniário (venda de 1/3) e 13º adiantado.
  - Alerta preventivo para evitar pagamento de férias em dobro.
- **Ponto e Atestados Médicos**:
  - Registro de atestados médicos com código **CID-10**, dias de afastamento e CRM do médico assistente.
  - Sinalização automática de afastamentos com mais de 15 dias consecutivos para perícia médica do INSS.

---

### 3. 🦺 Segurança do Trabalho (PGR / GRO - NR-01)
- **Inventário Geral de Riscos Ocupacionais**:
  - Categorização em 5 grupos regulamentares: **Físico**, **Químico**, **Biológico**, **Ergonômico** e **Acidente/Mecânico**.
  - Detalhamento de fontes geradoras, possíveis danos à saúde e código da Tabela 24 do eSocial.
  - Avaliação quantitativa (com limites de tolerância e níveis de ação) e qualitativa.
  - **Matriz de Risco 5x5**: Cálculo automatizado do Nível de Risco (Probabilidade × Severidade = 1 a 25) com classificação em *Baixo*, *Médio*, *Alto* e *Crítico*.
  - Indicação da eficácia de EPCs e EPIs.
- **Plano de Ação 5W2H**:
  - O que (*What*), Onde (*Where*), Quem (*Who*), Quando (*When*), Como (*How*) e Quanto custa (*How much*).
  - Status em tempo real (*Pendente*, *Em Andamento*, *Concluído*) com registro de conclusão.
- **Ordens de Serviço (OS - NR-01)**:
  - Ordens de serviço estruturadas por função, contendo atividades desenvolvidas, riscos, EPIs obrigatórios, medidas preventivas, normas proibitivas e punições disciplinares (Art. 158 da CLT).
  - Impressão formatada pronta para colher ciência do trabalhador.

---

### 4. 🩺 Saúde e Medicina Ocupacional (PCMSO - NR-07)
- **Gestão de Atestados de Saúde Ocupacional (ASO)**:
  - Tipos: Admissional, Periódico, Retorno ao Trabalho, Mudança de Riscos Ocupacionais e Demissional.
  - Definição de Aptidão: *Apto*, *Inapto* ou *Apto com Restrição*.
  - Registro do Médico Examinador e do Médico Coordenador do PCMSO (Nome, CRM e UF).
  - Exames complementares ocupacionais (Audiometria, Acuidade Visual, Espirometria, Raio-X padrão OIT, ECG, EEG).
- **Impressão Regulamentar em 2 Vias**:
  - Emissão com formatação profissional A4 em 2 vias (1ª via empregador, 2ª via trabalhador).

---

### 5. 🧤 Gestão de EPIs (NR-06)
- **Catálogo de Equipamentos**:
  - Cadastro com número do Certificado de Aprovação (**C.A.**) do Ministério do Trabalho, validade do CA, fabricante e periodicidade recomendada de troca.
  - Controle de estoque mínimo e estoque atual com baixa automática na entrega.
- **Ficha Eletrônica de Entrega de EPI**:
  - Registro da data de fornecimento, quantidade entregue, motivo (Admissão, Troca Periódica, Substituição por Danos).
  - Cálculo automático da data limite para a próxima troca periódica.
  - Registro de devoluções.
  - **Ficha Individual de EPI para Impressão**: Modelo oficial com o Termo de Responsabilidade e Guarda previsto no Art. 158 da CLT e NR-06.

---

### 6. 🎓 Treinamentos e Capacitações de NRs
- **Catálogo das Normas Regulamentadoras**:
  - NR-01 (Integração e Percepção de Risco), NR-06 (Uso e Guarda de EPI), NR-10 (Segurança em Eletricidade), NR-11 (Operação de Empilhadeiras), NR-12 (Segurança em Máquinas) e NR-35 (Trabalho em Altura).
- **Controle de Reciclagem**:
  - Acompanhamento das datas de realização e cálculo de vencimento da validade do certificado.
  - Emissão do número de certificado de capacitação.

---

### 7. ⚠️ Acidentes de Trabalho & Investigação (CAT - S-2210)
- **Registro do Incidente / Acidente**:
  - Classificação em: *Típico*, *Trajeto* ou *Doença Ocupacional*.
  - Registro de data, horário, local exato, parte do corpo atingida e agente causador.
  - Investigação de causa raiz através do método da **Árvore de Causas / 5 Porquês**.
  - Registro de medidas corretivas imediatas para evitar reincidência.
- **Emissão da CAT**:
  - Geração do número de protocolo da CAT e comunicação legal.

---

### 8. 📑 Central eSocial SST & PPP Eletrônico
- **Gerador de XML Oficial do eSocial**:
  - **S-2210**: Comunicação de Acidente de Trabalho.
  - **S-2220**: Monitoramento da Saúde do Trabalhador (ASO e exames).
  - **S-2240**: Condições Ambientais do Trabalho (Agentes nocivos, EPIs/EPCs e responsáveis técnicos).
- **Recursos da Central**:
  - Visualizador de código XML formatado.
  - Botão de cópia rápida para área de transferência.
  - Download do arquivo `.xml` pronto para envio pelo mensageiro ou portal WebGeral eSocial.
- **Perfil Profissiográfico Previdenciário (PPP Eletrônico)**:
  - Cruzamento de dados de DP (admissão, cargo, setor) com registros ambientais do PGR (NR-01) e exames do PCMSO (NR-07).
  - Impressão formatada do PPP em conformidade com a Instrução Normativa PRES/INSS nº 128/2022.

---

## 🧪 Verificação e Testes Unitários

O sistema possui uma suíte automatizada de testes cobrindo todas as regras de negócio:
```bash
agy-node test_api.js
```
*Resultado: 22 testes aprovados com 100% de sucesso.*

---

## 📂 Estrutura do Projeto

```
safework-rh/
├── database/
│   ├── schema.sql           # Modelagem relacional completa do SQLite
│   ├── db.js                # Conector nativo node:sqlite com prepared statements
│   └── seed.js              # Carga inicial com dados realistas da indústria modelo
├── server/
│   ├── routes/
│   │   ├── dashboard.js     # KPIs, TF/TG, Absenteísmo e Alertas
│   │   ├── colaboradores.js # CRUD de colaboradores e prontuário 360°
│   │   ├── cargos_setores.js# Setores, cargos, CBO e dados da empresa
│   │   ├── ferias.js        # Programação de férias e limite concessivo
│   │   ├── ponto_atestados.js# Atestados com CID-10 e encaminhamento ao INSS
│   │   ├── pgr.js           # Inventário de riscos NR-01 e planos 5W2H
│   │   ├── pcmso.js         # ASOs e controle de vencimentos NR-07
│   │   ├── epis.js          # Catálogo com CA e fichas de entrega NR-06
│   │   ├── treinamentos.js  # Gestão de NRs e reciclagens
│   │   ├── acidentes.js     # CAT e árvore de causas
│   │   └── esocial.js       # Gerador oficial de XMLs (S-2210, S-2220, S-2240) e PPP
│   └── app.js               # Servidor HTTP nativo de alta performance
├── public/
│   ├── css/
│   │   └── styles.css       # Estilos corporativos modernos e layout de impressão A4
│   ├── js/
│   │   ├── app.js           # Controlador SPA em JavaScript puro
│   │   └── print.js         # Motor de impressão A4 de ASO, Ficha EPI, OS e PPP
│   └── index.html           # Interface principal da aplicação
├── test_api.js              # Suíte de testes automatizados
├── iniciar_sistema.bat      # Inicializador em 1-clique para Windows
├── server.js                # Ponto de entrada do backend
└── README.md                # Manual de instruções e documentação regulatória
```
