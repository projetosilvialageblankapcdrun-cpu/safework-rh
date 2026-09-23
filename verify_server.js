// ====================================================================
// SafeWork RH & SST - Teste de Integração HTTP End-to-End
// ====================================================================

const http = require('node:http');
const { startServer } = require('./server/app.js');

const TEST_PORT = 3005;
const server = startServer(TEST_PORT);

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(`http://localhost:${TEST_PORT}${path}`, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function runVerification() {
    console.log('[E2E Test] Iniciando testes de integração HTTP...');

    try {
        // 1. Testar página inicial (index.html)
        const resIndex = await request('/');
        if (resIndex.status === 200 && resIndex.body.includes('SafeWork')) {
            console.log('  ✅ [PASS] Frontend servido com sucesso (HTTP 200)');
        } else {
            throw new Error(`Falha ao servir index.html: status ${resIndex.status}`);
        }

        // 2. Testar API Dashboard
        const resDash = await request('/api/dashboard');
        const dashData = JSON.parse(resDash.body);
        if (resDash.status === 200 && dashData.estatisticas.totalColaboradores >= 7) {
            console.log('  ✅ [PASS] Endpoint /api/dashboard retornou KPIs e alertas');
        } else {
            throw new Error(`Falha em /api/dashboard: status ${resDash.status}`);
        }

        // 3. Testar API Colaboradores
        const resColab = await request('/api/colaboradores');
        const colabData = JSON.parse(resColab.body);
        if (resColab.status === 200 && Array.isArray(colabData) && colabData.length >= 7) {
            console.log(`  ✅ [PASS] Endpoint /api/colaboradores retornou ${colabData.length} colaboradores`);
        } else {
            throw new Error(`Falha em /api/colaboradores: status ${resColab.status}`);
        }

        // 4. Testar API Central eSocial (Geração S-2220)
        const resS2220 = await request('/api/esocial/gerar-s2220', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aso_id: 1 })
        });
        const s2220Data = JSON.parse(resS2220.body);
        if (resS2220.status === 200 && s2220Data.xml.includes('<evtMonit')) {
            console.log('  ✅ [PASS] Endpoint /api/esocial/gerar-s2220 gerou XML eSocial com sucesso');
        } else {
            throw new Error(`Falha ao gerar XML S-2220: status ${resS2220.status}`);
        }

        console.log('\n🎉 TODOS OS TESTES END-TO-END PASSARAM COM SUCESSO!\n');
    } catch (err) {
        console.error('❌ Falha na verificação HTTP:', err);
        process.exitCode = 1;
    } finally {
        server.close();
    }
}

// Aguardar meio segundo para garantir que o server está ouvindo
setTimeout(runVerification, 500);
