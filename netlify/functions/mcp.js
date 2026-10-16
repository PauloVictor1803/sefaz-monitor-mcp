import {
    consultarStatusGeral,
    consultarStatusUf,
    consultarIncidentes,
    listarTodosEstados
} from '../../src/services/sefazService.js';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-Requested-With, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

const FERRAMENTAS_MCP = [
    {
        name: 'consultar_status_geral_sefaz',
        description: 'Consulta a situação geral dos servidores da SEFAZ em tempo real em todo o Brasil (status global UP/DOWN, total de incidentes ativos, manutenções programadas e autorizadores com instabilidade).',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'consultar_status_uf',
        description: 'Consulta o status da SEFAZ em tempo real para uma UF (estado) específica e tipo de documento (NF-e, NFC-e, CT-e, MDF-e). Identifica se a UF utiliza autorizador próprio (ex: SEFAZ-BA, SEFAZ-SP) ou virtual (SVRS, SVAN).',
        inputSchema: {
            type: 'object',
            properties: {
                uf: {
                    type: 'string',
                    description: 'Sigla de 2 letras da UF do estado (ex: BA, SP, RJ, MG, PE, RS, etc.)'
                },
                tipo_documento: {
                    type: 'string',
                    description: 'Tipo de documento fiscal a consultar: "TODOS", "NFE", "NFCE", "CTE" ou "MDFE" (padrão: "TODOS")',
                    enum: ['TODOS', 'NFE', 'NFCE', 'CTE', 'MDFE']
                }
            },
            required: ['uf']
        }
    },
    {
        name: 'consultar_incidentes_sefaz',
        description: 'Lista incidentes ativos, alertas de instabilidade, quedas e manutenções programadas nos servidores da SEFAZ nacional e autorizadores estaduais. Permite verificar histórico de problemas recentes.',
        inputSchema: {
            type: 'object',
            properties: {
                apenas_ativos: {
                    type: 'boolean',
                    description: 'Se true (padrão), retorna apenas incidentes e manutenções em andamento. Se false, inclui também incidentes resolvidos recentemente.'
                }
            }
        }
    },
    {
        name: 'listar_todos_estados_sefaz',
        description: 'Retorna a tabela com o status de autorização da SEFAZ para todos os 27 estados do Brasil e autorizadores virtuais.',
        inputSchema: {
            type: 'object',
            properties: {
                tipo_documento: {
                    type: 'string',
                    description: 'Tipo de documento: "NFE", "NFCE", "CTE" ou "MDFE" (padrão: "NFE")',
                    enum: ['NFE', 'NFCE', 'CTE', 'MDFE']
                },
                apenas_com_problemas: {
                    type: 'boolean',
                    description: 'Se true, lista apenas estados que apresentem instabilidade, degradação ou estejam fora do ar (padrão: false).'
                }
            }
        }
    }
];

