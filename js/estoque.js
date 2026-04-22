let imagemBase64Temp = "";

// =========================
// RENDERIZAÇÃO DO ESTOQUE
// =========================
function renderizarEstoque() {
    const buscaEl = document.getElementById('busca');
    const corpo = document.getElementById('corpo-estoque');
    if (!corpo) return;

    const q = buscaEl ? buscaEl.value.toLowerCase().trim() : "";
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

            const badge = qtdAtual <= 2
                ? `
                    <span class="status-badge bg-red">
                        <i class="ri-alarm-warning-line"></i>
                        BAIXO (${qtdAtual})
                    </span>
                  `
                : `
                    <span class="status-badge bg-green">
                        <i class="ri-checkbox-circle-line"></i>
                        ${qtdAtual} UN
                    </span>
                  `;

            const imagem = p.imagem
                ? `
                    <img 
                        src="${p.imagem}" 
                        alt="${p.modelo || 'Produto'}" 
                        style="
                            width:56px;
                            height:56px;
                            object-fit:cover;
                            border-radius:14px;
                            border:1px solid var(--border-color);
                            background:#fff;
                            box-shadow: var(--shadow-sm);
                            flex-shrink:0;
                        "
                    >
                  `
                : `
                    <div style="
                        width:56px;
                        height:56px;
                        border-radius:14px;
                        border:1px dashed var(--border-color);
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        color:var(--text-muted);
                        background:var(--bg-body);
                        flex-shrink:0;
                    ">
                        <i class="ri-image-line" style="font-size:20px;"></i>
                    </div>
                  `;

            const compatibilidadeLista = Array.isArray(p.compatibilidade) ? p.compatibilidade : [];
            const compatibilidadeTexto = compatibilidadeLista.length
                ? compatibilidadeLista.slice(0, 3).join(', ')
                : 'Sem compatibilidade informada';

            const compatibilidadeExtra = compatibilidadeLista.length > 3
                ? ` +${compatibilidadeLista.length - 3}`
                : '';

            const pString = JSON.stringify(p).replace(/"/g, '&quot;');

            html += `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:12px; min-width:240px;">
                            ${imagem}
                            <div style="min-width:0;">
                                <div style="
                                    font-weight:800;
                                    color:var(--text-main);
                                    font-size:13px;
                                    line-height:1.2;
                                    margin-bottom:4px;
                                ">
                                    ${p.modelo || '-'}
                                </div>

                                <div style="
                                    display:flex;
                                    align-items:center;
                                    gap:6px;
                                    flex-wrap:wrap;
                                ">
                                    <span style="
                                        font-size:10px;
                                        font-weight:800;
                                        color:var(--primary);
                                        background:rgba(16,185,129,0.10);
                                        border:1px solid rgba(16,185,129,0.15);
                                        padding:4px 8px;
                                        border-radius:999px;
                                        letter-spacing:0.2px;
                                    ">
                                        ${p.codigo || 'S/C'}
                                    </span>

                                    ${qtdAtual <= 2 ? `
                                        <span style="
                                            font-size:10px;
                                            font-weight:800;
                                            color:#b91c1c;
                                            background:rgba(239,68,68,0.12);
                                            border:1px solid rgba(239,68,68,0.18);
                                            padding:4px 8px;
                                            border-radius:999px;
                                            letter-spacing:0.2px;
                                        ">
                                            Reposição
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </td>

                    <td>
                        <div style="
                            font-size:12px;
                            color:var(--text-main);
                            line-height:1.4;
                            max-width:250px;
                        ">
                            ${compatibilidadeTexto}
                            <span style="color:var(--text-muted); font-weight:700;">${compatibilidadeExtra}</span>
                        </div>
                    </td>

                    <td>
                        ${badge}
                    </td>

                    <td style="font-weight:800; white-space:nowrap;">
                        R$ ${precoVenda.toFixed(2)}
                    </td>

                    <td style="text-align:right;">
                        <div style="
                            display:flex;
                            gap:8px;
                            justify-content:flex-end;
                            align-items:center;
                            flex-wrap:wrap;
                        ">
                            <button 
                                class="btn btn-primary btn-sm" 
                                style="
                                    min-width:42px;
                                    height:38px;
                                    padding:0 12px;
                                    border-radius:10px;
                                    box-shadow: 0 4px 12px rgba(16,185,129,0.20);
                                "
                                title="Vender produto"
                                onclick='abrirVenda("${p.id}",${pString})'
                            >
                                <i class="ri-shopping-cart-line"></i>
                            </button>

                            ${userNivel !== 'JUNIOR' ? `
                                <button 
                                    class="btn btn-secondary btn-sm" 
                                    style="
                                        min-width:42px;
                                        height:38px;
                                        padding:0 12px;
                                        border-radius:10px;
                                        border:1px solid var(--border-color);
                                        background:var(--bg-card);
                                        color:var(--text-main);
                                        font-weight:700;
                                    "
                                    title="Editar produto"
                                    onclick='carregarParaEdicao(${pString})'
                                >
                                    <i class="ri-pencil-line"></i>
                                </button>
                            ` : ''}
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
        reposicao.innerText = faltas || "Estoque OK.";
    }
}

