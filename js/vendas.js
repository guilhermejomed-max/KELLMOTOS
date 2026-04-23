let vendaPendente = null;
let itemEcoPendente = null;
let carrinhoVenda = [];
let orcamentoAtualId = null;

function obterNomeProdutoVenda(produto) {
    if (!produto) return 'Produto';
    const partes = [produto.marca, produto.nome_peca].map(v => String(v || '').trim()).filter(Boolean);
    return partes.join(' ') || produto.modelo || 'Produto';
}

function gerarNumeroOrcamento() {
    return 'ORC-' + String(Date.now()).slice(-8);
}

function resumoItensVenda(itens) {
    const lista = Array.isArray(itens) ? itens : [];
    if (!lista.length) return 'Item';
    if (lista.length === 1) {
        const item = lista[0];
        return `${item.nome || 'Item'} x${item.qtd || 1}`;
    }
    const totalPecas = lista.reduce((acc, item) => acc + (parseInt(item.qtd) || 0), 0);
    return `${lista.length} itens (${totalPecas} peças)`;
}

function normalizarItensDocumento(doc) {
    if (Array.isArray(doc?.itens) && doc.itens.length) {
        return doc.itens.map(item => ({
            id: item.id || item.produtoId || '',
            produtoId: item.produtoId || item.id || '',
            nome: item.nome || item.peca || 'Item',
            marca: item.marca || '',
            nome_peca: item.nome_peca || '',
            codigo: item.codigo || '',
            qtd: parseInt(item.qtd) || 1,
            unitario: parseFloat(item.unitario) || 0,
            total: parseFloat(item.total) || ((parseInt(item.qtd) || 1) * (parseFloat(item.unitario) || 0)),
            origem: item.origem || doc?.origem || 'BALCAO'
        }));
    }

    return [{
        id: doc?.produtoId || '',
        produtoId: doc?.produtoId || '',
        nome: doc?.peca || 'Item',
        marca: doc?.marca || '',
        nome_peca: doc?.nome_peca || '',
        codigo: doc?.codigo || '',
        qtd: parseInt(doc?.qtd) || 1,
        unitario: parseFloat(doc?.unitario) || 0,
        total: parseFloat(doc?.venda) || 0,
        origem: doc?.origem || 'BALCAO'
    }];
}

function totalCarrinhoVenda() {
    return carrinhoVenda.reduce((acc, item) => acc + ((parseInt(item.qtd) || 0) * (parseFloat(item.unitario) || 0)), 0);
}

function totalItensCarrinhoVenda() {
    return carrinhoVenda.reduce((acc, item) => acc + (parseInt(item.qtd) || 0), 0);
}

function renderizarCarrinhoVenda() {
    const corpo = document.getElementById('corpo-carrinho-venda');
    const vazio = document.getElementById('painel-carrinho-vazio');
    const tabela = document.getElementById('painel-carrinho-tabela');
    const totalEl = document.getElementById('total-carrinho-venda');
    const itensEl = document.getElementById('total-itens-carrinho');
    if (!corpo || !vazio || !tabela || !totalEl || !itensEl) return;

    if (!carrinhoVenda.length) {
        corpo.innerHTML = '';
        vazio.style.display = 'block';
        tabela.style.display = 'none';
        totalEl.innerText = 'R$ 0,00';
        itensEl.innerText = '0';
        return;
    }

    vazio.style.display = 'none';
    tabela.style.display = 'block';
    corpo.innerHTML = carrinhoVenda.map((item, index) => {
        const total = (parseInt(item.qtd) || 0) * (parseFloat(item.unitario) || 0);
        return `<tr>
            <td>
                <div style="font-weight:800; color:var(--text-main);">${item.nome}</div>
                <div style="font-size:12px; color:var(--text-muted);">${item.codigo || 'Sem código'}</div>
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn btn-sm btn-secondary" onclick="alterarQtdCarrinho(${index}, -1)">-</button>
                    <span style="min-width:24px; text-align:center; font-weight:800;">${item.qtd}</span>
                    <button class="btn btn-sm btn-secondary" onclick="alterarQtdCarrinho(${index}, 1)">+</button>
                </div>
            </td>
            <td>R$ ${(parseFloat(item.unitario) || 0).toFixed(2)}</td>
            <td style="font-weight:800;">R$ ${total.toFixed(2)}</td>
            <td style="text-align:right;"><button class="btn btn-sm btn-secondary" onclick="removerItemCarrinho(${index})"><i class="ri-delete-bin-line"></i></button></td>
        </tr>`;
    }).join('');

    totalEl.innerText = `R$ ${totalCarrinhoVenda().toFixed(2)}`;
    itensEl.innerText = String(totalItensCarrinhoVenda());
}

