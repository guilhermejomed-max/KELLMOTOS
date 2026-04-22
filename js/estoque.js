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

function abrirVendaProdutoEstoque(id) {
    const produto = obterProdutoEstoque(id);
    if (produto && typeof abrirVenda === 'function') abrirVenda(id, produto);
}

function carregarProdutoParaEdicaoPorId(id) {
    const produto = obterProdutoEstoque(id);
    if (produto) carregarParaEdicao(produto);
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

    const nome = produto?.modelo || 'Produto';
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
        (p.modelo || '').toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q) ||
        ((p.compatibilidade || []).join(' ').toLowerCase().includes(q))
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

            const badge = qtdAtual <= 2
                ? `<span class="status-badge bg-red"><i class="ri-alarm-warning-line"></i>BAIXO (${qtdAtual})</span>`
                : `<span class="status-badge bg-green"><i class="ri-checkbox-circle-line"></i>${qtdAtual} UN</span>`;

            const imagem = imagemPrincipal
                ? `<img src="${imagemPrincipal}" alt="${p.modelo || 'Produto'}" style="width:56px;height:56px;object-fit:cover;border-radius:14px;border:1px solid var(--border-color);background:#fff;box-shadow:var(--shadow-sm);flex-shrink:0;">`
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
                                <div style="font-weight:800;color:var(--text-main);font-size:13px;line-height:1.2;margin-bottom:4px;">${p.modelo || '-'}</div>
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
        .map(i => `• ${i.modelo} (Atual: ${parseInt(i.qtd) || 0})`)
        .join('\n');

    const reposicao = document.getElementById('lista-reposicao-txt');
    if (reposicao) {
        reposicao.innerText = faltas || 'Estoque OK.';
    }
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
        'modelo',
        'codigo',
        'qtd',
        'compra',
        'taxa_envio',
        'repasse',
        'imagem',
        'imagem-url'
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
                    ${imagemAtual ? `<img src="${imagemAtual}" alt="${produtoModalAtual.modelo || 'Produto'}" style="width:100%; max-height:420px; object-fit:contain; display:block;">` : `<div style="color:var(--text-muted); text-align:center; padding:32px;"><i class="ri-image-line" style="font-size:42px;"></i><div style="margin-top:10px; font-weight:700;">Produto sem imagens</div></div>`}
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
                <h2 style="margin:0 0 14px 0; font-size:24px; line-height:1.1; color:var(--text-main);">${produtoModalAtual.modelo || 'Produto'}</h2>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
                    <div style="padding:14px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-body);"><div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Quantidade</div><div style="font-size:22px; font-weight:800; color:var(--text-main); margin-top:6px;">${parseInt(produtoModalAtual.qtd) || 0}</div></div>
                    <div style="padding:14px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-body);"><div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Preço</div><div style="font-size:22px; font-weight:800; color:var(--text-main); margin-top:6px;">R$ ${(parseFloat(produtoModalAtual.repasse) || 0).toFixed(2)}</div></div>
                    <div style="padding:14px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-body);"><div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Custo</div><div style="font-size:22px; font-weight:800; color:var(--text-main); margin-top:6px;">R$ ${(parseFloat(produtoModalAtual.compra) || 0).toFixed(2)}</div></div>
                    <div style="padding:14px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-body);"><div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Envio</div><div style="font-size:22px; font-weight:800; color:var(--text-main); margin-top:6px;">R$ ${(parseFloat(produtoModalAtual.taxa_envio) || 0).toFixed(2)}</div></div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap;"><button type="button" class="btn btn-secondary" onclick="imprimirEtiquetaProduto(produtoModalAtual)"><i class="ri-barcode-line"></i> Imprimir etiqueta</button></div><div style="padding:16px; border-radius:18px; border:1px solid var(--border-color); background:var(--bg-body);">
                    <div style="font-size:11px; color:var(--text-muted); font-weight:800; text-transform:uppercase; margin-bottom:8px;">Compatibilidade</div>
                    <div style="font-size:14px; color:var(--text-main); line-height:1.5;">${compatibilidade}</div>
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

    const produto = {
        modelo: document.getElementById('modelo')?.value?.trim() || '',
        codigo: document.getElementById('codigo')?.value?.trim() || '',
        qtd: parseInt(document.getElementById('qtd')?.value) || 0,
        compra: parseFloat(document.getElementById('compra')?.value) || 0,
        taxa_envio: parseFloat(document.getElementById('taxa_envio')?.value) || 0,
        repasse: parseFloat(document.getElementById('repasse')?.value) || 0,
        compatibilidade: motoArr,
        imagem: imagemPrincipal,
        imagens: imagensFinal,
        timestamp: Date.now()
    };

    if (!produto.modelo) {
        return alert('Nome do produto é obrigatório.');
    }

    try {
        if (id) {
            await db.collection('estoque_kell').doc(id).update(produto);
            if (typeof registrarAuditoria === 'function') {
                registrarAuditoria('ESTOQUE', id, 'EDICAO', { modelo: produto.modelo });
            }
            Toastify({ text: 'Produto atualizado com sucesso!', style: { background: 'var(--primary)' } }).showToast();
        } else {
            const doc = await db.collection('estoque_kell').add(produto);
            if (typeof registrarAuditoria === 'function') {
                registrarAuditoria('ESTOQUE', doc.id, 'CRIACAO', { modelo: produto.modelo });
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
    document.getElementById('modelo').value = p.modelo || '';
    document.getElementById('codigo').value = p.codigo || '';
    document.getElementById('qtd').value = p.qtd || 0;
    document.getElementById('compra').value = p.compra || 0;
    document.getElementById('taxa_envio').value = p.taxa_envio || 0;
    document.getElementById('repasse').value = p.repasse || 0;

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











