# Diretrizes e Instruções para Agentes de IA (AGENTS.md)

Este repositório implementa o **SEFAZ Monitor MCP**, um servidor compatível com o protocolo aberto **Model Context Protocol (MCP)** e uma **API REST** de alta performance para monitoramento em tempo real da SEFAZ nos 27 estados do Brasil.

Para o manual completo de atendimento e diagnóstico de suporte fiscal a operadores, consulte também o arquivo [INSTRUCOES_AGENTE.md](INSTRUCOES_AGENTE.md).

---

## 1. Endpoints do Servidor

- **Produção (Netlify):** `https://monitorsefazmcp.netlify.app`
- **Endpoint MCP (Streamable HTTP):** `https://monitorsefazmcp.netlify.app/mcp`
- **Endpoint MCP (SSE):** `https://monitorsefazmcp.netlify.app/sse`
- **Endpoint REST Status Global:** `https://monitorsefazmcp.netlify.app/api/status`
- **Endpoint REST Status por UF:** `https://monitorsefazmcp.netlify.app/api/uf?uf=BA`
- **Documentação Interativa:** `https://monitorsefazmcp.netlify.app/docs`
- **Contexto para LLMs:** `https://monitorsefazmcp.netlify.app/llms.txt`

---

## 2. Ferramentas MCP Disponíveis

| Ferramenta | Parâmetros | Finalidade |
| :--- | :--- | :--- |
| `consultar_status_geral_sefaz` | *(Nenhum)* | Retorna o status global de todos os autorizadores do Brasil, total de incidentes ativos e manutenções programadas. |
| `consultar_status_uf` | `uf` (string obrigatória, ex: `"BA"`, `"SP"`), `tipo_documento` (opcional: `"TODOS"`, `"NFE"`, `"NFCE"`, `"CTE"`, `"MDFE"`) | Retorna a situação do estado solicitado, identificando se o autorizador é próprio (ex: SEFAZ Bahia) ou virtual (SVRS / SVAN). |
| `consultar_incidentes_sefaz` | `apenas_ativos` (boolean opcional, padrão: `true`) | Lista falhas ativas, alertas de lentidão e manutenções do Fisco. |
| `listar_todos_estados_sefaz` | `tipo_documento` (opcional: `"NFE"`, `"NFCE"`, `"CTE"`, `"MDFE"`), `apenas_com_problemas` (boolean opcional, padrão: `false`) | Tabela consolidada dos 27 estados para auditoria ou exibição em painéis. |

---

## 3. Roteamento Inteligente de Autorizadores

Nem todo estado brasileiro possui datacenter próprio para todos os modelos fiscais:
* **Próprio:** Estados como SP, MG, RJ, RS, PR, BA (para NF-e) possuem servidores próprios.
* **SVRS (SEFAZ Virtual do RS):** Atende múltiplos estados para NFC-e, CT-e e MDF-e. *Exemplo:* Na Bahia (BA), a **NF-e** roda no autorizador próprio da Bahia, mas a **NFC-e** roda na **SVRS**.
* **SVAN (SEFAZ Virtual do Ambiente Nacional):** Atende estados do Norte/Nordeste para determinados modelos.

O servidor MCP já faz esse de/para automaticamente e retorna o nome exato do autorizador responsável.

---

## 4. Guia Rápido de Resolução para Atendimento ao Operador

Ao receber chamados de operadores ou lojistas sobre "SEFAZ fora do ar" ou "erro na emissão de nota":

1. **SEFAZ com Queda ou Instabilidade Confirmada:**
   * Explicar que a falha é no datacenter da Secretaria da Fazenda (ou SVRS/SVAN) e não no computador/sistema do cliente.
   * Para **NFC-e (varejo)**: Orientar a emissão em **Contingência Offline** (impressão do DANFE NFC-e com transmissão posterior).
   * Para **NF-e**: Verificar se o sistema suporta **SVC-AN** ou **SVC-RS** de acordo com a UF emitente.
   * Orientar o operador a não reenviar notas em loop para não travar o banco nem gerar duplicidade.

2. **SEFAZ Operacional (Sem Queda do Fisco):**
   * O problema é local. Orientar a conferência de:
     1. Validade e instalação do Certificado Digital A1/A3 (cadeia ICP-Brasil).
     2. Conexão de Internet e liberação da porta 443 no Firewall / Antivírus.
     3. Relógio do Windows sincronizado com o horário de Brasília (NTP.br).
     4. Código de Rejeição da SEFAZ (ex: 204/539 duplicidade, 215 falha de schema XML).

---

## 5. Como Configurar Clientes MCP

### Claude Desktop (`claude_desktop_config.json`)
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

### Cursor IDE (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "sefaz-monitor": {
      "url": "https://monitorsefazmcp.netlify.app/mcp"
    }
  }
}
```

### Plataformas de Agentes Web (Streamable HTTP)
- **URL:** `https://monitorsefazmcp.netlify.app/mcp`
- **Transporte:** Streamable HTTP (POST)
- **Cabeçalhos:** Deixar vazio (ou `Authorization: Bearer <TOKEN>` se ativado via variável `AUTH_TOKEN`).
