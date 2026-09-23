# 🌐 Guia Completo: Como Publicar o SafeWork RH & SST na Nuvem (Acesso 24/7)

Para que o seu sistema funcione **24 horas por dia, 7 dias por semana**, acessível de qualquer lugar do mundo (celular, tablet, computadores de outras filiais ou de casa), **mesmo com o seu computador pessoal desligado**, ele precisa ser hospedado em um **servidor em nuvem**.

O sistema já foi preparado por completo com **Docker**, **SQLite persistente** e scripts prontos para rodar em qualquer provedor de nuvem.

Abaixo apresentamos as **3 melhores opções**, desde a mais simples (grátis em 5 minutos) até a mais profissional com domínio próprio da empresa:

---

## 🥇 Opção 1: Nuvem Gerenciada (Render / Railway) - *Mais Fácil (Recomendado)*

Nesta opção, você não precisa configurar Linux nem servidores. O serviço em nuvem cuida de tudo (inclusive do certificado de segurança HTTPS/SSL grátis).

### Passo a passo no Render.com:
1. Crie uma conta gratuita em [render.com](https://render.com).
2. Acesse sua conta do [GitHub](https://github.com) e crie um novo repositório privado chamado `safework-rh`.
3. Suba os arquivos da pasta `C:\Users\LENOVO\.gemini\antigravity\scratch\safework-rh` para o repositório do GitHub.
4. No painel do Render:
   - Clique em **"New +"** -> **"Web Service"**.
   - Selecione o seu repositório do GitHub `safework-rh`.
   - Em **Environment**, selecione **Docker**.
   - O Render lerá automaticamente o arquivo `Dockerfile` e `render.yaml` que já criamos no projeto!
   - Clique em **Create Web Service**.
5. Pronto! Em 2 minutos, o Render fornecerá um link público e seguro, por exemplo:
   👉 `https://safework-rh.onrender.com`
   Qualquer pessoa da sua equipe poderá acessar desse link pelo celular ou computador, a qualquer hora!

---

## 🥈 Opção 2: Servidor VPS Próprio (Oracle Cloud Grátis ou Hostinger / DigitalOcean)

Se você quer o sistema rodando com o domínio oficial da sua empresa (ex: `https://rh.minhaempresa.com.br` ou `https://sst.minhaempresa.com.br`), uma VPS (Servidor Virtual Privado) é a escolha ideal.

- **Oracle Cloud (Always Free)**: Gratuita para sempre (oferece servidor Linux com até 4 núcleos e 24GB de RAM sem custo).
- **Hostinger / Hetzner / DigitalOcean**: Custam a partir de R$ 18 a R$ 25/mês.

### Passo a passo na VPS (Ubuntu):
1. Contrate ou inicie uma máquina virtual com **Ubuntu 22.04 ou 24.04 LTS**.
2. Conecte no terminal da VPS via SSH.
3. Copie a pasta do projeto para o servidor (via Git ou SFTP com FileZilla).
4. Dentro da pasta do projeto no servidor, execute o instalador automático que criamos:
   ```bash
   chmod +x deploy_vps.sh
   ./deploy_vps.sh
   ```
5. O script irá:
   - Instalar o Node.js 24 LTS.
   - Configurar o **PM2** (gerenciador de processos que mantém o sistema rodando 24h por dia e reinicia sozinho se a máquina for reinicializada).
   - Iniciar o servidor e liberar o firewall.
6. Agora é só acessar via IP ou apontar o domínio da empresa!

---

## 🥉 Opção 3: Publicação Instantânea com Docker (AWS, Google Cloud ou Azure)

Se a sua empresa já utiliza serviços corporativos de nuvem:
1. Basta clonar o projeto ou copiar os arquivos.
2. Executar no terminal do servidor:
   ```bash
   docker compose up -d
   ```
3. O container `safework-rh-sst` subirá instantaneamente com persistência no volume `./data`, garantindo que nenhum dado cadastral, ASO ou EPI seja perdido em atualizações.

---

## 🔒 Segurança e Backup dos Dados na Nuvem

Como o sistema utiliza SQLite nativo em um único arquivo (`safework.db`), fazer backup é extremamente simples:
- Para salvar uma cópia completa de segurança da empresa, basta copiar o arquivo `safework.db` para o Google Drive, OneDrive ou pendrive.
- No Linux/VPS, você pode agendar um backup diário automático para o Google Drive com apenas 1 linha no Cron:
  ```bash
  cp /var/www/safework-rh/safework.db /backups/safework_$(date +%Y%m%d).db
  ```