function limparCarrinhoVenda(limparCliente = false) {
    carrinhoVenda = [];
    vendaPendente = null;
    renderizarCarrinhoVenda();
    if (limparCliente) {
        const nome = document.getElementById('cli-nome');
        const pgto = document.getElementById('cli-pgto');
        const boleto = document.getElementById('cli-boleto-select');
        const validade = document.getElementById('orc-validade');
        const observacao = document.getElementById('orc-observacao');
        if (nome) nome.value = '';
        if (pgto) pgto.value = 'DINHEIRO';
        if (boleto) boleto.value = '';
        if (validade) validade.value = '';
        if (observacao) observacao.value = '';
        mostrarSelecaoCliente();
    }
}

function removerItemCarrinho(index) {
    carrinhoVenda.splice(index, 1);
    renderizarCarrinhoVenda();
}

function alterarQtdCarrinho(index, delta) {
    const item = carrinhoVenda[index];
    if (!item) return;
    const produto = (cacheEstoque || []).find(p => p.id === item.id);
    const estoqueAtual = parseInt(produto?.qtd) || 0;
    const novaQtd = (parseInt(item.qtd) || 0) + delta;

    if (novaQtd <= 0) {
        removerItemCarrinho(index);
        return;
    }

    if (estoqueAtual && novaQtd > estoqueAtual) {
        return alert(`Estoque disponível para ${item.nome}: ${estoqueAtual}`);
    }

    item.qtd = novaQtd;
    renderizarCarrinhoVenda();
}

function adicionarProdutoAoCarrinho(produto, qtd, origem = 'BALCAO', unitarioOverride = null) {
    const quantidade = parseInt(qtd) || 1;
    const unitario = unitarioOverride != null ? parseFloat(unitarioOverride) || 0 : parseFloat(produto?.repasse) || 0;
    const nome = obterNomeProdutoVenda(produto);
    const existente = carrinhoVenda.find(item => item.id === produto.id && item.unitario === unitario && item.origem === origem);
    const estoqueAtual = parseInt(produto?.qtd) || 0;
    const qtdFinal = (existente ? parseInt(existente.qtd) || 0 : 0) + quantidade;

    if (estoqueAtual && qtdFinal > estoqueAtual) {
        return alert(`Estoque disponível para ${nome}: ${estoqueAtual}`);
    }

    if (existente) {
        existente.qtd = qtdFinal;
    } else {
        carrinhoVenda.push({
            id: produto.id,
            produtoId: produto.id,
            nome,
            marca: produto.marca || '',
            nome_peca: produto.nome_peca || '',
            codigo: produto.codigo || '',
            qtd: quantidade,
            unitario,
            origem
        });
    }

    renderizarCarrinhoVenda();
    Toastify({ text: `${nome} adicionado ao carrinho`, style: { background: 'var(--primary)' } }).showToast();
}

function focarCampoCodigoVenda() {
    const input = document.getElementById('venda-codigo-input');
    if (input) {
        input.focus();
        input.select?.();
    }
}

function obterDadosOrcamentoFormulario() {
    return {
        validade: document.getElementById('orc-validade')?.value || '',
        observacao: (document.getElementById('orc-observacao')?.value || '').trim()
    };
}

function adicionarProdutoPorCodigoRapido() {
    const input = document.getElementById('venda-codigo-input');
    const codigo = String(input?.value || '').trim();
    if (!codigo) return alert('Informe ou leia um código para adicionar ao carrinho.');

    const produto = (typeof localizarProdutoPorCodigo === 'function') ? localizarProdutoPorCodigo(codigo) : null;
    if (!produto) return alert('Produto não encontrado para esse código.');

    adicionarProdutoAoCarrinho(produto, 1, 'BALCAO', produto.repasse);
    if (input) input.value = '';
    focarCampoCodigoVenda();
}

function abrirVenda(id, p) {
    vendaPendente = { ...p, id, origem: 'BALCAO' };
    document.getElementById('m-qtd-titulo').innerText = obterNomeProdutoVenda(p);
    document.getElementById('venda-qtd-input').value = 1;
    document.getElementById('modal-qtd').style.display = 'flex';
}

function adicionarItemCarrinhoPendente() {
    if (!vendaPendente) return;
    const qtd = parseInt(document.getElementById('venda-qtd-input').value) || 1;
    adicionarProdutoAoCarrinho(vendaPendente, qtd, vendaPendente.origem || 'BALCAO', vendaPendente.repasse);
    fecharModais();
    focarCampoCodigoVenda();
}

function abrirVendaEco(id) {
    const p = (cacheEstoque || []).find(i => i.id === id);
    if (!p || !p.eco_venda) return alert('Configure preço online');
    vendaPendente = { ...p, id, repasse: p.eco_venda, origem: 'ECO' };
    document.getElementById('m-qtd-titulo').innerText = obterNomeProdutoVenda(p) + ' (WEB)';
    document.getElementById('venda-qtd-input').value = 1;
    document.getElementById('modal-qtd').style.display = 'flex';
}

