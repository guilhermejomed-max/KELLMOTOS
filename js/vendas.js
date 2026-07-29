let vendaPendente = null;
let itemEcoPendente = null;
let carrinhoVenda = [];
let orcamentoAtualId = null;
let anuncioProdutoPendente = null;
let orcamentoEmEdicaoId = null;
let orcamentoPopupEdicaoId = null;
let itensNovoOrcamento = [];
let itensEdicaoOrcamento = [];

function obterNomeProdutoVenda(produto) {
    if (!produto) return 'Produto';
    const partes = [produto.marca, produto.nome_peca].map(v => String(v || '').trim()).filter(Boolean);
    return partes.join(' ') || produto.modelo || 'Produto';
}

function obterImagensProdutoAnuncio(produto) {
    const imagens = [];
    if (Array.isArray(produto?.imagens)) imagens.push(...produto.imagens);
    if (produto?.imagem) imagens.push(produto.imagem);
    return imagens.map(img => String(img || '').trim()).filter(Boolean).filter((img, index, arr) => arr.indexOf(img) === index);
}

function montarDescricaoAnuncio(produto) {
    const nome = obterNomeProdutoVenda(produto);
    const aplicacoes = Array.isArray(produto?.compatibilidade) && produto.compatibilidade.length
        ? produto.compatibilidade.join(', ')
        : 'Consulte a compatibilidade antes da compra.';
    const codigo = produto?.codigo ? `Código da peça: ${produto.codigo}.` : '';
    const localizacao = produto?.localizacao
        ? [produto.localizacao.corredor, produto.localizacao.caixa, produto.localizacao.prateleira].filter(Boolean).join(' / ')
        : '';

    return [
        `${nome}`,
        '',
        'Produto cadastrado com revisão manual para anúncio.',
        codigo,
        `Marca: ${produto?.marca || 'Não informada'}.`,
        produto?.fornecedor ? `Fornecedor / linha: ${produto.fornecedor}.` : '',
        `Aplicação / compatibilidade: ${aplicacoes}.`,
        parseInt(produto?.intervalo_revisao_dias) ? `Ciclo técnico sugerido: ${parseInt(produto.intervalo_revisao_dias)} dias.` : '',
        localizacao ? `Localização interna: ${localizacao}.` : '',
        '',
        'Diferenciais:',
        '- Produto disponível em estoque.',
        '- Fotos reais cadastradas no sistema.',
        produto?.exige_base_troca ? '- Produto trabalha com base de troca.' : '',
        '- Envio e retirada conforme disponibilidade da loja.',
        '',
        'Antes de publicar:',
        '- Revise categoria e atributos do marketplace.',
        '- Confirme preço, estoque e compatibilidade.',
        '- Ajuste a descrição se necessário.'
    ].filter(Boolean).join('\n');
}

function montarTituloAnuncio(produto) {
    const nomePeca = String(produto?.nome_peca || produto?.modelo || '').trim();
    const marca = String(produto?.marca || '').trim();
    const primeiraCompatibilidade = Array.isArray(produto?.compatibilidade) && produto.compatibilidade.length
        ? String(produto.compatibilidade[0] || '').trim()
        : '';
    const codigo = String(produto?.codigo || '').trim();

    const partes = [
        nomePeca,
        primeiraCompatibilidade,
        marca,
        produto?.exige_base_troca ? 'Base de Troca' : '',
        codigo ? `Cód. ${codigo}` : ''
    ].filter(Boolean);

    return partes.join(' - ');
}

function obterProdutosRelacionadosVenda(produto) {
    const sugestoes = Array.isArray(produto?.sugestoes_produtos)
        ? produto.sugestoes_produtos
        : String(produto?.sugestoes_produtos || '').split(',');

    if (!Array.isArray(cacheEstoque) || !sugestoes.length) return [];

    return sugestoes
        .map(chave => String(chave || '').trim())
        .filter(Boolean)
        .map(chave => {
            const chaveNormalizada = chave.toLowerCase();
            return cacheEstoque.find(item =>
                item.id === chave ||
                String(item.codigo || '').trim().toLowerCase() === chaveNormalizada
            );
        })
        .filter(Boolean)
        .filter((item, index, arr) => arr.findIndex(outro => outro.id === item.id) === index);
}

