import {
    consultarStatusGeral,
    consultarStatusUf,
    consultarIncidentes,
    listarTodosEstados
} from '../src/services/sefazService.js';

async function rodarTestes() {
    console.log('--- 1. Testando consultarStatusGeral() ---');
    const geral = await consultarStatusGeral();
    console.log(geral.resumoTexto);
    console.log('Status geral:', geral.statusGeral, '| Ativos:', geral.totalIncidentesAtivos);

    console.log('\n--- 2. Testando consultarStatusUf("BA") ---');
    const ba = await consultarStatusUf('BA', 'TODOS');
    console.log(ba.resumoTexto);

    console.log('\n--- 3. Testando consultarStatusUf("SP", "NFCE") ---');
    const sp = await consultarStatusUf('SP', 'NFCE');
    console.log(sp.resumoTexto);

    console.log('\n--- 4. Testando consultarIncidentes(false) ---');
    const inc = await consultarIncidentes(false);
    console.log(inc.resumoTexto);

    console.log('\n--- 5. Testando listarTodosEstados("NFE", true) [Apenas com problemas] ---');
    const prob = await listarTodosEstados('NFE', true);
    console.log(prob.resumoTexto);

    console.log('✅ TODOS OS TESTES PASSARAM COM SUCESSO!');
}

rodarTestes().catch(err => {
    console.error('❌ Erro no teste:', err);
    process.exit(1);
});
