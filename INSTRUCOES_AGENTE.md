# SEFAZ Monitor — Manual para agentes de IA

## O que este serviço faz

Consulta informações públicas de disponibilidade da SEFAZ por meio do Monitor Webmania. Cobre NF-e, NFC-e, CT-e e MDF-e e resolve o autorizador próprio ou virtual de cada UF conforme o mapeamento da fonte.

Este serviço não autoriza notas, não consulta uma nota específica e não valida CFOP, CST, NCM, CEST, base ou alíquota. Disponibilidade reportada não identifica sozinha a causa do erro de um cliente.

## Conexão

Use o domínio do servidor que fornece este manual. Endpoints:

- `/mcp`: Streamable HTTP, POST JSON-RPC 2.0; protocolo informado pelo servidor: `2024-11-05`.
- `/sse`: transporte SSE quando suportado pelo cliente.
- `/api/status`: panorama nacional.
- `/api/uf?uf=BA&tipo_documento=NFCE`: status por estado e documento.
- `/api/estados?tipo_documento=NFE`: visão das UFs.
- `/api/incidentes?apenas_ativos=true`: incidentes e manutenções.
- `/docs` e `/openapi.json`: documentação REST e especificação.

Cabeçalhos de chamadas JSON: `Content-Type: application/json`, `Accept: application/json`. Se AUTH_TOKEN estiver configurado, envie `Authorization: Bearer <TOKEN>` ou `x-api-key: <TOKEN>`. Armazene a credencial no mecanismo de segredos da plataforma. Nunca inclua o token na URL, no prompt ou na resposta ao cliente.

Use o fluxo de inicialização do cliente MCP e `tools/list` para conferir o catálogo atual. Plataformas podem acrescentar um prefixo ao nome das ferramentas; use o nome efetivamente exposto.

## Ferramentas

### consultar_status_geral_sefaz

Sem parâmetros. Retorna a situação nacional reportada, incidentes, manutenções e componentes com problemas. Use para perguntas gerais, como “Há instabilidade na SEFAZ?”. Não use o panorama sozinho para afirmar a situação de um documento específico de determinada UF.

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"consultar_status_geral_sefaz","arguments":{}}}
```

### consultar_status_uf

`uf`: sigla obrigatória de duas letras. `tipo_documento`: `TODOS`, `NFE`, `NFCE`, `CTE` ou `MDFE`; padrão `TODOS`.

Aproveite a UF já conhecida do emitente. Não confunda com a UF do destinatário nem pergunte novamente um dado disponível. Use o modelo da nota envolvida; se não souber, esclareça ou consulte TODOS.

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"consultar_status_uf","arguments":{"uf":"BA","tipo_documento":"NFCE"}}}
```

Leia os objetos de `documentos`: `status`, `statusRotulo`, `documento`, `tipoAutorizador`, `autorizador` e `autorizadorNome`. O mesmo estado pode usar autorizador próprio em um modelo e SVRS/SVAN em outro. Reutilize o resultado obtido; não presuma um autorizador fixo só pela UF.

### consultar_incidentes_sefaz

`apenas_ativos`: booleano opcional, padrão true. Com false, inclui ocorrências resolvidas recentemente, quando disponíveis. Leia também as manutenções retornadas.

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"consultar_incidentes_sefaz","arguments":{"apenas_ativos":true}}}
```

Não apresente incidente resolvido como falha ativa. Confira as datas, o nome e a atualização de cada aviso. Incidente relacionado à UF não comprova que todos os modelos da UF estejam afetados.

### listar_todos_estados_sefaz

`tipo_documento`: `NFE`, `NFCE`, `CTE` ou `MDFE`; padrão NFE. Não aceita TODOS. `apenas_com_problemas`: booleano opcional, padrão false.

```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"listar_todos_estados_sefaz","arguments":{"tipo_documento":"NFE","apenas_com_problemas":false}}}
```

Use para comparar estados, listar ocorrências ou construir um painel. Para uma pergunta sobre uma única empresa, prefira consultar_status_uf e evite devolver a tabela inteira ao cliente.

## Retorno, atualização e limites

- MCP retorna blocos de texto: um resumo legível e, quando bem-sucedido, JSON estruturado em outro bloco. Não suponha que o primeiro bloco seja JSON. Confira `result.isError` e `error` JSON-RPC antes de usar o conteúdo.
- Status OPERACIONAL significa que não há indisponibilidade reportada para aquele componente no retorno consultado. Não garante a emissão de uma nota nem prova que um problema seja exclusivamente local.
- DEGRADADO e PARCIAL indicam instabilidade/queda parcial; OFFLINE indica indisponibilidade; MANUTENCAO é uma situação distinta. Status desconhecido ou sem mapeamento não deve virar “Operacional” ou “Fora do ar” por suposição.
- A camada de consulta usa cache com TTL de 60 segundos e pode reutilizar dados anteriores se a renovação falhar. O campo `cached` informa uso de cache, mas os retornos atuais não fornecem em todos os casos a idade completa do dado de origem. Não trate o horário da requisição como garantia de atualização da fonte.
- Falha de rede, autenticação ou formato do retorno significa consulta inconclusiva. Explique a limitação e não invente um status verde ou uma queda.
- Datas e horários devem ser interpretados com seu fuso; para atendimento brasileiro, apresente o horário de Brasília de forma explícita.

## Como usar no atendimento

1. Identifique a UF do emitente, o modelo fiscal e a mensagem/código exato do erro. Reutilize o cadastro e o que já foi informado.
2. Consulte o documento correto e informe o autorizador retornado, em linguagem simples.
3. Se houver instabilidade reportada, relacione-a à emissão sem afirmar que todas as outras causas foram descartadas. Opções de contingência dependem do produto, da configuração, da UF e da habilitação vigente: consulte a documentação técnica antes de ensinar os passos. Não invente prazos de transmissão nem prometa retransmissão automática sem evidência do sistema.
4. Se o serviço aparecer operacional, prossiga no diagnóstico com a documentação do sistema: rejeição específica, certificado, conexão e configuração. O painel não identifica sozinho a causa local.
5. Evite consultas repetidas durante o mesmo diagnóstico. Não oriente cancelamentos e retransmissões em sequência por tentativa.

Exemplo de resposta: “Na consulta recebida, a NFC-e da BA aparece operacional no autorizador informado pela ferramenta. Isso não descarta um problema específico da emissão. Qual mensagem ou código aparece na nota?” Adapte a UF, o documento e o status ao retorno real; não copie o exemplo como fato atual.
