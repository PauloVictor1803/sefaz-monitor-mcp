# SEFAZ Monitor MCP & REST API

[![Netlify Status](https://api.netlify.com/api/v1/badges/194e67c9-4ca9-462d-9f6e-2bdce99c7bb2/deploy-status)](https://app.netlify.com/projects/monitorsefazmcp/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-brightgreen.svg)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)

Servidor open-source que implementa o **Model Context Protocol (MCP)** e uma **API REST** de alta performance para monitorar em tempo real a disponibilidade de todos os servidores da **Secretaria da Fazenda (SEFAZ)** nos 27 estados do Brasil.

Desenvolvido para conectar agentes autônomos de IA (Claude, ChatGPT, Cursor, Dify, LibreChat, OpenWebUI) e sistemas ERP diretamente ao status operacional dos autorizadores fiscais.

---

## Acesso Rápido

- 🌐 **Dashboard Web & Testador:** [https://monitorsefazmcp.netlify.app](https://monitorsefazmcp.netlify.app)
- 📡 **Endpoint MCP (Streamable HTTP):** `https://monitorsefazmcp.netlify.app/mcp`
- 📡 **Endpoint SSE (Server-Sent Events):** `https://monitorsefazmcp.netlify.app/sse`
- 📖 **Manual de Instruções para Agentes (.MD):** [INSTRUCOES_AGENTE.md](INSTRUCOES_AGENTE.md) | [AGENTS.md](AGENTS.md)
- 📑 **Documentação da API REST:** [https://monitorsefazmcp.netlify.app/docs](https://monitorsefazmcp.netlify.app/docs)
- 🤖 **Contexto para LLMs:** [https://monitorsefazmcp.netlify.app/llms.txt](https://monitorsefazmcp.netlify.app/llms.txt)

---

## Principais Funcionalidades

- **Protocolo MCP (versão 2024-11-05):** Suporta transporte moderno **Streamable HTTP** (requisições JSON-RPC 2.0 via POST) e **Server-Sent Events (SSE)**.
- **Roteamento Inteligente de Autorizadores:** Resolve automaticamente se um estado usa **Autorizador Próprio** (ex: SEFAZ Bahia para NF-e, SEFAZ São Paulo) ou **Autorizador Virtual** (**SVRS** ou **SVAN**).
  * *Exemplo:* Na Bahia (BA), a **NF-e** roda no autorizador próprio da Bahia, enquanto a **NFC-e** roda na **SVRS** (Sefaz Virtual do RS). O servidor identifica e reporta essa diferença com exatidão.
- **Cobertura Completa de Documentos Fiscais:** NF-e (modelo 55), NFC-e (modelo 65), CT-e (modelo 57) e MDF-e (modelo 58).
- **Deploy Serverless Contínuo:** Configurado no Netlify (`netlify.toml` + `netlify/functions/mcp.js`), com deploy automático a cada commit na branch `main`.
- **Cache Inteligente:** Cache em memória com TTL de 60 segundos para evitar sobrecarga nas fontes e garantir respostas sub-segundo.
- **Formatação para Agentes:** As ferramentas retornam resumos em texto objetivo com esferas de status (`🟢 Operacional`, `🟡 Instável`, `🔴 Fora do Ar`) acompanhados do payload JSON estruturado.

---

## Catálogo de Ferramentas MCP (Tools)

| Ferramenta | Descrição | Parâmetros |
| :--- | :--- | :--- |
| `consultar_status_geral_sefaz` | Panorama geral da SEFAZ no país (status consolidado, total de incidentes ativos e manutenções). | *(Nenhum)* |
| `consultar_status_uf` | Consulta o status de uma UF específica e tipo de documento. Resolve o autorizador próprio ou virtual. | `uf` *(obrigatório, ex: `"BA"`, `"SP"`)*<br>`tipo_documento` *(opcional: `"TODOS"`, `"NFE"`, `"NFCE"`, `"CTE"`, `"MDFE"`)* |
| `consultar_incidentes_sefaz` | Lista incidentes em andamento, alertas de lentidão e manutenções programadas. | `apenas_ativos` *(opcional, booleano, padrão: `true`)* |
| `listar_todos_estados_sefaz` | Tabela consolidada dos 27 estados para auditoria ou montagem de painéis. | `tipo_documento` *(opcional, padrão: `"NFE"`)*<br>`apenas_com_problemas` *(opcional, padrão: `false`)* |

---

## Como Conectar ao seu Cliente MCP

### 1. Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "sefaz-monitor": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://monitorsefazmcp.netlify.app/mcp"]
    }
  }
}
```

Para **Claude Code**, adicione via terminal:
```bash
claude mcp add --transport http sefaz-monitor https://monitorsefazmcp.netlify.app/mcp
```

### 2. Cursor IDE (`.cursor/mcp.json`)

Adicione em **Settings > Features > MCP** ou no arquivo `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sefaz-monitor": {
      "url": "https://monitorsefazmcp.netlify.app/mcp"
    }
  }
}
```

### 3. Plataformas Web de Agentes (Dify, LibreChat, Chatwoot, Copilot)

- **Tipo de Transporte:** Streamable HTTP (ou Server-Sent Events / SSE)
- **URL do Servidor:** `https://monitorsefazmcp.netlify.app/mcp`
- **Método HTTP:** `POST`
- **Cabeçalhos:** Deixe vazio (ou envie `Authorization: Bearer <SEU_TOKEN>` caso a variável `AUTH_TOKEN` tenha sido configurada).

---

## Instruções para o System Prompt do Agente

Cole o texto abaixo nas instruções de sistema do seu agente para orientá-lo na resolução de falhas:

```text
Quando o usuário relatar falha, lentidão, rejeição de autorizador indisponível ou perguntar se a SEFAZ está operando, invoque a ferramenta consultar_status_uf informando a UF da empresa e o modelo do documento.
- Se a SEFAZ estiver com instabilidade ou queda: explique que a falha é no datacenter do Fisco (ou autorizador virtual SVRS/SVAN) e não no software de gestão. Oriente a emissão em Contingência Offline para NFC-e (com transmissão posterior) ou SVC para NF-e.
- Se a SEFAZ estiver 100% operacional: oriente a checagem de certificado digital A1/A3, liberação de firewall na porta 443, relógio do sistema e código numérico de rejeição da nota.
```

---

## Como Rodar Localmente

```bash
# 1. Clonar o repositório
git clone https://github.com/PauloVictor1803/sefaz-monitor-mcp.git
cd sefaz-monitor-mcp

# 2. Instalar dependências
npm install

# 3. Iniciar o servidor de desenvolvimento
npm start
# ou com live reload:
npm run dev

# 4. Executar os testes automatizados
npm test
```

O servidor local ficará disponível em `http://localhost:3000`:
- **Painel:** `http://localhost:3000/`
- **Endpoint MCP:** `http://localhost:3000/mcp`
- **API REST Status Geral:** `http://localhost:3000/api/status`
- **API REST Status UF:** `http://localhost:3000/api/uf?uf=BA`

---

## Integração Contínua e Deploy Automático (CI/CD)

Este repositório está configurado para **Deploy Contínuo no Netlify**:
1. Todo commit ou pull request aprovado na branch `main` dispara automaticamente o Webhook de build do Netlify.
2. O Netlify empacota as funções serverless e publica a versão mais recente em segundos.

---

## Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.
