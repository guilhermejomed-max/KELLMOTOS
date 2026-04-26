let imagemBase64Temp = "";

function normalizarListaImagens(lista) {
    return (Array.isArray(lista) ? lista : [])
        .map(img => String(img || '').trim())
        .filter(Boolean)
        .filter((img, index, arr) => arr.indexOf(img) === index);
}

function normalizarImagensProduto(produto) {
    if (!produto) return [];

    const imagens = [];
    if (Array.isArray(produto.imagens)) imagens.push(...produto.imagens);
    if (produto.imagem) imagens.push(produto.imagem);

    return normalizarListaImagens(imagens);
}

function obterProdutoEstoque(id) {
    return (typeof cacheEstoque !== 'undefined' && Array.isArray(cacheEstoque))
        ? cacheEstoque.find(item => item.id === id)
        : null;
}

function obterNomeProdutoEstoque(produto) {
    if (!produto) return 'Produto';
    const partes = [produto.marca, produto.nome_peca]
        .map(valor => String(valor || '').trim())
        .filter(Boolean);
    return partes.join(' ') || produto.modelo || 'Produto';
}

function obterLocalCadastradoPorId(id) {
    return Array.isArray(cacheLocais) ? cacheLocais.find(local => local.id === id) : null;
}

function obterLocalizacaoProduto(produto) {
    const localCadastrado = obterLocalCadastradoPorId(produto?.localizacao?.localId);
    if (localCadastrado) return localCadastrado;
    const localizacao = produto?.localizacao || {};
    return {
        id: localizacao.localId || '',
        rua: localizacao.rua || localizacao.corredor || '',
        local: localizacao.local || localizacao.posicao || localizacao.caixa || '',
        posicao: localizacao.local || localizacao.posicao || localizacao.caixa || ''
    };
}

function textoLocalizacaoProduto(produto) {
    const local = obterLocalizacaoProduto(produto);
    if (typeof obterTextoLocal === 'function') return obterTextoLocal(local);
    return [local.rua, local.local || local.posicao].filter(Boolean).join(' • ') || 'Sem local';
}

function atualizarSelectLocaisProduto() {
    const selects = [
        document.getElementById('loc-cadastrado'),
        document.getElementById('filtro-local-inventario')
    ].filter(Boolean);
    const locais = Array.isArray(cacheLocais) ? [...cacheLocais] : [];
    locais.sort((a, b) => textoLocalizacaoProduto({ localizacao: { localId: a.id } }).localeCompare(textoLocalizacaoProduto({ localizacao: { localId: b.id } }), 'pt-BR'));

    selects.forEach(select => {
        const valorAtual = select.value;
        const primeiraOpcao = select.id === 'filtro-local-inventario' ? 'Todos os locais' : 'Selecionar local cadastrado';
        select.innerHTML = `<option value="">${primeiraOpcao}</option>` + locais.map(local => `<option value="${local.id}">${obterTextoLocal(local)}</option>`).join('');
        select.value = valorAtual;
    });
}

function aplicarLocalSelecionadoProduto() {
    const select = document.getElementById('loc-cadastrado');
    const local = obterLocalCadastradoPorId(select?.value || '');
    if (!local) return;
    const rua = document.getElementById('loc-corredor');
    const localCampo = document.getElementById('loc-caixa');
    if (rua) rua.value = local.rua || '';
    if (localCampo) localCampo.value = local.local || local.posicao || '';
}

function abrirVendaProdutoEstoque(id) {
    const produto = obterProdutoEstoque(id);
    if (produto && typeof abrirVenda === 'function') abrirVenda(id, produto);
}

function carregarProdutoParaEdicaoPorId(id) {
    const produto = obterProdutoEstoque(id);
    if (produto) carregarParaEdicao(produto);
}



function abrirModalProdutoDetalhesPorId(id) {
    const produto = obterProdutoEstoque(id);
    if (produto) abrirModalProdutoDetalhes(produto);
}

function imprimirEtiquetaProdutoPorId(id) {
    const produto = obterProdutoEstoque(id);
    if (produto) imprimirEtiquetaProduto(produto);
}

function gerarSvgCodigoBarras(codigo) {
    if (typeof JsBarcode !== 'function') {
        throw new Error('Biblioteca de código de barras não carregada.');
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, String(codigo), {
        format: 'CODE128',
        displayValue: true,
        fontSize: 18,
        height: 54,
        margin: 0,
        width: 1.6,
        textMargin: 4
    });
    return svg.outerHTML;
}

