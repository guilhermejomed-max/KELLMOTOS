let imagemBase64Temp = "";

// ================= NOVAS FUNÇÕES (CORREÇÃO DO ERRO) =================
function previewImagemProduto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        imagemBase64Temp = e.target.result;
        atualizarPreviewImagem(imagemBase64Temp);

        const placeholder = document.getElementById("imagem-placeholder");
        if (placeholder) placeholder.style.display = "none";
    };

    reader.readAsDataURL(file);
}

function atualizarPreviewPorURL(url) {
    if (!url) return;

    imagemBase64Temp = "";
    atualizarPreviewImagem(url);

    const placeholder = document.getElementById("imagem-placeholder");
    if (placeholder) placeholder.style.display = "none";
}

// ================= RESTANTE DO SEU SISTEMA =================

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
            const badge = (p.qtd || 0) <= 2
                ? `<span class="status-badge bg-red">BAIXO (${p.qtd || 0})</span>`
                : `<span class="status-badge bg-green">${p.qtd || 0} UN</span>`;

            const imagem = p.imagem
                ? `<img src="${p.imagem}" style="width:56px;height:56px;object-fit:cover;border-radius:12px;">`
                : `<div style="width:56px;height:56px;border-radius:12px;background:#eee;"></div>`;

            const pString = JSON.stringify(p).replace(/"/g, '&quot;');

            html += `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:12px;">
                            ${imagem}
                            <div>
                                <b>${p.modelo || '-'}</b><br>
                                <small>${p.codigo || 'S/C'}</small>
                            </div>
                        </div>
                    </td>
                    <td>${badge}</td>
                    <td><b>R$ ${(parseFloat(p.repasse) || 0).toFixed(2)}</b></td>
                    <td style="text-align:right">
                        <button onclick='carregarParaEdicao(${pString})'>Editar</button>
                    </td>
                </tr>
            `;
        });
    }

    corpo.innerHTML = html;
}

// ================= FORM =================
function toggleFormCadastro() {
    const form = document.getElementById('form-cadastro');
    if (!form) return;
    form.classList.toggle('hidden');
}

function limparFormEstoque() {
    ['edit-id','modelo','codigo','qtd','compra','taxa_envio','repasse','imagem-url']
    .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const preview = document.getElementById('preview-imagem-produto');
    if (preview) preview.style.display = 'none';

    imagemBase64Temp = "";
}

// ================= SALVAR =================
async function salvarProduto() {
    const id = document.getElementById('edit-id')?.value || '';

    const produto = {
        modelo: document.getElementById('modelo').value,
        codigo: document.getElementById('codigo').value,
        qtd: parseInt(document.getElementById('qtd').value) || 0,
        compra: parseFloat(document.getElementById('compra').value) || 0,
        taxa_envio: parseFloat(document.getElementById('taxa_envio').value) || 0,
        repasse: parseFloat(document.getElementById('repasse').value) || 0,
        imagem: imagemBase64Temp || document.getElementById('imagem-url').value || '',
        timestamp: Date.now()
    };

    if (!produto.modelo) {
        alert("Nome obrigatório");
        return;
    }

    try {
        if (id) {
            await db.collection("estoque_kell").doc(id).update(produto);
        } else {
            await db.collection("estoque_kell").add(produto);
        }

        alert("Produto salvo!");
        limparFormEstoque();
        toggleFormCadastro();

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar");
    }
}

// ================= EDITAR =================
function carregarParaEdicao(p) {
    toggleFormCadastro();

    document.getElementById('edit-id').value = p.id || '';
    document.getElementById('modelo').value = p.modelo || '';
    document.getElementById('codigo').value = p.codigo || '';
    document.getElementById('qtd').value = p.qtd || 0;
    document.getElementById('compra').value = p.compra || 0;
    document.getElementById('repasse').value = p.repasse || 0;

    if (p.imagem) {
        atualizarPreviewImagem(p.imagem);
        imagemBase64Temp = p.imagem;
    }
}

// ================= PREVIEW =================
function atualizarPreviewImagem(src) {
    const img = document.getElementById('preview-imagem-produto');
    if (!img) return;

    img.src = src;
    img.style.display = "block";
}

// ================= INIT =================
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('imagem-produto');

    if (fileInput) {
        fileInput.addEventListener('change', previewImagemProduto);
    }
});
