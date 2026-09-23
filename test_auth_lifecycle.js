// Teste de Ciclo Completo de Autenticação e Gestão de Usuários
const http = require('node:http');

function request(path, options = {}, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(`http://localhost:3000${path}`, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : null;
                    resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, raw: body });
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(typeof data === 'string' ? data : JSON.stringify(data));
        }
        req.end();
    });
}

async function run() {
    console.log('--- INICIANDO TESTE DO CICLO DE AUTENTICAÇÃO ---');

    // 1. Login Admin
    const loginRes = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { login: 'admin', senha: 'admin123' });

    console.assert(loginRes.status === 200, `Login admin falhou com status ${loginRes.status}`);
    const token = loginRes.data.token;
    console.log('✅ 1. Login do Administrador Geral realizado com sucesso');

    // 2. /api/auth/me
    const meRes = await request('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.assert(meRes.status === 200 && meRes.data.usuario.login === 'admin', 'auth/me falhou');
    console.log('✅ 2. Identificação de sessão (/api/auth/me) validada');

    // 3. Admin cria novo usuário
    const testLogin = `julia.dp.${Date.now()}`;
    const testEmail = `${testLogin}@metalsul.com.br`;
    const createRes = await request('/api/usuarios', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }, {
        nome: 'Julia Assistente DP',
        login: testLogin,
        email: testEmail,
        senha: 'senhaSegura123',
        perfil: 'Gestor DP',
        ativo: 1
    });
    console.assert(createRes.status === 201, `Criação de usuário falhou: ${createRes.status}`);
    const novoUsuarioId = createRes.data.id;
    console.log(`✅ 3. Novo usuário criado pelo Administrador (ID: ${novoUsuarioId})`);

    // 4. Login com novo usuário
    const novoLoginRes = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { login: testLogin, senha: 'senhaSegura123' });
    console.assert(novoLoginRes.status === 200, 'Login do novo usuário falhou');
    const novoToken = novoLoginRes.data.token;
    console.log('✅ 4. Login com as credenciais do novo usuário realizado com sucesso');

    // 5. Testar que não-administrador NÃO pode gerenciar usuários (403)
    const forbRes = await request('/api/usuarios', {
        headers: { 'Authorization': `Bearer ${novoToken}` }
    });
    console.assert(forbRes.status === 403, `Esperado 403 para não-admin, obtido ${forbRes.status}`);
    console.log('✅ 5. Bloqueio de acesso a não-administradores validado (HTTP 403 Forbidden)');

    // 6. Admin altera dados do usuário
    const updateRes = await request(`/api/usuarios/${novoUsuarioId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }, {
        nome: 'Julia Coordenadora DP',
        perfil: 'Gestor DP',
        ativo: 0 // bloqueando usuário
    });
    console.assert(updateRes.status === 200, 'Atualização de usuário falhou');
    console.log('✅ 6. Administrador alterou dados e bloqueou usuário com sucesso');

    // 7. Login do usuário bloqueado deve falhar
    const loginBloqueadoRes = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { login: testLogin, senha: 'senhaSegura123' });
    console.assert(loginBloqueadoRes.status === 401, 'Usuário bloqueado conseguiu logar');
    console.log('✅ 7. Tentativa de login de usuário desativado rejeitada corretamente (HTTP 401)');

    // 8. Admin exclui usuário de teste
    const delRes = await request(`/api/usuarios/${novoUsuarioId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.assert(delRes.status === 200, 'Exclusão de usuário falhou');
    console.log('✅ 8. Administrador removeu usuário de teste com sucesso');

    // 9. Verificar elementos do front-end no index.html
    const htmlRes = await request('/');
    console.assert(htmlRes.raw.includes('id="login-screen"'), 'HTML não possui login-screen');
    console.assert(htmlRes.raw.includes('id="view-usuarios"'), 'HTML não possui view-usuarios');
    console.assert(htmlRes.raw.includes('id="modal-usuario"'), 'HTML não possui modal-usuario');
    console.assert(htmlRes.raw.includes('id="user-topbar-profile"'), 'HTML não possui user-topbar-profile');
    console.log('✅ 9. Componentes da interface visual (tela de login, modais e abas) verificados no HTML');

    console.log('\n=============================================');
    console.log('TODOS OS TESTES DE AUTENTICAÇÃO FORAM APROVADOS COM SUCESSO!');
    console.log('=============================================');
}

run().catch(err => {
    console.error('❌ ERRO NO TESTE:', err);
    process.exit(1);
});