function abrirModalCliente() {
    if (!carrinhoVenda.length) return alert('Adicione pelo menos um item ao carrinho.');
    fecharModais();
    document.getElementById('modal-cliente').style.display = 'flex';
    mostrarSelecaoCliente();
}

function mostrarSelecaoCliente() {
    const isBoleto = document.getElementById('cli-pgto').value === 'BOLETO';
    document.getElementById('selecao-cliente-boleto').style.display = isBoleto ? 'block' : 'none';
}

function montarPayloadItensCarrinho() {
    return carrinhoVenda.map(item => ({
        id: item.id,
        produtoId: item.produtoId || item.id,
        nome: item.nome,
        marca: item.marca || '',
        nome_peca: item.nome_peca || '',
        codigo: item.codigo || '',
        qtd: parseInt(item.qtd) || 1,
        unitario: parseFloat(item.unitario) || 0,
        total: (parseInt(item.qtd) || 1) * (parseFloat(item.unitario) || 0),
        origem: item.origem || 'BALCAO'
    }));
}

async function criarOuEfetivarVenda(tipo = 'VENDA') {
    if (!carrinhoVenda.length) return null;

    const cliNome = document.getElementById('cli-nome').value || 'Consumidor';
    const pgto = document.getElementById('cli-pgto').value;
    const cliId = document.getElementById('cli-boleto-select').value || '';
    const dadosOrcamento = obterDadosOrcamentoFormulario();
    const itens = montarPayloadItensCarrinho();
    const total = itens.reduce((acc, item) => acc + item.total, 0);
    const quantidadeTotal = itens.reduce((acc, item) => acc + item.qtd, 0);
    const resumo = resumoItensVenda(itens);

    if (tipo === 'ORCAMENTO') {
        const orcamento = {
            numero: gerarNumeroOrcamento(),
            itens,
            peca: resumo,
            produtoId: itens.length === 1 ? itens[0].produtoId : '',
            qtd: quantidadeTotal,
            venda: total,
            unitario: itens.length === 1 ? itens[0].unitario : 0,
            cliente: cliNome,
            clienteId: pgto === 'BOLETO' ? cliId : '',
            pagamento: pgto,
            validade: dadosOrcamento.validade,
            observacao: dadosOrcamento.observacao,
            status: 'ABERTO',
            tipo: 'ORCAMENTO',
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR'),
            timestamp: Date.now(),
            origem: itens.length === 1 ? (itens[0].origem || 'BALCAO') : 'CARRINHO',
            operador: auth.currentUser.email
        };
        await db.collection('vendas_kell').add(orcamento);
        Toastify({ text: 'Orçamento criado com sucesso!', style: { background: 'var(--primary)' } }).showToast();
        fecharModais();
        limparCarrinhoVenda(true);
        return orcamento;
    }

    const res = await db.runTransaction(async t => {
        const seqRef = db.collection('config_kell').doc('sequencial');
        const sDoc = await t.get(seqRef);
        const num = (sDoc.exists ? sDoc.data().ultimoPedido : 0) + 1;

        const leiturasEstoque = [];
        let custo = 0;
        const itensVenda = [];
        for (const item of itens) {
            const ref = db.collection('estoque_kell').doc(item.produtoId);
            const doc = await t.get(ref);
            if (!doc.exists) throw new Error(`Produto não encontrado: ${item.nome}`);
            const estoqueAtual = parseInt(doc.data().qtd) || 0;
            if (estoqueAtual < item.qtd) throw new Error(`Sem estoque para ${item.nome}`);
            const custoItem = item.qtd * (parseFloat(doc.data().compra) || 0);
            custo += custoItem;
            itensVenda.push({ ...item, custo_unitario: parseFloat(doc.data().compra) || 0 });
            leiturasEstoque.push({ ref, estoqueAtual, qtd: item.qtd });
        }

        let clienteFiadoRef = null;
        let clienteFiadoNome = '';
        if (pgto === 'BOLETO') {
            if (!cliId) throw new Error('Selecione um cliente para fiado.');
            clienteFiadoRef = db.collection('clientes_kell').doc(cliId);
            const cDoc = await t.get(clienteFiadoRef);
            if (!cDoc.exists) throw new Error('Cliente do fiado não encontrado.');
            clienteFiadoNome = cDoc.data().nome;
        }

        const lucro = total - custo;
        const venda = {
            numero: num,
            itens: itensVenda,
            peca: resumo,
            produtoId: itensVenda.length === 1 ? itensVenda[0].produtoId : '',
            qtd: quantidadeTotal,
            venda: total,
            unitario: itensVenda.length === 1 ? itensVenda[0].unitario : 0,
            cliente: cliNome,
            clienteId: pgto === 'BOLETO' ? cliId : '',
            pagamento: pgto,
            observacao: dadosOrcamento.observacao,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR'),
            timestamp: Date.now(),
            origem: itensVenda.length === 1 ? (itensVenda[0].origem || 'BALCAO') : 'CARRINHO',
            operador: auth.currentUser.email,
            financeiro: { custo_prod: custo, lucro_liquido: lucro },
            lucro,
            pagamento_efetivado: true
        };

        if (pgto === 'BOLETO') {
            venda.cliente = clienteFiadoNome;
            venda.pagamento_efetivado = false;
        }

        leiturasEstoque.forEach(item => {
            t.update(item.ref, { qtd: item.estoqueAtual - item.qtd });
        });

        if (clienteFiadoRef) {
            t.update(clienteFiadoRef, { debito: firebase.firestore.FieldValue.increment(total) });
        }

        t.set(seqRef, { ultimoPedido: num }, { merge: true });
        t.set(db.collection('vendas_kell').doc(), venda);
        return venda;
    });

    fecharModais();
    gerarCupom(res);
    Toastify({ text: 'Venda OK!', style: { background: 'green' } }).showToast();
    limparCarrinhoVenda(true);
    return res;
}

