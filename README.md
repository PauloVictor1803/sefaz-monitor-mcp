# SEFAZ Monitor MCP & REST API

Servidor **Model Context Protocol (MCP)** e **API REST** para monitorar a disponibilidade da **SEFAZ** em tempo real nos 27 estados do Brasil.

O serviço identifica automaticamente se a UF utiliza autorizador próprio (ex: SEFAZ-BA, SEFAZ-SP) ou virtual (SVRS, SVAN), além de listar incidentes ativos, avisos de lentidão e manutenções programadas.

Dados obtidos publicamente do Monitor SEFAZ Webmania® (`summary.json` e `components.json`).

---

## Funcionalidades

- **Compatibilidade MCP 2024-11-05:** Suporte a Streamable HTTP (JSON-RPC 2.0 direto via POST `/mcp`) e Server-Sent Events (SSE via GET `/sse`).
- **Resolução de Autorizadores por Estado:** Mapeia autorizadores próprios e virtuais para NF-e, NFC-e, CT-e e MDF-e.
- **Respostas Diretas para LLMs:** Saídas em texto objetivo para chat acompanhadas do JSON estruturado completo.
- **Deploy Serverless no Netlify:** Pronto para rodar via Netlify Functions (`netlify.toml` + `netlify/functions/mcp.js`) ou localmente com Express.
- **Painel Web com Testador:** Interface na raiz (`/`) para verificar o status e testar as ferramentas em tempo real.

---

## Ferramentas MCP Disponíveis

| Ferramenta | Descrição | Parâmetros |
| :--- | :--- | :--- |
| `consultar_status_geral_sefaz` | Panorama geral da SEFAZ no Brasil (status global, total de incidentes e manutenções). | *(Nenhum)* |
| `consultar_status_uf` | Status da SEFAZ para uma UF específica e tipo de documento. Identifica se o autorizador é próprio ou virtual. | `uf` (obrigatório, ex: `"BA"`), `tipo_documento` (opcional: `"TODOS"`, `"NFE"`, `"NFCE"`, `"CTE"`, `"MDFE"`) |
| `consultar_incidentes_sefaz` | Lista incidentes em andamento, alertas de lentidão e manutenções programadas. | `apenas_ativos` (opcional, padrão: `true`) |
| `listar_todos_estados_sefaz` | Retorna a tabela consolidada dos 27 estados para um documento fiscal. | `tipo_documento` (opcional, padrão: `"NFE"`), `apenas_com_problemas` (opcional, padrão: `false`) |

---

## Como Conectar ao seu Cliente MCP

Substitua `https://SEU_DOMINIO.netlify.app` pela URL onde o servidor estiver hospedado.

### 1. Claude Desktop & Claude Code
No arquivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sefaz-monitor": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://SEU_DOMINIO.netlify.app/mcp"]
    }
  }
}
```

No Claude Code:
```bash
claude mcp add --transport http sefaz-monitor https://SEU_DOMINIO.netlify.app/mcp
```

### 2. Cursor IDE
No arquivo `.cursor/mcp.json` ou nas configurações de MCP do Cursor:

```json
{
  "mcpServers": {
    "sefaz-monitor": {
      "url": "https://SEU_DOMINIO.netlify.app/mcp"
    }
  }
}
```

### 3. Plataformas de Agentes Web (Dify, LibreChat, Chatwoot ou Assistentes Próprios)
- **Tipo de Conexão:** Streamable HTTP
- **URL do Servidor:** `https://SEU_DOMINIO.netlify.app/mcp`
- **Cabeçalhos:** Opcional. Se `AUTH_TOKEN` estiver configurado, envie `Authorization: Bearer <SEU_TOKEN>`.

### 4. Instrução Sugerida para Prompts de Sistema
```text
Quando o usuário relatar erro, lentidão ou rejeição ao emitir documentos fiscais (NF-e, NFC-e, CT-e, MDF-e), ou perguntar sobre a disponibilidade da SEFAZ, consulte o status em tempo real com a ferramenta consultar_status_uf informando a UF da empresa. Explique com clareza se o autorizador do estado (ou o autorizador virtual correspondente) está operacional ou instável.
```

---

## Como Rodar Localmente

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

O servidor local ficará disponível em `http://localhost:3000`:
- **Interface Web:** `http://localhost:3000/`
- **Endpoint MCP:** `http://localhost:3000/mcp`
- **Endpoint SSE:** `http://localhost:3000/sse`
- **Status Geral REST:** `http://localhost:3000/api/status`
- **Status por UF REST:** `http://localhost:3000/api/uf?uf=BA`

---

## Deploy no Netlify

```bash
# 1. Login no Netlify
npx netlify login

# 2. Inicializar o projeto
npx netlify init

# 3. Publicar em produção
npx netlify deploy --build --prod
```

---

## Customização e White-Label

Para adaptar este projeto ao seu produto ou marca:

1. **Nome e Marca:** Edite o objeto `CONFIG` em `index.html` e as variáveis CSS em `:root`.
2. **Repositório:** Atualize a propriedade `CONFIG.repoUrl` com o link do seu repositório Git.
3. **Autenticação Opcional:** Defina a variável de ambiente `AUTH_TOKEN` no `.env` ou no painel do Netlify para restringir o acesso via token Bearer.

---

## Licença

MIT © Paulo Magalhães e colaboradores open-source.