export const handler = async (event, context) => {
    // 1. Pré-voo CORS (OPTIONS)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    const path = event.path || '';
    const method = event.httpMethod;
    const query = event.queryStringParameters || {};

    // 2. Validação opcional de Token (se AUTH_TOKEN estiver configurado no Netlify)
    const AUTH_TOKEN = process.env.AUTH_TOKEN || null;
    if (AUTH_TOKEN) {
        const authHeader = event.headers['authorization'] || event.headers['Authorization'];
        const apiKeyHeader = event.headers['x-api-key'] || event.headers['X-Api-Key'];
        const tokenRecebido = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : apiKeyHeader;

        if (!tokenRecebido || tokenRecebido !== AUTH_TOKEN) {
            return {
                statusCode: 401,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Não autorizado. Token de autenticação inválido ou ausente.' })
            };
        }
    }

    // 3. Rotas REST Convencionais
    if (path.includes('/api/status') || path.includes('/api/geral')) {
        try {
            const dados = await consultarStatusGeral();
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify(dados)
            };
        } catch (err) {
            return {
                statusCode: 500,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: err.message })
            };
        }
    }

    if (path.includes('/api/uf') || query.uf) {
        try {
            const uf = query.uf;
            const doc = query.tipo_documento || query.doc || 'TODOS';
            const dados = await consultarStatusUf(uf, doc);
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify(dados)
            };
        } catch (err) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: err.message })
            };
        }
    }

    if (path.includes('/api/incidentes')) {
        try {
            const apenasAtivos = query.apenas_ativos !== 'false';
            const dados = await consultarIncidentes(apenasAtivos);
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify(dados)
            };
        } catch (err) {
            return {
                statusCode: 500,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: err.message })
            };
        }
    }

    if (path.includes('/api/estados')) {
        try {
            const doc = query.tipo_documento || 'NFE';
            const apenasProblemas = query.apenas_com_problemas === 'true';
            const dados = await listarTodosEstados(doc, apenasProblemas);
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify(dados)
            };
        } catch (err) {
            return {
                statusCode: 500,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: err.message })
            };
        }
    }

    // 4. Suporte ao Streamable HTTP / SSE do MCP via GET
    if (method === 'GET') {
        const accept = event.headers['accept'] || event.headers['Accept'] || '';
        if (accept.includes('text/event-stream')) {
            const endpointEvent = `event: endpoint\ndata: ${path || '/mcp'}\n\n`;
            return {
                statusCode: 200,
                headers: {
                    ...CORS_HEADERS,
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                body: endpointEvent
            };
        }

        // Se GET simples na rota /mcp, retorna resumo JSON informando saúde do servidor
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                status: 'online',
                protocol: 'modelcontextprotocol',
                transport: 'streamable-http',
                server: 'sefaz-monitor-mcp',
                version: '1.0.0',
                tools: FERRAMENTAS_MCP.map(t => t.name)
            })
        };
    }

    // 5. Suporte ao Streamable HTTP via POST (Protocolo JSON-RPC 2.0 do MCP)
    if (method === 'POST') {
        let body = {};
        if (event.body) {
            try {
                body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            } catch (e) {
                return {
                    statusCode: 400,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'JSON inválido' }, id: null })
                };
            }
        }

        const { id, method: rpcMethod, params } = body || {};

        // A) Inicialização (initialize)
        if (rpcMethod === 'initialize') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: id ?? 1,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: { listChanged: false }
                        },
                        serverInfo: {
                            name: 'sefaz-monitor-mcp',
                            version: '1.0.0'
                        }
                    }
                })
            };
        }

        // B) Notificação de Inicialização
        if (rpcMethod === 'notifications/initialized') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: ''
            };
        }

        // C) Ping de teste de conexão (utilizado por clientes MCP)
        if (rpcMethod === 'ping') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ jsonrpc: '2.0', id: id ?? 1, result: {} })
            };
        }

        // D) Listagem de Ferramentas (tools/list)
        if (rpcMethod === 'tools/list') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: id ?? 1,
                    result: {
                        tools: FERRAMENTAS_MCP
                    }
                })
            };
        }

        // E) Execução da Ferramenta (tools/call)
        if (rpcMethod === 'tools/call') {
            const { name, arguments: toolArgs } = params || {};
            try {
                let resultado = null;

                if (name === 'consultar_status_geral_sefaz') {
                    resultado = await consultarStatusGeral();
                } else if (name === 'consultar_status_uf') {
                    const uf = toolArgs?.uf;
                    const doc = toolArgs?.tipo_documento || 'TODOS';
                    resultado = await consultarStatusUf(uf, doc);
                } else if (name === 'consultar_incidentes_sefaz') {
                    const apenasAtivos = toolArgs?.apenas_ativos !== false;
                    resultado = await consultarIncidentes(apenasAtivos);
                } else if (name === 'listar_todos_estados_sefaz') {
                    const doc = toolArgs?.tipo_documento || 'NFE';
                    const apenasProb = toolArgs?.apenas_com_problemas === true;
                    resultado = await listarTodosEstados(doc, apenasProb);
                } else {
                    return {
                        statusCode: 200,
                        headers: CORS_HEADERS,
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: id ?? null,
                            error: { code: -32601, message: `Ferramenta "${name}" não encontrada` }
                        })
                    };
                }

                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: id ?? null,
                        result: {
                            content: [
                                { type: 'text', text: resultado.resumoTexto },
                                { type: 'text', text: JSON.stringify(resultado, null, 2) }
                            ]
                        }
                    })
                };
            } catch (err) {
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: id ?? null,
                        result: {
                            isError: true,
                            content: [{ type: 'text', text: `Erro ao consultar SEFAZ: ${err.message}` }]
                        }
                    })
                };
            }
        }

        // Método não suportado
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: id ?? null,
                error: { code: -32601, message: `Método JSON-RPC "${rpcMethod}" não implementado` }
            })
        };
    }

    return {
        statusCode: 405,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Método HTTP não permitido' })
    };
};
