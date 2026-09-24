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
        const startTab = this.currentUser.perfil === 'Colaborador / Aluno' ? 'ead' : 'dashboard';
        await this.switchTab(startTab);
    },

    setupModalClosers() {
        document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal-backdrop');
                if (modal) modal.classList.remove('open');
            });
        });
        document.querySelectorAll('.modal-backdrop').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('open');
            });
        });
        const portal = document.getElementById('portal-denuncias');
        if (portal) {
            portal.addEventListener('click', (e) => {
                if (e.target === portal) this.fecharPortalDenuncias();
            });
        }
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
        const navItemDenuncias = document.getElementById('nav-item-denuncias');
        const eadInstructorActions = document.getElementById('ead-instructor-actions');

        if (nomeEl) nomeEl.innerText = this.currentUser.nome;
        if (perfilEl) perfilEl.innerText = this.currentUser.perfil;
        if (avatarEl) {
            const parts = (this.currentUser.nome || 'SW').trim().split(' ');
            const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
            avatarEl.innerText = initials;
        }

        const isAdmin = this.currentUser.perfil === 'Administrador';
        const isSst = this.currentUser.perfil === 'Técnico SST';
        const isInstrutor = this.currentUser.perfil === 'Instrutor / Professor';
        const isAluno = this.currentUser.perfil === 'Colaborador / Aluno';

        // Admin e SST visualizam canal de denúncias interno
        if (navCatAdmin) navCatAdmin.style.display = (isAdmin || isSst) ? 'block' : 'none';
        if (navItemUsuarios) navItemUsuarios.style.display = isAdmin ? 'flex' : 'none';
        if (navItemDenuncias) navItemDenuncias.style.display = (isAdmin || isSst) ? 'flex' : 'none';

        // Botões de criação de curso e matrícula visíveis para Admin e Instrutores
        if (eadInstructorActions) {
            eadInstructorActions.style.display = (isAdmin || isInstrutor) ? 'flex' : 'none';
        }
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
            'usuarios': ['Gestão de Usuários & Acessos', 'Controle de contas, senhas e perfis de permissão do sistema'],
            'ead': ['Academia EAD & Treinamentos Normativos (NR-01 Anexo II)', 'Videoaulas integradas, avaliações práticas, mural de avisos, canal Fale com o Professor e certificados oficiais'],
            'denuncias': ['Canal de Denúncias & Linha Ética (CIPA+A / Lei 14.457/22)', 'Comitê de Ética, apuração confidencial de assédio sexual, moral e irregularidades']
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
            case 'ead':
                await this.renderEad();
                break;
            case 'denuncias':
                await this.renderDenuncias();
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
    },

    // ====================================================================
    // 12. ACADEMIA CORPORATIVA & TREINAMENTOS EAD (NR-01 ANEXO II)
    // ====================================================================
    eadCurrentCurso: null,
    eadCurrentAula: null,
    eadMatriculaAtiva: null,
    eadAulasConcluidas: [],

    async renderEad() {
        try {
            const grid = document.getElementById('ead-cursos-grid');
            if (!grid) return;
            grid.innerHTML = '<div style="padding: 20px; color: #64748b;">Carregando treinamentos EAD...</div>';

            const [cursos, matriculas] = await Promise.all([
                this.api('/ead/cursos'),
                this.api('/ead/meus-cursos').catch(() => [])
            ]);

            if (!cursos || cursos.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 40px; text-align: center; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">🎓</div>
                        <h3 style="font-size: 1.1rem; color: #1e293b; margin-bottom: 6px;">Nenhum treinamento EAD disponível no momento</h3>
                        <p style="color: #64748b; font-size: 0.88rem; margin-bottom: 16px;">Instrutores podem cadastrar videoaulas e provas práticas em conformidade com a NR-01 Anexo II.</p>
                        <button class="btn btn-primary" onclick="App.abrirModalNovoCurso()">➕ Cadastrar Primeiro Curso</button>
                    </div>
                `;
                return;
            }

            // Mapear matrículas por curso_id
            const matMap = {};
            if (Array.isArray(matriculas)) {
                matriculas.forEach(m => { matMap[m.curso_id] = m; });
            }

            const isAdminOrProf = this.currentUser && (this.currentUser.perfil === 'Administrador' || this.currentUser.perfil === 'Instrutor / Professor');

            grid.innerHTML = cursos.map(c => {
                const mat = matMap[c.id];
                const pct = mat ? (mat.progresso_pct || 0) : 0;
                const statusMat = mat ? (mat.status === 'Aprovado' ? '✅ Concluído & Certificado' : (pct > 0 ? `Em Andamento (${pct}%)` : 'Não Iniciado')) : 'Disponível';
                const statusBadgeBg = mat && mat.status === 'Aprovado' ? '#dcfce7' : (pct > 0 ? '#e0f2fe' : '#f1f5f9');
                const statusBadgeColor = mat && mat.status === 'Aprovado' ? '#16a34a' : (pct > 0 ? '#0284c7' : '#64748b');

                return `
                    <div class="ead-course-card">
                        <div class="ead-course-header">
                            <span class="ead-course-badge">${c.categoria || 'SST'}</span>
                            <span class="ead-course-hours">⏱️ ${c.carga_horaria}h</span>
                        </div>
                        <div class="ead-course-body">
                            <h3 class="ead-course-title">${c.titulo}</h3>
                            <p class="ead-course-desc">${c.descricao || 'Treinamento de capacitação em Segurança e Saúde do Trabalho.'}</p>
                            
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #64748b; margin-bottom: 12px;">
                                <span>👨‍🏫 Instrutor: <strong style="color: #334155;">${c.instrutor_nome || 'SESMT MetalSul'}</strong></span>
                            </div>

                            <div style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px;">
                                    <span style="color: #64748b;">Progresso do Aluno</span>
                                    <span style="color: #0284c7;">${pct}%</span>
                                </div>
                                <div class="ead-progress-bar">
                                    <div class="ead-progress-fill" style="width: ${pct}%;"></div>
                                </div>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem; color: #64748b; margin-bottom: 14px;">
                                <span>📚 ${c.total_aulas || 0} Aulas</span>
                                <span style="background: ${statusBadgeBg}; color: ${statusBadgeColor}; padding: 3px 8px; border-radius: 999px; font-weight: 700;">${statusMat}</span>
                            </div>

                            <div style="display: flex; gap: 8px;">
                                <button type="button" class="btn btn-primary" style="flex: 1; padding: 9px; font-size: 0.88rem; justify-content: center;" onclick="App.abrirCursoPlayer(${c.id})">
                                    ▶️ Acessar Sala de Aula
                                </button>
                                ${isAdminOrProf ? `
                                    <button type="button" class="btn btn-outline" style="padding: 9px 12px;" title="Matricular colaborador neste curso" onclick="App.abrirModalMatricular(${c.id})">
                                        👥
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Erro ao renderizar EAD:', err);
            const grid = document.getElementById('ead-cursos-grid');
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 30px; text-align: center; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 10px; color: #b91c1c;">
                        <div style="font-size: 1.8rem; margin-bottom: 8px;">⚠️</div>
                        <div style="font-weight: 700; margin-bottom: 6px;">Não foi possível carregar os treinamentos EAD</div>
                        <div style="font-size: 0.85rem; margin-bottom: 12px;">${err.message || 'Erro de conexão com o servidor'}</div>
                        <button class="btn btn-primary" onclick="App.renderEad()">🔄 Tentar Novamente</button>
                    </div>
                `;
            }
        }
    },

    async abrirCursoPlayer(cursoId) {
        try {
            const [curso, mural, duvidas, matriculas] = await Promise.all([
                this.api(`/ead/cursos/${cursoId}`),
                this.api(`/ead/cursos/${cursoId}/mural`).catch(() => []),
                this.api(`/ead/cursos/${cursoId}/duvidas`).catch(() => []),
                this.api('/ead/meus-cursos').catch(() => [])
            ]);

            this.eadCurrentCurso = curso;
            let mat = Array.isArray(matriculas) ? matriculas.find(m => m.curso_id === cursoId) : null;

            // Se for admin ou instrutor sem matrícula, cria matrícula de visualização automática
            if (!mat && (this.currentUser.perfil === 'Administrador' || this.currentUser.perfil === 'Instrutor / Professor')) {
                try {
                    const novaMat = await this.api('/ead/matriculas', 'POST', { curso_id: cursoId });
                    mat = novaMat.matricula;
                } catch (e) {
                    mat = { id: 0, status: 'Instrutor', progresso_pct: 0 };
                }
            }

            this.eadMatriculaAtiva = mat;

            // Buscar aulas concluídas desta matrícula
            if (mat && mat.id) {
                const prog = await this.api(`/ead/matriculas/${mat.id}/progresso`).catch(() => ({ aulasConcluidas: [] }));
                this.eadAulasConcluidas = (prog && prog.aulasConcluidas) ? prog.aulasConcluidas : [];
            } else {
                this.eadAulasConcluidas = [];
            }

            // Atualizar cabeçalho da sala de aula
            document.getElementById('player-categoria-badge').innerText = curso.categoria || 'NR';
            document.getElementById('player-curso-titulo').innerText = curso.titulo;
            document.getElementById('player-instrutor-nome').innerText = curso.instrutor_nome || 'SESMT';
            document.getElementById('player-carga-horaria').innerText = curso.carga_horaria;

            const pct = mat ? (mat.progresso_pct || 0) : 0;
            document.getElementById('player-progresso-bar').style.width = `${pct}%`;
            document.getElementById('player-progresso-txt').innerText = `${pct}%`;

            // Construir playlist de aulas na barra lateral
            const playlistEl = document.getElementById('player-aulas-playlist');
            const totalCountEl = document.getElementById('player-aulas-total-count');
            playlistEl.innerHTML = '';
            totalCountEl.innerText = `${(curso.aulas || []).length} Aulas`;

            if (curso.aulas && curso.aulas.length > 0) {
                curso.aulas.forEach((aula, idx) => {
                    const concluida = this.eadAulasConcluidas.includes(aula.id);
                    const item = document.createElement('div');
                    item.className = `ead-playlist-item ${idx === 0 ? 'active' : ''} ${concluida ? 'completed' : ''}`;
                    item.id = `playlist-item-${aula.id}`;
                    item.onclick = () => App.carregarAulaPlayer(aula.id);
                    item.innerHTML = `
                        <div class="ead-playlist-check">${concluida ? '✅' : '⚪'}</div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">AULA ${idx + 1} • ${aula.duracao_minutos || 15} MIN</div>
                            <div style="font-size: 0.85rem; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${aula.titulo}</div>
                        </div>
                    `;
                    playlistEl.appendChild(item);
                });

                // Carregar primeira aula
                this.carregarAulaPlayer(curso.aulas[0].id);
            } else {
                playlistEl.innerHTML = '<div style="padding: 16px; color: #64748b; font-size: 0.85rem;">Nenhuma aula cadastrada ainda.</div>';
                document.getElementById('player-video-wrapper').innerHTML = '<div style="padding: 40px; text-align: center; color: #94a3b8;">Nenhum vídeo disponível para este curso.</div>';
            }

            // Renderizar Mural e Dúvidas
            this.renderPlayerMural(mural);
            this.renderPlayerDuvidas(duvidas);
            this.atualizarCardStatusProva();

            // Abrir modal
            document.getElementById('modal-curso-player').classList.add('open');
        } catch (err) {
            console.error('Erro ao abrir sala de aula EAD:', err);
            this.showToast('Não foi possível carregar a sala de aula.', 'danger');
        }
    },

    carregarAulaPlayer(aulaId) {
        if (!this.eadCurrentCurso || !this.eadCurrentCurso.aulas) return;
        const aula = this.eadCurrentCurso.aulas.find(a => a.id === aulaId);
        if (!aula) return;

        this.eadCurrentAula = aula;

        // Atualizar destaque na playlist
        document.querySelectorAll('.ead-playlist-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById(`playlist-item-${aulaId}`);
        if (activeItem) activeItem.classList.add('active');

        // Atualizar títulos
        const idx = this.eadCurrentCurso.aulas.findIndex(a => a.id === aulaId);
        document.getElementById('player-aula-ordem').innerText = `Aula ${idx + 1} de ${this.eadCurrentCurso.aulas.length}`;
        document.getElementById('player-aula-titulo').innerText = aula.titulo;
        document.getElementById('player-aula-conteudo').innerText = aula.conteudo_texto || 'Assista à videoaula acima com atenção e avance nas etapas para liberar a avaliação prática e seu certificado.';

        // Renderizar player de vídeo
        const videoWrapper = document.getElementById('player-video-wrapper');
        const url = (aula.url_video || '').trim();
        const tipo = (aula.tipo_video || '').toLowerCase();

        if (tipo === 'upload' || url.endsWith('.mp4') || url.endsWith('.webm')) {
            videoWrapper.innerHTML = `
                <video controls autoplay style="width: 100%; height: 100%; max-height: 480px; background: #000; border-radius: 8px;" src="${url}">
                    Seu navegador não suporta a reprodução direta deste formato de vídeo.
                </video>
            `;
        } else if (tipo === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = '';
            if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
            } else if (url.includes('v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('embed/')) {
                videoId = url.split('embed/')[1].split('?')[0];
            }
            videoWrapper.innerHTML = `
                <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
                    title="${aula.titulo}" 
                    style="width: 100%; height: 420px; border: none; border-radius: 8px;" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            `;
        } else if (tipo === 'vimeo' || url.includes('vimeo.com')) {
            const vimeoId = url.replace(/[^0-9]/g, '');
            videoWrapper.innerHTML = `
                <iframe src="https://player.vimeo.com/video/${vimeoId}?autoplay=1" 
                    title="${aula.titulo}" 
                    style="width: 100%; height: 420px; border: none; border-radius: 8px;" 
                    allow="autoplay; fullscreen; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            `;
        } else if (url) {
            videoWrapper.innerHTML = `
                <iframe src="${url}" 
                    title="${aula.titulo}" 
                    style="width: 100%; height: 420px; border: none; border-radius: 8px;" 
                    allowfullscreen>
                </iframe>
            `;
        } else {
            videoWrapper.innerHTML = `
                <div style="height: 280px; display: flex; align-items: center; justify-content: center; flex-direction: column; background: #1e293b; color: #fff; border-radius: 8px;">
                    <div style="font-size: 2.5rem; margin-bottom: 8px;">🎥</div>
                    <div style="font-size: 1rem; font-weight: 600;">Esta aula é baseada em leitura e procedimentos teóricos.</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">Revise as diretrizes da NR abaixo e clique em Concluir.</div>
                </div>
            `;
        }

        // Atualizar estado do botão de conclusão
        const concluida = this.eadAulasConcluidas.includes(aulaId);
        const btnConcluir = document.getElementById('btn-concluir-aula');
        if (concluida) {
            btnConcluir.innerText = '✅ Aula Concluída (Rever)';
            btnConcluir.className = 'btn btn-outline';
        } else {
            btnConcluir.innerText = '✅ Concluir esta Aula e Avançar';
            btnConcluir.className = 'btn btn-primary';
        }
    },

    async marcarAulaAtualConcluida() {
        if (!this.eadCurrentAula || !this.eadMatriculaAtiva) return;
        const matId = this.eadMatriculaAtiva.id;
        const aulaId = this.eadCurrentAula.id;

        try {
            const res = await this.api(`/ead/matriculas/${matId}/aulas/${aulaId}/concluir`, 'POST');
            if (res.progresso) {
                const pct = res.progresso.progresso_pct || 0;
                document.getElementById('player-progresso-bar').style.width = `${pct}%`;
                document.getElementById('player-progresso-txt').innerText = `${pct}%`;
            }

            if (!this.eadAulasConcluidas.includes(aulaId)) {
                this.eadAulasConcluidas.push(aulaId);
            }

            // Atualizar ícone na playlist
            const item = document.getElementById(`playlist-item-${aulaId}`);
            if (item) {
                item.classList.add('completed');
                const checkEl = item.querySelector('.ead-playlist-check');
                if (checkEl) checkEl.innerText = '✅';
            }

            // Avançar para próxima aula se houver
            const aulas = this.eadCurrentCurso.aulas || [];
            const curIdx = aulas.findIndex(a => a.id === aulaId);

            if (curIdx < aulas.length - 1) {
                this.showToast('Aula concluída com sucesso! Avançando para a próxima...', 'success');
                this.carregarAulaPlayer(aulas[curIdx + 1].id);
            } else {
                this.showToast('🎉 Parabéns! Você concluiu 100% das aulas! A Prova Prática foi liberada.', 'success');
                this.atualizarCardStatusProva();
                this.alternarTabPlayer('prova');
            }

            await this.renderEad();
        } catch (err) {
            console.error('Erro ao concluir aula:', err);
        }
    },

    alternarTabPlayer(tab) {
        ['mural', 'duvidas', 'prova'].forEach(t => {
            const navBtn = document.getElementById(`player-nav-${t}`);
            const pane = document.getElementById(`player-tab-${t}`);
            if (navBtn) navBtn.classList.toggle('active', t === tab);
            if (pane) pane.style.display = (t === tab) ? 'block' : 'none';
        });
    },

    renderPlayerMural(muralList) {
        const listEl = document.getElementById('player-mural-list');
        const formWrap = document.getElementById('player-mural-form-wrapper');

        const isAdminOrProf = this.currentUser && (this.currentUser.perfil === 'Administrador' || this.currentUser.perfil === 'Instrutor / Professor');
        if (formWrap) {
            if (isAdminOrProf) {
                formWrap.innerHTML = `
                    <form onsubmit="App.publicarMuralEad(event)" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
                        <div style="font-weight: 700; font-size: 0.88rem; color: #1e293b; margin-bottom: 8px;">📢 Publicar Novo Comunicado no Mural:</div>
                        <div class="form-grid" style="gap: 8px;">
                            <div class="form-group full-width">
                                <input type="text" id="mural-input-titulo" class="form-control" placeholder="Título do Comunicado (Ex: Dica de Simulado, Cronograma...)" required>
                            </div>
                            <div class="form-group full-width">
                                <textarea id="mural-input-msg" class="form-control" rows="2" placeholder="Mensagem para todos os colaboradores matriculados..." required></textarea>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <label style="font-size: 0.8rem; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                <input type="checkbox" id="mural-input-importante" style="accent-color: #d97706;"> Marcar como Comunicado Importante / Urgente
                            </label>
                            <button type="submit" class="btn btn-primary" style="padding: 6px 16px; font-size: 0.85rem;">Publicar Aviso</button>
                        </div>
                    </form>
                `;
            } else {
                formWrap.innerHTML = '';
            }
        }

        if (!muralList || muralList.length === 0) {
            listEl.innerHTML = '<div style="padding: 16px; color: #64748b; font-size: 0.85rem;">Nenhum comunicado no mural até o momento.</div>';
            return;
        }

        listEl.innerHTML = muralList.map(m => `
            <div class="ead-mural-card ${m.aviso_importante ? 'urgent' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <div style="font-weight: 700; font-size: 0.92rem; color: #1e293b;">
                        ${m.aviso_importante ? '⚠️ ' : '📌 '}${m.titulo}
                    </div>
                    <span style="font-size: 0.75rem; color: #64748b;">${new Date(m.created_at || Date.now()).toLocaleDateString('pt-BR')}</span>
                </div>
                <div style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin-bottom: 6px;">${m.mensagem}</div>
                <div style="font-size: 0.75rem; color: #0284c7; font-weight: 600;">Postado por: ${m.autor_nome || 'Instrutor'}</div>
            </div>
        `).join('');
    },

    async publicarMuralEad(e) {
        if (e) e.preventDefault();
        if (!this.eadCurrentCurso) return;
        const cursoId = this.eadCurrentCurso.id;
        const titulo = document.getElementById('mural-input-titulo').value.trim();
        const mensagem = document.getElementById('mural-input-msg').value.trim();
        const aviso_importante = document.getElementById('mural-input-importante')?.checked ? 1 : 0;

        try {
            await this.api(`/ead/cursos/${cursoId}/mural`, 'POST', { titulo, mensagem, aviso_importante });
            this.showToast('Comunicado publicado com sucesso no mural!', 'success');
            const muralAtualizado = await this.api(`/ead/cursos/${cursoId}/mural`);
            this.renderPlayerMural(muralAtualizado);
        } catch (err) {
            console.error('Erro ao publicar mural:', err);
        }
    },

    renderPlayerDuvidas(duvidasList) {
        const listEl = document.getElementById('player-duvidas-list');
        const countEl = document.getElementById('player-duvidas-count');
        if (countEl) countEl.innerText = duvidasList ? duvidasList.length : 0;

        if (!duvidasList || duvidasList.length === 0) {
            listEl.innerHTML = '<div style="padding: 16px; color: #64748b; font-size: 0.85rem;">Nenhuma dúvida enviada ainda. Faça uma pergunta abaixo diretamente ao professor!</div>';
            return;
        }

        const isAdminOrProf = this.currentUser && (this.currentUser.perfil === 'Administrador' || this.currentUser.perfil === 'Instrutor / Professor');

        listEl.innerHTML = duvidasList.map(d => `
            <div class="ead-duvida-card">
                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #64748b; margin-bottom: 4px;">
                    <span><strong>${d.aluno_nome || 'Colaborador'}</strong> ${d.aula_titulo ? `(Aula: ${d.aula_titulo})` : ''}</span>
                    <span>${new Date(d.created_at || Date.now()).toLocaleDateString('pt-BR')}</span>
                </div>
                <div style="font-size: 0.9rem; font-weight: 600; color: #1e293b; margin-bottom: 8px;">
                    ❓ "${d.pergunta}"
                </div>

                ${d.resposta ? `
                    <div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 10px; border-radius: 4px; font-size: 0.85rem; color: #166534;">
                        <div style="font-weight: 700; margin-bottom: 2px;">👨‍🏫 Resposta do Professor (${d.professor_nome || 'Instrutor'}):</div>
                        <div>${d.resposta}</div>
                    </div>
                ` : `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #fffbeb; padding: 8px 12px; border-radius: 4px;">
                        <span style="font-size: 0.78rem; color: #b45309; font-weight: 600;">⏳ Aguardando resposta do instrutor</span>
                        ${isAdminOrProf ? `
                            <button type="button" class="btn btn-outline" style="font-size: 0.78rem; padding: 4px 10px;" onclick="App.responderDuvidaEad(${d.id})">
                                Responder Colaborador
                            </button>
                        ` : ''}
                    </div>
                `}
            </div>
        `).join('');
    },

    async enviarDuvidaEad(e) {
        if (e) e.preventDefault();
        if (!this.eadCurrentCurso) return;
        const cursoId = this.eadCurrentCurso.id;
        const aulaId = this.eadCurrentAula ? this.eadCurrentAula.id : null;
        const input = document.getElementById('input-nova-duvida');
        const pergunta = input.value.trim();

        if (!pergunta) return;

        try {
            await this.api(`/ead/cursos/${cursoId}/duvidas`, 'POST', { pergunta, aula_id: aulaId });
            input.value = '';
            this.showToast('Dúvida enviada ao professor com sucesso!', 'success');
            const duvidasAtualizadas = await this.api(`/ead/cursos/${cursoId}/duvidas`);
            this.renderPlayerDuvidas(duvidasAtualizadas);
        } catch (err) {
            console.error('Erro ao enviar dúvida:', err);
        }
    },

    async responderDuvidaEad(duvidaId) {
        const resposta = prompt('Digite sua resposta técnica e pedagógica para o colaborador:');
        if (!resposta || !resposta.trim()) return;

        try {
            await this.api(`/ead/duvidas/${duvidaId}/resposta`, 'POST', { resposta: resposta.trim() });
            this.showToast('Resposta registrada com sucesso!', 'success');
            const duvidasAtualizadas = await this.api(`/ead/cursos/${this.eadCurrentCurso.id}/duvidas`);
            this.renderPlayerDuvidas(duvidasAtualizadas);
        } catch (err) {
            console.error('Erro ao responder dúvida:', err);
        }
    },

    atualizarCardStatusProva() {
        const card = document.getElementById('player-prova-status-card');
        if (!card || !this.eadCurrentCurso) return;

        const mat = this.eadMatriculaAtiva;
        const curso = this.eadCurrentCurso;
        const totalAulas = (curso.aulas || []).length;
        const concluidas = this.eadAulasConcluidas.length;
        const todasConcluidas = totalAulas > 0 && concluidas >= totalAulas;

        if (mat && mat.status === 'Aprovado') {
            card.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 8px;">🏆</div>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: #16a34a; margin-bottom: 6px;">
                    Treinamento Concluído com Sucesso!
                </h3>
                <p style="font-size: 0.9rem; color: #475569; max-width: 500px; margin: 0 auto 16px auto;">
                    Você foi aprovado com nota <strong>${mat.nota_final || 100}%</strong>. Seu certificado oficial foi emitido em total conformidade com a <strong>NR-01 Anexo II</strong>.
                </p>
                <div style="display: flex; justify-content: center; gap: 12px;">
                    <button type="button" class="btn btn-primary" style="padding: 10px 22px; font-weight: 700; font-size: 0.95rem;" onclick="App.imprimirCertificadoEad(${mat.id})">
                        🖨️ Imprimir Certificado Oficial (A4)
                    </button>
                </div>
            `;
        } else if (todasConcluidas) {
            card.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 8px;">📝</div>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 6px;">
                    Avaliação Prática de Conhecimento Pronta
                </h3>
                <p style="font-size: 0.9rem; color: #475569; max-width: 520px; margin: 0 auto 18px auto;">
                    Você assistiu a todas as ${totalAulas} aulas normativas. Para obter o seu certificado, responda às questões práticas. A nota mínima para aprovação é <strong>${curso.nota_minima || 70}%</strong>.
                </p>
                <button type="button" class="btn btn-primary" style="padding: 11px 26px; font-weight: 700; font-size: 1rem;" onclick="App.abrirProvaEad(${curso.id})">
                    🚀 Iniciar Avaliação Prática Agora
                </button>
            `;
        } else {
            card.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 8px;">🔒</div>
                <h3 style="font-size: 1.15rem; font-weight: 700; color: #64748b; margin-bottom: 6px;">
                    Avaliação Bloqueada (NR-01 Anexo II)
                </h3>
                <p style="font-size: 0.88rem; color: #64748b; max-width: 500px; margin: 0 auto 12px auto;">
                    A norma regulamentadora exige a conclusão integral da carga horária e videoaulas antes da aplicação da prova prática.
                </p>
                <div style="font-weight: 700; color: #0284c7; font-size: 0.9rem;">
                    Progresso Atual: ${concluidas} de ${totalAulas} aulas concluídas
                </div>
            `;
        }
    },

    async abrirProvaEad(cursoId) {
        try {
            const avaliacao = await this.api(`/ead/cursos/${cursoId}/avaliacao`);
            if (!avaliacao || !avaliacao.questoes || avaliacao.questoes.length === 0) {
                this.showToast('Nenhuma questão cadastrada para este treinamento.', 'warning');
                return;
            }

            document.getElementById('prova-curso-id').value = cursoId;
            document.getElementById('prova-matricula-id').value = this.eadMatriculaAtiva ? this.eadMatriculaAtiva.id : '';
            document.getElementById('prova-titulo').innerText = `📝 Avaliação Prática: ${avaliacao.titulo}`;

            const questoesContainer = document.getElementById('prova-questoes-container');
            questoesContainer.innerHTML = avaliacao.questoes.map((q, idx) => `
                <div class="ead-question-box" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <div style="font-weight: 700; font-size: 0.95rem; color: #1e293b; margin-bottom: 12px;">
                        ${idx + 1}. ${q.enunciado}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${(q.opcoes || []).map((op, oIdx) => {
                            const letra = ['A', 'B', 'C', 'D', 'E'][oIdx];
                            return `
                                <label style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 0.88rem; transition: background 0.15s;">
                                    <input type="radio" name="questao_${q.id}" value="${letra}" required style="margin-top: 3px; accent-color: #0284c7;">
                                    <span><strong>${letra})</strong> ${op}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('');

            document.getElementById('modal-prova-ead').classList.add('open');
        } catch (err) {
            console.error('Erro ao abrir prova:', err);
            this.showToast('Não foi possível carregar as questões da prova.', 'danger');
        }
    },

    async submeterProvaEad(e) {
        if (e) e.preventDefault();
        const matId = document.getElementById('prova-matricula-id').value;
        const cursoId = document.getElementById('prova-curso-id').value;

        // Coletar respostas
        const form = e.target;
        const formData = new FormData(form);
        const respostas = [];

        for (let [chave, valor] of formData.entries()) {
            if (chave.startsWith('questao_')) {
                const questao_id = parseInt(chave.replace('questao_', ''), 10);
                respostas.push({ questao_id, resposta_aluno: valor });
            }
        }

        try {
            const btn = document.getElementById('btn-finalizar-prova');
            btn.disabled = true;
            btn.innerText = 'Processando e Corrigindo...';

            const resultado = await this.api(`/ead/matriculas/${matId}/avaliacao`, 'POST', { respostas });

            document.getElementById('modal-prova-ead').classList.remove('open');

            if (resultado.aprovado) {
                this.showToast(`🎉 PARABÉNS! Você foi APROVADO com nota ${resultado.nota}%! Certificado emitido!`, 'success');
                if (this.eadMatriculaAtiva) {
                    this.eadMatriculaAtiva.status = 'Aprovado';
                    this.eadMatriculaAtiva.nota_final = resultado.nota;
                }
            } else {
                this.showToast(`Nota obtida: ${resultado.nota}%. A nota de corte é 70%. Você pode revisar o conteúdo e tentar novamente.`, 'danger');
            }

            this.atualizarCardStatusProva();
            await this.renderEad();
        } catch (err) {
            console.error('Erro ao submeter prova:', err);
        } finally {
            const btn = document.getElementById('btn-finalizar-prova');
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Finalizar e Enviar Prova 🚀';
            }
        }
    },

    async imprimirCertificadoEad(matId) {
        try {
            this.showToast('Gerando Certificado Oficial NR-01 Anexo II...', 'info');
            const certData = await this.api(`/ead/matriculas/${matId}/certificado`);
            if (typeof imprimirCertificadoTreinamentoEad === 'function') {
                imprimirCertificadoTreinamentoEad(certData);
            } else {
                this.showToast('Módulo de impressão de certificado não carregado.', 'danger');
            }
        } catch (err) {
            console.error('Erro ao gerar certificado:', err);
            this.showToast('Não foi possível gerar o certificado.', 'danger');
        }
    },

    abrirModalNovoCurso() {
        document.getElementById('curso-ead-id').value = '';
        document.getElementById('cad-curso-titulo').value = '';
        document.getElementById('cad-curso-categoria').value = 'NR-01';
        document.getElementById('cad-curso-horas').value = '8';
        document.getElementById('cad-curso-validade').value = '24';
        document.getElementById('cad-curso-nota').value = '70';
        document.getElementById('cad-curso-descricao').value = '';
        document.getElementById('cad-curso-ementa').value = '';

        // Limpar e preencher 1 aula e 2 questões padrão
        document.getElementById('cad-curso-aulas-container').innerHTML = '';
        document.getElementById('cad-curso-questoes-container').innerHTML = '';

        this.adicionarLinhaAula({ titulo: 'Introdução, Conceitos e Diretrizes Gerais', duracao: 30, tipo: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
        this.adicionarLinhaQuestao({ enunciado: 'Qual o objetivo principal desta capacitação segundo a NR?', correta: 'A' });

        document.getElementById('modal-novo-curso-ead').classList.add('open');
    },

    adicionarLinhaAula(dados = {}) {
        const container = document.getElementById('cad-curso-aulas-container');
        const idx = container.children.length + 1;
        const row = document.createElement('div');
        row.className = 'cad-aula-row';
        row.style.background = '#f8fafc';
        row.style.border = '1px solid #cbd5e1';
        row.style.borderRadius = '8px';
        row.style.padding = '12px';

        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 700; font-size: 0.85rem; color: #0284c7;">AULA ${idx}</span>
                <button type="button" class="btn btn-outline" style="color: #dc2626; border-color: #fca5a5; padding: 2px 8px; font-size: 0.75rem;" onclick="this.closest('.cad-aula-row').remove()">Remover Aula ❌</button>
            </div>
            <div class="form-grid" style="gap: 8px;">
                <div class="form-group full-width">
                    <label class="form-label">Título da Aula *</label>
                    <input type="text" class="form-control aula-titulo" required value="${dados.titulo || ''}" placeholder="Ex: Módulo 1 - Reconhecimento e Análise de Riscos">
                </div>
                <div class="form-group">
                    <label class="form-label">Tipo de Mídia / Vídeo</label>
                    <select class="form-control aula-tipo">
                        <option value="youtube" ${dados.tipo === 'youtube' ? 'selected' : ''}>Link YouTube</option>
                        <option value="vimeo" ${dados.tipo === 'vimeo' ? 'selected' : ''}>Link Vimeo</option>
                        <option value="upload" ${dados.tipo === 'upload' ? 'selected' : ''}>Arquivo no Servidor (/uploads)</option>
                        <option value="externo" ${dados.tipo === 'externo' ? 'selected' : ''}>Outro Link Externo (Drive/Portal)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Duração (Minutos)</label>
                    <input type="number" class="form-control aula-duracao" value="${dados.duracao || 20}" min="1" max="300">
                </div>
                <div class="form-group full-width">
                    <label class="form-label">URL do Vídeo (Link Externo ou Caminho de Upload) *</label>
                    <input type="text" class="form-control aula-url" required value="${dados.url || ''}" placeholder="https://www.youtube.com/watch?v=... ou /uploads/video.mp4">
                </div>
                <div class="form-group full-width">
                    <label class="form-label">Orientações e Conteúdo Complementar da Aula</label>
                    <textarea class="form-control aula-conteudo" rows="2" placeholder="Instruções adicionais para o aluno acompanhar este módulo...">${dados.conteudo || ''}</textarea>
                </div>
            </div>
        `;
        container.appendChild(row);
    },

    adicionarLinhaQuestao(dados = {}) {
        const container = document.getElementById('cad-curso-questoes-container');
        const idx = container.children.length + 1;
        const row = document.createElement('div');
        row.className = 'cad-questao-row';
        row.style.background = '#f8fafc';
        row.style.border = '1px solid #cbd5e1';
        row.style.borderRadius = '8px';
        row.style.padding = '12px';

        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 700; font-size: 0.85rem; color: #1e293b;">QUESTÃO ${idx}</span>
                <button type="button" class="btn btn-outline" style="color: #dc2626; border-color: #fca5a5; padding: 2px 8px; font-size: 0.75rem;" onclick="this.closest('.cad-questao-row').remove()">Remover ❌</button>
            </div>
            <div class="form-group full-width" style="margin-bottom: 8px;">
                <label class="form-label">Enunciado da Questão *</label>
                <input type="text" class="form-control q-enunciado" required value="${dados.enunciado || ''}" placeholder="Ex: Qual o equipamento obrigatório antes de iniciar a operação?">
            </div>
            <div class="form-grid" style="gap: 6px;">
                <div class="form-group full-width">
                    <input type="text" class="form-control q-op-a" required placeholder="Alternativa A (Ex: Realizar a APR e inspecionar os EPIs)" value="${(dados.opcoes && dados.opcoes[0]) || ''}">
                </div>
                <div class="form-group full-width">
                    <input type="text" class="form-control q-op-b" required placeholder="Alternativa B (Ex: Iniciar imediatamente sem avisar a equipe)" value="${(dados.opcoes && dados.opcoes[1]) || ''}">
                </div>
                <div class="form-group full-width">
                    <input type="text" class="form-control q-op-c" required placeholder="Alternativa C (Ex: Desativar os sensores de emergência)" value="${(dados.opcoes && dados.opcoes[2]) || ''}">
                </div>
                <div class="form-group full-width">
                    <input type="text" class="form-control q-op-d" required placeholder="Alternativa D (Ex: Aguardar o final do expediente)" value="${(dados.opcoes && dados.opcoes[3]) || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Gabarito Correto</label>
                    <select class="form-control q-correta">
                        <option value="A" ${dados.correta === 'A' ? 'selected' : ''}>Alternativa A</option>
                        <option value="B" ${dados.correta === 'B' ? 'selected' : ''}>Alternativa B</option>
                        <option value="C" ${dados.correta === 'C' ? 'selected' : ''}>Alternativa C</option>
                        <option value="D" ${dados.correta === 'D' ? 'selected' : ''}>Alternativa D</option>
                    </select>
                </div>
            </div>
        `;
        container.appendChild(row);
    },

    async salvarNovoCursoEad(e) {
        if (e) e.preventDefault();
        const titulo = document.getElementById('cad-curso-titulo').value.trim();
        const categoria = document.getElementById('cad-curso-categoria').value;
        const carga_horaria = parseInt(document.getElementById('cad-curso-horas').value, 10);
        const validade_meses = parseInt(document.getElementById('cad-curso-validade').value, 10);
        const nota_minima = parseInt(document.getElementById('cad-curso-nota').value, 10);
        const descricao = document.getElementById('cad-curso-descricao').value.trim();
        const conteudo_programatico = document.getElementById('cad-curso-ementa').value.trim();

        // Extrair aulas
        const aulas = [];
        document.querySelectorAll('.cad-aula-row').forEach(row => {
            const tit = row.querySelector('.aula-titulo').value.trim();
            const tip = row.querySelector('.aula-tipo').value;
            const dur = parseInt(row.querySelector('.aula-duracao').value, 10) || 15;
            const url = row.querySelector('.aula-url').value.trim();
            const cont = row.querySelector('.aula-conteudo').value.trim();
            if (tit && url) {
                aulas.push({ titulo: tit, tipo_video: tip, duracao_minutos: dur, url_video: url, conteudo_texto: cont });
            }
        });

        if (aulas.length === 0) {
            this.showToast('Adicione pelo menos 1 aula com vídeo.', 'danger');
            return;
        }

        // Extrair questões
        const questoes = [];
        document.querySelectorAll('.cad-questao-row').forEach(row => {
            const enun = row.querySelector('.q-enunciado').value.trim();
            const opA = row.querySelector('.q-op-a').value.trim();
            const opB = row.querySelector('.q-op-b').value.trim();
            const opC = row.querySelector('.q-op-c').value.trim();
            const opD = row.querySelector('.q-op-d').value.trim();
            const corr = row.querySelector('.q-correta').value;

            if (enun && opA && opB) {
                questoes.push({
                    enunciado: enun,
                    opcoes: [opA, opB, opC, opD].filter(Boolean),
                    correta: corr
                });
            }
        });

        const payload = {
            titulo,
            categoria,
            carga_horaria,
            validade_meses,
            nota_minima,
            descricao,
            conteudo_programatico,
            aulas,
            avaliacao: {
                titulo: `Prova Prática de ${categoria}`,
                questoes
            }
        };

        try {
            const btn = document.getElementById('btn-salvar-curso-ead');
            btn.disabled = true;
            btn.innerText = 'Salvando Treinamento...';

            await this.api('/ead/cursos', 'POST', payload);
            this.showToast('Treinamento EAD publicado com sucesso!', 'success');
            document.getElementById('modal-novo-curso-ead').classList.remove('open');
            await this.renderEad();
        } catch (err) {
            console.error('Erro ao salvar treinamento EAD:', err);
        } finally {
            const btn = document.getElementById('btn-salvar-curso-ead');
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Salvar e Publicar Treinamento';
            }
        }
    },

    async abrirModalMatricular(cursoId = null) {
        try {
            const [cursos, colabs] = await Promise.all([
                this.api('/ead/cursos'),
                this.api('/colaboradores')
            ]);

            const cursoSelect = document.getElementById('mat-curso-id');
            const colabSelect = document.getElementById('mat-colaborador-id');

            cursoSelect.innerHTML = cursos.map(c => `
                <option value="${c.id}" ${cursoId && c.id === cursoId ? 'selected' : ''}>${c.categoria} - ${c.titulo}</option>
            `).join('');

            colabSelect.innerHTML = colabs.map(col => `
                <option value="${col.id}">${col.nome} (CPF: ${col.cpf}) - ${col.cargo_nome || 'Colaborador'}</option>
            `).join('');

            document.getElementById('modal-matricular-ead').classList.add('open');
        } catch (err) {
            console.error('Erro ao abrir matrícula:', err);
        }
    },

    async salvarMatriculaEad(e) {
        if (e) e.preventDefault();
        const curso_id = parseInt(document.getElementById('mat-curso-id').value, 10);
        const colaborador_id = parseInt(document.getElementById('mat-colaborador-id').value, 10);

        try {
            await this.api('/ead/matriculas', 'POST', { curso_id, colaborador_id });
            this.showToast('Colaborador matriculado com sucesso no treinamento EAD!', 'success');
            document.getElementById('modal-matricular-ead').classList.remove('open');
            await this.renderEad();
        } catch (err) {
            console.error('Erro ao matricular:', err);
        }
    },

    // ====================================================================
    // 13. CANAL DE DENÚNCIAS & LINHA ÉTICA (LEI 14.457/2022)
    // ====================================================================
    _ultimoProtocolo: '',
    _ultimaChave: '',

    abrirPortalDenuncias() {
        const portal = document.getElementById('portal-denuncias');
        if (portal) {
            portal.style.display = 'flex';
            this.alternarTabPortalDenuncia('nova');
            this.selecionarTipoDenuncia('anonima');

            const form = document.getElementById('form-publico-denuncia');
            if (form) form.reset();

            const errBox = document.getElementById('den-erro-feedback');
            if (errBox) errBox.style.display = 'none';

            const boxTermo = document.getElementById('den-box-termo');
            if (boxTermo) {
                boxTermo.style.borderColor = '#fde68a';
                boxTermo.style.backgroundColor = '#fffbeb';
            }

            const successBox = document.getElementById('box-sucesso-denuncia');
            if (successBox) successBox.style.display = 'none';
            if (form) form.style.display = 'block';

            const card = document.querySelector('.denuncia-portal-card');
            if (card) card.scrollTop = 0;
        }
    },

    fecharPortalDenuncias() {
        const portal = document.getElementById('portal-denuncias');
        if (portal) portal.style.display = 'none';
    },

    alternarTabPortalDenuncia(tab) {
        const btnNova = document.getElementById('btn-tab-nova-denuncia');
        const btnAcompanhar = document.getElementById('btn-tab-acompanhar-denuncia');
        const tabNova = document.getElementById('portal-tab-nova');
        const tabAcompanhar = document.getElementById('portal-tab-acompanhar');

        if (tab === 'nova') {
            btnNova.className = 'btn btn-primary';
            btnAcompanhar.className = 'btn btn-outline';
            tabNova.style.display = 'block';
            tabAcompanhar.style.display = 'none';
        } else {
            btnNova.className = 'btn btn-outline';
            btnAcompanhar.className = 'btn btn-primary';
            tabNova.style.display = 'none';
            tabAcompanhar.style.display = 'block';
        }
    },

    selecionarTipoDenuncia(tipo) {
        const hiddenInput = document.getElementById('denuncia-tipo');
        if (hiddenInput) hiddenInput.value = tipo;

        const cardAnon = document.getElementById('card-tipo-anonima');
        const cardIdent = document.getElementById('card-tipo-identificada');
        const boxIdent = document.getElementById('box-dados-identificados');

        if (tipo === 'anonima') {
            if (cardAnon) cardAnon.classList.add('active');
            if (cardIdent) cardIdent.classList.remove('active');
            if (boxIdent) boxIdent.style.display = 'none';
        } else {
            if (cardAnon) cardAnon.classList.remove('active');
            if (cardIdent) cardIdent.classList.add('active');
            if (boxIdent) boxIdent.style.display = 'block';
        }
    },

    async enviarDenunciaPublica(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const erroFeedback = document.getElementById('den-erro-feedback');
        if (erroFeedback) erroFeedback.style.display = 'none';

        const boxTermo = document.getElementById('den-box-termo');
        if (boxTermo) {
            boxTermo.style.borderColor = '#fde68a';
            boxTermo.style.backgroundColor = '#fffbeb';
        }

        const tipo = document.getElementById('denuncia-tipo')?.value || 'anonima';
        const categoria = document.getElementById('den-categoria')?.value || '';
        const gravidade = document.getElementById('den-gravidade')?.value || 'Média';
        const data_fato = document.getElementById('den-data-fato')?.value || '';
        const local_fato = document.getElementById('den-local')?.value?.trim() || '';
        const envolvidos = document.getElementById('den-envolvidos')?.value?.trim() || '';
        const descricaoEl = document.getElementById('den-descricao');
        const descricao = descricaoEl ? descricaoEl.value.trim() : '';
        const testemunhas = document.getElementById('den-testemunhas')?.value?.trim() || '';
        const termoEl = document.getElementById('den-termo');

        // Validação 1: Descrição detalhada dos fatos
        if (!descricao) {
            if (erroFeedback) {
                erroFeedback.innerText = '⚠️ Por favor, descreva detalhadamente os fatos ocorridos no campo "Relato Detalhado dos Fatos".';
                erroFeedback.style.display = 'block';
            }
            if (descricaoEl) {
                descricaoEl.focus();
                descricaoEl.style.borderColor = '#ef4444';
                descricaoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            this.showToast('Por favor, preencha o relato dos fatos para enviar.', 'warning');
            return;
        } else if (descricaoEl) {
            descricaoEl.style.borderColor = '';
        }

        // Validação 2: Termo de veracidade
        if (!termoEl || !termoEl.checked) {
            if (erroFeedback) {
                erroFeedback.innerText = '⚠️ É obrigatório declarar a veracidade das informações marcando a caixa de seleção acima.';
                erroFeedback.style.display = 'block';
            }
            if (boxTermo) {
                boxTermo.style.borderColor = '#ef4444';
                boxTermo.style.backgroundColor = '#fef2f2';
                boxTermo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            if (termoEl) termoEl.focus();
            this.showToast('Marque a caixa de declaração de veracidade para prosseguir.', 'warning');
            return;
        }

        // Validação 3: Se identificada, nome obrigatório
        if (tipo === 'identificada') {
            const nomeEl = document.getElementById('den-nome');
            const nome = nomeEl ? nomeEl.value.trim() : '';
            if (!nome) {
                if (erroFeedback) {
                    erroFeedback.innerText = '⚠️ Na denúncia identificada, por favor informe seu Nome Completo.';
                    erroFeedback.style.display = 'block';
                }
                if (nomeEl) {
                    nomeEl.focus();
                    nomeEl.style.borderColor = '#ef4444';
                    nomeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                this.showToast('Por favor, informe seu nome na denúncia identificada.', 'warning');
                return;
            }
        }

        const payload = {
            tipo,
            categoria,
            gravidade,
            data_fato,
            local_fato,
            envolvidos,
            descricao,
            testemunhas
        };

        if (tipo === 'identificada') {
            payload.nome = document.getElementById('den-nome')?.value?.trim() || '';
            payload.email = document.getElementById('den-email')?.value?.trim() || '';
            payload.telefone = document.getElementById('den-telefone')?.value?.trim() || '';
            payload.setor = document.getElementById('den-setor')?.value?.trim() || '';
        }

        const btn = document.getElementById('btn-submit-denuncia');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '🔒 Criptografando e Enviando com Segurança...';
            }

            const res = await fetch('/api/denuncias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao enviar relato.');

            const protocolo = data.protocolo || (data.denuncia && data.denuncia.protocolo) || '-';
            const chave = data.chave_acesso || (data.denuncia && data.denuncia.chave_acesso) || '-';

            this._ultimoProtocolo = protocolo;
            this._ultimaChave = chave;

            const elProto = document.getElementById('sucesso-protocolo');
            if (elProto) elProto.innerText = protocolo;

            const elChv = document.getElementById('sucesso-chave');
            if (elChv) elChv.innerText = chave;

            const form = document.getElementById('form-publico-denuncia');
            if (form) form.style.display = 'none';

            const boxSucesso = document.getElementById('box-sucesso-denuncia');
            if (boxSucesso) boxSucesso.style.display = 'block';

            // Rolagem suave de volta ao topo do card para exibir o protocolo com destaque imediato
            const portalCard = document.querySelector('.denuncia-portal-card');
            if (portalCard) {
                portalCard.scrollTop = 0;
            }

            this.showToast('✅ Denúncia registrada com sucesso e total sigilo!', 'success');
        } catch (err) {
            console.error('Erro ao enviar denúncia:', err);
            if (erroFeedback) {
                erroFeedback.innerText = '❌ ' + (err.message || 'Erro ao enviar denúncia ao servidor.');
                erroFeedback.style.display = 'block';
            }
            this.showToast(err.message || 'Erro ao registrar denúncia.', 'danger');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '🔒 Enviar Denúncia com Segurança';
            }
        }
    },

    copiarProtocoloChave() {
        const texto = `SafeWork - Linha Ética CIPA+A\nProtocolo: ${this._ultimoProtocolo}\nChave de Acesso: ${this._ultimaChave}\nLink de Acompanhamento: ${window.location.origin}`;
        navigator.clipboard.writeText(texto).then(() => {
            this.showToast('Protocolo e Chave copiados para a área de transferência!', 'success');
        }).catch(() => {
            prompt('Copie seu Protocolo e Chave abaixo:', `${this._ultimoProtocolo} | ${this._ultimaChave}`);
        });
    },

    async consultarDenunciaPublica(e) {
        if (e) e.preventDefault();
        const protocolo = document.getElementById('busca-protocolo').value.trim();
        const chave_acesso = document.getElementById('busca-chave').value.trim();
        const resContainer = document.getElementById('resultado-acompanhamento-denuncia');

        if (!protocolo || !chave_acesso) return;

        try {
            resContainer.innerHTML = '<div style="padding: 16px; color: #64748b;">Consultando banco de dados de apuração...</div>';

            const res = await fetch(`/api/denuncias/consultar?protocolo=${encodeURIComponent(protocolo)}&chave_acesso=${encodeURIComponent(chave_acesso)}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Protocolo ou chave inválida.');

            const d = data.denuncia;
            const statusBg = {
                'Recebida': '#fef3c7',
                'Em Investigação': '#e0f2fe',
                'Procedente': '#fee2e2',
                'Improcedente': '#f1f5f9',
                'Concluída': '#dcfce7'
            }[d.status] || '#f1f5f9';

            const statusColor = {
                'Recebida': '#d97706',
                'Em Investigação': '#0284c7',
                'Procedente': '#dc2626',
                'Improcedente': '#64748b',
                'Concluída': '#16a34a'
            }[d.status] || '#334155';

            resContainer.innerHTML = `
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 18px; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">PROTOCOLO REGISTRADO</div>
                            <div style="font-size: 1.15rem; font-weight: 800; color: #0369a1; font-family: monospace;">${d.protocolo}</div>
                        </div>
                        <div>
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 0.85rem;">
                                STATUS: ${d.status.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    <div class="form-grid" style="font-size: 0.88rem; gap: 8px; margin-bottom: 14px;">
                        <div><strong>Categoria:</strong> ${d.categoria}</div>
                        <div><strong>Data do Registro:</strong> ${new Date(d.created_at).toLocaleDateString('pt-BR')}</div>
                        <div><strong>Gravidade Informada:</strong> ${d.gravidade}</div>
                        <div><strong>Modalidade:</strong> ${d.tipo === 'anonima' ? '🕵️ Anônima (Sigilosa)' : '👤 Identificada'}</div>
                    </div>

                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
                        <div style="font-weight: 700; font-size: 0.82rem; color: #64748b; margin-bottom: 4px;">RESUMO DO SEU RELATO:</div>
                        <div style="font-size: 0.88rem; color: #334155; line-height: 1.5;">${d.descricao}</div>
                    </div>

                    <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 14px;">
                        <div style="font-weight: 700; font-size: 0.9rem; color: #1e40af; margin-bottom: 6px;">
                            🏛️ Parecer Oficial do Comitê de Ética / CIPA+A:
                        </div>
                        <div style="font-size: 0.88rem; color: #1e3a8a; line-height: 1.5; margin-bottom: 8px;">
                            ${d.resposta_denunciante || 'Sua manifestação foi recebida com sucesso e está sob triagem preliminar do Comitê de Ética. O prazo legal para primeira apuração é de até 30 dias.'}
                        </div>
                        ${d.medidas_tomadas ? `
                            <div style="font-size: 0.82rem; color: #047857; font-weight: 700;">
                                Medidas adotadas: ${d.medidas_tomadas}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        } catch (err) {
            resContainer.innerHTML = `<div style="padding: 16px; background: #fee2e2; border: 1px solid #fca5a5; color: #b91c1c; border-radius: 8px; font-size: 0.88rem;">${err.message || 'Relato não encontrado.'}</div>`;
        }
    },

    async renderDenuncias() {
        try {
            const filtro = document.getElementById('filtro-status-denuncia')?.value || '';
            const data = await this.api(`/denuncias${filtro ? `?status=${encodeURIComponent(filtro)}` : ''}`);

            const lista = data.denuncias || [];
            const st = data.estatisticas || {};

            // Atualizar KPIs
            document.getElementById('kpi-denuncias-total').innerText = st.total || lista.length;
            document.getElementById('kpi-denuncias-investigacao').innerText = st.em_investigacao || 0;
            document.getElementById('kpi-denuncias-procedentes').innerText = st.procedentes || 0;
            document.getElementById('kpi-denuncias-concluidas').innerText = st.concluidas || 0;

            const tbody = document.getElementById('tbody-denuncias');
            if (!tbody) return;

            if (lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">Nenhuma denúncia registrada com este filtro.</td></tr>';
                return;
            }

            tbody.innerHTML = lista.map(d => {
                const statusBadgeBg = {
                    'Recebida': '#fef3c7',
                    'Em Investigação': '#e0f2fe',
                    'Procedente': '#fee2e2',
                    'Improcedente': '#f1f5f9',
                    'Concluída': '#dcfce7'
                }[d.status] || '#f1f5f9';

                const statusColor = {
                    'Recebida': '#d97706',
                    'Em Investigação': '#0284c7',
                    'Procedente': '#dc2626',
                    'Improcedente': '#64748b',
                    'Concluída': '#16a34a'
                }[d.status] || '#334155';

                const urgBg = d.gravidade === 'Alta' ? '#fee2e2' : (d.gravidade === 'Média' ? '#fef3c7' : '#f1f5f9');
                const urgColor = d.gravidade === 'Alta' ? '#dc2626' : (d.gravidade === 'Média' ? '#d97706' : '#64748b');

                return `
                    <tr>
                        <td style="font-family: monospace; font-weight: 700; color: #0284c7;">${d.protocolo}</td>
                        <td>${new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>
                            <span class="badge" style="background: ${d.tipo === 'anonima' ? '#f1f5f9' : '#e0f2fe'}; color: ${d.tipo === 'anonima' ? '#475569' : '#0369a1'};">
                                ${d.tipo === 'anonima' ? '🕵️ Anônima' : '👤 Identificada'}
                            </span>
                        </td>
                        <td style="font-weight: 600;">${d.categoria}</td>
                        <td><span class="badge" style="background: ${urgBg}; color: ${urgColor};">${d.gravidade}</span></td>
                        <td><span class="badge" style="background: ${statusBadgeBg}; color: ${statusColor}; font-weight: 700;">${d.status}</span></td>
                        <td>
                            <button type="button" class="btn btn-outline" style="padding: 5px 10px; font-size: 0.8rem;" onclick="App.abrirModalDetalhesDenuncia(${d.id})">
                                ⚖️ Analisar / Tramitar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error('Erro ao renderizar denúncias:', err);
        }
    },

    async abrirModalDetalhesDenuncia(id) {
        try {
            const data = await this.api(`/denuncias/${id}`);
            const d = data.denuncia;

            document.getElementById('tramitacao-denuncia-id').value = d.id;
            document.getElementById('modal-denuncia-subtitulo').innerText = `Protocolo: ${d.protocolo} • Registrado em: ${new Date(d.created_at).toLocaleDateString('pt-BR')}`;

            // Preencher campos de tramitação
            document.getElementById('tramitacao-status').value = d.status || 'Recebida';
            document.getElementById('tramitacao-medidas').value = d.medidas_tomadas || '';
            document.getElementById('tramitacao-resposta').value = d.resposta_denunciante || '';
            document.getElementById('tramitacao-notas').value = d.parecer_comite || '';

            // Montar visualização dos fatos
            const content = document.getElementById('detalhes-denuncia-content');
            content.innerHTML = `
                <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                        <div>
                            <span style="font-size: 0.8rem; color: #64748b;">Modalidade:</span>
                            <span style="font-weight: 700; color: #1e293b;">${d.tipo === 'anonima' ? '🕵️ Denúncia Anônima (Sigilo Absoluto Lei 14.457/22)' : '👤 Denúncia Identificada'}</span>
                        </div>
                        <div>
                            <span style="font-size: 0.8rem; color: #64748b;">Gravidade:</span>
                            <span style="font-weight: 700; color: #dc2626;">${d.gravidade}</span>
                        </div>
                    </div>

                    ${d.tipo === 'identificada' ? `
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.85rem;">
                            <div style="font-weight: 700; color: #166534; margin-bottom: 4px;">📋 Dados do Denunciante (Protegido por LGPD e Imunidade):</div>
                            <div>Nome: <strong>${d.nome || '-'}</strong> | E-mail: <strong>${d.email || '-'}</strong> | Tel: <strong>${d.telefone || '-'}</strong> | Setor: <strong>${d.setor || '-'}</strong></div>
                        </div>
                    ` : ''}

                    <div class="form-grid" style="font-size: 0.88rem; gap: 8px; margin-bottom: 10px;">
                        <div><strong>Categoria:</strong> ${d.categoria}</div>
                        <div><strong>Data do Fato:</strong> ${d.data_fato || 'Não especificada'}</div>
                        <div><strong>Local / Setor:</strong> ${d.local_fato || 'Não especificado'}</div>
                        <div><strong>Pessoas Envolvidas:</strong> ${d.envolvidos || 'Não especificados'}</div>
                    </div>

                    <div style="margin-bottom: 10px;">
                        <div style="font-weight: 700; font-size: 0.82rem; color: #64748b; margin-bottom: 4px;">RELATO COMPLETO:</div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 0.9rem; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${d.descricao}</div>
                    </div>

                    ${d.testemunhas ? `
                        <div>
                            <div style="font-weight: 700; font-size: 0.82rem; color: #64748b; margin-bottom: 2px;">TESTEMUNHAS OU EVIDÊNCIAS APONTADAS:</div>
                            <div style="font-size: 0.85rem; color: #475569;">${d.testemunhas}</div>
                        </div>
                    ` : ''}
                </div>
            `;

            document.getElementById('modal-detalhes-denuncia').classList.add('open');
        } catch (err) {
            console.error('Erro ao abrir detalhes da denúncia:', err);
        }
    },

    async salvarTramitacaoDenuncia(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('tramitacao-denuncia-id').value;
        const status = document.getElementById('tramitacao-status').value;
        const medidas_tomadas = document.getElementById('tramitacao-medidas').value.trim();
        const resposta_denunciante = document.getElementById('tramitacao-resposta').value.trim();
        const parecer_comite = document.getElementById('tramitacao-notas').value.trim();

        try {
            await this.api(`/denuncias/${id}/tramitacao`, 'PUT', {
                status,
                medidas_tomadas,
                resposta_denunciante,
                parecer_comite
            });

            this.showToast('Tramitação atualizada com sucesso! Denunciante poderá consultar o andamento.', 'success');
            document.getElementById('modal-detalhes-denuncia').classList.remove('open');
            await this.renderDenuncias();
        } catch (err) {
            console.error('Erro ao salvar tramitação:', err);
        }
    }
};

// Iniciar ao carregar DOM
document.addEventListener('DOMContentLoaded', () => App.init());
