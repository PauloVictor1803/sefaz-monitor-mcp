/**
 * Serviço de Monitoramento em Tempo Real dos Servidores da SEFAZ
 * Fonte de dados: Monitor SEFAZ Webmania® (v3 API pública)
 * https://monitorsefaz.webmaniabr.com
 */

const SUMMARY_URL = 'https://monitorsefaz.webmaniabr.com/v3/summary.json';
const COMPONENTS_URL = 'https://monitorsefaz.webmaniabr.com/v3/components.json';

// Dicionário dos 27 Estados do Brasil
export const ESTADOS_BRASIL = {
    'AC': { nome: 'Acre', regiao: 'Norte' },
    'AL': { nome: 'Alagoas', regiao: 'Nordeste' },
    'AP': { nome: 'Amapá', regiao: 'Norte' },
    'AM': { nome: 'Amazonas', regiao: 'Norte' },
    'BA': { nome: 'Bahia', regiao: 'Nordeste' },
    'CE': { nome: 'Ceará', regiao: 'Nordeste' },
    'DF': { nome: 'Distrito Federal', regiao: 'Centro-Oeste' },
    'ES': { nome: 'Espírito Santo', regiao: 'Sudeste' },
    'GO': { nome: 'Goiás', regiao: 'Centro-Oeste' },
    'MA': { nome: 'Maranhão', regiao: 'Nordeste' },
    'MT': { nome: 'Mato Grosso', regiao: 'Centro-Oeste' },
    'MS': { nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
    'MG': { nome: 'Minas Gerais', regiao: 'Sudeste' },
    'PA': { nome: 'Pará', regiao: 'Norte' },
    'PB': { nome: 'Paraíba', regiao: 'Nordeste' },
    'PR': { nome: 'Paraná', regiao: 'Sul' },
    'PE': { nome: 'Pernambuco', regiao: 'Nordeste' },
    'PI': { nome: 'Piauí', regiao: 'Nordeste' },
    'RJ': { nome: 'Rio de Janeiro', regiao: 'Sudeste' },
    'RN': { nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
    'RS': { nome: 'Rio Grande do Sul', regiao: 'Sul' },
    'RO': { nome: 'Rondônia', regiao: 'Norte' },
    'RR': { nome: 'Roraima', regiao: 'Norte' },
    'SC': { nome: 'Santa Catarina', regiao: 'Sul' },
    'SP': { nome: 'São Paulo', regiao: 'Sudeste' },
    'SE': { nome: 'Sergipe', regiao: 'Nordeste' },
    'TO': { nome: 'Tocantins', regiao: 'Norte' }
};

export const TIPOS_DOCUMENTO = {
    'NFE': {
        codigo: 'NFE',
        nome: 'NF-e (Nota Fiscal Eletrônica)',
        grupoWebmania: 'Autorizadores de NF-e'
    },
    'NFCE': {
        codigo: 'NFCE',
        nome: 'NFC-e (Nota de Consumidor Eletrônica)',
        grupoWebmania: 'Autorizadores de NFC-e'
    },
    'CTE': {
        codigo: 'CTE',
        nome: 'CT-e (Conhecimento de Transporte Eletrônico)',
        grupoWebmania: 'Autorizadores de CT-e'
    },
    'MDFE': {
        codigo: 'MDFE',
        nome: 'MDF-e (Manifesto de Documentos Fiscais)',
        grupoWebmania: 'Autorizadores de MDF-e'
    }
};

// Cache em memória (TTL: 60 segundos)
let cacheDados = {
    summary: null,
    components: null,
    timestamp: 0
};
const CACHE_TTL_MS = 60 * 1000;

/**
 * Traduz e formata status em linguagem amigável com emoji
 */
export function formatarStatus(statusRaw) {
    const s = String(statusRaw || '').toUpperCase();
    switch (s) {
        case 'OPERATIONAL':
        case 'UP':
            return { codigo: 'OPERACIONAL', rotulo: 'Operacional', emoji: '🟢', classe: 'up' };
        case 'DEGRADED_PERFORMANCE':
        case 'DEGRADEDPERFORMANCE':
        case 'DEGRADED':
            return { codigo: 'DEGRADADO', rotulo: 'Instabilidade / Lentidão', emoji: '🟡', classe: 'degraded' };
        case 'PARTIAL_OUTAGE':
        case 'PARTIALOUTAGE':
            return { codigo: 'PARCIAL', rotulo: 'Queda Parcial', emoji: '🟠', classe: 'partial' };
        case 'MAJOR_OUTAGE':
        case 'MAJOROUTAGE':
        case 'DOWN':
        case 'OFFLINE':
            return { codigo: 'OFFLINE', rotulo: 'Fora do Ar (Offline)', emoji: '🔴', classe: 'down' };
        case 'UNDER_MAINTENANCE':
        case 'UNDERMAINTENANCE':
        case 'MAINTENANCE':
            return { codigo: 'MANUTENCAO', rotulo: 'Em Manutenção', emoji: '🔵', classe: 'maintenance' };
        default:
            return { codigo: s || 'DESCONHECIDO', rotulo: s || 'Desconhecido', emoji: '⚪', classe: 'unknown' };
    }
}

/**
 * Formata data ISO para horário e data no fuso de Brasília
 */
export function formatarDataHora(isoString) {
    if (!isoString) return 'Não informado';
    try {
        const data = new Date(isoString);
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            dateStyle: 'short',
            timeStyle: 'medium'
        }).format(data);
    } catch {
        return isoString;
    }
}

