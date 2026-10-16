# ⚡ SEFAZ Monitor MCP (Streamable HTTP / SSE) & REST API

Servidor **Model Context Protocol (MCP)** e **API REST** para monitoramento em tempo real dos serviços autorizadores da **SEFAZ** em todo o território brasileiro (todos os 27 estados + DF), com identificação inteligente entre autorizadores próprios e virtuais (**SVRS**, **SVAN**), feed de incidentes ativos, alertas de lentidão/queda e manutenções programadas.

Desenvolvido para integração nativa com a assistente de suporte **TINA** da **ATS Informática** (via aba *Tools HTTP e MCP / Servidores MCP Streamable HTTP*), Dify, Cursor, Claude e aplicações web.

Alimentado pelos dados públicos em tempo real do **Monitor SEFAZ Webmania®**:
- `https://monitorsefaz.webmaniabr.com/v3/summary.json`
- `https://monitorsefaz.webmaniabr.com/v3/components.json`

---

## 🚀 Funcionalidades Principais

1. **Protocolo MCP Streamable HTTP & SSE Nativo:** Compatível diretamente com o botão *"Testar conexão"* do Tina Console e clientes MCP modernos (JSON-RPC 2.0 via `initialize`, `ping`, `tools/list` e `tools/call`).
2. **Resolução Inteligente de UFs:**
   - Detecta automaticamente quando o estado possui autorizador próprio (ex: **SEFAZ-BA**, **SEFAZ-SP**, **SEFAZ-MG**) ou autorizador virtual (**SVRS**, **SVAN**).
   - Exemplo: para **BA**, a **NF-e** roda no autorizador próprio da Bahia, mas a **NFC-e** roda na **SVRS**!
3. **Respostas Formatadas para Chat & WhatsApp:** Resumos limpos, sem asteriscos de markdown que possam poluir o WhatsApp, acompanhados do JSON estruturado completo.
4. **Deploy Serverless Imediato no Netlify:** Pronto para publicação gratuita no Netlify com Netlify Functions (`netlify.toml` + `netlify/functions/mcp.js`).
5. **Dashboard Web Interativo:** Painel visual na raiz (`/`) com status ao vivo, matriz de estados e testador de ferramentas integrado.

---

## 🛠️ Ferramentas MCP (Tools) Expostas

| Ferramenta | Descrição | Parâmetros |
| :--- | :--- | :--- |
| `consultar_status_geral_sefaz` | Panorama geral da SEFAZ no Brasil (status global, total de incidentes, manutenções e alertas). | *(Nenhum)* |
| `consultar_status_uf` | Status da SEFAZ para uma UF específica e tipo de documento (NF-e, NFC-e, CT-e, MDF-e). Identifica se o autorizador é próprio ou virtual. | `uf` (obrigatório: ex: `"BA"`), `tipo_documento` (opcional: `"TODOS"`, `"NFE"`, `"NFCE"`, `"CTE"`, `"MDFE"`) |
| `consultar_incidentes_sefaz` | Lista incidentes em andamento, alertas de lentidão e manutenções programadas. | `apenas_ativos` (opcional: `true`/`false`) |
| `listar_todos_estados_sefaz` | Retorna a tabela consolidada dos 27 estados para um documento fiscal. | `tipo_documento` (opcional: `"NFE"`), `apenas_com_problemas` (opcional: `false`) |

---

## 📦 Como Publicar no Netlify

Como você já possui a estrutura no Netlify (semelhante ao `consultainscricaoestadual.netlify.app`), você pode publicar este projeto de qualquer uma das três formas:

### Opção 1: Via Netlify CLI (Recomendado e mais rápido)

Abra o terminal nesta pasta (`Consulta Sefaz API-MCP`) e execute:

```bash
# 1. Login no Netlify (se ainda não estiver conectado)
npx netlify login

# 2. Inicializar o site no Netlify (ou conectar a um existente)
npx netlify init

# 3. Publicar em produção diretamente
npx netlify deploy --prod
```