function calcularAgendaRevisaoVenda(itens, dadosCliente) {
    const agora = Date.now();
    const kmAtual = parseInt(dadosCliente?.motor_km_atual) || 0;
    const horasAtual = parseInt(dadosCliente?.motor_horas_atual) || 0;

    return itens
        .filter(item => parseInt(item.intervalo_revisao_dias) > 0)
        .map(item => {
            const intervalo = parseInt(item.intervalo_revisao_dias) || 0;
            const proxima = new Date(agora + (intervalo * 24 * 60 * 60 * 1000));
            return {
                produtoId: item.produtoId || item.id || '',
                nome: item.nome || 'Item',
                intervalo_dias: intervalo,
                data_base_ts: agora,
                proxima_revisao_ts: proxima.getTime(),
                proxima_revisao: proxima.toLocaleDateString('pt-BR'),
                km_registrado: kmAtual || null,
                horas_registradas: horasAtual || null,
                observacao: item.observacao_revisao || ''
            };
        });
}

function renderizarSugestoesCarrinho() {
    const box = document.getElementById('painel-sugestoes-carrinho');
    if (!box) return;

    const idsNoCarrinho = new Set(carrinhoVenda.map(item => item.produtoId || item.id));
    const sugestoes = [];

    carrinhoVenda.forEach(item => {
        const produto = (cacheEstoque || []).find(prod => prod.id === (item.produtoId || item.id));
        obterProdutosRelacionadosVenda(produto).forEach(relacionado => {
            if (idsNoCarrinho.has(relacionado.id)) return;
            if (!sugestoes.find(existente => existente.id === relacionado.id)) {
                sugestoes.push(relacionado);
            }
        });
    });

    if (!sugestoes.length) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }

    box.style.display = 'block';
    box.innerHTML = `
        <div style="padding:16px; border:1px solid var(--border-color); border-radius:16px; background:var(--bg-body);">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
                <div>
                    <div style="font-size:11px; font-weight:700; color:var(--primary); text-transform:none; letter-spacing:0;">Kit de manutenção</div>
                    <div style="font-size:14px; font-weight:700; color:var(--text-main);">Sugestões para aumentar o ticket do atendimento</div>
                </div>
                <div style="font-size:12px; color:var(--text-muted);">Baseado nas peças já selecionadas</div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:10px;">
                ${sugestoes.slice(0, 6).map(item => `
                    <div style="border:1px solid var(--border-color); border-radius:14px; padding:12px; background:var(--bg-card);">
                        <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">${item.codigo || 'Sem código'}</div>
                        <div style="font-size:14px; font-weight:700; color:var(--text-main); line-height:1.35; margin-bottom:6px;">${obterNomeProdutoVenda(item)}</div>
                        <div style="font-size:13px; color:var(--primary); font-weight:700; margin-bottom:10px;">R$ ${(parseFloat(item.repasse) || 0).toFixed(2)}</div>
                        <button class="btn btn-secondary btn-sm" onclick="adicionarProdutoAoCarrinhoPorId('${item.id}')">Adicionar ao carrinho</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function adicionarProdutoAoCarrinhoPorId(id) {
    const produto = (cacheEstoque || []).find(item => item.id === id);
    if (!produto) return alert('Produto relacionado não encontrado.');
    adicionarProdutoAoCarrinho(produto, 1, 'BALCAO', produto.repasse);
}

function montarRascunhoAnuncio(produto) {
    const imagens = obterImagensProdutoAnuncio(produto);
    const precoOnline = parseFloat(produto?.eco_venda) || 0;
    const precoBalcao = parseFloat(produto?.repasse) || 0;
    const preco = precoOnline || precoBalcao || 0;
    return {
        titulo: produto?.anuncio_ml_rascunho?.titulo || montarTituloAnuncio(produto),
        categoria: produto?.anuncio_ml_rascunho?.categoria || '',
        preco,
        estoque: parseInt(produto?.qtd) || 0,
        condicao: produto?.anuncio_ml_rascunho?.condicao || 'Novo',
        descricao: produto?.anuncio_ml_rascunho?.descricao || montarDescricaoAnuncio(produto),
        imagens,
        observacoes: produto?.anuncio_ml_rascunho?.observacoes || '',
        marketplace: 'Mercado Livre',
        codigo: produto?.codigo || '',
        produtoId: produto?.id || ''
    };
}

