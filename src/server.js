import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import {
    consultarStatusGeral,
    consultarStatusUf,
    consultarIncidentes,
    listarTodosEstados,
    ESTADOS_BRASIL
} from './services/sefazService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN || null;

// Habilita CORS amplo para qualquer client MCP ou plataforma web
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Requested-With', 'Accept']
}));

app.use(express.json());

// Serve arquivos estáticos da raiz do projeto (index.html, docs.html, llms.txt, etc.)
app.use(express.static(path.join(__dirname, '..')));

// Middleware de autenticação opcional (se AUTH_TOKEN estiver configurado no .env)
function verificarAutenticacao(req, res, next) {
    if (!AUTH_TOKEN) return next();

    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];

    const tokenRecebido = authHeader
        ? authHeader.replace(/^Bearer\s+/i, '').trim()
        : apiKeyHeader;

    if (!tokenRecebido || tokenRecebido !== AUTH_TOKEN) {
        return res.status(401).json({
            error: 'Não autorizado. Token inválido ou ausente no cabeçalho.'
        });
    }

    next();
}

/**
 * Cria uma nova instância do Servidor MCP com as 4 ferramentas registradas
 */
function criarInstanciaMcp() {
    const server = new McpServer({
        name: 'sefaz-monitor-mcp',
        version: '1.0.0'
    });

    // Ferramenta 1: Situação Geral
    server.tool(
        'consultar_status_geral_sefaz',
        'Consulta a situação geral dos servidores da SEFAZ em tempo real em todo o Brasil (status global UP/DOWN, total de incidentes ativos, manutenções programadas e autorizadores com instabilidade).',
        {},
        async () => {
            try {
                const dados = await consultarStatusGeral();
                return {
                    content: [
                        { type: 'text', text: dados.resumoTexto },
                        { type: 'text', text: JSON.stringify(dados, null, 2) }
                    ]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Erro ao consultar status geral da SEFAZ: ${err.message}` }]
                };
            }
        }
    );

    // Ferramenta 2: Status por UF
    server.tool(
        'consultar_status_uf',
        'Consulta o status da SEFAZ em tempo real para uma UF (estado) específica e tipo de documento (NF-e, NFC-e, CT-e, MDF-e). Identifica se a UF utiliza autorizador próprio (ex: SEFAZ-BA, SEFAZ-SP) ou virtual (SVRS, SVAN).',
        {
            uf: z.string().describe('Sigla de 2 letras da UF do estado (ex: BA, SP, RJ, MG, PE, RS, etc.)'),
            tipo_documento: z.enum(['TODOS', 'NFE', 'NFCE', 'CTE', 'MDFE']).optional().describe('Tipo de documento fiscal (padrão: "TODOS")')
        },
        async ({ uf, tipo_documento }) => {
            try {
                const dados = await consultarStatusUf(uf, tipo_documento || 'TODOS');
                return {
                    content: [
                        { type: 'text', text: dados.resumoTexto },
                        { type: 'text', text: JSON.stringify(dados, null, 2) }
                    ]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Erro ao consultar SEFAZ para ${uf}: ${err.message}` }]
                };
            }
        }
    );

    // Ferramenta 3: Incidentes e Alertas
    server.tool(
        'consultar_incidentes_sefaz',
        'Lista incidentes ativos, alertas de instabilidade, quedas e manutenções programadas nos servidores da SEFAZ nacional e autorizadores estaduais. Permite verificar histórico de problemas recentes.',
        {
            apenas_ativos: z.boolean().optional().describe('Se true (padrão), retorna apenas incidentes ativos. Se false, inclui também recentemente resolvidos.')
        },
        async ({ apenas_ativos }) => {
            try {
                const dados = await consultarIncidentes(apenas_ativos !== false);
                return {
                    content: [
                        { type: 'text', text: dados.resumoTexto },
                        { type: 'text', text: JSON.stringify(dados, null, 2) }
                    ]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Erro ao consultar incidentes da SEFAZ: ${err.message}` }]
                };
            }
        }
    );

    // Ferramenta 4: Todos os Estados
    server.tool(
        'listar_todos_estados_sefaz',
        'Retorna a tabela com o status de autorização da SEFAZ para todos os 27 estados do Brasil e autorizadores virtuais.',
        {
            tipo_documento: z.enum(['NFE', 'NFCE', 'CTE', 'MDFE']).optional().describe('Tipo de documento fiscal (padrão: "NFE")'),
            apenas_com_problemas: z.boolean().optional().describe('Se true, lista apenas estados que apresentem instabilidade (padrão: false)')
        },
        async ({ tipo_documento, apenas_com_problemas }) => {
            try {
                const dados = await listarTodosEstados(tipo_documento || 'NFE', apenas_com_problemas === true);
                return {
                    content: [
                        { type: 'text', text: dados.resumoTexto },
                        { type: 'text', text: JSON.stringify(dados, null, 2) }
                    ]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Erro ao listar estados da SEFAZ: ${err.message}` }]
                };
            }
        }
    );

    return server;
}

