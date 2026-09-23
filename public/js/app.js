// ====================================================================
// SafeWork RH & SST - Controlador Principal da Aplicação SPA
// Gerenciamento de abas, requisições assíncronas à API, modais e formulários
// ====================================================================

const App = {
    currentTab: 'dashboard',
    currentUser: null,
    token: localStorage.getItem('safework_token') || null,
    cache: {
        setores: [],
        cargos: [],
        colaboradores: [],
        epis: [],
        treinamentos: []
    },

    // INICIALIZAÇÃO
    async init() {
        console.log('[SafeWork App] Inicializando aplicação...');
        this.setupNavigation();
        this.setupModalClosers();

        // Verificar sessão de autenticação existente
        const authed = await this.verificarAutenticacao();
        if (!authed) {
            this.mostrarTelaLogin();
            return;
        }

        await this.loadInitialCache();
        await this.switchTab('dashboard');
    },

    // AUTENTICAÇÃO E SESSÃO
    async verificarAutenticacao() {
        const token = localStorage.getItem('safework_token');
        if (!token) return false;
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                localStorage.removeItem('safework_token');
                this.token = null;
                this.currentUser = null;
                return false;
            }
            const data = await res.json();
            this.token = token;
            this.currentUser = data.usuario;
            this.atualizarWidgetUsuario();
            this.esconderTelaLogin();
            return true;
        } catch (e) {
            console.error('Falha ao verificar token:', e);
            return false;
        }
    },

    mostrarTelaLogin() {
        const screen = document.getElementById('login-screen');
        if (screen) screen.classList.remove('hidden');
    },

    esconderTelaLogin() {
        const screen = document.getElementById('login-screen');
        if (screen) screen.classList.add('hidden');
    },

    atualizarWidgetUsuario() {
        if (!this.currentUser) return;
        const nomeEl = document.getElementById('user-topbar-nome');
        const perfilEl = document.getElementById('user-topbar-perfil');
        const avatarEl = document.getElementById('user-topbar-avatar');
        const navCatAdmin = document.getElementById('nav-cat-admin');
        const navItemUsuarios = document.getElementById('nav-item-usuarios');

        if (nomeEl) nomeEl.innerText = this.currentUser.nome;
        if (perfilEl) perfilEl.innerText = this.currentUser.perfil;
        if (avatarEl) {
            const parts = (this.currentUser.nome || 'SW').trim().split(' ');
            const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
            avatarEl.innerText = initials;
        }

        // Permissão: Apenas Administrador pode ver a aba de Gestão de Usuários
        const isAdmin = this.currentUser.perfil === 'Administrador';
        if (navCatAdmin) navCatAdmin.style.display = isAdmin ? 'block' : 'none';
        if (navItemUsuarios) navItemUsuarios.style.display = isAdmin ? 'flex' : 'none';
    },

    preencherCredencialDemo(login, senha) {
        const loginInput = document.getElementById('login-usuario');
        const senhaInput = document.getElementById('login-senha');
        if (loginInput) loginInput.value = login;
        if (senhaInput) senhaInput.value = senha;
        const errEl = document.getElementById('login-error-msg');
        if (errEl) errEl.style.display = 'none';
    },

    async fazerLogin(event) {
        if (event) event.preventDefault();
        const login = document.getElementById('login-usuario').value.trim();
        const senha = document.getElementById('login-senha').value;
        const errEl = document.getElementById('login-error-msg');
        const btnSubmit = document.getElementById('btn-login-submit');

        if (!login || !senha) {
            if (errEl) {
                errEl.innerText = 'Por favor, preencha o usuário e a senha.';
                errEl.style.display = 'block';
            }
            return;
        }

        try {
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerText = 'Autenticando...';
            }
            if (errEl) errEl.style.display = 'none';

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, senha })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Credenciais inválidas.');
            }

            // Sucesso no login
            this.token = data.token;
            this.currentUser = data.usuario;
            localStorage.setItem('safework_token', data.token);

            this.atualizarWidgetUsuario();
            this.esconderTelaLogin();
            this.showToast(`Bem-vindo, ${data.usuario.nome}!`, 'success');

            // Carrega dados da aplicação
            await this.loadInitialCache();
            await this.switchTab('dashboard');
        } catch (err) {
            if (errEl) {
                errEl.innerText = err.message || 'Erro ao realizar login.';
                errEl.style.display = 'block';
            }
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = '🔐 Acessar Sistema';
            }
        }
    },

    async fazerLogout() {
        try {
            if (this.token) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    }
                }).catch(() => {});
            }
        } finally {
            localStorage.removeItem('safework_token');
            this.token = null;
            this.currentUser = null;
            const formLogin = document.getElementById('form-login');
            if (formLogin) formLogin.reset();
            const errEl = document.getElementById('login-error-msg');
            if (errEl) errEl.style.display = 'none';
            this.mostrarTelaLogin();
            this.showToast('Você saiu do sistema.', 'info');
        }
    },

    // TOASTS
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${type === 'danger' ? '⚠️' : (type === 'success' ? '✅' : 'ℹ️')}</span>
            <div>${message}</div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    // REQUISIÇÕES À API (COM TOKEN JWT/HMAC)
    async api(endpoint, method = 'GET', body = null) {
        try {
            const token = this.token || localStorage.getItem('safework_token');
            const options = {
                method,
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            };
            if (body) options.body = JSON.stringify(body);

            const res = await fetch(`/api${endpoint}`, options);
            if (res.status === 401) {
                this.fazerLogout();
                throw new Error('Sessão expirada. Faça login novamente.');
            }
            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Erro de conexão' }));
                throw new Error(errData.error || `Erro HTTP ${res.status}`);
            }
            return await res.json();
        } catch (err) {
            console.error(`Erro API ${endpoint}:`, err);
            this.showToast(err.message, 'danger');
            throw err;
        }
    },

    // CARREGAR CACHE BÁSICO
    async loadInitialCache() {
        try {
            const [setores, cargos, colabs, epis, treinos] = await Promise.all([
                this.api('/setores'),
                this.api('/cargos'),
                this.api('/colaboradores'),
                this.api('/epis'),
                this.api('/treinamentos/catalogo')
            ]);
            this.cache.setores = setores;
            this.cache.cargos = cargos;
            this.cache.colaboradores = colabs;
            this.cache.epis = epis;
            this.cache.treinamentos = treinos;
        } catch (e) {
            console.warn('Falha no pré-carregamento de cache:', e);
        }
    },

    // NAVEGAÇÃO ENTRE ABAS
    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = link.getAttribute('data-tab');
                if (targetTab) this.switchTab(targetTab);
            });
        });
    },

    async switchTab(tabName) {
        this.currentTab = tabName;

        // Atualizar links ativos na sidebar
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.getAttribute('data-tab') === tabName);
        });

        // Atualizar título do topo
        const pageTitle = document.getElementById('page-title');
        const pageDesc = document.getElementById('page-description');

        const titulos = {
            'dashboard': ['Dashboard Executivo', 'Visão 360° de DP, Riscos Ocupacionais, Absenteísmo e Alertas'],
            'colaboradores': ['Colaboradores & Admissão (DP)', 'Gestão funcional, contratos, dependentes e prontuário integrado'],
            'ferias': ['Gestão de Férias (DP)', 'Controle de períodos aquisitivos, concessivos e alerta de dobra (CLT)'],
            'ponto': ['Ponto & Atestados Médicos', 'Registro de frequência, CID-10, afastamentos e encaminhamento ao INSS'],
            'pgr': ['PGR & Riscos Ocupacionais (NR-01)', 'Inventário de perigos, matriz de riscos 5x5 e planos de ação 5W2H'],
            'pcmso': ['PCMSO & Medicina Ocupacional (NR-07)', 'Controle de ASOs, exames complementares e alertas de vencimento'],
            'epis': ['Gestão de EPIs (NR-06)', 'Catálogo com CA do MTE, controle de estoque e ficha de entrega'],
            'treinamentos': ['Treinamentos de NRs', 'Capacitações obrigatórias de NRs, validade, reciclagem e certificados'],
            'acidentes': ['Acidentes de Trabalho & CAT', 'Registro de acidentes, árvore de causas e emissão oficial de CAT'],
            'esocial': ['Central eSocial & PPP', 'Validação e emissão de XMLs (S-2210, S-2220, S-2240) e PPP Eletrônico'],
            'usuarios': ['Gestão de Usuários & Acessos', 'Controle de contas, senhas e perfis de permissão do sistema']
        };

        if (titulos[tabName]) {
            pageTitle.innerText = titulos[tabName][0];
            pageDesc.innerText = titulos[tabName][1];
        }

        // Esconder todas as views e exibir a ativa
        document.querySelectorAll('.tab-view').forEach(view => view.style.display = 'none');
        const activeView = document.getElementById(`view-${tabName}`);
        if (activeView) activeView.style.display = 'block';

        // Carregar dados específicos da aba
        await this.loadTabData(tabName);
    },

    async loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                await this.renderDashboard();
                break;
            case 'colaboradores':
                await this.renderColaboradores();
                break;
            case 'ferias':
                await this.renderFerias();
                break;
            case 'ponto':
                await this.renderPontoAtestados();
                break;
            case 'pgr':
                await this.renderPgr();
                break;
            case 'pcmso':
                await this.renderPcmso();
                break;
            case 'epis':
                await this.renderEpis();
                break;
            case 'treinamentos':
                await this.renderTreinamentos();
                break;
            case 'acidentes':
                await this.renderAcidentes();
                break;
            case 'esocial':
                await this.renderEsocial();
                break;
            case 'usuarios':
                await this.renderUsuarios();
                break;
        }
    },

    // 1. DASHBOARD
    async renderDashboard() {
        const data = await this.api('/dashboard');
        const st = data.estatisticas;

        // Renderizar KPIs
        document.getElementById('kpi-ativos').innerText = st.ativos;
        document.getElementById('kpi-total-colab').innerText = `${st.totalColaboradores} no quadro`;
        document.getElementById('kpi-tf').innerText = st.taxaFrequencia;
        document.getElementById('kpi-tg').innerText = st.taxaGravidade;
        document.getElementById('kpi-absenteismo').innerText = `${st.taxaAbsenteismo}%`;
        document.getElementById('kpi-riscos-altos').innerText = st.riscosCriticosAltos;
        document.getElementById('kpi-total-riscos').innerText = `${st.totalRiscos} riscos no inventário`;

        // Renderizar Alertas Proativos
        const alertsList = document.getElementById('dashboard-alerts-list');
        alertsList.innerHTML = '';
        if (data.alertas.length === 0) {
            alertsList.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 0.9rem;">Nenhum alerta pendente no momento. Empresa em total conformidade!</div>';
        } else {
            data.alertas.forEach(al => {
                const el = document.createElement('div');
                el.className = `alert-card ${al.tipo}`;
                el.innerHTML = `
                    <div class="alert-icon">${al.tipo === 'danger' ? '🔴' : (al.tipo === 'warning' ? '🟡' : '🔵')}</div>
                    <div class="alert-content">
                        <span class="alert-badge">${al.modulo}</span>
                        <div class="alert-title">${al.titulo}</div>
                        <div class="alert-desc">${al.mensagem}</div>
                    </div>
                    <a href="${al.link}" class="alert-action-btn" onclick="event.preventDefault(); App.switchTab('${al.link.replace('#', '')}')">Ver Detalhes</a>
                `;
                alertsList.appendChild(el);
            });
        }
    },

    // 2. COLABORADORES (DP)
    async renderColaboradores() {
        const search = document.getElementById('search-colaborador')?.value || '';
        const colabs = await this.api(`/colaboradores?search=${encodeURIComponent(search)}`);
        this.cache.colaboradores = colabs;

        const tbody = document.getElementById('tbody-colaboradores');
        tbody.innerHTML = '';

        colabs.forEach(c => {
            const tr = document.createElement('tr');
            const statusClass = c.status === 'Ativo' ? 'success' : (c.status === 'Afastado' ? 'danger' : 'warning');
            tr.innerHTML = `
                <td><strong>${c.matricula}</strong></td>
                <td>
                    <div style="font-weight: 600;">${c.nome}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">CPF: ${c.cpf}</div>
                </td>
                <td>${c.cargo_titulo}</td>
                <td>${c.setor_nome}</td>
                <td>${c.data_admissao}</td>
                <td>R$ ${c.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td><span class="badge ${statusClass}">${c.status}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="App.verPerfilColaborador(${c.id})">Perfil 360°</button>
                    <button class="btn btn-secondary btn-sm" onclick="App.imprimirFichaEpiColaborador(${c.id})">Ficha EPI</button>
                    <button class="btn btn-primary btn-sm" onclick="App.abrirGeradorOs(${c.id})">Gerar O.S.</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async verPerfilColaborador(id) {
        const c = await this.api(`/colaboradores/${id}`);
        const modal = document.getElementById('modal-perfil-colaborador');
        const body = document.getElementById('perfil-colaborador-content');

        let asosHtml = c.asos.map(a => `<li>ASO ${a.tipo_aso} em ${a.data_emissao} - <strong>${a.aptidao}</strong> (Venc: ${a.data_validade})</li>`).join('') || '<li>Nenhum ASO registrado</li>';
        let episHtml = c.epis.map(e => `<li>${e.quantidade}x ${e.epi_nome} (CA ${e.ca_numero}) entregue em ${e.data_entrega}</li>`).join('') || '<li>Nenhum EPI entregue</li>';
        let treinosHtml = c.treinamentos.map(t => `<li>${t.norma}: ${t.titulo} - Venc: ${t.data_vencimento}</li>`).join('') || '<li>Nenhum treinamento registrado</li>';
        let atestadosHtml = c.atestados.map(at => `<li>Atestado de ${at.dias_afastamento} dias (CID ${at.cid10}) em ${at.data_inicio} ${at.encaminhado_inss ? '<span class="badge danger">INSS</span>' : ''}</li>`).join('') || '<li>Nenhum atestado registrado</li>';

        body.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <h4 style="margin-bottom: 8px; color: var(--accent);">Dados Pessoais e Funcionais</h4>
                    <p><strong>Nome:</strong> ${c.nome}</p>
                    <p><strong>Matrícula:</strong> ${c.matricula} | <strong>CPF:</strong> ${c.cpf}</p>
                    <p><strong>Cargo:</strong> ${c.cargo_titulo} (CBO: ${c.cbo})</p>
                    <p><strong>Setor:</strong> ${c.setor_nome}</p>
                    <p><strong>Admissão:</strong> ${c.data_admissao} | <strong>Status:</strong> ${c.status}</p>
                    <p><strong>Salário Base:</strong> R$ ${c.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p><strong>Insalubridade:</strong> ${c.insalubridade_grau}% | <strong>Periculosidade:</strong> ${c.periculosidade ? '30%' : 'Não'}</p>
                </div>
                <div>
                    <h4 style="margin-bottom: 8px; color: var(--accent);">Histórico de Saúde & Medicina (PCMSO)</h4>
                    <ul style="font-size: 0.85rem; padding-left: 20px;">${asosHtml}</ul>
                    <h4 style="margin-top: 14px; margin-bottom: 8px; color: var(--accent);">Atestados Médicos (DP & SST)</h4>
                    <ul style="font-size: 0.85rem; padding-left: 20px;">${atestadosHtml}</ul>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4 style="margin-bottom: 8px; color: var(--accent);">EPIs Fornecidos (NR-06)</h4>
                    <ul style="font-size: 0.85rem; padding-left: 20px;">${episHtml}</ul>
                </div>
                <div>
                    <h4 style="margin-bottom: 8px; color: var(--accent);">Capacitações de NRs</h4>
                    <ul style="font-size: 0.85rem; padding-left: 20px;">${treinosHtml}</ul>
                </div>
            </div>
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="App.imprimirFichaEpiColaborador(${c.id})">Imprimir Ficha de EPI</button>
                <button class="btn btn-primary" onclick="App.abrirGeradorOs(${c.id})">Gerar Ordem de Serviço (O.S.)</button>
                <button class="btn btn-outline" onclick="App.gerarPppColaborador(${c.id})">Gerar PPP Eletrônico</button>
            </div>
        `;

        this.openModal('modal-perfil-colaborador');
    },

    // 3. FÉRIAS (DP)
    async renderFerias() {
        const ferias = await this.api('/ferias');
        const tbody = document.getElementById('tbody-ferias');
        tbody.innerHTML = '';

        ferias.forEach(f => {
            const tr = document.createElement('tr');
            const statusClass = f.status === 'Em Gozo' ? 'success' : (f.status === 'Programada' ? 'info' : 'secondary');
            tr.innerHTML = `
                <td><strong>${f.colaborador_nome}</strong> (${f.matricula})</td>
                <td>${f.cargo_nome}</td>
                <td>${f.periodo_aquisitivo_inicio} até ${f.periodo_aquisitivo_fim}</td>
                <td style="color: #b91c1c; font-weight: bold;">${f.limite_concessivo}</td>
                <td>${f.data_inicio} até ${f.data_fim} (${f.dias_gozo} dias)</td>
                <td>${f.abono_pecuniario ? 'Sim (10 dias)' : 'Não'}</td>
                <td><span class="badge ${statusClass}">${f.status}</span></td>
                <td>
                    ${f.status === 'Programada' ? `<button class="btn btn-primary btn-sm" onclick="App.atualizarStatusFerias(${f.id}, 'Em Gozo')">Iniciar Gozo</button>` : ''}
                    ${f.status === 'Em Gozo' ? `<button class="btn btn-secondary btn-sm" onclick="App.atualizarStatusFerias(${f.id}, 'Concluída')">Concluir Retorno</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async atualizarStatusFerias(id, status) {
        await this.api(`/ferias/${id}/status`, 'PUT', { status });
        this.showToast(`Status de férias alterado para ${status}!`, 'success');
        await this.renderFerias();
    },

    // 4. PONTO & ATESTADOS (DP + SST)
    async renderPontoAtestados() {
        const atestados = await this.api('/atestados');
        const tbody = document.getElementById('tbody-atestados');
        tbody.innerHTML = '';

        atestados.forEach(at => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${at.colaborador_nome}</strong></td>
                <td>${at.cargo_nome}</td>
                <td>${at.data_inicio} até ${at.data_fim}</td>
                <td><strong>${at.dias_afastamento} dias</strong></td>
                <td><span class="badge secondary">${at.cid10}</span> ${at.cid10_descricao || ''}</td>
                <td>${at.medico_nome} (CRM/${at.medico_uf} ${at.medico_crm})</td>
                <td>
                    ${at.encaminhado_inss ? '<span class="badge danger">Sim (>15 dias)</span>' : '<span class="badge success">Não</span>'}
                </td>
                <td>${at.tipo_afastamento}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    // 5. PGR / GRO (NR-01)
    async renderPgr() {
        const [riscos, planos, ordens] = await Promise.all([
            this.api('/pgr/riscos'),
            this.api('/pgr/planos'),
            this.api('/pgr/ordens-servico')
        ]);

        // Renderizar Inventário de Riscos
        const tbodyRiscos = document.getElementById('tbody-riscos');
        tbodyRiscos.innerHTML = '';

        riscos.forEach(r => {
            const tr = document.createElement('tr');
            const classColor = r.classificacao_risco === 'Crítico' ? 'danger' : (r.classificacao_risco === 'Alto' ? 'warning' : 'info');
            tr.innerHTML = `
                <td><strong>${r.setor_nome}</strong></td>
                <td><span class="badge secondary">${r.grupo_risco}</span></td>
                <td><strong>${r.perigo_fator}</strong><br><span style="font-size: 0.75rem; color: var(--text-muted);">${r.fonte_geradora}</span></td>
                <td>${r.tipo_avaliacao} (${r.intensidade_concentracao || 'Qualitativo'})</td>
                <td>${r.probabilidade} × ${r.severidade} = <strong>${r.nivel_risco}</strong></td>
                <td><span class="badge ${classColor}">${r.classificacao_risco}</span></td>
                <td>${r.medidas_preventivas_existentes || 'Uso de EPI'}</td>
            `;
            tbodyRiscos.appendChild(tr);
        });

        // Renderizar Planos de Ação 5W2H
        const tbodyPlanos = document.getElementById('tbody-planos5w2h');
        tbodyPlanos.innerHTML = '';

        planos.forEach(p => {
            const tr = document.createElement('tr');
            const statusClass = p.status === 'Concluído' ? 'success' : (p.status === 'Em Andamento' ? 'warning' : 'danger');
            tr.innerHTML = `
                <td><strong>${p.o_que}</strong></td>
                <td>${p.onde}</td>
                <td>${p.quem}</td>
                <td><strong>${p.quando_prazo}</strong></td>
                <td>R$ ${p.quanto_custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td><span class="badge ${statusClass}">${p.status}</span></td>
                <td>
                    ${p.status !== 'Concluído' ? `<button class="btn btn-primary btn-sm" onclick="App.concluirPlano5W2H(${p.id})">Concluir Ação</button>` : 'Finalizado'}
                </td>
            `;
            tbodyPlanos.appendChild(tr);
        });

        // Renderizar Ordens de Serviço
        const listOs = document.getElementById('list-ordens-servico');
        listOs.innerHTML = '';
        ordens.forEach(os => {
            const item = document.createElement('div');
            item.className = 'panel-card';
            item.style.marginBottom = '12px';
            item.innerHTML = `
                <div class="panel-header" style="padding: 12px 18px;">
                    <div><strong>${os.cargo_nome}</strong> (CBO: ${os.cbo}) - Setor: ${os.setor_nome}</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-sm" onclick="App.abrirGeradorOs(null, ${os.cargo_id})">Emitir / Editar O.S.</button>
                    </div>
                </div>
            `;
            listOs.appendChild(item);
        });
    },

    async concluirPlano5W2H(id) {
        await this.api(`/pgr/planos/${id}/status`, 'PUT', { status: 'Concluído' });
        this.showToast('Plano de Ação 5W2H concluído com sucesso!', 'success');
        await this.renderPgr();
    },

    // 6. PCMSO (NR-07)
    async renderPcmso() {
        const [asos, vencimentos] = await Promise.all([
            this.api('/pcmso/asos'),
            this.api('/pcmso/vencimentos')
        ]);

        // Vencimentos de ASO
        const alertBox = document.getElementById('pcmso-vencimentos-box');
        alertBox.innerHTML = '';
        if (vencimentos.length > 0) {
            vencimentos.forEach(v => {
                const el = document.createElement('div');
                el.className = `alert-card ${v.status_vencimento === 'Vencido' ? 'danger' : 'warning'}`;
                el.innerHTML = `
                    <div class="alert-icon">🩺</div>
                    <div class="alert-content">
                        <strong>${v.colaborador_nome}</strong> (${v.cargo_nome} - ${v.setor_nome}) - ASO ${v.tipo_aso} ${v.status_vencimento.toLowerCase()} em ${v.data_validade}.
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="App.abrirModalNovoAso(${v.id})">Renovar ASO</button>
                `;
                alertBox.appendChild(el);
            });
        }

        // Tabela de ASOs
        const tbody = document.getElementById('tbody-asos');
        tbody.innerHTML = '';

        asos.forEach(a => {
            const tr = document.createElement('tr');
            const aptClass = a.aptidao === 'Apto' ? 'success' : (a.aptidao === 'Inapto' ? 'danger' : 'warning');
            tr.innerHTML = `
                <td><strong>${a.colaborador_nome}</strong> (${a.matricula})</td>
                <td>${a.cargo_nome}</td>
                <td><span class="badge secondary">${a.tipo_aso}</span></td>
                <td>${a.data_emissao}</td>
                <td>${a.data_validade}</td>
                <td><span class="badge ${aptClass}">${a.aptidao}</span></td>
                <td>${a.medico_examinador_nome} (CRM ${a.medico_examinador_crm})</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="App.imprimirAsoOficial(${a.id})">Imprimir (2 Vias)</button>
                    <button class="btn btn-outline btn-sm" onclick="App.gerarXmlS2220(${a.id})">XML S-2220</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async imprimirAsoOficial(asoId) {
        const aso = await this.api(`/pcmso/asos/${asoId}`);
        PrintService.imprimirAso(aso);
    },

    // 7. GESTÃO DE EPIS (NR-06)
    async renderEpis() {
        const [catalogo, entregas] = await Promise.all([
            this.api('/epis'),
            this.api('/epis/entregas')
        ]);

        // Catálogo de EPIs
        const tbodyCat = document.getElementById('tbody-catalogo-epis');
        tbodyCat.innerHTML = '';

        catalogo.forEach(ep => {
            const tr = document.createElement('tr');
            const caClass = ep.status_ca === 'CA Válido' ? 'success' : 'danger';
            tr.innerHTML = `
                <td><strong>${ep.nome}</strong></td>
                <td><strong>${ep.ca_numero}</strong></td>
                <td>${ep.ca_validade} <span class="badge ${caClass}">${ep.status_ca}</span></td>
                <td>${ep.fabricante}</td>
                <td><span class="badge secondary">${ep.tipo_protecao}</span></td>
                <td><strong>${ep.estoque_atual}</strong> un</td>
                <td>R$ ${ep.custo_unitario.toFixed(2)}</td>
            `;
            tbodyCat.appendChild(tr);
        });

        // Histórico de Entregas
        const tbodyEntregas = document.getElementById('tbody-entregas-epis');
        tbodyEntregas.innerHTML = '';

        entregas.forEach(ent => {
            const tr = document.createElement('tr');
            const trocaClass = ent.status_troca === 'Troca Vencida' ? 'danger' : (ent.status_troca === 'Troca Próxima' ? 'warning' : 'success');
            tr.innerHTML = `
                <td><strong>${ent.colaborador_nome}</strong></td>
                <td>${ent.epi_nome} (CA ${ent.ca_numero})</td>
                <td>${ent.data_entrega}</td>
                <td>${ent.quantidade} un</td>
                <td>${ent.data_prevista_troca} <span class="badge ${trocaClass}">${ent.status_troca}</span></td>
                <td>${ent.motivo}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="App.imprimirFichaEpiColaborador(${ent.colaborador_id})">Ver Ficha</button>
                    ${!ent.devolvido ? `<button class="btn btn-outline btn-sm" onclick="App.devolverEpi(${ent.id})">Devolução</button>` : '<span class="badge secondary">Devolvido</span>'}
                </td>
            `;
            tbodyEntregas.appendChild(tr);
        });
    },

    async devolverEpi(entregaId) {
        await this.api(`/epis/entregas/${entregaId}/devolucao`, 'PUT', {});
        this.showToast('Devolução de EPI registrada com sucesso!', 'success');
        await this.renderEpis();
    },

    async imprimirFichaEpiColaborador(colaboradorId) {
        const data = await this.api(`/epis/ficha/${colaboradorId}`);
        PrintService.imprimirFichaEpi(data);
    },

    // 8. TREINAMENTOS DE NRS
    async renderTreinamentos() {
        const realizados = await this.api('/treinamentos/realizados');
        const tbody = document.getElementById('tbody-treinamentos');
        tbody.innerHTML = '';

        realizados.forEach(t => {
            const tr = document.createElement('tr');
            const statusClass = t.status_calculado === 'Válido' ? 'success' : (t.status_calculado === 'Vencido' ? 'danger' : 'warning');
            tr.innerHTML = `
                <td><strong>${t.colaborador_nome}</strong> (${t.matricula})</td>
                <td><strong>${t.norma}</strong> - ${t.curso_nome}</td>
                <td>${t.data_realizacao}</td>
                <td>${t.data_vencimento}</td>
                <td><span class="badge ${statusClass}">${t.status_calculado}</span></td>
                <td>${t.instrutor_nome}</td>
                <td><code>${t.certificado_numero}</code></td>
            `;
            tbody.appendChild(tr);
        });
    },

    // 9. ACIDENTES & CAT (S-2210)
    async renderAcidentes() {
        const acidentes = await this.api('/acidentes');
        const tbody = document.getElementById('tbody-acidentes');
        tbody.innerHTML = '';

        acidentes.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${a.numero_cat}</strong></td>
                <td><strong>${a.colaborador_nome}</strong></td>
                <td>${a.data_acidente} às ${a.hora_acidente}</td>
                <td><span class="badge secondary">${a.tipo_acidente}</span></td>
                <td>${a.local_acidente}</td>
                <td>${a.parte_corpo_atingida} (${a.agente_causador})</td>
                <td>${a.dias_afastamento} dias</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="App.gerarXmlS2210(${a.id})">XML S-2210</button>
                    <button class="btn btn-secondary btn-sm" onclick="App.verDetalhesAcidente(${a.id})">Investigação</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async verDetalhesAcidente(id) {
        const a = await this.api(`/acidentes/${id}`);
        alert(`INVESTIGAÇÃO DE ACIDENTE (CAT ${a.numero_cat})\n\nColaborador: ${a.colaborador_nome}\nData/Hora: ${a.data_acidente} às ${a.hora_acidente}\nLocal: ${a.local_acidente}\nParte do Corpo: ${a.parte_corpo_atingida}\n\nDescrição do Fato:\n${a.descricao_acidente}\n\nÁrvore de Causas:\n${a.investigacao_arvore_causas || 'Em análise'}\n\nMedidas Corretivas:\n${a.medidas_corretivas_adotadas || 'DDS e adequações operacionais'}`);
    },

    // 10. CENTRAL ESOCIAL & PPP
    async renderEsocial() {
        const eventos = await this.api('/esocial/eventos');
        const tbody = document.getElementById('tbody-esocial-eventos');
        tbody.innerHTML = '';

        eventos.forEach(ev => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${ev.evento_tipo}</strong></td>
                <td>${ev.colaborador_nome} (CPF: ${ev.cpf})</td>
                <td>${ev.data_geracao}</td>
                <td><span class="badge success">${ev.status}</span></td>
                <td><code>${ev.recibo_protocolo || '-'}</code></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="App.visualizarXml('${ev.evento_tipo}', ${JSON.stringify(ev.xml_conteudo)})">Ver XML</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async gerarXmlS2210(acidenteId) {
        const res = await this.api('/esocial/gerar-s2210', 'POST', { acidente_id: acidenteId });
        this.visualizarXml('S-2210 - Comunicação de Acidente de Trabalho (CAT)', res.xml);
    },

    async gerarXmlS2220(asoId) {
        const res = await this.api('/esocial/gerar-s2220', 'POST', { aso_id: asoId });
        this.visualizarXml('S-2220 - Monitoramento da Saúde do Trabalhador', res.xml);
    },

    async gerarXmlS2240(colaboradorId) {
        const res = await this.api('/esocial/gerar-s2240', 'POST', { colaborador_id: colaboradorId });
        this.visualizarXml('S-2240 - Condições Ambientais do Trabalho (Agentes Nocivos)', res.xml);
    },

    async gerarPppColaborador(colaboradorId) {
        const data = await this.api(`/esocial/ppp/${colaboradorId}`);
        PrintService.imprimirPpp(data);
    },

    visualizarXml(titulo, xmlString) {
        const modal = document.getElementById('modal-xml-esocial');
        document.getElementById('modal-xml-title').innerText = `Evento eSocial: ${titulo}`;
        const codeEl = document.getElementById('xml-code-content');
        codeEl.innerText = xmlString;

        document.getElementById('btn-copiar-xml').onclick = () => {
            navigator.clipboard.writeText(xmlString);
            App.showToast('XML copiado para a área de transferência!', 'success');
        };

        document.getElementById('btn-download-xml').onclick = () => {
            const blob = new Blob([xmlString], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `evento_esocial_${Date.now()}.xml`;
            a.click();
        };

        this.openModal('modal-xml-esocial');
    },

    // GERENCIAMENTO DE MODAIS
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('open');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('open');
    },

    setupModalClosers() {
        document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-backdrop');
                if (modal) modal.classList.remove('open');
            });
        });
    },

    // FORMULÁRIOS DE CRIAÇÃO RÁPIDA
    abrirModalNovoColaborador() {
        const selectCargo = document.getElementById('novo-colab-cargo');
        const selectSetor = document.getElementById('novo-colab-setor');

        selectCargo.innerHTML = this.cache.cargos.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
        selectSetor.innerHTML = this.cache.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');

        this.openModal('modal-novo-colaborador');
    },

    async salvarNovoColaborador(e) {
        e.preventDefault();
        const form = e.target;
        const data = {
            nome: form.nome.value,
            cpf: form.cpf.value,
            cargo_id: Number(form.cargo_id.value),
            setor_id: Number(form.setor_id.value),
            data_nascimento: form.data_nascimento.value,
            data_admissao: form.data_admissao.value,
            salario: Number(form.salario.value),
            tipo_contrato: form.tipo_contrato.value
        };

        await this.api('/colaboradores', 'POST', data);
        this.closeModal('modal-novo-colaborador');
        form.reset();
        this.showToast('Colaborador cadastrado com sucesso!', 'success');
        await this.renderColaboradores();
    },

    abrirModalEntregaEpi() {
        const selectColab = document.getElementById('entrega-epi-colab');
        const selectEpi = document.getElementById('entrega-epi-id');

        selectColab.innerHTML = this.cache.colaboradores.map(c => `<option value="${c.id}">${c.nome} (${c.matricula})</option>`).join('');
        selectEpi.innerHTML = this.cache.epis.map(e => `<option value="${e.id}">${e.nome} (CA: ${e.ca_numero} | Estoque: ${e.estoque_atual})</option>`).join('');

        this.openModal('modal-entrega-epi');
    },

    async salvarEntregaEpi(e) {
        e.preventDefault();
        const form = e.target;
        const data = {
            colaborador_id: Number(form.colaborador_id.value),
            epi_id: Number(form.epi_id.value),
            quantidade: Number(form.quantidade.value),
            motivo: form.motivo.value,
            data_entrega: form.data_entrega.value
        };

        await this.api('/epis/entregas', 'POST', data);
        this.closeModal('modal-entrega-epi');
        form.reset();
        this.showToast('Entrega de EPI registrada e estoque atualizado!', 'success');
        await this.renderEpis();
    },

    abrirModalNovoAtestado() {
        const selectColab = document.getElementById('atestado-colab');
        selectColab.innerHTML = this.cache.colaboradores.map(c => `<option value="${c.id}">${c.nome} (${c.matricula})</option>`).join('');
        this.openModal('modal-novo-atestado');
    },

    async salvarNovoAtestado(e) {
        e.preventDefault();
        const form = e.target;
        const data = {
            colaborador_id: Number(form.colaborador_id.value),
            data_inicio: form.data_inicio.value,
            data_fim: form.data_fim.value,
            dias_afastamento: Number(form.dias_afastamento.value),
            cid10: form.cid10.value,
            cid10_descricao: form.cid10_descricao.value,
            medico_nome: form.medico_nome.value,
            medico_crm: form.medico_crm.value,
            tipo_afastamento: form.tipo_afastamento.value
        };

        await this.api('/atestados', 'POST', data);
        this.closeModal('modal-novo-atestado');
        form.reset();
        this.showToast('Atestado médico registrado com sucesso!', 'success');
        await this.renderPontoAtestados();
    },

    // ====================================================================
    // GERADOR INTERATIVO DE ORDEM DE SERVIÇO (NR-01)
    // ====================================================================
    async abrirGeradorOs(colaboradorId = null, cargoId = null) {
        const selectColab = document.getElementById('os-colab-select');
        const selectCargo = document.getElementById('os-cargo-select');
        const selectSetor = document.getElementById('os-setor-select');

        selectColab.innerHTML = '<option value="">-- Preenchimento Manual / Novo Trabalhador --</option>' + 
            this.cache.colaboradores.map(c => `<option value="${c.id}">${c.nome} (${c.matricula} - ${c.cargo_titulo})</option>`).join('');

        selectCargo.innerHTML = this.cache.cargos.map(car => `<option value="${car.id}">${car.titulo}</option>`).join('');
        selectSetor.innerHTML = this.cache.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');

        document.getElementById('os-data-emissao').value = new Date().toISOString().split('T')[0];
        document.getElementById('os-revisao').value = '01';

        if (colaboradorId) {
            selectColab.value = String(colaboradorId);
            await this.onOsColaboradorChange(colaboradorId);
        } else if (cargoId) {
            selectColab.value = '';
            selectCargo.value = String(cargoId);
            await this.onOsCargoChange(cargoId);
        } else {
            selectColab.value = '';
            document.getElementById('os-nome').value = '';
            document.getElementById('os-cpf').value = '';
            document.getElementById('os-matricula').value = '';
            const firstCargoId = this.cache.cargos[0]?.id;
            if (firstCargoId) {
                selectCargo.value = String(firstCargoId);
                await this.onOsCargoChange(firstCargoId);
            }
        }

        this.openModal('modal-gerador-os');
    },

    async onOsColaboradorChange(colabId) {
        if (!colabId) {
            document.getElementById('os-nome').value = '';
            document.getElementById('os-cpf').value = '';
            document.getElementById('os-matricula').value = '';
            return;
        }

        const colab = await this.api(`/colaboradores/${colabId}`);
        if (!colab) return;

        document.getElementById('os-nome').value = colab.nome;
        document.getElementById('os-cpf').value = colab.cpf;
        document.getElementById('os-matricula').value = colab.matricula;
        document.getElementById('os-cargo-select').value = String(colab.cargo_id);
        document.getElementById('os-setor-select').value = String(colab.setor_id);
        document.getElementById('os-cbo').value = colab.cbo || '';

        await this.carregarTemplateOs(colab.cargo_id);
    },

    async onOsCargoChange(cargoId) {
        if (!cargoId) return;
        const cargo = this.cache.cargos.find(c => c.id === Number(cargoId));
        if (cargo) {
            document.getElementById('os-cbo').value = cargo.cbo || '';
            document.getElementById('os-setor-select').value = String(cargo.setor_id);
        }
        await this.carregarTemplateOs(cargoId);
    },

    async carregarTemplateOs(cargoId) {
        try {
            const tpl = await this.api(`/pgr/ordens-servico/template/${cargoId}`);
            if (!tpl) return;

            document.getElementById('os-atividades').value = tpl.atividades_desenvolvidas || '';
            document.getElementById('os-riscos').value = tpl.riscos_funcao || '';
            document.getElementById('os-epis').value = tpl.epis_obrigatorios || '';
            document.getElementById('os-medidas').value = tpl.medidas_preventivas || '';
            document.getElementById('os-proibicoes').value = tpl.normas_proibicoes || '';
            document.getElementById('os-procedimentos-acidente').value = tpl.procedimentos_acidente || 
                '• Em caso de acidente ou incidente, paralisar a máquina ou atividade imediatamente;\n• Acionar o socorrista da brigada interna de emergência e o SESMT;\n• Encaminhar a vítima ao ambulatório ou serviço médico de urgência;\n• Preservar o local do acidente para a perícia e investigação de causas;\n• Comunicar a chefia imediata para a emissão da CAT em até 24 horas.';
            document.getElementById('os-punicoes').value = tpl.punicoes_previstas || '';
            if (tpl.revisao) document.getElementById('os-revisao').value = tpl.revisao;
        } catch (e) {
            console.error('Erro ao carregar template da O.S.:', e);
        }
    },

    async restaurarPadraoOs() {
        const cargoId = document.getElementById('os-cargo-select').value;
        if (!cargoId) return;
        await this.carregarTemplateOs(cargoId);
        this.showToast('Textos restaurados para o padrão original da função!', 'info');
    },

    async salvarModeloOs() {
        const cargoId = Number(document.getElementById('os-cargo-select').value);
        if (!cargoId) {
            this.showToast('Selecione um cargo válido para salvar o modelo.', 'danger');
            return;
        }

        const data = {
            cargo_id: cargoId,
            atividades_desenvolvidas: document.getElementById('os-atividades').value,
            riscos_funcao: document.getElementById('os-riscos').value,
            epis_obrigatorios: document.getElementById('os-epis').value,
            medidas_preventivas: document.getElementById('os-medidas').value,
            normas_proibicoes: document.getElementById('os-proibicoes').value,
            procedimentos_acidente: document.getElementById('os-procedimentos-acidente').value,
            punicoes_previstas: document.getElementById('os-punicoes').value,
            revisao: document.getElementById('os-revisao').value,
            data_aprovacao: document.getElementById('os-data-emissao').value
        };

        await this.api('/pgr/ordens-servico', 'POST', data);
        this.showToast('Modelo padrão da Ordem de Serviço salvo no banco de dados!', 'success');
        await this.renderPgr();
    },

    imprimirOsCustomizada() {
        const cargoSelect = document.getElementById('os-cargo-select');
        const cargoNome = cargoSelect.options[cargoSelect.selectedIndex]?.text || '';
        const setorSelect = document.getElementById('os-setor-select');
        const setorNome = setorSelect.options[setorSelect.selectedIndex]?.text || '';

        const osData = {
            colaborador_nome: document.getElementById('os-nome').value.trim() || 'Nome do Colaborador',
            colaborador_cpf: document.getElementById('os-cpf').value.trim(),
            colaborador_matricula: document.getElementById('os-matricula').value.trim(),
            cargo_nome: cargoNome,
            cbo: document.getElementById('os-cbo').value.trim(),
            setor_nome: setorNome,
            data_aprovacao: document.getElementById('os-data-emissao').value,
            revisao: document.getElementById('os-revisao').value.trim(),
            empresa_nome: document.getElementById('os-empresa').value,
            atividades_desenvolvidas: document.getElementById('os-atividades').value,
            riscos_funcao: document.getElementById('os-riscos').value,
            epis_obrigatorios: document.getElementById('os-epis').value,
            medidas_preventivas: document.getElementById('os-medidas').value,
            normas_proibicoes: document.getElementById('os-proibicoes').value,
            procedimentos_acidente: document.getElementById('os-procedimentos-acidente').value,
            punicoes_previstas: document.getElementById('os-punicoes').value
        };

        PrintService.imprimirOrdemServico(osData);
    },

    // 11. GESTÃO DE USUÁRIOS (ADMINISTRADOR)
    async renderUsuarios() {
        if (!this.currentUser || this.currentUser.perfil !== 'Administrador') {
            this.showToast('Apenas o Administrador Geral pode acessar este módulo.', 'danger');
            await this.switchTab('dashboard');
            return;
        }

        const tbody = document.getElementById('tbody-usuarios');
        if (!tbody) return;

        try {
            const usuarios = await this.api('/usuarios');

            if (!usuarios || usuarios.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: var(--text-muted);">Nenhum usuário cadastrado.</td></tr>`;
                return;
            }

            tbody.innerHTML = usuarios.map(u => {
                const perfilBadgeClass = {
                    'Administrador': 'badge-perfil-admin',
                    'Gestor DP': 'badge-perfil-dp',
                    'Técnico SST': 'badge-perfil-sst',
                    'Visualizador': 'badge-perfil-viewer'
                }[u.perfil] || 'badge-perfil-viewer';

                const statusBadge = u.ativo
                    ? `<span class="badge badge-success">Ativo</span>`
                    : `<span class="badge badge-danger">Bloqueado</span>`;

                const ultimoAcessoStr = u.ultimo_acesso 
                    ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') 
                    : 'Nunca acessou';

                const isMasterAdmin = u.login === 'admin' && this.currentUser.login === 'admin';
                const isSelf = u.id === this.currentUser.id;

                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-primary);">${u.nome}</td>
                        <td><code>${u.login}</code></td>
                        <td>${u.email}</td>
                        <td><span class="badge ${perfilBadgeClass}">${u.perfil}</span></td>
                        <td>${statusBadge}</td>
                        <td style="font-size: 0.8rem; color: var(--text-muted);">${ultimoAcessoStr}</td>
                        <td>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <button class="btn btn-outline btn-sm" onclick="App.abrirModalEditarUsuario(${u.id})" title="Editar dados e senha">
                                    ✏️ Editar
                                </button>
                                ${!isSelf ? `
                                    <button class="btn btn-sm ${u.ativo ? 'btn-outline' : 'btn-primary'}" 
                                            onclick="App.alternarStatusUsuario(${u.id}, ${u.ativo})" 
                                            title="${u.ativo ? 'Bloquear acesso' : 'Desbloquear acesso'}">
                                        ${u.ativo ? '🚫 Bloquear' : '✅ Ativar'}
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="App.excluirUsuario(${u.id}, '${u.nome}')" title="Excluir usuário permanentemente">
                                        🗑️
                                    </button>
                                ` : `<span style="font-size: 0.75rem; color: var(--accent); font-weight: 600; padding: 4px;">(Sua conta)</span>`}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error('Erro ao renderizar usuários:', err);
        }
    },

    abrirModalNovoUsuario() {
        document.getElementById('modal-usuario-title').innerText = '➕ Novo Usuário do Sistema';
        document.getElementById('usuario-id').value = '';
        document.getElementById('usuario-nome').value = '';
        document.getElementById('usuario-login').value = '';
        document.getElementById('usuario-email').value = '';
        document.getElementById('usuario-senha').value = '';
        document.getElementById('usuario-senha').required = true;
        document.getElementById('help-usuario-senha').style.display = 'none';
        document.getElementById('usuario-perfil').value = 'Gestor DP';
        document.getElementById('usuario-ativo').checked = true;
        document.getElementById('btn-salvar-usuario').innerText = 'Cadastrar Usuário';

        document.getElementById('modal-usuario').classList.add('open');
    },

    async abrirModalEditarUsuario(id) {
        try {
            const usuarios = await this.api('/usuarios');
            const user = usuarios.find(u => u.id === id);
            if (!user) {
                this.showToast('Usuário não encontrado.', 'danger');
                return;
            }

            document.getElementById('modal-usuario-title').innerText = `✏️ Editar Usuário: ${user.nome}`;
            document.getElementById('usuario-id').value = user.id;
            document.getElementById('usuario-nome').value = user.nome;
            document.getElementById('usuario-login').value = user.login;
            document.getElementById('usuario-email').value = user.email;
            document.getElementById('usuario-senha').value = '';
            document.getElementById('usuario-senha').required = false;
            document.getElementById('help-usuario-senha').style.display = 'block';
            document.getElementById('usuario-perfil').value = user.perfil;
            document.getElementById('usuario-ativo').checked = !!user.ativo;
            document.getElementById('btn-salvar-usuario').innerText = 'Salvar Alterações';

            document.getElementById('modal-usuario').classList.add('open');
        } catch (err) {
            console.error('Erro ao carregar usuário:', err);
        }
    },

    async salvarUsuario(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('usuario-id').value;
        const nome = document.getElementById('usuario-nome').value.trim();
        const login = document.getElementById('usuario-login').value.trim();
        const email = document.getElementById('usuario-email').value.trim();
        const senha = document.getElementById('usuario-senha').value;
        const perfil = document.getElementById('usuario-perfil').value;
        const ativo = document.getElementById('usuario-ativo').checked ? 1 : 0;

        const payload = { nome, login, email, perfil, ativo };
        if (senha) payload.senha = senha;

        try {
            if (id) {
                // Atualização de usuário existente
                await this.api(`/usuarios/${id}`, 'PUT', payload);
                this.showToast('Usuário atualizado com sucesso!', 'success');
                // Se atualizou a si mesmo, atualiza widget do topo
                if (Number(id) === this.currentUser.id) {
                    this.currentUser.nome = nome;
                    this.currentUser.perfil = perfil;
                    this.atualizarWidgetUsuario();
                }
            } else {
                // Criação de novo usuário
                if (!senha || senha.length < 6) {
                    this.showToast('A senha deve ter no mínimo 6 caracteres.', 'danger');
                    return;
                }
                await this.api('/usuarios', 'POST', payload);
                this.showToast(`Usuário "${login}" cadastrado com sucesso!`, 'success');
            }

            document.getElementById('modal-usuario').classList.remove('open');
            await this.renderUsuarios();
        } catch (err) {
            // Toast com erro já é acionado pelo api()
        }
    },

    async alternarStatusUsuario(id, statusAtual) {
        const novoStatus = statusAtual ? 0 : 1;
        const acao = novoStatus ? 'desbloquear' : 'bloquear';
        if (!confirm(`Deseja realmente ${acao} o acesso deste usuário?`)) return;

        try {
            await this.api(`/usuarios/${id}`, 'PUT', { ativo: novoStatus });
            this.showToast(`Status do usuário alterado com sucesso!`, 'success');
            await this.renderUsuarios();
        } catch (err) {
            // Toast com erro já exibido por api()
        }
    },

    async excluirUsuario(id, nome) {
        if (!confirm(`ATENÇÃO: Deseja realmente excluir permanentemente o usuário "${nome}"? Esta operação é irreversível.`)) return;

        try {
            await this.api(`/usuarios/${id}`, 'DELETE');
            this.showToast(`Usuário excluído com sucesso!`, 'success');
            await this.renderUsuarios();
        } catch (err) {
            // Toast com erro já exibido por api()
        }
    }
};

// Iniciar ao carregar DOM
document.addEventListener('DOMContentLoaded', () => App.init());