function gerarResumoTextoAnuncio(draft) {
    return [
        `Marketplace: ${draft.marketplace}`,
        `Título: ${draft.titulo}`,
        `Categoria: ${draft.categoria || 'Definir manualmente'}`,
        `Preço: R$ ${parseFloat(draft.preco || 0).toFixed(2)}`,
        `Estoque: ${parseInt(draft.estoque || 0)}`,
        `Condição: ${draft.condicao || 'Novo'}`,
        `Código: ${draft.codigo || 'Sem código'}`,
        '',
        'Descrição:',
        draft.descricao || '',
        '',
        draft.observacoes ? `Observações:\n${draft.observacoes}` : '',
        '',
        'Imagens:',
        ...(draft.imagens || [])
    ].filter(Boolean).join('\n');
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
            origem: item.origem || doc?.origem || 'BALCAO',
            exige_base_troca: !!item.exige_base_troca,
            status_base_troca: item.status_base_troca || 'NORMAL',
            intervalo_revisao_dias: parseInt(item.intervalo_revisao_dias) || 0,
            observacao_revisao: item.observacao_revisao || ''
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
        origem: doc?.origem || 'BALCAO',
        exige_base_troca: !!doc?.exige_base_troca,
        status_base_troca: doc?.status_base_troca || 'NORMAL',
        intervalo_revisao_dias: parseInt(doc?.intervalo_revisao_dias) || 0,
        observacao_revisao: doc?.observacao_revisao || ''
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
    const sugestoesBox = document.getElementById('painel-sugestoes-carrinho');
    if (!corpo || !vazio || !tabela || !totalEl || !itensEl) return;

    if (!carrinhoVenda.length) {
        corpo.innerHTML = '';
        vazio.style.display = 'block';
        tabela.style.display = 'none';
        totalEl.innerText = 'R$ 0,00';
        itensEl.innerText = '0';
        if (sugestoesBox) {
            sugestoesBox.style.display = 'none';
            sugestoesBox.innerHTML = '';
        }
        return;
    }

    vazio.style.display = 'none';
    tabela.style.display = 'block';
    corpo.innerHTML = carrinhoVenda.map((item, index) => {
        const total = (parseInt(item.qtd) || 0) * (parseFloat(item.unitario) || 0);
        const observacoes = [];
        if (item.exige_base_troca || item.status_base_troca === 'BASE_PENDENTE' || item.status_base_troca === 'AGUARDANDO_RETIFICA') {
            observacoes.push('<span style="font-size:11px; font-weight:700; color:#b45309;">Base de troca</span>');
        }
        if (parseInt(item.intervalo_revisao_dias) > 0) {
            observacoes.push(`<span style="font-size:11px; font-weight:700; color:#2563eb;">Revisão em ${parseInt(item.intervalo_revisao_dias)} dias</span>`);
        }
        return `<tr>
            <td>
                <div style="font-weight:700; color:var(--text-main);">${item.nome}</div>
                <div style="font-size:12px; color:var(--text-muted);">${item.codigo || 'Sem código'}</div>
                ${observacoes.length ? `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">${observacoes.join('')}</div>` : ''}
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn btn-sm btn-secondary" onclick="alterarQtdCarrinho(${index}, -1)">-</button>
                    <span style="min-width:24px; text-align:center; font-weight:700;">${item.qtd}</span>
                    <button class="btn btn-sm btn-secondary" onclick="alterarQtdCarrinho(${index}, 1)">+</button>
                </div>
            </td>
            <td>R$ ${(parseFloat(item.unitario) || 0).toFixed(2)}</td>
            <td style="font-weight:700;">R$ ${total.toFixed(2)}</td>
            <td style="text-align:right;"><button class="btn btn-sm btn-secondary" onclick="removerItemCarrinho(${index})"><i class="ri-delete-bin-line"></i></button></td>
        </tr>`;
    }).join('');

    totalEl.innerText = `R$ ${totalCarrinhoVenda().toFixed(2)}`;
    itensEl.innerText = String(totalItensCarrinhoVenda());
    renderizarSugestoesCarrinho();
}

function limparCarrinhoVenda(limparCliente = false) {
    carrinhoVenda = [];
    vendaPendente = null;
    orcamentoEmEdicaoId = null;
    renderizarCarrinhoVenda();
    if (limparCliente) {
        const nome = document.getElementById('cli-nome');
        const pgto = document.getElementById('cli-pgto');
        const boleto = document.getElementById('cli-boleto-select');
        const validade = document.getElementById('orc-validade');
        const observacao = document.getElementById('orc-observacao');
        const kmAtual = document.getElementById('motor-km-atual');
        const horasAtual = document.getElementById('motor-horas-atual');
        if (nome) nome.value = '';
        if (pgto) pgto.value = 'DINHEIRO';
        if (boleto) boleto.value = '';
        if (validade) validade.value = '';
        if (observacao) observacao.value = '';
        if (kmAtual) kmAtual.value = '';
        if (horasAtual) horasAtual.value = '';
        mostrarSelecaoCliente();
    }
    atualizarEstadoModalCliente();
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
            origem,
            exige_base_troca: !!produto.exige_base_troca,
            status_base_troca: produto.status_base_troca || 'NORMAL',
            intervalo_revisao_dias: parseInt(produto.intervalo_revisao_dias) || 0,
            observacao_revisao: produto.observacao_revisao || ''
        });
    }

    renderizarCarrinhoVenda();
    if (produto.exige_base_troca || produto.status_base_troca === 'BASE_PENDENTE' || produto.status_base_troca === 'AGUARDANDO_RETIFICA') {
        Toastify({ text: `${nome}: atenção à base de troca`, style: { background: '#f59e0b' } }).showToast();
    }
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
        observacao: (document.getElementById('orc-observacao')?.value || '').trim(),
        motor_km_atual: parseInt(document.getElementById('motor-km-atual')?.value) || 0,
        motor_horas_atual: parseInt(document.getElementById('motor-horas-atual')?.value) || 0
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
    document…15114 tokens truncated…uirOrcamento(id) {
    if (!podeExecutarAcao('excluir_orcamento')) {
        return alert('Você não tem permissão para excluir orçamentos.');
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

    const lista = (typeof cacheVendas !== 'undefined' ? cacheVendas : []).filter(v => v.tipo !== 'ORCAMENTO' && v.tipo !== 'ORDEM_SERVICO').slice(0, 50);
    tbody.innerHTML = lista.map(v => {
        const numero = v.numero || '---';
        const cliente = v.cliente || 'Consumidor';
        const peca = v.peca || resumoItensVenda(normalizarItensDocumento(v));
        const revisao = v.proxima_revisao ? `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Próxima revisão: ${v.proxima_revisao}</div>` : '';
        const valor = parseFloat(v.venda || 0).toFixed(2);
        const vendaSafe = JSON.stringify(v).replace(/"/g, '&quot;');
        return `<tr>
            <td><b style="color:var(--primary)">#${numero}</b></td>
            <td>${cliente}</td>
            <td><div>${peca}</div>${revisao}</td>
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
    const busca = (document.getElementById('orcamentos-busca')?.value || '').trim().toLowerCase();
    const filtroStatus = document.getElementById('orcamentos-status')?.value || 'ABERTOS';
    const hoje = new Date().toISOString().slice(0, 10);
    const vencendoHoje = emAberto.filter(o => o.validade === hoje).length;
    const valorEmAberto = emAberto.reduce((total, o) => total + (parseFloat(o.venda) || 0), 0);

    const atualizarKpi = (id, valor) => { const el = document.getElementById(id); if (el) el.innerText = valor; };
    atualizarKpi('orc-kpi-abertos', emAberto.length);
    atualizarKpi('orc-kpi-valor', `R$ ${valorEmAberto.toFixed(2)}`);
    atualizarKpi('orc-kpi-vencendo', vencendoHoje);
    atualizarKpi('orc-kpi-convertidos', historicoLista.length);

    const visiveis = lista.filter(o => {
        const status = o.status || 'ABERTO';
        const correspondeStatus = filtroStatus === 'TODOS' || status === filtroStatus || (filtroStatus === 'ABERTOS' && status !== 'VENDIDO');
        const texto = [o.numero, o.cliente, o.modelo_moto, o.ano_moto, o.peca, resumoItensVenda(normalizarItensDocumento(o))].join(' ').toLowerCase();
        return correspondeStatus && (!busca || texto.includes(busca));
    });
    const abertosVisiveis = visiveis.filter(v => (v.status || 'ABERTO') !== 'VENDIDO');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--text-muted);">Nenhum orçamento cadastrado.</td></tr>';
        historico.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:18px; color:var(--text-muted);">Sem histórico de orçamentos.</td></tr>';
        return;
    }

    tbody.innerHTML = abertosVisiveis.length ? abertosVisiveis.map(o => {
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
                <button class="btn btn-sm btn-secondary" onclick="abrirPopupEdicaoOrcamento('${o.id}')">Editar</button>
                ${podeExecutarAcao('excluir_orcamento') ? `<button class="btn btn-sm btn-danger" onclick="excluirOrcamento('${o.id}')"><i class="ri-delete-bin-line"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--text-muted);">Nenhum orçamento encontrado para este filtro.</td></tr>';

    historico.innerHTML = historicoLista.length ? historicoLista.map(o => `
        <tr>
            <td onclick="imprimirOrcamento('${o.id}')" style="cursor:pointer;"><b>${o.numero || '---'}</b> - ${o.cliente || 'Consumidor'}</td>
            <td>${o.validade ? o.validade.split('-').reverse().join('/') : 'Sem validade'}</td>
            <td align="right"><button class="btn btn-sm btn-secondary" onclick="imprimirOrcamento('${o.id}')">Ver Histórico</button></td>
        </tr>
    `).join('') : '<tr><td colspan="3" style="text-align:center; padding:18px; color:var(--text-muted);">Sem histórico de orçamentos.</td></tr>';
}

function abrirNovoOrcamento() {
    itensNovoOrcamento = [{ nome: '', qtd: 1, unitario: 0 }];
    const hoje = new Date().toISOString().slice(0, 10);
    const data = document.getElementById('novo-orcamento-data');
    const cliente = document.getElementById('novo-orcamento-cliente');
    const modeloMoto = document.getElementById('novo-orcamento-modelo-moto');
    const anoMoto = document.getElementById('novo-orcamento-ano-moto');
    const nomeLoja = document.getElementById('novo-orcamento-loja');
    const infoLoja = document.getElementById('novo-orcamento-loja-info');
    if (data) data.value = hoje;
    if (cliente) cliente.value = '';
    if (modeloMoto) modeloMoto.value = '';
    if (anoMoto) anoMoto.value = '';
    if (nomeLoja) nomeLoja.innerText = configEmpresa?.nome || 'KELL MOTOS';
    if (infoLoja) infoLoja.innerText = [configEmpresa?.endereco, configEmpresa?.telefone, configEmpresa?.cnpj ? `CNPJ: ${configEmpresa.cnpj}` : ''].filter(Boolean).join(' • ') || 'Informações da loja';
    renderizarItensNovoOrcamento();
    fecharModais();
    document.getElementById('modal-novo-orcamento').style.display = 'flex';
}

function adicionarItemNovoOrcamento() {
    itensNovoOrcamento.push({ nome: '', qtd: 1, unitario: 0 });
    renderizarItensNovoOrcamento();
}

function atualizarItemNovoOrcamento(indice, campo, valor) {
    if (!itensNovoOrcamento[indice]) return;
    itensNovoOrcamento[indice][campo] = campo === 'nome' ? valor : (parseFloat(valor) || 0);
    atualizarTotaisNovoOrcamento();
}

function removerItemNovoOrcamento(indice) {
    itensNovoOrcamento.splice(indice, 1);
    if (!itensNovoOrcamento.length) itensNovoOrcamento.push({ nome: '', qtd: 1, unitario: 0 });
    renderizarItensNovoOrcamento();
}

function renderizarItensNovoOrcamento() {
    const corpo = document.getElementById('novo-orcamento-itens');
    const totalEl = document.getElementById('novo-orcamento-total');
    if (!corpo || !totalEl) return;
    corpo.innerHTML = itensNovoOrcamento.map((item, indice) => {
        const subtotal = (parseFloat(item.qtd) || 0) * (parseFloat(item.unitario) || 0);
        const nome = String(item.nome || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<tr><td><input class="input-style" style="margin:0; min-width:220px;" placeholder="Descreva o item ou serviço" value="${nome}" oninput="atualizarItemNovoOrcamento(${indice}, 'nome', this.value)"></td><td><input class="input-style" style="margin:0;" type="number" min="1" step="1" value="${item.qtd || 1}" oninput="atualizarItemNovoOrcamento(${indice}, 'qtd', this.value)"></td><td><input class="input-style" style="margin:0;" type="number" min="0" step="0.01" value="${item.unitario || 0}" oninput="atualizarItemNovoOrcamento(${indice}, 'unitario', this.value)"></td><td id="novo-orc-subtotal-${indice}" style="text-align:right; font-weight:700;">R$ ${subtotal.toFixed(2)}</td><td style="text-align:center;"><button type="button" class="btn btn-sm btn-secondary" title="Remover linha" aria-label="Remover linha" onclick="removerItemNovoOrcamento(${indice})"><i class="ri-delete-bin-line"></i></button></td></tr>`;
    }).join('');
    atualizarTotaisNovoOrcamento();
}

function atualizarTotaisNovoOrcamento() {
    const totalEl = document.getElementById('novo-orcamento-total');
    const total = itensNovoOrcamento.reduce((soma, item) => soma + ((parseFloat(item.qtd) || 0) * (parseFloat(item.unitario) || 0)), 0);
    if (totalEl) totalEl.innerText = `R$ ${total.toFixed(2)}`;
    itensNovoOrcamento.forEach((item, indice) => {
        const subtotalEl = document.getElementById(`novo-orc-subtotal-${indice}`);
        if (subtotalEl) subtotalEl.innerText = `R$ ${((parseFloat(item.qtd) || 0) * (parseFloat(item.unitario) || 0)).toFixed(2)}`;
    });
}

async function salvarNovoOrcamento() {
    const cliente = document.getElementById('novo-orcamento-cliente')?.value.trim();
    const data = document.getElementById('novo-orcamento-data')?.value;
    const modeloMoto = document.getElementById('novo-orcamento-modelo-moto')?.value.trim() || '';
    const anoMoto = document.getElementById('novo-orcamento-ano-moto')?.value.trim() || '';
    const itensValidos = itensNovoOrcamento.filter(item => String(item.nome || '').trim() && (parseFloat(item.qtd) || 0) > 0);
    if (!cliente) return alert('Informe o nome do cliente.');
    if (!data) return alert('Informe a data do orçamento.');
    if (anoMoto && !/^\d{4}$/.test(anoMoto)) return alert('Informe o ano da moto com quatro dígitos.');
    if (!itensValidos.length) return alert('Adicione pelo menos um item com descrição e quantidade.');
    const itens = itensValidos.map(item => ({ id: '', produtoId: '', nome: String(item.nome).trim(), qtd: parseFloat(item.qtd), unitario: parseFloat(item.unitario) || 0, total: (parseFloat(item.qtd) || 0) * (parseFloat(item.unitario) || 0), origem: 'ORCAMENTO_MANUAL' }));
    const total = itens.reduce((soma, item) => soma + item.total, 0);
    const payload = { numero: gerarNumeroOrcamento(), tipo: 'ORCAMENTO', status: 'ABERTO', cliente, clienteId: '', modelo_moto: modeloMoto, ano_moto: anoMoto, itens, peca: resumoItensVenda(itens), produtoId: '', qtd: itens.reduce((soma, item) => soma + item.qtd, 0), venda: total, unitario: itens.length === 1 ? itens[0].unitario : 0, pagamento: 'A DEFINIR', data: data.split('-').reverse().join('/'), data_referencia: data, hora: new Date().toLocaleTimeString('pt-BR'), timestamp: Date.now(), origem: 'ORCAMENTO_MANUAL', operador: auth.currentUser?.email || 'SISTEMA' };
    try {
        const doc = await db.collection('vendas_kell').add(payload);
        if (typeof registrarAuditoria === 'function') registrarAuditoria('VENDAS', doc.id, 'ORCAMENTO_CRIADO', { numero: payload.numero, cliente, valor: total });
        Toastify({ text: 'Orçamento salvo com sucesso!', style: { background: 'var(--primary)' } }).showToast();
        fecharModais();
    } catch (e) {
        alert(e.message || e);
    }
}

function exportarVendasCSV() {
    if (!podeExecutarAcao('exportar_relatorios')) return alert('Você não tem permissão para exportar relatórios.');
    const linhas = [['Número','Data','Cliente','Pagamento','Resumo','Valor','Próxima revisão']];
    (cacheVendas || []).filter(item => item.tipo !== 'ORCAMENTO' && item.tipo !== 'ORDEM_SERVICO').forEach(item => {
        linhas.push([
            item.numero || '',
            item.data || '',
            item.cliente || '',
            item.pagamento || '',
            item.peca || '',
            (parseFloat(item.venda) || 0).toFixed(2),
            item.proxima_revisao || ''
        ]);
    });
    baixarCSV('vendas_kell.csv', linhas);
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
            const custo = (parseFloat(p.custo_medio ?? p.compra) || 0) + (parseFloat(p.taxa_envio) || 0);
            const possuiRascunho = !!(p.anuncio_ml_rascunho && p.anuncio_ml_rascunho.titulo);
            const statusAnuncio = possuiRascunho
                ? '<span class="status-badge bg-green">Rascunho salvo</span>'
                : '<span class="status-badge" style="background:rgba(245,158,11,0.14); color:#b45309;">Pendente</span>';
            const custoHtml = podeExecutarAcao('ver_custo') ? `R$ ${custo.toFixed(2)}` : '--';

            h += `<tr>
                <td>
                    <div style="font-weight:700; color:var(--text-main);">${obterNomeProdutoVenda(p)}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${statusAnuncio}</div>
                </td>
                <td>${custoHtml}</td>
                <td>R$ ${(p.repasse || 0).toFixed(2)}</td>
                <td>${p.eco_venda ? 'R$ ' + p.eco_venda.toFixed(2) : '--'}</td>
                <td align="right">
                    <div style="display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap;">
                        ${podeExecutarAcao('editar_preco') ? `<button class="btn btn-sm btn-secondary" onclick='abrirAjusteEco("${p.id}")'>Config</button>` : ''}
                        ${podeExecutarAcao('publicar_anuncio') ? `<button class="btn btn-sm btn-secondary" onclick='abrirGeradorAnuncio("${p.id}")'>Gerar anúncio</button>` : ''}
                        <button class="btn btn-sm btn-primary" onclick='abrirVendaEco("${p.id}")'>Vender</button>
                    </div>
                </td>
            </tr>`;
        });
    }
    tbody.innerHTML = h;
}

function abrirAjusteEco(id) {
    if (!podeExecutarAcao('editar_preco')) return alert('Você não tem permissão para editar preço.');
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
    if (!podeExecutarAcao('editar_preco')) return alert('Você não tem permissão para editar preço online.');
    if (!itemEcoPendente) return;
    const v = parseFloat(document.getElementById('calc_venda').value.replace('R$ ', ''));
    await db.collection('estoque_kell').doc(itemEcoPendente.id).update({ eco_venda: v });
    if (typeof registrarAuditoria === 'function') registrarAuditoria('ECOMMERCE', itemEcoPendente.id, 'PRECO_ONLINE', { eco_venda: v });
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