async function confirmarVenda() {
    try {
        await criarOuEfetivarVenda('VENDA');
    } catch (e) {
        alert(e.message || e);
    }
}

async function criarOrcamento() {
    try {
        await criarOuEfetivarVenda('ORCAMENTO');
    } catch (e) {
        alert(e.message || e);
    }
}

async function converterOrcamentoEmVenda(id) {
    const orcamento = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORCAMENTO');
    if (!orcamento) return alert('Orçamento não encontrado.');
    if (orcamento.status === 'VENDIDO') return alert('Esse orçamento já foi convertido em venda.');

    const itens = normalizarItensDocumento(orcamento);

    try {
        await db.runTransaction(async t => {
            const seqRef = db.collection('config_kell').doc('sequencial');
            const sDoc = await t.get(seqRef);
            const num = (sDoc.exists ? sDoc.data().ultimoPedido : 0) + 1;

            const leiturasEstoque = [];
            let custo = 0;
            for (const item of itens) {
                const refProduto = db.collection('estoque_kell').doc(item.produtoId);
                const produtoDoc = await t.get(refProduto);
                if (!produtoDoc.exists) throw new Error(`Produto não encontrado: ${item.nome}`);
                const estoqueAtual = parseInt(produtoDoc.data().qtd) || 0;
                if (estoqueAtual < item.qtd) throw new Error(`Sem estoque para ${item.nome}`);
                custo += item.qtd * (parseFloat(produtoDoc.data().compra) || 0);
                leiturasEstoque.push({ refProduto, estoqueAtual, qtd: item.qtd });
            }

            const total = itens.reduce((acc, item) => acc + item.total, 0);
            const quantidadeTotal = itens.reduce((acc, item) => acc + item.qtd, 0);
            const lucro = total - custo;
            const venda = {
                numero: num,
                itens,
                peca: resumoItensVenda(itens),
                produtoId: itens.length === 1 ? itens[0].produtoId : '',
                qtd: quantidadeTotal,
                venda: total,
                unitario: itens.length === 1 ? itens[0].unitario : 0,
                cliente: orcamento.cliente,
                clienteId: orcamento.clienteId || '',
                pagamento: orcamento.pagamento,
                observacao: orcamento.observacao || '',
                data: new Date().toLocaleDateString('pt-BR'),
                hora: new Date().toLocaleTimeString('pt-BR'),
                timestamp: Date.now(),
                origem: 'ORCAMENTO',
                operador: auth.currentUser.email,
                financeiro: { custo_prod: custo, lucro_liquido: lucro },
                lucro,
                pagamento_efetivado: orcamento.pagamento !== 'BOLETO'
            };

            let clienteFiadoRef = null;
            let clienteFiadoNome = '';
            if (orcamento.pagamento === 'BOLETO') {
                if (!orcamento.clienteId) throw new Error('Esse orçamento fiado precisa de um cliente vinculado.');
                clienteFiadoRef = db.collection('clientes_kell').doc(orcamento.clienteId);
                const cDoc = await t.get(clienteFiadoRef);
                if (!cDoc.exists) throw new Error('Cliente do fiado não encontrado.');
                clienteFiadoNome = cDoc.data().nome;
            }

            if (clienteFiadoNome) {
                venda.cliente = clienteFiadoNome;
            }

            leiturasEstoque.forEach(item => {
                t.update(item.refProduto, { qtd: item.estoqueAtual - item.qtd });
            });

            if (clienteFiadoRef) {
                t.update(clienteFiadoRef, { debito: firebase.firestore.FieldValue.increment(total) });
            }

            t.set(seqRef, { ultimoPedido: num }, { merge: true });
            t.set(db.collection('vendas_kell').doc(), venda);
            t.update(db.collection('vendas_kell').doc(id), { status: 'VENDIDO', venda_numero: num, convertido_em: Date.now() });
        });
        Toastify({ text: 'Orçamento convertido em venda!', style: { background: 'green' } }).showToast();
    } catch (e) {
        alert(e.message || e);
    }
}

