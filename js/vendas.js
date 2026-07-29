let vendaPendente = null;
let itemEcoPendente = null;
let carrinhoVenda = [];
let orcamentoAtualId = null;
let anuncioProdutoPendente = null;
let orcamentoEmEdicaoId = null;
let orcamentoPopupEdicaoId = null;
let itensNovoOrcamento = [];

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
    orcamentoEmEdicaoId = null;
    fecharModais();
    atualizarEstadoModalCliente();
    document.getElementById('modal-cliente').style.display = 'flex';
    mostrarSelecaoCliente();
}

function atualizarEstadoModalCliente() {
    const titulo = document.getElementById('modal-cliente-titulo');
    const btnOrcamento = document.getElementById('btn-criar-orcamento');
    const btnVenda = document.getElementById('btn-confirmar-venda');
    const editando = !!orcamentoEmEdicaoId;

    if (titulo) titulo.innerText = editando ? 'Editar orçamento' : 'Venda / Orçamento';
    if (btnOrcamento) btnOrcamento.innerText = editando ? 'Salvar alterações' : 'Criar orçamento';
    if (btnVenda) btnVenda.style.display = editando ? 'none' : 'inline-flex';
}

function resetarEstadoModalCliente() {
    orcamentoEmEdicaoId = null;
    atualizarEstadoModalCliente();
}

