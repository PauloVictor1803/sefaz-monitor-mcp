# Painel Monitor SEFAZ — 28/10/2026

Interface com visão geral, estados, incidentes, teste das quatro ferramentas e manual para IA com cópia/download. Mantidos os endpoints e o serviço de consulta. Os dados vêm do monitor Webmania; não equivalem a teste direto de cada autorizador.

Atualização automática a cada 60 segundos é opcional e pausa com a página oculta. Horário de recebimento não é apresentado como horário de atualização da fonte. Estados desconhecidos e erros não são exibidos como operacional.

Ajuste técnico: src/server.js tinha o fechamento da rota /api/estados ausente. Adicionado }); antes do fallback 404 para permitir a execução do servidor Express. Handler Netlify preservado.

Validação local: node --check monitor.js e src/server.js passaram. npm test executou as cinco chamadas do smoke test existente com sucesso. Quatro ferramentas conferidas pelo navegador. Autorizador NF-e da BA e NFC-e/SVRS conferidos. Manual visualizado/copiadо. A verificação completa de responsividade em múltiplas larguras ainda deve acompanhar a revisão antes do deploy.

Prévia: node scripts/preview.mjs (127.0.0.1:8792). Esta entrega não ativa token, não altera Tina e não migra hospedagem.