function abrirOrcamentoParaEdicao(id) {
    const orcamento = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORCAMENTO');
    if (!orcamento) return;
    carrinhoVenda = normalizarItensDocumento(orcamento);
    renderizarCarrinhoVenda();
    document.getElementById('cli-nome').value = orcamento.cliente || '';
    document.getElementById('cli-pgto').value = orcamento.pagamento || 'DINHEIRO';
    document.getElementById('cli-boleto-select').value = orcamento.clienteId || '';
    const validade = document.getElementById('orc-validade');
    const observacao = document.getElementById('orc-observacao');
    if (validade) validade.value = orcamento.validade || '';
    if (observacao) observacao.value = orcamento.observacao || '';
    mostrarSelecaoCliente();
    document.getElementById('modal-cliente').style.display = 'flex';
}

function duplicarOrcamento(id) {
    const orcamento = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORCAMENTO');
    if (!orcamento) return alert('Orçamento não encontrado.');

    carrinhoVenda = normalizarItensDocumento(orcamento);
    renderizarCarrinhoVenda();
    document.getElementById('cli-nome').value = orcamento.cliente || '';
    document.getElementById('cli-pgto').value = orcamento.pagamento || 'DINHEIRO';
    document.getElementById('cli-boleto-select').value = orcamento.clienteId || '';
    const validade = document.getElementById('orc-validade');
    const observacao = document.getElementById('orc-observacao');
    if (validade) validade.value = orcamento.validade || '';
    if (observacao) observacao.value = orcamento.observacao || '';
    mostrarSelecaoCliente();
    document.getElementById('modal-cliente').style.display = 'flex';
    Toastify({ text: 'Orçamento carregado para duplicação.', style: { background: 'var(--primary)' } }).showToast();
}