function imprimirEtiquetaProduto(produto) {
    const codigo = String(produto?.codigo || '').trim();
    if (!codigo) {
        alert('Esse produto precisa ter um código para gerar a etiqueta.');
        return;
    }

    let barcodeSvg = '';
    try {
        barcodeSvg = gerarSvgCodigoBarras(codigo);
    } catch (e) {
        console.error(e);
        alert('Não foi possível gerar o código de barras.');
        return;
    }

    const nome = obterNomeProdutoEstoque(produto);
    const preco = `R$ ${(parseFloat(produto?.repasse) || 0).toFixed(2)}`;
    const janela = window.open('', '_blank', 'width=420,height=320');
    if (!janela) {
        alert('Não foi possível abrir a janela de impressão.');
        return;
    }

    janela.document.write(`<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8"><title>Etiqueta ${codigo}</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}.etiqueta{width:60mm;min-height:35mm;border:1px solid #111;border-radius:6px;padding:3.5mm;display:flex;flex-direction:column;justify-content:space-between;gap:2.5mm}.nome{font-size:11px;font-weight:700;line-height:1.2;text-align:center}.codigo{font-size:11px;font-weight:700;text-align:center;letter-spacing:1px}.preco{font-size:14px;font-weight:800;text-align:center}.barra{display:flex;justify-content:center;align-items:center;overflow:hidden}.barra svg{width:100%;height:auto}</style></head><body><div class="etiqueta"><div class="nome">${nome}</div><div class="barra">${barcodeSvg}</div><div class="codigo">${codigo}</div><div class="preco">${preco}</div></div><script>window.onload=function(){setTimeout(function(){window.print();},150);};<\/script></body></html>`);
    janela.document.close();
}