/**
 * Busca dados da Webmania com cache inteligente
 */
export async function obterDadosWebmania(forceRefresh = false) {
    const agora = Date.now();
    if (!forceRefresh && cacheDados.summary && cacheDados.components && (agora - cacheDados.timestamp < CACHE_TTL_MS)) {
        return {
            summary: cacheDados.summary,
            components: cacheDados.components,
            cached: true,
            idadeCacheSegundos: Math.round((agora - cacheDados.timestamp) / 1000)
        };
    }

    try {
        const headers = {
            'User-Agent': 'Sefaz-Monitor-MCP/1.0 (Open-Source MCP Server; +https://github.com/sefaz-monitor-mcp)',
            'Accept': 'application/json'
        };

        const [resSummary, resComponents] = await Promise.all([
            fetch(SUMMARY_URL, { headers }),
            fetch(COMPONENTS_URL, { headers })
        ]);

        if (!resSummary.ok) throw new Error(`Falha ao obter summary.json: HTTP ${resSummary.status}`);
        if (!resComponents.ok) throw new Error(`Falha ao obter components.json: HTTP ${resComponents.status}`);

        const summary = await resSummary.json();
        const componentsData = await resComponents.json();
        const components = Array.isArray(componentsData) ? componentsData : (componentsData.components || []);

        cacheDados = {
            summary,
            components,
            timestamp: agora
        };

        return {
            summary,
            components,
            cached: false,
            idadeCacheSegundos: 0
        };
    } catch (err) {
        // Se houver erro de rede mas tivermos cache antigo, utiliza como fallback
        if (cacheDados.summary && cacheDados.components) {
            console.warn('Aviso: Falha ao renovar dados do monitor Webmania, usando cache prévio:', err.message);
            return {
                summary: cacheDados.summary,
                components: cacheDados.components,
                cached: true,
                aviso: `Dados em cache prévio devido a falha de conexão: ${err.message}`
            };
        }
        throw new Error(`Não foi possível conectar ao Monitor SEFAZ Webmania: ${err.message}`);
    }
}

/**
 * Mapeia se a UF possui autorizador próprio ou virtual para o tipo de documento
 */