function imprimirOrcamento(id) {
    const orcamento = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORCAMENTO');
    if (!orcamento) return alert('Orçamento não encontrado.');

    orcamentoAtualId = id;
    const itens = normalizarItensDocumento(orcamento);
    const htmlItens = itens.map(item => `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:6px; font-size:11px; color:#334155;">${item.nome}</td>
            <td style="padding:6px; text-align:center; font-size:11px;">${item.qtd}</td>
            <td style="padding:6px; text-align:right; font-size:11px;">R$ <span class="blur-sensitive">${parseFloat(item.unitario || 0).toFixed(2)}</span></td>
            <td style="padding:6px; text-align:right; font-size:11px; font-weight:bold;">R$ <span class="blur-sensitive">${parseFloat(item.total || 0).toFixed(2)}</span></td>
        </tr>
    `).join('');
    const status = orcamento.status || 'ABERTO';
    const statusBadge = status === 'VENDIDO'
        ? `<span style="color:#059669; font-weight:bold; background:#d1fae5; padding:2px 6px; border-radius:4px; font-size:10px;">VENDIDO</span>`
        : `<span style="color:#dc2626; font-weight:bold; background:#fee2e2; padding:2px 6px; border-radius:4px; font-size:10px;">ABERTO</span>`;

    document.getElementById('orcamento-visualizacao').innerHTML = `
        <div style="padding:20px; font-family:'Plus Jakarta Sans', sans-serif; width:100%; box-sizing:border-box;">
            <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #0f172a; padding-bottom:15px;">
                <h2 style="margin:0; color:#0f172a; font-size:22px; text-transform:uppercase; letter-spacing:-0.5px;">${configEmpresa.nome}</h2>
                <div style="font-size:11px; color:#64748b; margin-top:5px; line-height:1.4;">
                    ${configEmpresa.endereco ? configEmpresa.endereco + ' • ' : ''}
                    CNPJ: ${configEmpresa.cnpj || 'Não Informado'}<br>
                    Tel: ${configEmpresa.telefone || 'Não Informado'}
                </div>
                <div style="margin-top:10px; font-weight:800; font-size:12px; color:#0f172a; border:1px solid #0f172a; display:inline-block; padding:4px 12px; border-radius:20px; text-transform:uppercase;">
                    Orçamento de Venda
                </div>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:20px;">
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <tr>
                        <td style="color:#64748b; font-weight:bold; width:100px; padding-bottom:4px;">ORÇAMENTO:</td>
                        <td style="font-weight:bold; color:#0f172a; font-size:13px; padding-bottom:4px;">${orcamento.numero || '---'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:bold; padding-bottom:4px;">CLIENTE:</td>
                        <td style="color:#334155; padding-bottom:4px;">${orcamento.cliente || 'Consumidor'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:bold; padding-bottom:4px;">EMISSÃO:</td>
                        <td style="color:#334155; padding-bottom:4px;">${orcamento.data || '--'} ${orcamento.hora || ''}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:bold; padding-bottom:4px;">PAGAMENTO:</td>
                        <td style="color:#334155; padding-bottom:4px;">${orcamento.pagamento || 'Não informado'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:bold;">VALIDADE:</td>
                        <td style="color:#334155;">${orcamento.validade ? orcamento.validade.split('-').reverse().join('/') : 'Não informada'}</td>
                    </tr>
                </table>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:20px;">
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:uppercase;">Total de itens</small>
                    <div style="font-size:12px; font-weight:800; color:#334155;">${itens.reduce((acc, item) => acc + (parseInt(item.qtd) || 0), 0)}</div>
                </div>
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:uppercase;">Valor do orçamento</small>
                    <div style="font-size:12px; font-weight:800; color:#334155;">R$ <span class="blur-sensitive">${parseFloat(orcamento.venda || 0).toFixed(2)}</span></div>
                </div>
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:uppercase;">Status</small>
                    <div style="font-size:12px; font-weight:800; color:#334155;">${statusBadge}</div>
                </div>
            </div>

            <table style="width:100%; border-collapse: collapse; font-size:11px;">
                <thead>
                    <tr style="background:#f1f5f9; color:#475569; border-top:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1;">
                        <th style="padding:8px; text-align:left;">Descrição / Serviço</th>
                        <th style="padding:8px; text-align:center; width:15%;">Qtd</th>
                        <th style="padding:8px; text-align:right; width:20%;">Unitário</th>
                        <th style="padding:8px; text-align:right; width:20%;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlItens || '<tr><td colspan="4" style="text-align:center; padding:15px; font-style:italic; color:#94a3b8;">Nenhum item no orçamento.</td></tr>'}
                </tbody>
            </table>

            <div style="margin-top:18px; display:flex; justify-content:flex-end;">
                <div style="min-width:260px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:14px;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b; margin-bottom:8px;">
                        <span>Total</span>
                        <strong style="color:#0f172a;">R$ <span class="blur-sensitive">${parseFloat(orcamento.venda || 0).toFixed(2)}</span></strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b;">
                        <span>Pagamento</span>
                        <strong style="color:#0f172a;">${orcamento.pagamento || 'Não informado'}</strong>
                    </div>
                </div>
            </div>

            ${orcamento.observacao ? `
                <div style="margin-top:20px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #cbd5e1;">
                    <div style="color:#64748b; font-weight:bold; font-size:11px; margin-bottom:8px;">OBSERVAÇÃO:</div>
                    <div style="font-size:11px; color:#334155; line-height:1.6;">${orcamento.observacao}</div>
                </div>
            ` : ''}

            <div style="margin-top:30px; page-break-inside: avoid;">
                <p style="font-size:9px; text-align:justify; color:#64748b; line-height:1.4; margin-bottom:30px; border-top:1px solid #e2e8f0; padding-top:10px;">
                    Este orçamento é uma proposta comercial e pode sofrer alteração de preço, prazo ou disponibilidade até a confirmação da venda.
                </p>

                <div style="display:flex; justify-content:center; margin-top:10px;">
                    <div style="text-align:center; width:70%;">
                        <div style="border-top:1px dashed #0f172a; margin-bottom:5px;"></div>
                        <span style="font-size:11px; font-weight:bold; color:#0f172a; text-transform:uppercase;">${orcamento.cliente || 'Consumidor'}</span><br>
                        <span style="font-size:9px; color:#64748b;">Assinatura do Cliente / Responsável</span>
                    </div>
                </div>
            </div>

            <div style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:5px; text-align:center; font-size:8px; color:#94a3b8;">
                Documento emitido em ${new Date().toLocaleString('pt-BR')} pelo Sistema KELL MOTOS PRO
            </div>
        </div>
    `;

    document.getElementById('modal-orcamento').style.display = 'flex';
}

