# Estado dos três painéis — 28/10/2026

## Onde paramos
Os layouts foram preparados e conferidos localmente. Este checkpoint guarda os arquivos para continuidade, sem merge em main e sem publicação de produção solicitada. Nenhuma configuração da Tina ou chave de produção foi alterada nesta etapa.

- Fiscal: painel com seis consultas, manual Markdown, configuração de acesso em memória e ícone de documento com porcentagem.
- Monitor SEFAZ: painel de estados, incidentes, teste das quatro ferramentas e manual Markdown.
- Consulta IE: formulário compacto, resultado abaixo, cores escuras/azuis mantidas, ícone documento/IE/lupa e aviso âmbar centralizado. Acesso público preservado.

## Próximo trabalho: autenticação
Planejar ativação coordenada de Bearer no Fiscal e Monitor SEFAZ, com uma chave por serviço, ambiente do servidor e Segredos da Tina. Conferir o AUTH_TOKEN existente no Fiscal antes de eventual substituição. No Monitor, verificar a aplicação efetiva no handler usado pela hospedagem; uma variável configurada por si só não protege o endpoint.

As novas chaves foram geradas e guardadas fora dos repositórios, mas não aplicadas aos serviços nem à Tina. Nenhum valor deve aparecer no Git, documentação, issue, HTML, URL ou log. A Consulta IE permanece pública.

Antes de ativar: cobrir MCP e REST, validar chave ausente/incorreta/correta e regressão da interface; preparar reversão e atualizar os cabeçalhos da Tina no mesmo procedimento. Migração para servidor ATS e eventual troca de hospedagem permanecem pendentes. Não executar novos testes pagos da Tina sem autorização específica.

## Referências
- [Fiscal](https://github.com/PauloVictor1803/mcp-fiscal-brasil-kosmus)
- [Monitor SEFAZ](https://github.com/PauloVictor1803/sefaz-monitor-mcp)
- A Consulta IE está em repositório privado; seus arquivos e detalhes não são reproduzidos nos repositórios públicos.

## Pendência de tokens
Acompanhar [issue #1 no Monitor SEFAZ](https://github.com/PauloVictor1803/sefaz-monitor-mcp/issues/1). Issues está desabilitado no repositório Fiscal. Nenhuma chave foi publicada.