### Opção 2: Via GitHub / GitLab / Bitbucket

1. Crie um repositório no seu GitHub (ex.: `sefaz-monitor-mcp`).
2. Faça o push dos arquivos desta pasta:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit sefaz monitor mcp"
   git branch -M main
   git remote add origin https://github.com/seu-usuario/sefaz-monitor-mcp.git
   git push -u origin main
   ```
3. No painel do [Netlify](https://app.netlify.com), clique em **"Add new site" > "Import an existing project"** e selecione o repositório.
4. O Netlify detectará automaticamente o arquivo `netlify.toml`! Basta clicar em **Deploy**.

### Opção 3: Drag & Drop no Netlify

1. No terminal, gere o diretório ou suba a pasta inteira no painel [Netlify Drop](https://app.netlify.com/drop).

---

## 🤖 Como Configurar na TINA (Console ATS)

Após publicar no Netlify, você terá sua URL pública (exemplo: `https://sefaz-monitor.netlify.app`).

1. Acesse o **Console da Tina** e abra o agente **Tina**.
2. Clique na aba **Tools HTTP e MCP**.
3. Na seção **Servidores MCP (Streamable HTTP)**, clique em **+ Servidor MCP**.
4. Configure os campos:
   - **Nome / Prefixo:** `sefaz_monitor`
   - **URL:** `https://SEU-SITE.netlify.app/mcp`
   - **Cabeçalhos:** *(deixe vazio, a menos que configure AUTH_TOKEN)*
   - **Filtro:** *(deixe vazio para expor todas as 4 ferramentas)*
5. Clique no botão **Testar conexão**. O servidor responderá com sucesso!
6. Clique em **Salvar e ativar**.

### 💡 Instrução Pronta para o Prompt da Tina:

Adicione o seguinte trecho no **Prompt** da Tina para que ela utilize o monitor automaticamente quando clientes relatarem problemas com notas fiscais:

```text
## Consulta de Status da SEFAZ em Tempo Real
Se o cliente relatar erro ao emitir ou transmitir nota fiscal (NF-e, NFC-e, CT-e, MDF-e), lentidão na emissão, mensagem de rejeição de servidor indisponível ou perguntar se a SEFAZ está fora do ar, consulte imediatamente o status do estado dele através da ferramenta sefaz_monitor_consultar_status_uf informando a UF da empresa. Explique ao cliente de forma clara e empática se a SEFAZ do estado dele (ou a SEFAZ Virtual SVRS) está operacional ou passando por instabilidade no momento.
```

---

## 💻 Como Rodar Localmente (Desenvolvimento)

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor local
npm start
# ou com recarregamento automático:
npm run dev

# 3. Rodar testes automatizados do serviço
npm test
```

O servidor iniciará em `http://localhost:3000`:
- **Dashboard Web Interativo:** `http://localhost:3000/`
- **Endpoint MCP Streamable HTTP:** `http://localhost:3000/mcp`
- **Endpoint MCP SSE:** `http://localhost:3000/sse`
- **Status Geral REST:** `http://localhost:3000/api/status`
- **Status por UF REST:** `http://localhost:3000/api/uf?uf=BA`
- **Incidentes REST:** `http://localhost:3000/api/incidentes`

---

## 🔒 Autenticação Opcional

Por padrão, a consulta é aberta (não requer token). Se desejar restringir o acesso no Netlify ou localmente:
1. Defina a variável de ambiente `AUTH_TOKEN=seu_token_secreto`.
2. No Tina Console, na configuração do MCP, adicione o cabeçalho:
   - Nome: `Authorization`
   - Valor: `Bearer seu_token_secreto` (ou use `x-api-key: seu_token_secreto`).

---

## 📄 Licença

MIT © ATS Informática / Paulo Magalhães.