function baixarOrcamentoPDF() {
    if (!orcamentoAtualId) return;
    const el = document.getElementById('orcamento-visualizacao');
    const opt = {
        margin: 5,
        filename: `Orcamento_${orcamentoAtualId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(el).set(opt).save();
}

async function excluirOrcamento(id) {
    if (typeof userNivel === 'undefined' || userNivel !== 'SENIOR') {
        return alert('Somente usuários SENIOR podem excluir orçamentos.');
    }

    const orcamento = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORCAMENTO');
    if (!orcamento) return alert('Orçamento não encontrado.');

    const confirmado = confirm(`Excluir o orçamento ${orcamento.numero || ''} de ${orcamento.cliente || 'Consumidor'}?`);
    if (!confirmado) return;

    try {
        await db.collection('vendas_kell').doc(id).delete();
        Toastify({ text: 'Orçamento excluído com sucesso!', style: { background: 'var(--primary)' } }).showToast();
    } catch (e) {
        alert(e.message || e);
    }
}

function renderizarVendas() {
    const tbody = document.getElementById('corpo-vendas');
    if (!tbody) return;

    const lista = (typeof cacheVendas !== 'undefined' ? cacheVendas : []).filter(v => v.tipo !== 'ORCAMENTO').slice(0, 50);
    tbody.innerHTML = lista.map(v => {
        const numero = v.numero || '---';
        const cliente = v.cliente || 'Consumidor';
        const peca = v.peca || resumoItensVenda(normalizarItensDocumento(v));
        const valor = parseFloat(v.venda || 0).toFixed(2);
        const vendaSafe = JSON.stringify(v).replace(/"/g, '&quot;');
        return `<tr>
            <td><b style="color:var(--primary)">#${numero}</b></td>
            <td>${cliente}</td>
            <td>${peca}</td>
            <td>R$ ${valor}</td>
            <td style="text-align:right"><button class="btn btn-sm btn-secondary" onclick='gerarCupom(${vendaSafe})'><i class="ri-printer-line"></i></button></td>
        </tr>`;
    }).join('');
}

function renderizarOrcamentos() {
    const tbody = document.getElementById('corpo-orcamentos');
    const historico = document.getElementById('corpo-historico-orcamentos');
    if (!tbody || !historico) return;

    const lista = (typeof cacheVendas !== 'undefined' ? cacheVendas : []).filter(v => v.tipo === 'ORCAMENTO').slice(0, 50);
    const emAberto = lista.filter(v => (v.status || 'ABERTO') !== 'VENDIDO');
    const historicoLista = lista.filter(v => (v.status || 'ABERTO') === 'VENDIDO');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--text-muted);">Nenhum orçamento cadastrado.</td></tr>';
        historico.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:18px; color:var(--text-muted);">Sem histórico de orçamentos.</td></tr>';
        return;
    }

    tbody.innerHTML = emAberto.length ? emAberto.map(o => {
        const valor = parseFloat(o.venda || 0).toFixed(2);
        const status = o.status || 'ABERTO';
        const badgeColor = 'bg-red';
        const resumo = o.peca || resumoItensVenda(normalizarItensDocumento(o));
        const validade = o.validade ? `Validade: ${o.validade.split('-').reverse().join('/')}` : 'Sem validade';
        return `<tr>
            <td onclick="imprimirOrcamento('${o.id}')" style="cursor:pointer;"><b style="color:var(--primary)">${o.numero || '---'}</b></td>
            <td onclick="imprimirOrcamento('${o.id}')" style="cursor:pointer;">${o.cliente || 'Consumidor'}</td>
            <td onclick="imprimirOrcamento('${o.id}')" style="cursor:pointer;"><div>${resumo}</div><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${validade}</div></td>
            <td>R$ ${valor}</td>
            <td><span class="status-badge ${badgeColor}">${status}</span></td>
            <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                ${status !== 'VENDIDO' ? `<button class="btn btn-sm btn-primary" onclick="converterOrcamentoEmVenda('${o.id}')">Virar venda</button>` : ''}
                <button class="btn btn-sm btn-secondary" onclick="imprimirOrcamento('${o.id}')"><i class="ri-printer-line"></i></button>
                <button class="btn btn-sm btn-secondary" onclick="duplicarOrcamento('${o.id}')"><i class="ri-file-copy-line"></i></button>
                <button class="btn btn-sm btn-secondary" onclick="abrirOrcamentoParaEdicao('${o.id}')">Abrir</button>
                ${typeof userNivel !== 'undefined' && userNivel === 'SENIOR' ? `<button class="btn btn-sm btn-danger" onclick="excluirOrcamento('${o.id}')"><i class="ri-delete-bin-line"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--text-muted);">Nenhum orçamento em aberto.</td></tr>';

    historico.innerHTML = historicoLista.length ? historicoLista.map(o => `
        <tr>
            <td onclick="imprimirOrcamento('${o.id}')" style="cursor:pointer;"><b>${o.numero || '---'}</b> - ${o.cliente || 'Consumidor'}</td>
            <td>${o.validade ? o.validade.split('-').reverse().join('/') : 'Sem validade'}</td>
            <td align="right"><button class="btn btn-sm btn-secondary" onclick="imprimirOrcamento('${o.id}')">Ver Histórico</button></td>
        </tr>
    `).join('') : '<tr><td colspan="3" style="text-align:center; padding:18px; color:var(--text-muted);">Sem histórico de orçamentos.</td></tr>';
}

function gerarCupom(v) {
    const itens = normalizarItensDocumento(v);
    document.getElementById('cp-empresa-nome').innerText = configEmpresa.nome;
    document.getElementById('cp-empresa-end').innerText = configEmpresa.endereco || '';
    document.getElementById('cp-empresa-cnpj').innerText = configEmpresa.cnpj;
    document.getElementById('cp-empresa-tel').innerText = configEmpresa.telefone || '';
    document.getElementById('cp-num').innerText = '#' + v.numero;
    document.getElementById('cp-data').innerText = v.data + ' ' + v.hora;
    document.getElementById('cp-cli').innerText = String(v.cliente || '').slice(0, 30);
    document.getElementById('cp-itens').innerHTML = itens.map(item => `<tr><td style="padding:2px 0;">${String(item.nome || '').slice(0, 25)}</td><td align="center">${item.qtd}</td><td align="right">${parseFloat(item.total || 0).toFixed(2)}</td></tr>`).join('');
    document.getElementById('cp-total').innerText = 'R$ ' + parseFloat(v.venda || 0).toFixed(2);
    document.getElementById('cp-pgto').innerText = v.pagamento;
    document.getElementById('cp-operador').innerText = (v.operador || 'sis').split('@')[0];
    document.getElementById('qrcode-venda').innerHTML = '';
    new QRCode(document.getElementById('qrcode-venda'), { text: 'PED-' + v.numero, width: 80, height: 80 });
    const wrapper = document.getElementById('cupom-wrapper');
    const element = document.getElementById('cupom-print');
    wrapper.style.display = 'flex';
    setTimeout(() => {
        const contentHeight = element.offsetHeight;
        const heightInMm = (contentHeight * 0.264583) + 10;
        const opt = { margin: 0, filename: `Recibo_${v.numero}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 3, useCORS: true, scrollY: 0 }, jsPDF: { unit: 'mm', format: [80, heightInMm] } };
        html2pdf().from(element).set(opt).save().then(() => wrapper.style.display = 'none');
    }, 500);
}