export function mapearUfDocumento(uf, docType, components) {
    const ufUpper = (uf || '').trim().toUpperCase();
    const docUpper = (docType || 'NFE').trim().toUpperCase();
    const configDoc = TIPOS_DOCUMENTO[docUpper] || TIPOS_DOCUMENTO['NFE'];
    const infoEstado = ESTADOS_BRASIL[ufUpper] || { nome: ufUpper, regiao: 'Brasil' };

    const itensDoGrupo = components.filter(c => c.group && c.group.name === configDoc.grupoWebmania);

    // 1. Autorizador Próprio (o nome do componente é a própria sigla da UF)
    const matchDireto = itensDoGrupo.find(c => c.name && c.name.toUpperCase() === ufUpper);
    if (matchDireto) {
        const status = formatarStatus(matchDireto.status);
        return {
            uf: ufUpper,
            estado: infoEstado.nome,
            regiao: infoEstado.regiao,
            documento: configDoc.codigo,
            documentoNome: configDoc.nome,
            tipoAutorizador: 'PROPRIO',
            autorizador: `SEFAZ-${ufUpper}`,
            autorizadorNome: `SEFAZ ${infoEstado.nome} (Autorizador Próprio)`,
            descricao: matchDireto.description || '',
            statusOriginal: matchDireto.status,
            status: status.codigo,
            statusRotulo: status.rotulo,
            emoji: status.emoji,
            componenteId: matchDireto.id
        };
    }

    // 2. Autorizador Virtual (a descrição do componente lista as UFs atendidas)
    const matchVirtual = itensDoGrupo.find(c => {
        if (!c.description) return false;
        const ufs = c.description.split(',').map(s => s.trim().toUpperCase());
        return ufs.includes(ufUpper);
    });

    if (matchVirtual) {
        const status = formatarStatus(matchVirtual.status);
        const virtualNome = matchVirtual.name === 'SVRS'
            ? 'SEFAZ Virtual do RS (SVRS)'
            : (matchVirtual.name === 'SVAN' ? 'SEFAZ Virtual Ambiente Nacional (SVAN)' : `SEFAZ Virtual (${matchVirtual.name})`);

        return {
            uf: ufUpper,
            estado: infoEstado.nome,
            regiao: infoEstado.regiao,
            documento: configDoc.codigo,
            documentoNome: configDoc.nome,
            tipoAutorizador: 'VIRTUAL',
            autorizador: matchVirtual.name,
            autorizadorNome: virtualNome,
            descricao: `Atende: ${matchVirtual.description}`,
            statusOriginal: matchVirtual.status,
            status: status.codigo,
            statusRotulo: status.rotulo,
            emoji: status.emoji,
            componenteId: matchVirtual.id
        };
    }

    // 3. Fallback inteligente (ex: MDF-e atende via SVRS nacional)
    const fallback = itensDoGrupo.find(c => c.name === 'SVRS') || itensDoGrupo[0];
    if (fallback) {
        const status = formatarStatus(fallback.status);
        return {
            uf: ufUpper,
            estado: infoEstado.nome,
            regiao: infoEstado.regiao,
            documento: configDoc.codigo,
            documentoNome: configDoc.nome,
            tipoAutorizador: 'VIRTUAL_PADRAO',
            autorizador: fallback.name || 'SVRS',
            autorizadorNome: `SEFAZ Virtual (${fallback.name || 'SVRS'})`,
            descricao: fallback.description || 'Ambiente autorizador integrado',
            statusOriginal: fallback.status,
            status: status.codigo,
            statusRotulo: status.rotulo,
            emoji: status.emoji,
            componenteId: fallback.id
        };
    }

    return {
        uf: ufUpper,
        estado: infoEstado.nome,
        regiao: infoEstado.regiao,
        documento: configDoc.codigo,
        documentoNome: configDoc.nome,
        tipoAutorizador: 'DESCONHECIDO',
        autorizador: 'N/A',
        autorizadorNome: 'Autorizador não localizado',
        descricao: '',
        statusOriginal: 'UNKNOWN',
        status: 'DESCONHECIDO',
        statusRotulo: 'Não identificado',
        emoji: '⚪',
        componenteId: null
    };
}

/**
 * Consulta a Situação Geral dos servidores da SEFAZ
 */