let imagensProdutoTemp = [];
let produtoModalAtual = null;
let indiceImagemProdutoModal = 0;
// =========================
// RENDERIZAÃ‡ÃƒO DO ESTOQUE
// =========================
function renderizarEstoque() {
    const buscaEl = document.getElementById('busca');
    const corpo = document.getElementById('corpo-estoque');
    if (!corpo) return;

    const q = buscaEl ? buscaEl.value.toLowerCase().trim() : '';
    let html = '';

    const lista = (typeof cacheEstoque !== 'undefined' && Array.isArray(cacheEstoque))
        ? [...cacheEstoque]
        : [];

    const filtered = lista.filter(p =>
        [p.modelo, p.marca, p.nome_peca, p.codigo, textoLocalizacaoProduto(p), ...(p.compatibilidade || [])]
            .join(' ')
            .toLowerCase()
            .includes(q)
    );

    filtered.sort((a, b) => ((b.compra || 0) * (b.qtd || 0)) - ((a.compra || 0) * (a.qtd || 0)));

    if (filtered.length === 0) {
        html = `
            <tr>
                <td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted)">
                    Nenhum produto encontrado.
                </td>
            </tr>
        `;
    } else {
        filtered.forEach(p => {
            const qtdAtual = parseInt(p.qtd) || 0;
            const precoVenda = parseFloat(p.repasse) || 0;
            const imagensProduto = normalizarImagensProduto(p);
            const imagemPrincipal = imagensProduto[0] || '';
            const nomeProduto = obterNomeProdutoEstoque(p);

            const badge = qtdAtual <= 2
                ? `<span class="status-badge bg-red"><i class="ri-alarm-warning-line"></i>BAIXO (${qtdAtual})</span>`
                : `<span class="status-badge bg-green"><i class="ri-checkbox-circle-line"></i>${qtdAtual} UN</span>`;

            const imagem = imagemPrincipal
                ? `<img src="${imagemPrincipal}" alt="${nomeProduto}" style="width:56px;height:56px;object-fit:cover;border-radius:14px;border:1px solid var(--border-color);background:#fff;box-shadow:var(--shadow-sm);flex-shrink:0;">`
                : `<div style="width:56px;height:56px;border-radius:14px;border:1px dashed var(--border-color);display:flex;align-items:center;justify-content:center;color:var(--text-muted);background:var(--bg-body);flex-shrink:0;"><i class="ri-image-line" style="font-size:20px;"></i></div>`;

            const compatibilidadeLista = Array.isArray(p.compatibilidade) ? p.compatibilidade : [];
            const compatibilidadeTexto = compatibilidadeLista.length ? compatibilidadeLista.slice(0, 3).join(', ') : 'Sem compatibilidade informada';
            const compatibilidadeExtra = compatibilidadeLista.length > 3 ? ` +${compatibilidadeLista.length - 3}` : '';

            html += `
                <tr>
                    <td onclick="abrirModalProdutoDetalhesPorId('${p.id}')" style="cursor:pointer;">
                        <div style="display:flex; align-items:center; gap:12px; min-width:240px;">
                            ${imagem}
                            <div style="min-width:0;">
                                <div style="font-weight:800;color:var(--text-main);font-size:13px;line-height:1.2;margin-bottom:4px;">${nomeProduto}</div>
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Marca: ${p.marca || 'Não informada'}</div>
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;"><i class="ri-map-pin-2-line"></i> ${textoLocalizacaoProduto(p)}</div>
                                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                                    <span style="font-size:10px;font-weight:800;color:var(--primary);background:rgba(16,185,129,0.10);border:1px solid rgba(16,185,129,0.15);padding:4px 8px;border-radius:999px;letter-spacing:0.2px;">${p.codigo || 'S/C'}</span>
                                    ${imagensProduto.length > 0 ? `<span style="font-size:10px;font-weight:800;color:#1d4ed8;background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.15);padding:4px 8px;border-radius:999px;letter-spacing:0.2px;">${imagensProduto.length} foto(s)</span>` : ''}
                                    ${qtdAtual <= 2 ? `<span style="font-size:10px;font-weight:800;color:#b91c1c;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.18);padding:4px 8px;border-radius:999px;letter-spacing:0.2px;">Reposição</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td><div style="font-size:12px;color:var(--text-main);line-height:1.4;max-width:250px;">${compatibilidadeTexto}<span style="color:var(--text-muted); font-weight:700;">${compatibilidadeExtra}</span></div></td>
                    <td>${badge}</td>
                    <td style="font-weight:800; white-space:nowrap;">R$ ${precoVenda.toFixed(2)}</td>
                    <td style="text-align:right;">
                        <div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap;">
                            <button class="btn btn-primary btn-sm" style="min-width:42px;height:38px;padding:0 12px;border-radius:10px;box-shadow:0 4px 12px rgba(16,185,129,0.20);" title="Vender produto" onclick="abrirVendaProdutoEstoque('${p.id}')"><i class="ri-shopping-cart-line"></i></button>
                            <button class="btn btn-secondary btn-sm" style="min-width:42px;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-card);color:var(--text-main);font-weight:700;" title="Imprimir etiqueta" onclick="imprimirEtiquetaProdutoPorId('${p.id}')"><i class="ri-barcode-line"></i></button>
                            ${userNivel !== 'JUNIOR' ? `<button class="btn btn-secondary btn-sm" style="min-width:42px;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-card);color:var(--text-main);font-weight:700;" title="Editar produto" onclick="carregarProdutoParaEdicaoPorId('${p.id}')"><i class="ri-pencil-line"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    corpo.innerHTML = html;

    const faltas = lista
        .filter(i => (parseInt(i.qtd) || 0) <= 2)
        .map(i => `• ${obterNomeProdutoEstoque(i)} (Atual: ${parseInt(i.qtd) || 0})`)
        .join('\n');

    const reposicao = document.getElementById('lista-reposicao-txt');
    if (reposicao) {
        reposicao.innerText = faltas || 'Estoque OK.';
    }

    if (document.getElementById('painel-inventario') && !document.getElementById('painel-inventario').classList.contains('hidden')) {
        renderizarInventario();
    }
}

function obterInventarioSalvo() {
    try {
        return JSON.parse(localStorage.getItem('inventario_kell') || '{}');
    } catch (e) {
        return {};
    }
}

function salvarInventarioLocal(dados) {
    localStorage.setItem('inventario_kell', JSON.stringify(dados || {}));
}

function toggleInventario() {
    const painel = document.getElementById('painel-inventario');
    if (!painel) return;
    painel.classList.toggle('hidden');
    if (!painel.classList.contains('hidden')) {
        atualizarSelectLocaisProduto();
        renderizarInventario();
        painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function atualizarContagemInventario(id, valor) {
    const dados = obterInventarioSalvo();
    if (valor === '') {
        delete dados[id];
    } else {
        dados[id] = parseInt(valor) || 0;
    }
    salvarInventarioLocal(dados);
    renderizarInventarioResumo();
    const diffEl = document.getElementById(`inv-diff-${id}`);
    const produto = obterProdutoEstoque(id);
    if (diffEl && produto) {
        const diff = (dados[id] ?? 0) - (parseInt(produto.qtd) || 0);
        diffEl.innerText = diff > 0 ? `+${diff}` : String(diff);
        diffEl.className = diff === 0 ? 'inventory-diff ok' : 'inventory-diff alert';
    }
}

function renderizarInventarioResumo() {
    const dados = obterInventarioSalvo();
    const lista = Array.isArray(cacheEstoque) ? cacheEstoque : [];
    const idsContados = Object.keys(dados).filter(id => lista.some(p => p.id === id));
    const diferenca = idsContados.reduce((acc, id) => {
        const produto = lista.find(p => p.id === id);
        return acc + ((parseInt(dados[id]) || 0) - (parseInt(produto?.qtd) || 0));
    }, 0);

    if (document.getElementById('inv-total-itens')) document.getElementById('inv-total-itens').innerText = lista.length;
    if (document.getElementById('inv-total-contados')) document.getElementById('inv-total-contados').innerText = idsContados.length;
    if (document.getElementById('inv-diferenca-total')) document.getElementById('inv-diferenca-total').innerText = diferenca > 0 ? `+${diferenca}` : String(diferenca);
}

function renderizarInventario() {
    const corpo = document.getElementById('corpo-inventario');
    if (!corpo) return;
    const busca = (document.getElementById('busca-inventario')?.value || '').toLowerCase().trim();
    const filtroLocal = document.getElementById('filtro-local-inventario')?.value || '';
    const dados = obterInventarioSalvo();
    const lista = (Array.isArray(cacheEstoque) ? [...cacheEstoque] : []).filter(p => {
        const texto = [obterNomeProdutoEstoque(p), p.codigo, textoLocalizacaoProduto(p)].join(' ').toLowerCase();
        const bateBusca = texto.includes(busca);
        const bateLocal = !filtroLocal || p.localizacao?.localId === filtroLocal;
        return bateBusca && bateLocal;
    });

    lista.sort((a, b) => textoLocalizacaoProduto(a).localeCompare(textoLocalizacaoProduto(b), 'pt-BR') || obterNomeProdutoEstoque(a).localeCompare(obterNomeProdutoEstoque(b), 'pt-BR'));

    corpo.innerHTML = lista.length ? lista.map(p => {
        const sistema = parseInt(p.qtd) || 0;
        const contado = Object.prototype.hasOwnProperty.call(dados, p.id) ? dados[p.id] : '';
        const diff = contado === '' ? '' : ((parseInt(contado) || 0) - sistema);
        return `
            <tr>
                <td><strong>${obterNomeProdutoEstoque(p)}</strong><br><small style="color:var(--text-muted);">${p.codigo || 'Sem código'}</small></td>
                <td>${textoLocalizacaoProduto(p)}</td>
                <td><span class="stock-pill ok">${sistema}</span></td>
                <td><input type="number" class="input-style inventory-count-input" value="${contado}" placeholder="0" oninput="atualizarContagemInventario('${p.id}', this.value)"></td>
                <td><span id="inv-diff-${p.id}" class="${diff === '' || diff === 0 ? 'inventory-diff ok' : 'inventory-diff alert'}">${diff === '' ? '--' : (diff > 0 ? `+${diff}` : diff)}</span></td>
                <td><button class="btn btn-sm btn-secondary" onclick="limparContagemItemInventario('${p.id}')">Limpar</button></td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">Nenhum item encontrado para a contagem.</td></tr>';

    renderizarInventarioResumo();
}

function limparContagemItemInventario(id) {
    const dados = obterInventarioSalvo();
    delete dados[id];
    salvarInventarioLocal(dados);
    renderizarInventario();
}

async function aplicarInventarioContado() {
    const dados = obterInventarioSalvo();
    const ids = Object.keys(dados).filter(id => obterProdutoEstoque(id));
    if (!ids.length) return alert('Nenhum item contado para aplicar.');

    const confirmado = confirm(`Aplicar a contagem em ${ids.length} item(ns)? Isso vai substituir a quantidade atual no estoque.`);
    if (!confirmado) return;

    const operador = auth.currentUser ? auth.currentUser.email : 'SISTEMA';
    const momento = Date.now();
    for (let i = 0; i < ids.length; i += 450) {
        const batch = db.batch();
        ids.slice(i, i + 450).forEach(id => {
            batch.update(db.collection('estoque_kell').doc(id), {
                qtd: parseInt(dados[id]) || 0,
                inventario_em: momento,
                inventario_operador: operador
            });
        });
        await batch.commit();
    }
    salvarInventarioLocal({});
    renderizarInventario();
    Toastify({ text: 'Inventário aplicado ao estoque!', style: { background: 'var(--primary)' } }).showToast();
}

function exportarInventarioCSV() {
    const dados = obterInventarioSalvo();
    const linhas = ['Produto;Codigo;Local;Sistema;Contado;Diferenca'];
    (cacheEstoque || []).forEach(p => {
        const sistema = parseInt(p.qtd) || 0;
        const contado = Object.prototype.hasOwnProperty.call(dados, p.id) ? parseInt(dados[p.id]) || 0 : '';
        const diff = contado === '' ? '' : contado - sistema;
        linhas.push([obterNomeProdutoEstoque(p), p.codigo || '', textoLocalizacaoProduto(p), sistema, contado, diff].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    });

    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario-kell-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
// =========================
// FORMULÃRIO
// =========================
function toggleFormCadastro() {
    const form = document.getElementById('form-cadastro');
    if (!form) return;

    form.classList.toggle('hidden');

    const titulo = document.getElementById('form-cadastro-titulo');
    const btn = document.getElementById('btn-salvar-produto');

    if (!form.classList.contains('hidden')) {
        const editId = document.getElementById('edit-id');
        if (!editId || !editId.value) {
            limparFormEstoque();
            if (titulo) titulo.innerText = 'Novo produto';
            if (btn) btn.innerHTML = '<i class="ri-save-3-line"></i> Salvar produto';
            atualizarModoProduto('Novo cadastro');
        }
    }
}

function limparFormEstoque() {
    const ids = [
        'edit-id',
        'marca',
        'nome-peca',
        'modelo',
        'codigo',
        'qtd',
        'compra',
        'taxa_envio',
        'repasse',
        'imagem',
        'imagem-url',
        'loc-cadastrado',
        'loc-corredor',
        'loc-caixa',
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const preview = document.getElementById('preview-imagem-produto');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }

    const fileInputA = document.getElementById('imagem-file');
    const fileInputB = document.getElementById('imagem-produto');
    if (fileInputA) fileInputA.value = '';
    if (fileInputB) fileInputB.value = '';

    const placeholder = document.getElementById('imagem-placeholder');
    if (placeholder) placeholder.style.display = 'flex';

    document.querySelectorAll('.moto-check').forEach(c => c.checked = false);

    imagemBase64Temp = '';
    imagensProdutoTemp = [];
    renderizarPreviewImagensProduto();

    const titulo = document.getElementById('form-cadastro-titulo');
    const btn = document.getElementById('btn-salvar-produto');

    if (titulo) titulo.innerText = 'Novo produto';
    if (btn) btn.innerHTML = '<i class="ri-save-3-line"></i> Salvar produto';

    atualizarModeloProduto();
    atualizarSugestaoPreco(0);
    atualizarModoProduto('Novo cadastro');
}

function calcularSugerido() {
    const compra = parseFloat(document.getElementById('compra')?.value) || 0;
    const margem = (typeof configEmpresa !== 'undefined' && configEmpresa.margem) ? configEmpresa.margem : 40;
    const sugerido = compra * (1 + margem / 100);

    const repasse = document.getElementById('repasse');
    if (repasse && !repasse.value) {
        repasse.placeholder = "Sug: R$ " + sugerido.toFixed(2);
    }

    atualizarSugestaoPreco(sugerido);
}

function atualizarSugestaoPreco(valor) {
    const label = document.getElementById('sugestao-preco-label');
    if (label) {
        label.innerText = `R$ ${(parseFloat(valor) || 0).toFixed(2)}`;
    }
}

function atualizarModoProduto(texto) {
    const label = document.getElementById('produto-modo-label');
    if (label) {
        label.innerText = texto;
    }
}

function atualizarModeloProduto() {
    const marca = document.getElementById('marca')?.value?.trim() || '';
    const nomePeca = document.getElementById('nome-peca')?.value?.trim() || '';
    const modelo = [marca, nomePeca].filter(Boolean).join(' ').trim();
    const campoModelo = document.getElementById('modelo');
    if (campoModelo) campoModelo.value = modelo;
    return modelo;
}

// =========================
// PREVIEW DE IMAGENS
// =========================
function atualizarPreviewImagem(src) {
    const preview = document.getElementById('preview-imagem-produto');
    const placeholder = document.getElementById('imagem-placeholder');

    if (!preview) return;

    if (src) {
        preview.src = src;
        preview.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        preview.src = '';
        preview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }
}

function renderizarPreviewImagensProduto() {
    const lista = document.getElementById('preview-imagens-produto-lista');
    const contador = document.getElementById('contador-imagens-produto');
    const imagens = normalizarListaImagens(imagensProdutoTemp);
    imagensProdutoTemp = imagens;

    atualizarPreviewImagem(imagens[0] || '');

    if (contador) {
        contador.innerText = imagens.length
            ? `${imagens.length} imagem(ns) selecionada(s)`
            : 'Nenhuma imagem selecionada';
    }

    if (!lista) return;

    if (!imagens.length) {
        lista.innerHTML = '';
        lista.style.display = 'none';
        return;
    }

    lista.style.display = 'grid';
    lista.innerHTML = imagens.map((imagem, index) => `
        <div style="position:relative; border-radius:14px; overflow:hidden; border:1px solid var(--border-color); background:#fff; min-height:92px;">
            <img src="${imagem}" alt="Imagem ${index + 1}" style="width:100%; height:92px; object-fit:cover; display:block;">
            <button type="button" onclick="removerImagemProduto(${index})" style="position:absolute; top:6px; right:6px; width:24px; height:24px; border:none; border-radius:999px; background:rgba(15,23,42,0.8); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                <i class="ri-close-line"></i>
            </button>
        </div>
    `).join('');
}

function lerArquivoComoBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function previewImagemProduto(event) {
    const files = [...(event?.target?.files || [])];
    if (!files.length) return;

    try {
        const imagensNovas = await Promise.all(files.map(lerArquivoComoBase64));
        imagensProdutoTemp = normalizarListaImagens([...imagensProdutoTemp, ...imagensNovas]);
        imagemBase64Temp = imagensProdutoTemp[0] || '';

        const imagemCampo = document.getElementById('imagem');
        if (imagemCampo) imagemCampo.value = imagemBase64Temp;

        const urlInput = document.getElementById('imagem-url');
        if (urlInput) urlInput.value = '';

        renderizarPreviewImagensProduto();
    } catch (e) {
        console.error(e);
        alert('Não foi possível carregar as imagens selecionadas.');
    }
}

function removerImagemProduto(index) {
    imagensProdutoTemp.splice(index, 1);
    imagensProdutoTemp = normalizarListaImagens(imagensProdutoTemp);
    imagemBase64Temp = imagensProdutoTemp[0] || '';

    const imagemCampo = document.getElementById('imagem');
    if (imagemCampo) imagemCampo.value = imagemBase64Temp;

    renderizarPreviewImagensProduto();
}

function adicionarImagemPorURL() {
    const urlInput = document.getElementById('imagem-url');
    const valor = (urlInput?.value || '').trim();
    if (!valor) return;

    imagensProdutoTemp = normalizarListaImagens([...imagensProdutoTemp, valor]);
    imagemBase64Temp = imagensProdutoTemp[0] || '';

    const imagemCampo = document.getElementById('imagem');
    if (imagemCampo) imagemCampo.value = imagemBase64Temp;

    if (urlInput) urlInput.value = '';
    renderizarPreviewImagensProduto();
}

function configurarUploadImagemProduto() {
    const fileInputPadrao = document.getElementById('imagem-file');
    const fileInputNovo = document.getElementById('imagem-produto');
    const urlInput = document.getElementById('imagem-url');

    const bindFileInput = (input) => {
        if (input && !input.dataset.binded) {
            input.addEventListener('change', function (e) {
                previewImagemProduto(e);
            });
            input.dataset.binded = 'true';
        }
    };

    bindFileInput(fileInputPadrao);
    bindFileInput(fileInputNovo);

    if (urlInput && !urlInput.dataset.binded) {
        urlInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                adicionarImagemPorURL();
            }
        });
        urlInput.dataset.binded = 'true';
    }
}

// =========================
// MODAL DE DETALHES DO PRODUTO
// =========================
function renderizarModalProdutoDetalhes() {
    const container = document.getElementById('produto-detalhes-conteudo');
    if (!container || !produtoModalAtual) return;

    const imagens = normalizarImagensProduto(produtoModalAtual);
    const imagemAtual = imagens[indiceImagemProdutoModal] || '';
    const compatibilidade = Array.isArray(produtoModalAtual.compatibilidade) && produtoModalAtual.compatibilidade.length
        ? produtoModalAtual.compatibilidade.join(', ')
        : 'Sem compatibilidade informada';

    container.innerHTML = `
        <div style="display:grid; grid-template-columns:minmax(0,1.1fr) minmax(280px,0.9fr); gap:20px; align-items:start;">
            <div>
                <div style="border:1px solid var(--border-color); border-radius:18px; overflow:hidden; background:var(--bg-body); min-height:320px; display:flex; align-items:center; justify-content:center;">
                    ${imagemAtual ? `<img src="${imagemAtual}" alt="${obterNomeProdutoEstoque(produtoModalAtual)}" style="width:100%; max-height:420px; object-fit:contain; display:block;">` : `<div style="color:var(--text-muted); text-align:center; padding:32px;"><i class="ri-image-line" style="font-size:42px;"></i><div style="margin-top:10px; font-weight:700;">Produto sem imagens</div></div>`}
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(74px,1fr)); gap:10px; margin-top:12px;">
                    ${imagens.map((img, index) => `<button type="button" onclick="selecionarImagemProdutoModal(${index})" style="padding:0; border:${index === indiceImagemProdutoModal ? '2px solid var(--primary)' : '1px solid var(--border-color)'}; border-radius:14px; overflow:hidden; background:#fff; cursor:pointer; height:74px;"><img src="${img}" alt="Miniatura ${index + 1}" style="width:100%; height:100%; object-fit:cover; display:block;"></button>`).join('')}
                </div>
            </div>
            <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                    <span style="font-size:11px; font-weight:800; color:var(--primary); background:rgba(16,185,129,0.10); border:1px solid rgba(16,185,129,0.15); padding:5px 10px; border-radius:999px;">${produtoModalAtual.codigo || 'Sem código'}</span>
                    <span style="font-size:11px; font-weight:800; color:#1d4ed8; background:rgba(59,130,246,0.10); border:1px solid rgba(59,130,246,0.15); padding:5px 10px; border-radius:999px;">${imagens.length} foto(s)</span>
                </div>
                <h2 style="margin:0 0 8px 0; font-size:24px; line-height:1.1; color:var(--text-main);">${obterNomeProdutoEstoque(produtoModalAtual)}</h2>
                <div style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">Marca: ${produtoModalAtual.marca || 'Não informada'}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
                    <div style="padding:14px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-body);"><div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Quantidade</div><div style="font-size:22px; font-weight:800; color:var(--text-main); margin-top:6px;">${parseInt(produtoModalAtual.qtd) || 0}</div></div>
                    <div style="padding:14px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-body);"><div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Preço</div><div style="font-size:22px; font-weight:800; color:var(--text-main); margin-top:6px;">R$ ${(parseFloat(produtoModalAtual.repasse) || 0).toFixed(2)}</div></div>
                    <div style="padding:14px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-body);"><div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Custo</div><div style="font-size:22px; font-weight:800; color:var(--text-main); margin-top:6px;">R$ ${(parseFloat(produtoModalAtual.compra) || 0).toFixed(2)}</div></div>
                    <div style="padding:14px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-body);"><div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Envio</div><div style="font-size:22px; font-weight:800; color:var(--text-main); margin-top:6px;">R$ ${(parseFloat(produtoModalAtual.taxa_envio) || 0).toFixed(2)}</div></div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap;"><button type="button" class="btn btn-secondary" onclick="imprimirEtiquetaProduto(produtoModalAtual)"><i class="ri-barcode-line"></i> Imprimir etiqueta</button><button type="button" class="btn btn-secondary" onclick="transferirLocalizacaoProduto(produtoModalAtual.id)"><i class="ri-route-line"></i> Transferir localização</button></div><div style="padding:16px; border-radius:18px; border:1px solid var(--border-color); background:var(--bg-body);">
                    <div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase; margin-bottom:8px;">Compatibilidade</div>
                    <div style="font-size:14px; color:var(--text-main); line-height:1.5;">${compatibilidade}</div><div style="margin-top:14px; font-size:13px; color:var(--text-muted);"><b>Localização:</b> ${textoLocalizacaoProduto(produtoModalAtual)}</div>
                </div>
            </div>
        </div>
    `;
}

function abrirModalProdutoDetalhes(produto) {
    produtoModalAtual = produto;
    indiceImagemProdutoModal = 0;
    renderizarModalProdutoDetalhes();
    const modal = document.getElementById('modal-produto-detalhes');
    if (modal) modal.style.display = 'flex';
}

function selecionarImagemProdutoModal(index) {
    indiceImagemProdutoModal = index;
    renderizarModalProdutoDetalhes();
}

// =========================
// SALVAR PRODUTO
// =========================
async function salvarProduto() {
    const id = document.getElementById('edit-id')?.value || '';
    const motoArr = [];

    document.querySelectorAll('.moto-check:checked').forEach(c => motoArr.push(c.value));

    const imagemManual = document.getElementById('imagem')?.value?.trim() || '';
    const imagemUrl = document.getElementById('imagem-url')?.value?.trim() || '';
    const imagensFinal = normalizarListaImagens(imagensProdutoTemp.length ? imagensProdutoTemp : [imagemBase64Temp, imagemManual, imagemUrl]);
    const imagemPrincipal = imagensFinal[0] || '';
    const marca = document.getElementById('marca')?.value?.trim() || '';
    const nomePeca = document.getElementById('nome-peca')?.value?.trim() || '';
    const modelo = atualizarModeloProduto();
    const localSelecionado = obterLocalCadastradoPorId(document.getElementById('loc-cadastrado')?.value || '');
    const rua = document.getElementById('loc-corredor')?.value?.trim() || '';
    const localFisico = document.getElementById('loc-caixa')?.value?.trim() || '';

    const produto = {
        marca: marca,
        nome_peca: nomePeca,
        modelo: modelo,
        codigo: document.getElementById('codigo')?.value?.trim() || '',
        qtd: parseInt(document.getElementById('qtd')?.value) || 0,
        compra: parseFloat(document.getElementById('compra')?.value) || 0,
        taxa_envio: parseFloat(document.getElementById('taxa_envio')?.value) || 0,
        repasse: parseFloat(document.getElementById('repasse')?.value) || 0,
        compatibilidade: motoArr,
        imagem: imagemPrincipal,
        imagens: imagensFinal,
        localizacao: {
            localId: localSelecionado?.id || '',
            rua,
            local: localFisico,
            posicao: localFisico,
            corredor: rua,
            caixa: localFisico,
            prateleira: ''
        },
        timestamp: Date.now()
    };

    if (!produto.nome_peca) {
        return alert('Nome da peça é obrigatório.');
    }

    try {
        if (id) {
            await db.collection('estoque_kell').doc(id).update(produto);
            if (typeof registrarAuditoria === 'function') {
                registrarAuditoria('ESTOQUE', id, 'EDICAO', { modelo: produto.modelo, marca: produto.marca, nome_peca: produto.nome_peca });
            }
            Toastify({ text: 'Produto atualizado com sucesso!', style: { background: 'var(--primary)' } }).showToast();
        } else {
            const doc = await db.collection('estoque_kell').add(produto);
            if (typeof registrarAuditoria === 'function') {
                registrarAuditoria('ESTOQUE', doc.id, 'CRIACAO', { modelo: produto.modelo, marca: produto.marca, nome_peca: produto.nome_peca });
            }
            Toastify({ text: 'Produto salvo com sucesso!', style: { background: 'var(--primary)' } }).showToast();
        }

        limparFormEstoque();
        const form = document.getElementById('form-cadastro');
        if (form) form.classList.add('hidden');
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar produto: ' + e.message);
    }
}
// =========================
// EDIÃ‡ÃƒO
// =========================
function carregarParaEdicao(p) {
    const form = document.getElementById('form-cadastro');
    if (form && form.classList.contains('hidden')) {
        form.classList.remove('hidden');
    }

    document.getElementById('edit-id').value = p.id || '';
    document.getElementById('marca').value = p.marca || '';
    document.getElementById('nome-peca').value = p.nome_peca || '';
    document.getElementById('modelo').value = p.modelo || obterNomeProdutoEstoque(p);
    document.getElementById('codigo').value = p.codigo || '';
    document.getElementById('qtd').value = p.qtd || 0;
    document.getElementById('compra').value = p.compra || 0;
    document.getElementById('taxa_envio').value = p.taxa_envio || 0;
    document.getElementById('repasse').value = p.repasse || 0;
    const localizacaoProduto = obterLocalizacaoProduto(p);
    document.getElementById('loc-cadastrado').value = p.localizacao?.localId || '';
    document.getElementById('loc-corredor').value = localizacaoProduto.rua || '';
    document.getElementById('loc-caixa').value = localizacaoProduto.local || localizacaoProduto.posicao || '';

    const imagemCampo = document.getElementById('imagem');
    const imagemUrl = document.getElementById('imagem-url');
    const fileInputA = document.getElementById('imagem-file');
    const fileInputB = document.getElementById('imagem-produto');
    const imagensProduto = normalizarImagensProduto(p);

    if (imagemCampo) imagemCampo.value = imagensProduto[0] || '';
    if (imagemUrl) imagemUrl.value = '';
    if (fileInputA) fileInputA.value = '';
    if (fileInputB) fileInputB.value = '';

    imagensProdutoTemp = imagensProduto;
    imagemBase64Temp = imagensProduto[0] || '';
    renderizarPreviewImagensProduto();

    document.querySelectorAll('.moto-check').forEach(c => {
        c.checked = (p.compatibilidade || []).includes(c.value);
    });

    atualizarModeloProduto();

    const titulo = document.getElementById('form-cadastro-titulo');
    const btn = document.getElementById('btn-salvar-produto');

    if (titulo) titulo.innerText = 'Editar produto';
    if (btn) btn.innerHTML = '<i class="ri-save-3-line"></i> Atualizar produto';

    atualizarModoProduto('Editando produto');
    calcularSugerido();

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// =========================
// REPOSIÃ‡ÃƒO
// =========================
function enviarWhatsapp() {
    const texto = document.getElementById('lista-reposicao-txt')?.innerText || 'Estoque OK.';
    window.open("https://wa.me/?text=" + encodeURIComponent("*REPOSIÇÃO KELL MOTOS*\n" + texto));
}

// =========================
// INIT
// =========================
document.addEventListener('DOMContentLoaded', function () {
    configurarUploadImagemProduto();
    renderizarPreviewImagensProduto();
    atualizarSelectLocaisProduto();

    const compra = document.getElementById('compra');
    if (compra && !compra.dataset.bindedSugestao) {
        compra.addEventListener('input', calcularSugerido);
        compra.dataset.bindedSugestao = "true";
    }

    const repasse = document.getElementById('repasse');
    if (repasse && !repasse.dataset.bindedSugestao) {
        repasse.addEventListener('input', function () {
            const valor = parseFloat(this.value) || 0;
            atualizarSugestaoPreco(valor);
        });
        repasse.dataset.bindedSugestao = "true";
    }

    const btnSalvar = document.getElementById('btn-salvar-produto');
    if (btnSalvar && !btnSalvar.querySelector('i')) {
        btnSalvar.innerHTML = '<i class="ri-save-3-line"></i> Salvar produto';
    }
});















function renderizarCatalogo() {
    const grid = document.getElementById('catalogo-grid');
    if (!grid) return;
    const busca = (document.getElementById('catalogo-busca')?.value || '').toLowerCase().trim();
    const lista = Array.isArray(cacheEstoque) ? [...cacheEstoque] : [];
    const filtrada = lista.filter(p => {
        const texto = [p.modelo, p.marca, p.nome_peca, p.codigo, ...(p.compatibilidade || [])].join(' ').toLowerCase();
        return texto.includes(busca);
    });
    grid.innerHTML = filtrada.map(p => {
        const imagens = normalizarImagensProduto(p);
        const imagem = imagens[0] || '';
        const nomeProduto = obterNomeProdutoEstoque(p);
        return `<div class="card" style="padding:16px; border-radius:18px; cursor:pointer;" onclick="abrirModalProdutoDetalhesPorId('${p.id}')"><div style="height:180px; border-radius:14px; overflow:hidden; background:var(--bg-body); display:flex; align-items:center; justify-content:center; margin-bottom:12px;">${imagem ? `<img src="${imagem}" alt="${nomeProduto}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="ri-image-line" style="font-size:36px; color:var(--text-muted);"></i>`}</div><div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">Marca: ${p.marca || 'Não informada'}</div><div style="font-size:15px; font-weight:800; color:var(--text-main); margin-bottom:6px;">${nomeProduto}</div><div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Código: ${p.codigo || 'Sem código'}</div><div style="font-size:22px; font-weight:800; color:var(--primary); margin-bottom:10px;">R$ ${(parseFloat(p.repasse) || 0).toFixed(2)}</div><div style="font-size:12px; color:var(--text-muted); line-height:1.5;">${(p.compatibilidade || []).slice(0, 3).join(', ') || 'Sem aplicação informada'}</div><div style="margin-top:12px; font-size:12px; font-weight:700; color:var(--primary);">Toque para ver mais detalhes</div></div>`;
    }).join('');
    if (!filtrada.length) {
        grid.innerHTML = '<div class="card" style="padding:24px; text-align:center; color:var(--text-muted);">Nenhum produto encontrado no catálogo.</div>';
    }
}

async function transferirLocalizacaoProduto(id) {
    const produto = (cacheEstoque || []).find(item => item.id === id);
    if (!produto) return alert('Produto não encontrado.');

    const localAtual = obterLocalizacaoProduto(produto);
    const rua = prompt('Nova rua:', localAtual.rua || '');
    if (rua === null) return;
    const localFisico = prompt('Novo local:', localAtual.local || localAtual.posicao || '');
    if (localFisico === null) return;

    await db.collection('estoque_kell').doc(id).update({
        localizacao: {
            localId: '',
            rua: String(rua || '').trim(),
            local: String(localFisico || '').trim(),
            posicao: String(localFisico || '').trim(),
            corredor: String(rua || '').trim(),
            caixa: String(localFisico || '').trim(),
            prateleira: ''
        },
        transferencia_em: Date.now()
    });

    Toastify({ text: 'Localização atualizada!', style: { background: 'var(--primary)' } }).showToast();
}