// Armazena sessões ativas do transporte SSE
const sseTransports = new Map();

// --- ROTAS DO SERVIDOR MCP (STREAMABLE HTTP / SSE) ---

async function handleSseConnect(req, res) {
    try {
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;
        sseTransports.set(sessionId, transport);

        const mcpServer = criarInstanciaMcp();
        await mcpServer.connect(transport);

        res.on('close', () => {
            sseTransports.delete(sessionId);
        });
    } catch (err) {
        console.error('Erro ao conectar cliente SSE MCP:', err);
        if (!res.headersSent) {
            res.status(500).send('Erro ao inicializar conexão SSE MCP');
        }
    }
}

app.get('/sse', verificarAutenticacao, handleSseConnect);
app.get('/mcp/sse', verificarAutenticacao, handleSseConnect);
app.get('/mcp', verificarAutenticacao, (req, res, next) => {
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
        return handleSseConnect(req, res);
    }
    return res.json({
        status: 'online',
        server: 'sefaz-monitor-mcp',
        transport: 'streamable-http',
        version: '1.0.0',
        tools: [
            'consultar_status_geral_sefaz',
            'consultar_status_uf',
            'consultar_incidentes_sefaz',
            'listar_todos_estados_sefaz'
        ]
    });
});

async function handlePostMessage(req, res) {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return res.status(400).send('Parâmetro sessionId ausente');
    }

    const transport = sseTransports.get(sessionId);
    if (!transport) {
        return res.status(404).send('Sessão MCP não encontrada ou expirada');
    }

    try {
        await transport.handlePostMessage(req, res, req.body);
    } catch (err) {
        console.error('Erro ao processar mensagem POST da sessão:', err);
        if (!res.headersSent) {
            res.status(500).send(err.message);
        }
    }
}

app.post('/messages', verificarAutenticacao, handlePostMessage);
app.post('/message', verificarAutenticacao, handlePostMessage);
app.post('/mcp/messages', verificarAutenticacao, handlePostMessage);