export async function consultarStatusGeral(forceRefresh = false) {
    const { summary, components, cached } = await obterDadosWebmania(forceRefresh);

    const statusGlobal = formatarStatus(summary.page?.status);
    const incidentesAtivos = summary.activeIncidents || [];
    const manutencoesAtivas = summary.activeMaintenances || [];
    const incidentesResolvidosRecentes = (summary.recentlyResolvedIncidents || []).slice(0, 5);

    // Contabiliza componentes com problema
    const componentesComProblema = components.filter(c => c.status && c.status.toUpperCase() !== 'OPERATIONAL');

    let resumoTexto = `STATUS GERAL DA SEFAZ (TEMPO REAL):\n`;
    resumoTexto += `${statusGlobal.emoji} Monitor Geral: ${statusGlobal.rotulo} (${summary.page?.name || 'Webmania'})\n`;
    resumoTexto += `• Atualizado em: ${formatarDataHora(new Date().toISOString())}\n\n`;

    if (incidentesAtivos.length > 0) {
        resumoTexto += `ATENÇÃO: Há ${incidentesAtivos.length} incidente(s) ativo(s) no momento:\n`;
        incidentesAtivos.forEach(inc => {
            const impacto = formatarStatus(inc.impact);
            resumoTexto += `  ${impacto.emoji} ${inc.name} (Início: ${formatarDataHora(inc.started)})\n`;
            if (inc.lastUpdate?.message) {
                resumoTexto += `    Atualização: ${inc.lastUpdate.message}\n`;
            }
        });
        resumoTexto += `\n`;
    } else {
        resumoTexto += `Nenhum incidente ativo no momento. Todos os autorizadores monitorados estão respondendo normalmente.\n\n`;
    }

    if (manutencoesAtivas.length > 0) {
        resumoTexto += `Manutenções Programadas Ativas:\n`;
        manutencoesAtivas.forEach(m => {
            resumoTexto += `  • ${m.name} (Início: ${formatarDataHora(m.start)}, Duração est.: ${m.duration} min)\n`;
        });
        resumoTexto += `\n`;
    }

    if (incidentesResolvidosRecentes.length > 0) {
        resumoTexto += `Últimas instabilidades resolvidas recentemente:\n`;
        incidentesResolvidosRecentes.slice(0, 3).forEach(inc => {
            resumoTexto += `  • ${inc.name} (Resolvido em: ${formatarDataHora(inc.resolved)})\n`;
        });
    }

    return {
        resumoTexto,
        statusGeral: statusGlobal.codigo,
        statusGeralRotulo: statusGlobal.rotulo,
        emojiGeral: statusGlobal.emoji,
        totalIncidentesAtivos: incidentesAtivos.length,
        incidentesAtivos,
        totalManutencoesAtivas: manutencoesAtivas.length,
        manutencoesAtivas,
        incidentesResolvidosRecentes,
        totalComponentesComProblema: componentesComProblema.length,
        componentesComProblema: componentesComProblema.map(c => ({
            id: c.id,
            nome: c.name,
            grupo: c.group?.name || 'Geral',
            status: c.status
        })),
        fonte: summary.page?.url || 'https://monitorsefaz.webmaniabr.com',
        cached
    };
}

/**
 * Consulta o status da SEFAZ para uma UF específica e tipo de documento
 */
export async function consultarStatusUf(uf, tipoDocumento = 'TODOS', forceRefresh = false) {
    if (!uf) throw new Error('A sigla do estado (UF) é obrigatória (ex: BA, SP, MG, RJ).');
    const ufUpper = uf.trim().toUpperCase();

    if (!ESTADOS_BRASIL[ufUpper]) {
        throw new Error(`UF "${uf}" não é uma sigla válida de estado brasileiro. Exemplos válidos: BA, SP, RJ, MG, PR, RS, etc.`);
    }

    const { summary, components, cached } = await obterDadosWebmania(forceRefresh);
    const infoEstado = ESTADOS_BRASIL[ufUpper];

    const docsDesejados = (tipoDocumento && tipoDocumento !== 'TODOS')
        ? [tipoDocumento.toUpperCase()]
        : ['NFE', 'NFCE', 'CTE', 'MDFE'];

    const resultadosDocs = docsDesejados.map(doc => mapearUfDocumento(ufUpper, doc, components));

    // Verifica se algum incidente ativo menciona esta UF ou os autorizadores envolvidos
    const nomesAutorizadores = new Set(resultadosDocs.map(r => r.autorizador.toUpperCase()));
    const incidentesRelacionados = (summary.activeIncidents || []).filter(inc => {
        const nomeInc = (inc.name || '').toUpperCase();
        if (nomeInc.includes(ufUpper)) return true;
        for (const auth of nomesAutorizadores) {
            if (nomeInc.includes(auth)) return true;
        }
        return false;
    });

    // Monta resposta amigável para chat e agentes LLM
    let temProblema = resultadosDocs.some(r => r.status !== 'OPERACIONAL');

    let resumoTexto = `STATUS SEFAZ - ${infoEstado.nome.toUpperCase()} (${ufUpper})\n`;
    resumoTexto += `Região: ${infoEstado.regiao} | Consulta em tempo real\n\n`;

    resultadosDocs.forEach(r => {
        resumoTexto += `${r.emoji} ${r.documento}: ${r.statusRotulo}\n`;
        resumoTexto += `   Autorizador: ${r.autorizadorNome}\n`;
    });

    if (incidentesRelacionados.length > 0) {
        resumoTexto += `\nALERTA DE INCIDENTE ATIVO NA SEFAZ (${ufUpper}):\n`;
        incidentesRelacionados.forEach(inc => {
            resumoTexto += `• ${inc.name} (Início: ${formatarDataHora(inc.started)})\n`;
            if (inc.lastUpdate?.message) {
                resumoTexto += `  Detalhe: ${inc.lastUpdate.message}\n`;
            }
        });
    } else {
        resumoTexto += `\nSem incidentes ou manutenções registradas para ${ufUpper} no momento.`;
    }

    return {
        resumoTexto,
        uf: ufUpper,
        estado: infoEstado.nome,
        regiao: infoEstado.regiao,
        operacional: !temProblema,
        documentos: resultadosDocs,
        incidentesAtivosUf: incidentesRelacionados,
        totalIncidentesUf: incidentesRelacionados.length,
        cached
    };
}

