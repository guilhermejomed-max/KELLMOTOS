let imagemBase64Temp = "";

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
                ? `<span class="status-badge bg-red"><i class="ri-alarm-warning-line"></i> BAIXO (${p.qtd || 0})</span>`
                : `<span class="status-badge bg-green">${p.qtd || 0} UN</span>`;

            const imagem = p.imagem
                ? `<img src="${p.imagem}" alt="${p.modelo || 'Produto'}" style="width:56px;height:56px;object-fit:cover;border-radius:12px;border:1px solid var(--border-color);background:#fff;">`
                : `<div style="width:56px;height:56px;border-radius:12px;border:1px dashed var(--border-color);display:flex;align-items:center;justify-content:center;color:var(--text-muted);background:var(--bg-body);">
                        <i class="ri-image-line" style="font-size:20px;"></i>
                   </div>`;

            const pString = JSON.stringify(p).replace(/"/g, '&quot;');

            html += `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:12px;">
                            ${imagem}
                            <div>
                                <b>${p.modelo || '-'}</b><br>
                                <small style="color:var(--text-muted); font-size:11px">${p.codigo || 'S/C'}</small>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                                    ${((p.compatibilidade || []).slice(0, 3).join(', ')) || 'Sem compatibilidade informada'}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>${badge}</td>
                    <td style="font-weight:700">R$ ${(parseFloat(p.repasse) || 0).toFixed(2)}</td>
                    <td style="text-align:right">
                        <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                            <button class="btn btn-sm btn-primary" onclick='abrirVenda("${p.id}",${pString})'>
                                <i class="ri-shopping-cart-line"></i>
                            </button>
                            ${userNivel !== 'JUNIOR' ? `
                                <button class="btn btn-sm btn-secondary" onclick='carregarParaEdicao(${pString})'>
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
        .filter(i => (i.qtd || 0) <= 2)
        .map(i => `• ${i.modelo} (Atual: ${i.qtd || 0})`)
        .join('\n');

    const reposicao = document.getElementById('lista-reposicao-txt');
    if (reposicao) {
        reposicao.innerText = faltas || "Estoque OK.";
    }
}

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
            if (titulo) titulo.innerText = 'Cadastro de Produto';
            if (btn) btn.innerText = 'Salvar';
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

    const fileInput = document.getElementById('imagem-file');
    if (fileInput) fileInput.value = '';

    document.querySelectorAll('.moto-check').forEach(c => c.checked = false);

    imagemBase64Temp = "";

    const titulo = document.getElementById('form-cadastro-titulo');
    const btn = document.getElementById('btn-salvar-produto');
    if (titulo) titulo.innerText = 'Cadastro de Produto';
    if (btn) btn.innerText = 'Salvar';
}

function calcularSugerido() {
    const compra = parseFloat(document.getElementById('compra')?.value) || 0;
    const margem = (typeof configEmpresa !== 'undefined' && configEmpresa.margem) ? configEmpresa.margem : 40;
    const repasse = document.getElementById('repasse');

    if (repasse && !repasse.value) {
        repasse.placeholder = "Sug: R$ " + (compra * (1 + margem / 100)).toFixed(2);
    }
}

function atualizarPreviewImagem(src) {
    const preview = document.getElementById('preview-imagem-produto');
    if (!preview) return;

    if (src) {
        preview.src = src;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
}

function configurarUploadImagemProduto() {
    const fileInput = document.getElementById('imagem-file');
    const urlInput = document.getElementById('imagem-url');

    if (fileInput && !fileInput.dataset.binded) {
        fileInput.addEventListener('change', function (e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (event) {
                imagemBase64Temp = event.target.result;
                atualizarPreviewImagem(imagemBase64Temp);

                const imagemCampo = document.getElementById('imagem');
                if (imagemCampo) imagemCampo.value = imagemBase64Temp;

                if (urlInput) urlInput.value = '';
            };
            reader.readAsDataURL(file);
        });
        fileInput.dataset.binded = "true";
    }

    if (urlInput && !urlInput.dataset.binded) {
        urlInput.addEventListener('input', function () {
            const url = this.value.trim();
            const imagemCampo = document.getElementById('imagem');
            if (url) {
                imagemBase64Temp = "";
                if (imagemCampo) imagemCampo.value = url;
                atualizarPreviewImagem(url);
            } else if (!imagemBase64Temp) {
                if (imagemCampo) imagemCampo.value = '';
                atualizarPreviewImagem('');
            }
        });
        urlInput.dataset.binded = "true";
    }
}

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
    const fileInput = document.getElementById('imagem-file');

    if (imagemCampo) imagemCampo.value = p.imagem || '';
    if (imagemUrl) imagemUrl.value = (p.imagem && !String(p.imagem).startsWith('data:')) ? p.imagem : '';
    if (fileInput) fileInput.value = '';

    imagemBase64Temp = (p.imagem && String(p.imagem).startsWith('data:')) ? p.imagem : "";
    atualizarPreviewImagem(p.imagem || '');

    document.querySelectorAll('.moto-check').forEach(c => {
        c.checked = (p.compatibilidade || []).includes(c.value);
    });

    const titulo = document.getElementById('form-cadastro-titulo');
    const btn = document.getElementById('btn-salvar-produto');

    if (titulo) titulo.innerText = 'Editar Produto';
    if (btn) btn.innerText = 'Atualizar Produto';

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function enviarWhatsapp() {
    const texto = document.getElementById('lista-reposicao-txt')?.innerText || 'Estoque OK.';
    window.open("https://wa.me/?text=" + encodeURIComponent("*REPOSIÇÃO KELL MOTOS*\n" + texto));
}

document.addEventListener('DOMContentLoaded', function () {
    configurarUploadImagemProduto();
});