// ==================== ESTOQUE V2 COM IMAGENS ====================

let imagemTemporaria = null;

// --- RENDERIZAÇÃO GRID DE PRODUTOS ---
function renderizarEstoque() {
    const q = document.getElementById('busca').value.toLowerCase();
    const grid = document.getElementById('estoque-grid');
    
    if (!grid) return;

    const filtered = cacheEstoque.filter(p =>
        p.modelo.toLowerCase().includes(q) || 
        (p.codigo || '').toLowerCase().includes(q) || 
        (p.compatibilidade || []).join(' ').toLowerCase().includes(q)
    );

    // Ordenação Curva ABC
    filtered.sort((a, b) => (b.compra * b.qtd) - (a.compra * a.qtd));

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Nenhum produto encontrado.</div>';
        return;
    }

    let html = '';
    filtered.forEach(p => {
        const statusClass = p.qtd <= 2 ? 'baixo' : p.qtd <= 5 ? 'medio' : 'alto';
        const statusTexto = p.qtd <= 2 ? `BAIXO (${p.qtd})` : `${p.qtd} UN`;
        const imagemUrl = p.imagem || 'https://via.placeholder.com/280x180?text=Sem+Imagem';
        const pString = JSON.stringify(p).replace(/"/g, '&quot;');

        html += `
            <div class="produto-card">
                <div class="produto-imagem">
                    <img src="${imagemUrl}" alt="${p.modelo}" onerror="this.src='https://via.placeholder.com/280x180?text=Erro+Imagem'">
                </div>
                <div class="produto-info">
                    <div class="produto-nome">${p.modelo}</div>
                    <div class="produto-codigo">Código: ${p.codigo || 'S/C'}</div>
                    <div class="produto-compatibilidade">${(p.compatibilidade || []).slice(0, 2).join(', ') || 'Sem compatibilidade'}</div>
                    
                    <div class="produto-precos">
                        <div class="preco-box">
                            <div class="preco-label">Custo</div>
                            <div class="preco-valor">R$ ${p.compra.toFixed(2)}</div>
                        </div>
                        <div class="preco-box">
                            <div class="preco-label">Venda</div>
                            <div class="preco-valor">R$ ${p.repasse.toFixed(2)}</div>
                        </div>
                    </div>

                    <div class="produto-status">
                        <span class="status-badge ${statusClass}">📦 ${statusTexto}</span>
                    </div>

                    <div class="produto-acoes">
                        <button class="btn-acao btn-vender" onclick='abrirVenda("${p.id}",${pString})'>
                            <i class="ri-shopping-cart-line"></i> Vender
                        </button>
                        ${userNivel !== 'JUNIOR' ? `
                            <button class="btn-acao btn-editar" onclick='carregarParaEdicao(${pString})'>
                                <i class="ri-pencil-line"></i> Editar
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;

    // Atualizar lista de reposição
    const faltas = cacheEstoque.filter(i => i.qtd <= 2).map(i => `• ${i.modelo} (Atual: ${i.qtd})`).join('\n');
    if (document.getElementById('lista-reposicao-txt')) {
        document.getElementById('lista-reposicao-txt').innerText = faltas || "Estoque OK.";
    }
}

// --- GERENCIAR FORMULÁRIO ---
function toggleFormCadastro() {
    const f = document.getElementById('form-cadastro');
    f.classList.toggle('hidden');
    if (!f.classList.contains('hidden')) {
        limparFormEstoque();
        renderizarMotosSeletor();
    }
}

function limparFormEstoque() {
    ['edit-id', 'modelo', 'codigo', 'qtd', 'compra', 'taxa_envio', 'repasse'].forEach(id => 
        document.getElementById(id).value = ''
    );
    document.getElementById('image-url').value = '';
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('form-titulo').innerText = 'Novo Produto';
    imagemTemporaria = null;
    
    // Desmarcar todas motos
    document.querySelectorAll('.moto-check').forEach(c => c.checked = false);
}

// --- RENDERIZAR SELETOR DE MOTOS ---
function renderizarMotosSeletor() {
    const container = document.getElementById('motos-checkboxes');
    if (!container) return;

    let html = '';
    cacheMotos.forEach(m => {
        html += `
            <label class="moto-check-label">
                <input type="checkbox" class="moto-check" value="${m.nome}">
                <span>${m.nome}</span>
            </label>
        `;
    });
    
    container.innerHTML = html || '<span style="color: var(--text-muted); font-size: 12px;">Nenhuma moto cadastrada</span>';
}

// --- UPLOAD E PREVIEW DE IMAGEM ---
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione uma imagem válida');
        return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Imagem muito grande. Máximo 5MB');
        return;
    }

    // Armazenar arquivo temporário
    imagemTemporaria = file;

    // Preview local
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewDiv = document.getElementById('image-preview');
        previewDiv.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
                ${file.name}
            </div>
        `;
    };
    reader.readAsDataURL(file);

    // Indicador visual
    document.getElementById('upload-area').classList.add('active');
}

// --- UPLOAD PARA FIREBASE STORAGE ---
async function uploadImagemFirebase(file, nomeArquivo) {
    try {
        const storage = firebase.storage();
        const ref = storage.ref(`produtos/${nomeArquivo}`);
        await ref.put(file);
        const url = await ref.getDownloadURL();
        return url;
    } catch (e) {
        console.error("Erro ao fazer upload:", e);
        alert("Erro ao enviar imagem: " + e.message);
        return null;
    }
}

// --- CALCULAR PREÇO SUGERIDO ---
function calcularSugerido() {
    const c = parseFloat(document.getElementById('compra').value) || 0;
    const t = parseFloat(document.getElementById('taxa_envio').value) || 0;
    const custo_total = c + t;
    const sugerido = custo_total * (1 + (configEmpresa.margem || 40) / 100);
    document.getElementById('repasse').placeholder = "Sug: R$ " + sugerido.toFixed(2);
}

// --- SALVAR PRODUTO ---
async function salvarProduto() {
    const id = document.getElementById('edit-id').value;
    const modelo = document.getElementById('modelo').value;
    
    if (!modelo) return alert("Nome obrigatório");

    // Mostrar loading
    const btnSalvar = event.target;
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> Salvando...';

    try {
        const motoArr = [];
        document.querySelectorAll('.moto-check:checked').forEach(c => motoArr.push(c.value));

        let imagemUrl = document.getElementById('image-url').value;

        // Se houver imagem temporária, fazer upload
        if (imagemTemporaria && !id) {
            const timestamp = Date.now();
            const nomeArquivo = `${timestamp}_${imagemTemporaria.name}`;
            imagemUrl = await uploadImagemFirebase(imagemTemporaria, nomeArquivo);
            
            if (!imagemUrl) {
                btnSalvar.disabled = false;
                btnSalvar.innerHTML = textoOriginal;
                return;
            }
        } else if (imagemTemporaria && id) {
            // Atualizar imagem em produto existente
            const timestamp = Date.now();
            const nomeArquivo = `${timestamp}_${imagemTemporaria.name}`;
            imagemUrl = await uploadImagemFirebase(imagemTemporaria, nomeArquivo);
        }

        const p = {
            modelo: modelo,
            codigo: document.getElementById('codigo').value,
            qtd: parseInt(document.getElementById('qtd').value) || 0,
            compra: parseFloat(document.getElementById('compra').value) || 0,
            taxa_envio: parseFloat(document.getElementById('taxa_envio').value) || 0,
            repasse: parseFloat(document.getElementById('repasse').value) || 0,
            compatibilidade: motoArr,
            imagem: imagemUrl || '',
            timestamp: Date.now()
        };

        if (id) {
            await db.collection("estoque_kell").doc(id).update(p);
            registrarAuditoria('ESTOQUE', id, 'EDICAO', { modelo: p.modelo });
        } else {
            const doc = await db.collection("estoque_kell").add(p);
            registrarAuditoria('ESTOQUE', doc.id, 'CRIACAO', { modelo: p.modelo });
        }

        toggleFormCadastro();
        Toastify({ text: "✅ Produto Salvo!", style: { background: "var(--primary)" } }).showToast();

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar: " + e.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = textoOriginal;
        imagemTemporaria = null;
    }
}

// --- CARREGAR PARA EDIÇÃO ---
function carregarParaEdicao(p) {
    document.getElementById('edit-id').value = p.id;
    document.getElementById('modelo').value = p.modelo;
    document.getElementById('codigo').value = p.codigo;
    document.getElementById('qtd').value = p.qtd;
    document.getElementById('compra').value = p.compra;
    document.getElementById('taxa_envio').value = p.taxa_envio;
    document.getElementById('repasse').value = p.repasse;

    // Carregar imagem
    if (p.imagem) {
        document.getElementById('image-url').value = p.imagem;
        document.getElementById('image-preview').innerHTML = `
            <img src="${p.imagem}" alt="${p.modelo}">
            <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
                Clique para alterar
            </div>
        `;
    }

    // Marcar motos
    document.querySelectorAll('.moto-check').forEach(c => 
        c.checked = (p.compatibilidade || []).includes(c.value)
    );

    document.getElementById('form-titulo').innerText = `Editando: ${p.modelo}`;
    renderizarMotosSeletor();
    toggleFormCadastro();
    
    // Scroll para formulário
    setTimeout(() => {
        document.getElementById('form-cadastro').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

// --- DRAG AND DROP ---
document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('active');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('active');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('active');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                document.getElementById('foto-input').files = files;
                handleImageUpload({ target: { files } });
            }
        });
    }
});

// --- ECOMMERCE ---
function renderizarEcommerce() {
    const tbody = document.getElementById('corpo-ecommerce');
    if (!tbody) return;
    let h = '';
    if (typeof cacheEstoque !== 'undefined') {
        cacheEstoque.forEach(p => {
            const custo = (p.compra || 0) + (p.taxa_envio || 0);
            h += `<tr><td>${p.modelo}</td><td>R$ ${custo.toFixed(2)}</td><td>R$ ${p.repasse.toFixed(2)}</td><td>${p.eco_venda ? 'R$ ' + p.eco_venda.toFixed(2) : '--'}</td><td align="right"><button class="btn btn-sm btn-secondary" onclick='abrirAjusteEco("${p.id}")'>Config</button> <button class="btn btn-sm btn-primary" onclick='abrirVendaEco("${p.id}")'>Vender</button></td></tr>`;
        });
    }
    tbody.innerHTML = h;
}

// --- WHATSAPP ---
function enviarWhatsapp() {
    window.open("https://wa.me/?text=" + encodeURIComponent("*REPOSIÇÃO KELL MOTOS*\n" + document.getElementById('lista-reposicao-txt').innerText));
}

// Inicializar ao carregar página
document.addEventListener('DOMContentLoaded', () => {
    // Renderizar motos seletor quando disponível
    if (document.getElementById('motos-checkboxes')) {
        renderizarMotosSeletor();
    }
});

// Estilo para spinner de loading
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