/**
 * Consulta Incidentes e Manutenções
 */
export async function consultarIncidentes(apenasAtivos = true, forceRefresh = false) {
    const { summary, cached } = await obterDadosWebmania(forceRefresh);

    const ativos = summary.activeIncidents || [];
    const manutencoes = summary.activeMaintenances || [];
    const resolvidos = summary.recentlyResolvedIncidents || [];

    let resumoTexto = `MONITOR SEFAZ - INCIDENTES E MANUTENÇÕES:\n\n`;

    if (ativos.length === 0) {
        resumoTexto += `Não há nenhum incidente ativo no momento. Todos os autorizadores estão estáveis.\n\n`;
    } else {
        resumoTexto += `Incidentes em andamento (${ativos.length}):\n`;
        ativos.forEach(inc => {
            const impacto = formatarStatus(inc.impact);
            resumoTexto += `• [${impacto.codigo}] ${inc.name}\n`;
            resumoTexto += `  Status: ${inc.status} | Início: ${formatarDataHora(inc.started)}\n`;
            if (inc.lastUpdate?.message) {
                resumoTexto += `  Última atualização: ${inc.lastUpdate.message}\n`;
            }
        });
        resumoTexto += `\n`;
    }

    if (manutencoes.length > 0) {
        resumoTexto += `Manutenções programadas:\n`;
        manutencoes.forEach(m => {
            resumoTexto += `• ${m.name} (Início: ${formatarDataHora(m.start)}, Duração est.: ${m.duration} min)\n`;
        });
        resumoTexto += `\n`;
    }

    if (!apenasAtivos && resolvidos.length > 0) {
        resumoTexto += `Incidentes recentes já resolvidos:\n`;
        resolvidos.forEach(inc => {
            resumoTexto += `• ${inc.name} (Início: ${formatarDataHora(inc.started)} | Fim: ${formatarDataHora(inc.resolved)})\n`;
        });
    }

    return {
        resumoTexto,
        ativos,
        manutencoes,
        resolvidosRecentes: resolvidos,
        totalAtivos: ativos.length,
        cached
    };
}

/**
 * Lista todos os estados para um determinado tipo de documento
 */
export async function listarTodosEstados(tipoDocumento = 'NFE', apenasComProblemas = false, forceRefresh = false) {
    const { components, cached } = await obterDadosWebmania(forceRefresh);
    const ufs = Object.keys(ESTADOS_BRASIL);

    let lista = ufs.map(uf => mapearUfDocumento(uf, tipoDocumento, components));

    if (apenasComProblemas) {
        lista = lista.filter(item => item.status !== 'OPERACIONAL');
    }

    let resumoTexto = `STATUS SEFAZ - TODOS OS ESTADOS (${tipoDocumento.toUpperCase()}):\n\n`;
    if (lista.length === 0 && apenasComProblemas) {
        resumoTexto += `100% dos estados estão com status OPERACIONAL para ${tipoDocumento}.\n`;
    } else {
        lista.forEach(item => {
            resumoTexto += `${item.emoji} [${item.uf}] ${item.estado}: ${item.statusRotulo} (${item.autorizador})\n`;
        });
    }

    return {
        resumoTexto,
        tipoDocumento: tipoDocumento.toUpperCase(),
        totalEstados: lista.length,
        estados: lista,
        cached
    };
}