function resetarPopupEdicaoOrcamento() {
    orcamentoPopupEdicaoId = null;
    ['editar-orc-cliente','editar-orc-validade','editar-orc-km','editar-orc-horas','editar-orc-valor','editar-orc-observacao'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const selectPgto = document.getElementById('editar-orc-pgto');
    const selectCliente = document.getElementById('editar-orc-boleto-select');
    const resumo = document.getElementById('editar-orcamento-resumo');
    if (selectPgto) selectPgto.value = 'DINHEIRO';
    if (selectCliente) selectCliente.value = '';
    if (resumo) resumo.innerHTML = '';
    mostrarSelecaoClienteEdicaoOrcamento();
}

function mostrarSelecaoClienteEdicaoOrcamento() {
    const isBoleto = document.getElementById('editar-orc-pgto')?.value === 'BOLETO';
    const wrap = document.getElementById('editar-orc-boleto-wrap');
    if (wrap) wrap.style.display = isBoleto ? 'block' : 'none';
    if (isBoleto && typeof atualizarSelectClientes === 'function') {
        atualizarSelectClientes();
        const origem = document.getElementById('cli-boleto-select');
        const destino = document.getElementById('editar-orc-boleto-select');
        if (origem && destino && !destino.innerHTML) destino.innerHTML = origem.innerHTML;
        sincronizarClienteEdicaoOrcamento(true);
    }
}

function sincronizarClienteEdicaoOrcamento(porNome = false) {
    const select = document.getElementById('editar-orc-boleto-select');
    const inputNome = document.getElementById('editar-orc-cliente');
    if (!select || !inputNome) return null;
    if (porNome && !select.value) {
        const clientePorNome = localizarClienteFiadoPorNome(inputNome.value);
        if (clientePorNome) select.value = clientePorNome.id;
    }
    const cliente = (cacheClientes || []).find(item => item.id === select.value) || null;
    if (cliente) inputNome.value = cliente.nome || inputNome.value;
    return cliente;
}

function consultarProdutoBalcao(valorManual = '') {
    const busca = String(valorManual || document.getElementById('consulta-balcao-input')?.value || '').toLowerCase().trim();
    const box = document.getElementById('consulta-balcao-resultado');
    if (!box) return;
    if (!busca) {
        box.innerHTML = 'Nenhuma consulta realizada ainda.';
        return;
    }

    const produto = (cacheEstoque || []).find(item => [item.codigo, item.modelo, item.marca, item.nome_peca, ...(item.compatibilidade || [])].join(' ').toLowerCase().includes(busca));
    if (!produto) {
        box.innerHTML = `<div style="color:var(--danger); font-weight:700;">Nenhum produto encontrado para "${busca}".</div>`;
        return;
    }

    const relacionados = typeof obterProdutosRelacionadosVenda === 'function' ? obterProdutosRelacionadosVenda(produto).slice(0, 3) : [];
    box.innerHTML = `
        <div style="display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:start;">
            <div>
                <div style="font-size:12px; color:var(--text-muted);">${produto.codigo || 'Sem código'} • ${produto.localizacao?.corredor || '--'} ${produto.localizacao?.caixa || '--'} ${produto.localizacao?.prateleira || '--'}</div>
                <div style="font-size:20px; font-weight:700; color:var(--text-main); margin-top:4px;">${obterNomeProdutoVenda(produto)}</div>
                <div style="font-size:13px; color:var(--text-muted); margin-top:8px;">${(produto.compatibilidade || []).slice(0, 4).join(', ') || 'Sem aplicação informada'}</div>
                ${relacionados.length ? `<div style="margin-top:12px; font-size:13px; color:var(--text-main);"><b>Relacionados:</b> ${relacionados.map(item => obterNomeProdutoVenda(item)).join(', ')}</div>` : ''}
            </div>
            <div style="text-align:right;">
                <div style="font-size:12px; color:var(--text-muted);">Estoque</div>
                <div style="font-size:22px; font-weight:700; color:var(--text-main);">${parseInt(produto.qtd) || 0}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">Preço</div>
                <div style="font-size:24px; font-weight:700; color:var(--primary);">R$ ${(parseFloat(produto.repasse) || 0).toFixed(2)}</div>
            </div>
        </div>
    `;
}

function limparFormularioOS() {
    ['os-cliente','os-veiculo','os-placa','os-km','os-previsao','os-diagnostico','os-servico','os-pecas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const status = document.getElementById('os-status');
    if (status) status.value = 'ABERTA';
}

async function salvarOrdemServico() {
    if (!podeExecutarAcao('gerenciar_os')) return alert('Você não tem permissão para gerenciar ordens de serviço.');
    const payload = {
        tipo: 'ORDEM_SERVICO',
        numero: 'OS-' + String(Date.now()).slice(-8),
        cliente: document.getElementById('os-cliente')?.value?.trim() || 'Consumidor',
        veiculo: document.getElementById('os-veiculo')?.value?.trim() || '',
        placa: document.getElementById('os-placa')?.value?.trim() || '',
        km_atual: parseInt(document.getElementById('os-km')?.value) || 0,
        previsao: document.getElementById('os-previsao')?.value || '',
        status: document.getElementById('os-status')?.value || 'ABERTA',
        diagnostico: document.getElementById('os-diagnostico')?.value?.trim() || '',
        servico: document.getElementById('os-servico')?.value?.trim() || '',
        pecas_sugeridas: String(document.getElementById('os-pecas')?.value || '').split(',').map(item => item.trim()).filter(Boolean),
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR'),
        timestamp: Date.now(),
        operador: auth.currentUser?.email || 'SISTEMA'
    };
    if (!payload.cliente || !payload.veiculo) return alert('Cliente e veículo são obrigatórios.');
    const doc = await db.collection('vendas_kell').add(payload);
    if (typeof registrarAuditoria === 'function') registrarAuditoria('SERVICOS', doc.id, 'CRIACAO_OS', { cliente: payload.cliente, status: payload.status });
    limparFormularioOS();
    Toastify({ text: 'Ordem de serviço salva!', style: { background: 'var(--primary)' } }).showToast();
}

function renderizarOrdensServico() {
    const corpo = document.getElementById('corpo-os');
    if (!corpo) return;
    const lista = (cacheVendas || []).filter(item => item.tipo === 'ORDEM_SERVICO').slice(0, 50);
    corpo.innerHTML = lista.length ? lista.map(item => `
        <tr>
            <td><b style="color:var(--primary)">${item.numero || '---'}</b></td>
            <td>${item.cliente || '--'}</td>
            <td>${item.veiculo || '--'}</td>
            <td><span class="status-badge ${item.status === 'FINALIZADA' ? 'bg-green' : 'bg-red'}">${item.status || 'ABERTA'}</span></td>
            <td>${item.previsao ? item.previsao.split('-').reverse().join('/') : '--'}</td>
            <td style="text-align:right;"><button class="btn btn-sm btn-secondary" onclick="abrirOrdemServico('${item.id}')">Abrir</button></td>
        </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--text-muted);">Nenhuma ordem de serviço registrada.</td></tr>';
}

function abrirOrdemServico(id) {
    const ordem = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORDEM_SERVICO');
    const box = document.getElementById('os-visualizacao');
    const modal = document.getElementById('modal-os');
    if (!ordem || !box || !modal) return;
    box.innerHTML = `
        <div class="form-grid-2">
            <div class="modal-subtle-box"><div class="modal-section-title">Cliente</div><div style="font-weight:700; color:var(--text-main);">${ordem.cliente || '--'}</div></div>
            <div class="modal-subtle-box"><div class="modal-section-title">Status</div><div style="font-weight:700; color:var(--text-main);">${ordem.status || 'ABERTA'}</div></div>
            <div class="modal-subtle-box"><div class="modal-section-title">Veículo</div><div style="font-weight:700; color:var(--text-main);">${ordem.veiculo || '--'}</div></div>
            <div class="modal-subtle-box"><div class="modal-section-title">Placa / ID</div><div style="font-weight:700; color:var(--text-main);">${ordem.placa || '--'}</div></div>
            <div class="modal-subtle-box"><div class="modal-section-title">KM</div><div style="font-weight:700; color:var(--text-main);">${ordem.km_atual || '--'}</div></div>
            <div class="modal-subtle-box"><div class="modal-section-title">Previsão</div><div style="font-weight:700; color:var(--text-main);">${ordem.previsao ? ordem.previsao.split('-').reverse().join('/') : '--'}</div></div>
        </div>
        <div class="modal-subtle-box" style="margin-top:16px;"><div class="modal-section-title">Diagnóstico</div><div style="margin-top:8px; color:var(--text-main); line-height:1.6;">${ordem.diagnostico || '--'}</div></div>
        <div class="modal-subtle-box" style="margin-top:16px;"><div class="modal-section-title">Serviço</div><div style="margin-top:8px; color:var(--text-main); line-height:1.6;">${ordem.servico || '--'}</div></div>
        <div class="modal-subtle-box" style="margin-top:16px;"><div class="modal-section-title">Peças sugeridas</div><div style="margin-top:8px; color:var(--text-main); line-height:1.6;">${(ordem.pecas_sugeridas || []).join(', ') || '--'}</div></div>
    `;
    modal.style.display = 'flex';
}

function mostrarSelecaoCliente() {
    const isBoleto = document.getElementById('cli-pgto').value === 'BOLETO';
    document.getElementById('selecao-cliente-boleto').style.display = isBoleto ? 'block' : 'none';
    if (isBoleto && typeof atualizarSelectClientes === 'function') {
        atualizarSelectClientes();
        sincronizarClienteFiadoSelecionado(true);
    }
}

function normalizarNomeClienteFiado(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function localizarClienteFiadoPorNome(nome) {
    const alvo = normalizarNomeClienteFiado(nome);
    if (!alvo) return null;
    return (cacheClientes || []).find(cliente => normalizarNomeClienteFiado(cliente.nome) === alvo) || null;
}

function sincronizarClienteFiadoSelecionado(porNome = false) {
    const select = document.getElementById('cli-boleto-select');
    const inputNome = document.getElementById('cli-nome');
    if (!select || !inputNome) return null;

    if (porNome && !select.value) {
        const clientePorNome = localizarClienteFiadoPorNome(inputNome.value);
        if (clientePorNome) {
            select.value = clientePorNome.id;
        }
    }

    const clienteSelecionado = (cacheClientes || []).find(cliente => cliente.id === select.value) || null;
    if (clienteSelecionado) {
        inputNome.value = clienteSelecionado.nome || inputNome.value;
    }
    return clienteSelecionado;
}

function obterClienteFiadoVinculado() {
    const pgto = document.getElementById('cli-pgto')?.value;
    if (pgto !== 'BOLETO') return null;

    const select = document.getElementById('cli-boleto-select');
    const inputNome = document.getElementById('cli-nome');
    if (!select || !inputNome) return null;

    let cliente = (cacheClientes || []).find(item => item.id === select.value) || null;
    if (!cliente) {
        cliente = localizarClienteFiadoPorNome(inputNome.value);
        if (cliente) {
            select.value = cliente.id;
        }
    }

    if (cliente?.nome) {
        inputNome.value = cliente.nome;
    }
    return cliente;
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
        origem: item.origem || 'BALCAO',
        exige_base_troca: !!item.exige_base_troca,
        status_base_troca: item.status_base_troca || 'NORMAL',
        intervalo_revisao_dias: parseInt(item.intervalo_revisao_dias) || 0,
        observacao_revisao: item.observacao_revisao || ''
    }));
}

async function criarOuEfetivarVenda(tipo = 'VENDA') {
    if (!carrinhoVenda.length) return null;

    const clienteFiadoSelecionado = obterClienteFiadoVinculado();
    const cliNome = clienteFiadoSelecionado?.nome || document.getElementById('cli-nome').value || 'Consumidor';
    const pgto = document.getElementById('cli-pgto').value;
    const cliId = clienteFiadoSelecionado?.id || document.getElementById('cli-boleto-select').value || '';
    const dadosOrcamento = obterDadosOrcamentoFormulario();
    const itens = montarPayloadItensCarrinho();
    const total = itens.reduce((acc, item) => acc + item.total, 0);
    const quantidadeTotal = itens.reduce((acc, item) => acc + item.qtd, 0);
    const resumo = resumoItensVenda(itens);
    const agendaRevisao = calcularAgendaRevisaoVenda(itens, dadosOrcamento);
    const proximaRevisao = agendaRevisao.slice().sort((a, b) => a.proxima_revisao_ts - b.proxima_revisao_ts)[0] || null;

    if (tipo === 'ORCAMENTO') {
        const orcamentoAtual = orcamentoEmEdicaoId ? (cacheVendas || []).find(item => item.id === orcamentoEmEdicaoId && item.tipo === 'ORCAMENTO') : null;
        if (orcamentoEmEdicaoId && !orcamentoAtual) throw new Error('Orçamento em edição não encontrado.');
        if (orcamentoAtual?.status === 'VENDIDO') throw new Error('Esse orçamento já foi convertido em venda.');

        const orcamento = {
            numero: orcamentoAtual?.numero || gerarNumeroOrcamento(),
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
            motor_km_atual: dadosOrcamento.motor_km_atual || 0,
            motor_horas_atual: dadosOrcamento.motor_horas_atual || 0,
            agenda_revisao: agendaRevisao,
            proxima_revisao: proximaRevisao?.proxima_revisao || '',
            proxima_revisao_ts: proximaRevisao?.proxima_revisao_ts || null,
            status: orcamentoAtual?.status || 'ABERTO',
            tipo: 'ORCAMENTO',
            data: orcamentoAtual?.data || new Date().toLocaleDateString('pt-BR'),
            hora: orcamentoAtual?.hora || new Date().toLocaleTimeString('pt-BR'),
            timestamp: orcamentoAtual?.timestamp || Date.now(),
            atualizado_em: Date.now(),
            origem: itens.length === 1 ? (itens[0].origem || 'BALCAO') : 'CARRINHO',
            operador: auth.currentUser.email
        };
        if (orcamentoEmEdicaoId) {
            await db.collection('vendas_kell').doc(orcamentoEmEdicaoId).update(orcamento);
            if (typeof registrarAuditoria === 'function') registrarAuditoria('VENDAS', orcamentoEmEdicaoId, 'ORCAMENTO_EDITADO', { numero: orcamento.numero, cliente: orcamento.cliente, valor: orcamento.venda });
        } else {
            await db.collection('vendas_kell').add(orcamento);
            if (typeof registrarAuditoria === 'function') registrarAuditoria('VENDAS', String(orcamento.numero || ''), 'ORCAMENTO_CRIADO', { cliente: orcamento.cliente, valor: orcamento.venda });
        }
        Toastify({ text: orcamentoEmEdicaoId ? 'Orçamento atualizado com sucesso!' : 'Orçamento criado com sucesso!', style: { background: 'var(--primary)' } }).showToast();
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
            motor_km_atual: dadosOrcamento.motor_km_atual || 0,
            motor_horas_atual: dadosOrcamento.motor_horas_atual || 0,
            agenda_revisao: agendaRevisao,
            proxima_revisao: proximaRevisao?.proxima_revisao || '',
            proxima_revisao_ts: proximaRevisao?.proxima_revisao_ts || null,
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
    if (typeof registrarMovimentacaoProduto === 'function') {
        for (const item of res.itens || []) {
            await registrarMovimentacaoProduto(item.produtoId || item.id, {
                tipo: 'SAIDA_VENDA',
                motivo: `Venda #${res.numero}`,
                impacto: `-${parseInt(item.qtd) || 0} unidade(s)`,
                data: new Date().toLocaleString('pt-BR'),
                usuario: auth.currentUser?.email || 'SISTEMA'
            });
        }
    }
    if (typeof registrarAuditoria === 'function') registrarAuditoria('VENDAS', String(res.numero || ''), 'VENDA_FINALIZADA', { cliente: res.cliente, valor: res.venda });
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
    const agendaRevisao = Array.isArray(orcamento.agenda_revisao) ? orcamento.agenda_revisao : calcularAgendaRevisaoVenda(itens, orcamento);
    const proximaRevisao = agendaRevisao.slice().sort((a, b) => a.proxima_revisao_ts - b.proxima_revisao_ts)[0] || null;

    try {
        await db.runTransaction(async t => {
            const seqRef = db.collection('config_kell').doc('sequencial');
            const sDoc = await t.get(seqRef);
            const num = (sDoc.exists ? sDoc.data().ultimoPedido : 0) + 1;

            const leiturasEstoque = [];
            let custo = 0;
            for (const item of itens.filter(item => item.produtoId)) {
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
                motor_km_atual: parseInt(orcamento.motor_km_atual) || 0,
                motor_horas_atual: parseInt(orcamento.motor_horas_atual) || 0,
                agenda_revisao: agendaRevisao,
                proxima_revisao: proximaRevisao?.proxima_revisao || '',
                proxima_revisao_ts: proximaRevisao?.proxima_revisao_ts || null,
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
        if (typeof registrarMovimentacaoProduto === 'function') {
        for (const item of itens.filter(item => item.produtoId)) {
            await registrarMovimentacaoProduto(item.produtoId || item.id, {
                    tipo: 'SAIDA_ORCAMENTO',
                    motivo: `Conversão orçamento ${orcamento.numero || ''}`,
                    impacto: `-${parseInt(item.qtd) || 0} unidade(s)`,
                    data: new Date().toLocaleString('pt-BR'),
                    usuario: auth.currentUser?.email || 'SISTEMA'
                });
            }
        }
        if (typeof registrarAuditoria === 'function') registrarAuditoria('VENDAS', id, 'ORCAMENTO_CONVERTIDO', { numero: orcamento.numero, cliente: orcamento.cliente });
        Toastify({ text: 'Orçamento convertido em venda!', style: { background: 'green' } }).showToast();
    } catch (e) {
        alert(e.message || e);
    }
}

function abrirPopupEdicaoOrcamento(id) {
    const orcamento = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORCAMENTO');
    if (!orcamento) return;
    if ((orcamento.status || 'ABERTO') === 'VENDIDO') return alert('Esse orçamento já foi convertido em venda.');
    orcamentoPopupEdicaoId = id;
    const itens = normalizarItensDocumento(orcamento);
    const resumo = document.getElementById('editar-orcamento-resumo');
    const selectOrigem = document.getElementById('cli-boleto-select');
    const selectDestino = document.getElementById('editar-orc-boleto-select');
    if (selectOrigem && selectDestino) selectDestino.innerHTML = selectOrigem.innerHTML;
    if (resumo) {
        resumo.innerHTML = `
            <div style="font-size:11px; color:var(--text-muted); font-weight:700; text-transform:none; margin-bottom:8px;">O que será editado</div>
            <div style="font-weight:700; color:var(--text-main); margin-bottom:6px;">${orcamento.numero || '---'} • ${orcamento.cliente || 'Consumidor'}</div>
            <div style="font-size:13px; color:var(--text-main); line-height:1.6;">${itens.map(item => `${item.qtd}x ${item.nome}`).join(' • ') || 'Sem itens'}</div>
        `;
    }
    document.getElementById('editar-orc-cliente').value = orcamento.cliente || '';
    document.getElementById('editar-orc-pgto').value = orcamento.pagamento || 'DINHEIRO';
    document.getElementById('editar-orc-boleto-select').value = orcamento.clienteId || '';
    document.getElementById('editar-orc-validade').value = orcamento.validade || '';
    document.getElementById('editar-orc-km').value = orcamento.motor_km_atual || '';
    document.getElementById('editar-orc-horas').value = orcamento.motor_horas_atual || '';
    document.getElementById('editar-orc-valor').value = `R$ ${(parseFloat(orcamento.venda) || 0).toFixed(2)}`;
    document.getElementById('editar-orc-observacao').value = orcamento.observacao || '';
    mostrarSelecaoClienteEdicaoOrcamento();
    document.getElementById('modal-editar-orcamento').style.display = 'flex';
}

function abrirOrcamentoParaEdicao(id) {
    orcamentoEmEdicaoId = id;
    const orcamento = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORCAMENTO');
    if (!orcamento) return;
    carrinhoVenda = normalizarItensDocumento(orcamento);
    renderizarCarrinhoVenda();
    document.getElementById('cli-nome').value = orcamento.cliente || '';
    document.getElementById('cli-pgto').value = orcamento.pagamento || 'DINHEIRO';
    document.getElementById('cli-boleto-select').value = orcamento.clienteId || '';
    const validade = document.getElementById('orc-validade');
    const observacao = document.getElementById('orc-observacao');
    const kmAtual = document.getElementById('motor-km-atual');
    const horasAtual = document.getElementById('motor-horas-atual');
    if (validade) validade.value = orcamento.validade || '';
    if (observacao) observacao.value = orcamento.observacao || '';
    if (kmAtual) kmAtual.value = orcamento.motor_km_atual || '';
    if (horasAtual) horasAtual.value = orcamento.motor_horas_atual || '';
    mostrarSelecaoCliente();
    atualizarEstadoModalCliente();
    document.getElementById('modal-cliente').style.display = 'flex';
}

function editarItensOrcamentoAtual() {
    if (!orcamentoPopupEdicaoId) return alert('Nenhum orçamento selecionado.');
    fecharModais();
    abrirOrcamentoParaEdicao(orcamentoPopupEdicaoId);
}

async function salvarEdicaoOrcamentoDireta() {
    if (!orcamentoPopupEdicaoId) return alert('Nenhum orçamento selecionado.');
    const orcamento = (cacheVendas || []).find(item => item.id === orcamentoPopupEdicaoId && item.tipo === 'ORCAMENTO');
    if (!orcamento) return alert('Orçamento não encontrado.');
    if ((orcamento.status || 'ABERTO') === 'VENDIDO') return alert('Esse orçamento já foi convertido em venda.');

    const pagamento = document.getElementById('editar-orc-pgto').value || 'DINHEIRO';
    const clienteFiado = pagamento === 'BOLETO' ? sincronizarClienteEdicaoOrcamento(true) : null;
    if (pagamento === 'BOLETO' && !clienteFiado) return alert('Selecione um cliente para o fiado.');

    const payload = {
        cliente: pagamento === 'BOLETO' ? (clienteFiado?.nome || document.getElementById('editar-orc-cliente').value || 'Consumidor') : (document.getElementById('editar-orc-cliente').value || 'Consumidor'),
        clienteId: pagamento === 'BOLETO' ? (clienteFiado?.id || document.getElementById('editar-orc-boleto-select').value || '') : '',
        pagamento,
        validade: document.getElementById('editar-orc-validade').value || '',
        motor_km_atual: parseInt(document.getElementById('editar-orc-km').value) || 0,
        motor_horas_atual: parseInt(document.getElementById('editar-orc-horas').value) || 0,
        observacao: String(document.getElementById('editar-orc-observacao').value || '').trim(),
        atualizado_em: Date.now(),
        operador: auth.currentUser?.email || orcamento.operador || 'SISTEMA'
    };

    const agendaRevisao = Array.isArray(orcamento.agenda_revisao) ? calcularAgendaRevisaoVenda(normalizarItensDocumento(orcamento), payload) : calcularAgendaRevisaoVenda(normalizarItensDocumento(orcamento), payload);
    const proximaRevisao = agendaRevisao.slice().sort((a, b) => a.proxima_revisao_ts - b.proxima_revisao_ts)[0] || null;
    payload.agenda_revisao = agendaRevisao;
    payload.proxima_revisao = proximaRevisao?.proxima_revisao || '';
    payload.proxima_revisao_ts = proximaRevisao?.proxima_revisao_ts || null;

    await db.collection('vendas_kell').doc(orcamentoPopupEdicaoId).update(payload);
    if (typeof registrarAuditoria === 'function') registrarAuditoria('VENDAS', orcamentoPopupEdicaoId, 'ORCAMENTO_EDITADO_DIRETO', { cliente: payload.cliente, pagamento: payload.pagamento });
    Toastify({ text: 'Orçamento atualizado com sucesso!', style: { background: 'var(--primary)' } }).showToast();
    fecharModais();
}

function duplicarOrcamento(id) {
    const orcamento = (cacheVendas || []).find(item => item.id === id && item.tipo === 'ORCAMENTO');
    if (!orcamento) return alert('Orçamento não encontrado.');

    orcamentoEmEdicaoId = null;
    carrinhoVenda = normalizarItensDocumento(orcamento);
    renderizarCarrinhoVenda();
    document.getElementById('cli-nome').value = orcamento.cliente || '';
    document.getElementById('cli-pgto').value = orcamento.pagamento || 'DINHEIRO';
    document.getElementById('cli-boleto-select').value = orcamento.clienteId || '';
    const validade = document.getElementById('orc-validade');
    const observacao = document.getElementById('orc-observacao');
    const kmAtual = document.getElementById('motor-km-atual');
    const horasAtual = document.getElementById('motor-horas-atual');
    if (validade) validade.value = orcamento.validade || '';
    if (observacao) observacao.value = orcamento.observacao || '';
    if (kmAtual) kmAtual.value = orcamento.motor_km_atual || '';
    if (horasAtual) horasAtual.value = orcamento.motor_horas_atual || '';
    mostrarSelecaoCliente();
    atualizarEstadoModalCliente();
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
            <td style="padding:6px; text-align:right; font-size:11px;">R$ ${parseFloat(item.unitario || 0).toFixed(2)}</td>
            <td style="padding:6px; text-align:right; font-size:11px; font-weight:700;">R$ ${parseFloat(item.total || 0).toFixed(2)}</td>
        </tr>
    `).join('');
    const status = orcamento.status || 'ABERTO';
    const statusBadge = status === 'VENDIDO'
        ? `<span style="color:#059669; font-weight:700; background:#d1fae5; padding:2px 6px; border-radius:4px; font-size:10px;">VENDIDO</span>`
        : `<span style="color:#dc2626; font-weight:700; background:#fee2e2; padding:2px 6px; border-radius:4px; font-size:10px;">ABERTO</span>`;

    document.getElementById('orcamento-visualizacao').innerHTML = `
        <div style="padding:20px; font-family:'Inter', 'Segoe UI', Arial, sans-serif; width:100%; box-sizing:border-box;">
            <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #0f172a; padding-bottom:15px;">
                <h2 style="margin:0; color:#0f172a; font-size:22px; text-transform:none; letter-spacing:0;">${configEmpresa.nome}</h2>
                <div style="font-size:11px; color:#64748b; margin-top:5px; line-height:1.4;">
                    ${configEmpresa.endereco ? configEmpresa.endereco + ' • ' : ''}
                    CNPJ: ${configEmpresa.cnpj || 'Não Informado'}<br>
                    Tel: ${configEmpresa.telefone || 'Não Informado'}
                </div>
                <div style="margin-top:10px; font-weight:700; font-size:12px; color:#0f172a; border:1px solid #0f172a; display:inline-block; padding:4px 12px; border-radius:20px; text-transform:none;">
                    Orçamento de Venda
                </div>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:20px;">
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <tr>
                        <td style="color:#64748b; font-weight:700; width:100px; padding-bottom:4px;">ORÇAMENTO:</td>
                        <td style="font-weight:700; color:#0f172a; font-size:13px; padding-bottom:4px;">${orcamento.numero || '---'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:700; padding-bottom:4px;">CLIENTE:</td>
                        <td style="color:#334155; padding-bottom:4px;">${orcamento.cliente || 'Consumidor'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:700; padding-bottom:4px;">EMISSÃO:</td>
                        <td style="color:#334155; padding-bottom:4px;">${orcamento.data || '--'} ${orcamento.hora || ''}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:700; padding-bottom:4px;">PAGAMENTO:</td>
                        <td style="color:#334155; padding-bottom:4px;">${orcamento.pagamento || 'Não informado'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:700;">VALIDADE:</td>
                        <td style="color:#334155;">${orcamento.validade ? orcamento.validade.split('-').reverse().join('/') : 'Não informada'}</td>
                    </tr>
                </table>
            </div>

            <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:20px;">
                <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:none;">Modelo da moto</small>
                    <div style="font-size:12px; font-weight:700; color:#334155; margin-top:3px;">${orcamento.modelo_moto || 'Não informado'}</div>
                </div>
                <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:none;">Ano da moto</small>
                    <div style="font-size:12px; font-weight:700; color:#334155; margin-top:3px;">${orcamento.ano_moto || 'Não informado'}</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:20px;">
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:none;">Total de itens</small>
                    <div style="font-size:12px; font-weight:700; color:#334155;">${itens.reduce((acc, item) => acc + (parseInt(item.qtd) || 0), 0)}</div>
                </div>
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:none;">Valor do orçamento</small>
                    <div style="font-size:12px; font-weight:700; color:#334155;">R$ ${parseFloat(orcamento.venda || 0).toFixed(2)}</div>
                </div>
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:none;">Status</small>
                    <div style="font-size:12px; font-weight:700; color:#334155;">${statusBadge}</div>
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
                        <strong style="color:#0f172a;">R$ ${parseFloat(orcamento.venda || 0).toFixed(2)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b;">
                        <span>Pagamento</span>
                        <strong style="color:#0f172a;">${orcamento.pagamento || 'Não informado'}</strong>
                    </div>
                </div>
            </div>

            ${orcamento.observacao ? `
                <div style="margin-top:20px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #cbd5e1;">
                    <div style="color:#64748b; font-weight:700; font-size:11px; margin-bottom:8px;">OBSERVAÇÃO:</div>
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
                        <span style="font-size:11px; font-weight:700; color:#0f172a; text-transform:none;">${orcamento.cliente || 'Consumidor'}</span><br>
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
        html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            onclone: (documento) => {
                documento.body.classList.remove('dark-mode', 'privacy-on');
                documento.documentElement.style.background = '#ffffff';
                documento.body.style.background = '#ffffff';
                documento.body.style.color = '#0f172a';
                const visualizacao = documento.getElementById('orcamento-visualizacao');
                const estiloExportacao = documento.createElement('style');
                estiloExportacao.textContent = `
                    #orcamento-visualizacao, #orcamento-visualizacao * { filter:none !important; opacity:1 !important; }
                    #orcamento-visualizacao td { color:#334155 !important; background:#ffffff !important; }
                    #orcamento-visualizacao th { color:#ffffff !important; background:#0f172a !important; }
                    #orcamento-visualizacao strong { color:#0f172a !important; }
                `;
                documento.head.appendChild(estiloExportacao);
                if (visualizacao) {
                    visualizacao.style.background = '#ffffff';
                    visualizacao.style.color = '#0f172a';
                    visualizacao.querySelectorAll('*').forEach(elemento => {
                        elemento.style.filter = 'none';
                    });
                }
            }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(el).set(opt).save();
}

function imprimirOrcamentoAtual() {
    const visualizacao = document.getElementById('orcamento-visualizacao');
    if (!visualizacao) return;
    const janela = window.open('', '_blank', 'width=900,height=700');
    if (!janela) return alert('Permita a abertura da janela de impressão para continuar.');
    janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Orçamento KELL MOTOS</title><style>
        * { box-sizing:border-box; filter:none !important; opacity:1 !important; }
        body { margin:0; padding:18px; background:#fff !important; color:#334155 !important; font-family:Arial,sans-serif; }
        #orcamento-visualizacao { background:#fff !important; color:#334155 !important; }
        #orcamento-visualizacao td { color:#334155 !important; background:#fff !important; }
        #orcamento-visualizacao th { color:#fff !important; background:#0f172a !important; }
        #orcamento-visualizacao strong { color:#0f172a !important; }
        @page { margin:10mm; }
    </style></head><body><div id="orcamento-visualizacao">${visualizacao.innerHTML}</div><script>window.onload=()=>window.print();<\/script></body></html>`);
    janela.document.close();
}

function abrirGeradorAnuncio(id) {
    if (!podeExecutarAcao('publicar_anuncio')) return alert('Você não tem permissão para gerar anúncios.');
    const produto = (cacheEstoque || []).find(item => item.id === id);
    if (!produto) return alert('Produto não encontrado.');

    anuncioProdutoPendente = {
        id,
        produto,
        draft: montarRascunhoAnuncio(produto)
    };

    renderizarModalAnuncioProduto();
    document.getElementById('modal-anuncio-produto').style.display = 'flex';
}

function renderizarModalAnuncioProduto() {
    const container = document.getElementById('anuncio-produto-conteudo');
    if (!container || !anuncioProdutoPendente) return;

    const { produto, draft } = anuncioProdutoPendente;
    const nome = obterNomeProdutoVenda(produto);
    const imagens = draft.imagens || [];

    container.innerHTML = `
        <div style="display:grid; grid-template-columns:minmax(280px, 0.9fr) minmax(0, 1.1fr); gap:20px; align-items:start;">
            <div>
                <div style="padding:18px; border:1px solid var(--border-color); border-radius:18px; background:var(--bg-body);">
                    <div style="font-size:11px; color:var(--text-muted); font-weight:700; text-transform:none; margin-bottom:8px;">Produto base</div>
                    <h3 style="margin:0 0 6px 0; color:var(--text-main);">${nome}</h3>
                    <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Código: ${produto.codigo || 'Sem código'} • Estoque: ${parseInt(produto.qtd) || 0}</div>
                    <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
                        <div style="padding:12px; border-radius:14px; background:var(--bg-card); border:1px solid var(--border-color);">
                            <div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:none;">Preço balcão</div>
                            <div style="font-size:18px; font-weight:700; color:var(--text-main); margin-top:6px;">R$ ${(parseFloat(produto.repasse) || 0).toFixed(2)}</div>
                        </div>
                        <div style="padding:12px; border-radius:14px; background:var(--bg-card); border:1px solid var(--border-color);">
                            <div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:none;">Preço online</div>
                            <div style="font-size:18px; font-weight:700; color:var(--text-main); margin-top:6px;">R$ ${(parseFloat(produto.eco_venda) || 0).toFixed(2)}</div>
                        </div>
                    </div>
                    <div style="margin-top:16px; font-size:11px; color:var(--text-muted); line-height:1.6;">
                        <b style="color:var(--text-main);">Compatibilidade:</b><br>
                        ${(produto.compatibilidade || []).join(', ') || 'Sem compatibilidade informada.'}
                    </div>
                </div>

                <div style="margin-top:16px; padding:18px; border:1px solid var(--border-color); border-radius:18px; background:var(--bg-body);">
                    <div style="font-size:11px; color:var(--text-muted); font-weight:700; text-transform:none; margin-bottom:8px;">Fotos do anúncio</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(88px, 1fr)); gap:10px;">
                        ${imagens.length ? imagens.map(img => `<div style="height:88px; border-radius:14px; overflow:hidden; background:#fff; border:1px solid var(--border-color);"><img src="${img}" alt="Imagem do anúncio" style="width:100%; height:100%; object-fit:cover;"></div>`).join('') : `<div style="grid-column:1/-1; padding:18px; text-align:center; color:var(--text-muted); border:1px dashed var(--border-color); border-radius:14px;">Sem imagens no produto.</div>`}
                    </div>
                </div>
            </div>

            <div>
                <div style="padding:18px; border:1px solid var(--border-color); border-radius:18px; background:var(--bg-body);">
                    <div style="font-size:11px; color:var(--text-muted); font-weight:700; text-transform:none; margin-bottom:8px;">Rascunho do anúncio</div>
                    <label class="input-label">Título</label>
                    <input id="anuncio-titulo" class="input-style" value="${String(draft.titulo || '').replace(/"/g, '&quot;')}" placeholder="Título do anúncio">
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                        <div>
                            <label class="input-label">Categoria</label>
                            <input id="anuncio-categoria" class="input-style" value="${String(draft.categoria || '').replace(/"/g, '&quot;')}" placeholder="Ex: Pastilhas de freio">
                        </div>
                        <div>
                            <label class="input-label">Preço</label>
                            <input id="anuncio-preco" type="number" class="input-style" value="${parseFloat(draft.preco || 0)}" placeholder="0,00">
                        </div>
                        <div>
                            <label class="input-label">Estoque</label>
                            <input id="anuncio-estoque" type="number" class="input-style" value="${parseInt(draft.estoque || 0)}" placeholder="0">
                        </div>
                    </div>
                    <label class="input-label">Condição</label>
                    <select id="anuncio-condicao" class="input-style">
                        <option value="Novo" ${draft.condicao === 'Novo' ? 'selected' : ''}>Novo</option>
                        <option value="Usado" ${draft.condicao === 'Usado' ? 'selected' : ''}>Usado</option>
                    </select>
                    <label class="input-label">Descrição</label>
                    <textarea id="anuncio-descricao" class="input-style" style="min-height:260px; resize:vertical;">${draft.descricao || ''}</textarea>
                    <label class="input-label">Observações internas</label>
                    <textarea id="anuncio-observacoes" class="input-style" style="min-height:90px; resize:vertical;" placeholder="Anote ajustes antes de publicar.">${draft.observacoes || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

function obterDraftAnuncioAtual() {
    if (!anuncioProdutoPendente) return null;
    return {
        ...anuncioProdutoPendente.draft,
        titulo: document.getElementById('anuncio-titulo')?.value?.trim() || '',
        categoria: document.getElementById('anuncio-categoria')?.value?.trim() || '',
        preco: parseFloat(document.getElementById('anuncio-preco')?.value) || 0,
        estoque: parseInt(document.getElementById('anuncio-estoque')?.value) || 0,
        condicao: document.getElementById('anuncio-condicao')?.value || 'Novo',
        descricao: document.getElementById('anuncio-descricao')?.value?.trim() || '',
        observacoes: document.getElementById('anuncio-observacoes')?.value?.trim() || ''
    };
}

async function copiarResumoAnuncio() {
    const draft = obterDraftAnuncioAtual();
    if (!draft) return;
    const texto = gerarResumoTextoAnuncio(draft);
    try {
        await navigator.clipboard.writeText(texto);
        Toastify({ text: 'Resumo do anúncio copiado!', style: { background: 'var(--primary)' } }).showToast();
    } catch (e) {
        alert('Não foi possível copiar automaticamente. ' + e.message);
    }
}

async function salvarRascunhoAnuncio() {
    if (!podeExecutarAcao('publicar_anuncio')) return alert('Você não tem permissão para salvar rascunhos de anúncio.');
    if (!anuncioProdutoPendente) return;
    const draft = obterDraftAnuncioAtual();
    anuncioProdutoPendente.draft = draft;
    try {
        await db.collection('estoque_kell').doc(anuncioProdutoPendente.id).update({
            anuncio_ml_rascunho: draft,
            anuncio_ml_atualizado_em: Date.now()
        });
        Toastify({ text: 'Rascunho do anúncio salvo!', style: { background: 'var(--primary)' } }).showToast();
    } catch (e) {
        alert(e.message || e);
    }
}

async function excluirOrcamento(id) {
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