// =========================
// FORMULÁRIO
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

    imagemBase64Temp = "";

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
// PREVIEW DE IMAGEM
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

function previewImagemProduto(event) {
    const file = event?.target?.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        imagemBase64Temp = e.target.result;

        const imagemCampo = document.getElementById('imagem');
        if (imagemCampo) imagemCampo.value = imagemBase64Temp;

        const urlInput = document.getElementById('imagem-url');
        if (urlInput) urlInput.value = '';

        atualizarPreviewImagem(imagemBase64Temp);
    };

    reader.readAsDataURL(file);
}

function atualizarPreviewPorURL(url) {
    const valor = (url || '').trim();
    const imagemCampo = document.getElementById('imagem');

    if (valor) {
        imagemBase64Temp = "";
        if (imagemCampo) imagemCampo.value = valor;
        atualizarPreviewImagem(valor);
    } else {
        if (imagemCampo) imagemCampo.value = '';
        if (!imagemBase64Temp) {
            atualizarPreviewImagem('');
        }
    }
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
            input.dataset.binded = "true";
        }
    };

    bindFileInput(fileInputPadrao);
    bindFileInput(fileInputNovo);

    if (urlInput && !urlInput.dataset.binded) {
        urlInput.addEventListener('input', function () {
            atualizarPreviewPorURL(this.value);
        });
        urlInput.dataset.binded = "true";
    }
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

    const imagemFinal = imagemBase64Temp || imagemManual || imagemUrl || '';

    const produto = {
        modelo: document.getElementById('modelo')?.value?.trim() || '',
        codigo: document.getElementById('codigo')?.value?.trim() || '',
        qtd: parseInt(document.getElementById('qtd')?.value) || 0,
        compra: parseFloat(document.getElementById('compra')?.value) || 0,
        taxa_envio: parseFloat(document.getElementById('taxa_envio')?.value) || 0,
        repasse: parseFloat(document.getElementById('repasse')?.value) || 0,
        compatibilidade: motoArr,
        imagem: imagemFinal,
        timestamp: Date.now()
    };

    if (!produto.modelo) {
        return alert("Nome do produto é obrigatório.");
    }

    try {
        if (id) {
            await db.collection("estoque_kell").doc(id).update(produto);
            if (typeof registrarAuditoria === 'function') {
                registrarAuditoria('ESTOQUE', id, 'EDICAO', { modelo: produto.modelo });
            }
            Toastify({
                text: "Produto atualizado com sucesso!",
                style: { background: "var(--primary)" }
            }).showToast();
        } else {
            const doc = await db.collection("estoque_kell").add(produto);
            if (typeof registrarAuditoria === 'function') {
                registrarAuditoria('ESTOQUE', doc.id, 'CRIACAO', { modelo: produto.modelo });
            }
            Toastify({
                text: "Produto salvo com sucesso!",
                style: { background: "var(--primary)" }
            }).showToast();
        }

        limparFormEstoque();
        const form = document.getElementById('form-cadastro');
        if (form) form.classList.add('hidden');
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar produto: " + e.message);
    }
}

// =========================
// EDIÇÃO
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

    if (imagemCampo) imagemCampo.value = p.imagem || '';
    if (imagemUrl) imagemUrl.value = (p.imagem && !String(p.imagem).startsWith('data:')) ? p.imagem : '';
    if (fileInputA) fileInputA.value = '';
    if (fileInputB) fileInputB.value = '';

    imagemBase64Temp = (p.imagem && String(p.imagem).startsWith('data:')) ? p.imagem : "";
    atualizarPreviewImagem(p.imagem || '');

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
// REPOSIÇÃO
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