function renderizarEcommerce() {
    const tbody = document.getElementById('corpo-ecommerce');
    if (!tbody) return;
    let h = '';
    if (typeof cacheEstoque !== 'undefined') {
        cacheEstoque.forEach(p => {
            const custo = (p.compra || 0) + (p.taxa_envio || 0);
            h += `<tr><td>${obterNomeProdutoVenda(p)}</td><td>R$ ${custo.toFixed(2)}</td><td>R$ ${(p.repasse || 0).toFixed(2)}</td><td>${p.eco_venda ? 'R$ ' + p.eco_venda.toFixed(2) : '--'}</td><td align="right"><button class="btn btn-sm btn-secondary" onclick='abrirAjusteEco("${p.id}")'>Config</button> <button class="btn btn-sm btn-primary" onclick='abrirVendaEco("${p.id}")'>Vender</button></td></tr>`;
        });
    }
    tbody.innerHTML = h;
}

function abrirAjusteEco(id) {
    itemEcoPendente = cacheEstoque.find(i => i.id === id);
    if (!itemEcoPendente) return;
    document.getElementById('label-peca-eco').innerText = obterNomeProdutoVenda(itemEcoPendente);
    document.getElementById('card-calc-eco').style.display = 'block';
    executarCalculoOnline();
}

function executarCalculoOnline() {
    if (!itemEcoPendente) return;
    const b = (parseFloat(itemEcoPendente.compra) || 0) + (parseFloat(itemEcoPendente.taxa_envio) || 0);
    const e = parseFloat(document.getElementById('calc_emb').value) || 0;
    const tx = parseFloat(document.getElementById('calc_taxa_site').value) || 0;
    const fix = parseFloat(document.getElementById('calc_taxa_fixa').value) || 0;
    const fr = parseFloat(document.getElementById('calc_frete').value) || 0;
    const br = parseFloat(document.getElementById('calc_brinde').value) || 0;
    const m = parseFloat(document.getElementById('calc_margem_alvo').value) || 0;
    const sug = (b + e + fr + br + fix + (b * tx / 100)) * (1 + m / 100);
    document.getElementById('calc_venda').value = 'R$ ' + sug.toFixed(2);
}

async function salvarPrecoOnline() {
    if (!itemEcoPendente) return;
    const v = parseFloat(document.getElementById('calc_venda').value.replace('R$ ', ''));
    await db.collection('estoque_kell').doc(itemEcoPendente.id).update({ eco_venda: v });
    document.getElementById('card-calc-eco').style.display = 'none';
    Toastify({ text: 'Atualizado' }).showToast();
}

document.addEventListener('DOMContentLoaded', () => {
    renderizarCarrinhoVenda();
    const inputVenda = document.getElementById('venda-codigo-input');
    if (inputVenda && !inputVenda.dataset.bindedEnter) {
        inputVenda.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                venderPorCodigoManual();
            }
        });
        inputVenda.dataset.bindedEnter = 'true';
    }
    focarCampoCodigoVenda();
});