// Suporte a chamada direta JSON-RPC (Streamable HTTP POST sem SSE prévio)
app.post(['/', '/mcp', '/rpc'], verificarAutenticacao, async (req, res) => {
    const body = req.body;
    const { id, method, params } = body || {};

    if (method === 'initialize') {
        return res.json({
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
        });
    }

    if (method === 'notifications/initialized') {
        return res.status(200).send('');
    }

    if (method === 'ping') {
        return res.json({ jsonrpc: '2.0', id: id ?? 1, result: {} });
    }

    if (method === 'tools/list') {
        return res.json({
            jsonrpc: '2.0',
            id: id ?? 1,
            result: {
                tools: [
                    {
                        name: 'consultar_status_geral_sefaz',
                        description: 'Consulta a situação geral dos servidores da SEFAZ em tempo real em todo o Brasil (status global UP/DOWN, total de incidentes ativos, manutenções programadas e autorizadores com instabilidade).',
                        inputSchema: { type: 'object', properties: {}, required: [] }
                    },
                    {
                        name: 'consultar_status_uf',
                        description: 'Consulta o status da SEFAZ em tempo real para uma UF (estado) específica e tipo de documento (NF-e, NFC-e, CT-e, MDF-e). Identifica se a UF usa autorizador próprio ou virtual (SVRS, SVAN).',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                uf: { type: 'string', description: 'Sigla da UF (ex: BA, SP, RJ, MG)' },
                                tipo_documento: {
                                    type: 'string',
                                    description: 'Tipo de documento ("TODOS", "NFE", "NFCE", "CTE", "MDFE")',
                                    enum: ['TODOS', 'NFE', 'NFCE', 'CTE', 'MDFE']
                                }
                            },
                            required: ['uf']
                        }
                    },
                    {
                        name: 'consultar_incidentes_sefaz',
                        description: 'Lista incidentes ativos, alertas de instabilidade, quedas e manutenções programadas nos servidores da SEFAZ.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                apenas_ativos: { type: 'boolean', description: 'Se true, lista apenas ativos.' }
                            }
                        }
                    },
                    {
                        name: 'listar_todos_estados_sefaz',
                        description: 'Retorna a tabela com o status de autorização da SEFAZ para todos os 27 estados do Brasil.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                tipo_documento: { type: 'string', enum: ['NFE', 'NFCE', 'CTE', 'MDFE'] },
                                apenas_com_problemas: { type: 'boolean' }
                            }
                        }
                    }
                ]
            }
        });
    }

    if (method === 'tools/call') {
        const { name, arguments: toolArgs } = params || {};
        try {
            let resultado = null;
            if (name === 'consultar_status_geral_sefaz') {
                resultado = await consultarStatusGeral();
            } else if (name === 'consultar_status_uf') {
                resultado = await consultarStatusUf(toolArgs?.uf, toolArgs?.tipo_documento || 'TODOS');
            } else if (name === 'consultar_incidentes_sefaz') {
                resultado = await consultarIncidentes(toolArgs?.apenas_ativos !== false);
            } else if (name === 'listar_todos_estados_sefaz') {
                resultado = await listarTodosEstados(toolArgs?.tipo_documento || 'NFE', toolArgs?.apenas_com_problemas === true);
            } else {
                return res.json({
                    jsonrpc: '2.0',
                    id: id ?? null,
                    error: { code: -32601, message: `Ferramenta "${name}" não encontrada` }
                });
            }

            return res.json({
                jsonrpc: '2.0',
                id: id ?? null,
                result: {
                    content: [
                        { type: 'text', text: resultado.resumoTexto },
                        { type: 'text', text: JSON.stringify(resultado, null, 2) }
                    ]
                }
            });
        } catch (err) {
            return res.json({
                jsonrpc: '2.0',
                id: id ?? null,
                result: {
                    isError: true,
                    content: [{ type: 'text', text: `Erro: ${err.message}` }]
                }
            });
        }
    }

    return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Método "${method}" não implementado` }
    });
});

// --- ROTAS REST DIRETAS ---

app.get('/api/status', verificarAutenticacao, async (req, res) => {
    try {
        const dados = await consultarStatusGeral();
        res.json(dados);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get(['/api/uf', '/api/status/:uf'], verificarAutenticacao, async (req, res) => {
    try {
        const uf = req.params.uf || req.query.uf;
        const doc = req.query.tipo_documento || req.query.doc || 'TODOS';
        const dados = await consultarStatusUf(uf, doc);
        res.json(dados);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/incidentes', verificarAutenticacao, async (req, res) => {
    try {
        const apenasAtivos = req.query.apenas_ativos !== 'false';
        const dados = await consultarIncidentes(apenasAtivos);
        res.json(dados);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/estados', verificarAutenticacao, async (req, res) => {
    try {
        const doc = req.query.tipo_documento || 'NFE';
        const apenasProblemas = req.query.apenas_com_problemas === 'true';
        const dados = await listarTodosEstados(doc, apenasProblemas);
        res.json(dados);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
// Fallback para páginas não encontradas (404)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', '404.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor SEFAZ Monitor MCP rodando com sucesso!`);
    console.log(`📍 URL Local: http://localhost:${PORT}`);
    console.log(`📡 Endpoint MCP Streamable HTTP / Netlify: http://localhost:${PORT}/mcp`);
    console.log(`📡 Endpoint MCP SSE: http://localhost:${PORT}/sse`);
    console.log(`🔍 Endpoint REST Status Geral: http://localhost:${PORT}/api/status`);
    console.log(`🔍 Endpoint REST Status UF: http://localhost:${PORT}/api/uf?uf=BA`);
    if (AUTH_TOKEN) {
        console.log(`🔒 Autenticação ATIVADA via token`);
    } else {
        console.log(`🔓 Autenticação ABERTA`);
    }
});
