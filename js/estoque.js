// ==================== ESTOQUE V2.1 - SMART (Mantém Design Premium) ====================

let imagemTemporaria = null;
let visualizacaoAtiva = 'tabela'; // 'tabela' ou 'cards'

// --- TOGGLE VISUALIZAÇÃO ---
function toggleVisualizacao() {
    visualizacaoAtiva = visualizacaoAtiva === 'tabela' ? 'cards' : 'tabela';
    renderizarEstoque();
    
    const btnToggle = document.getElementById('btn-toggle-viz');
    if (btnToggle) {
        btnToggle.innerHTML = visualizacaoAtiva === 'tabela' 
            ? '<i class="ri-layout-grid-line"></i> Ver Cards'
            : '<i class="ri-table-2"></i> Ver Tabela';
    }
}

// --- RENDERIZAÇÃO ---
function renderizarEstoque() {
    const q = document.getElementById('busca').value.toLowerCase();
    
    const filtered = cacheEstoque.filter(p =>
        p.modelo.toLowerCase().includes(q) || 
        (p.codigo || '').toLowerCase().includes(q) || 
        (p.compatibilidade || []).join(' ').toLowerCase().includes(q)
    );

    filtered.sort((a, b) => (b.compra * b.qtd) - (a.compra * a.qtd));

    if (visualizacaoAtiva === 'tabela') {
        renderizarTabelaEstoque(filtered);
    } else {
        renderizarCardsEstoque(filtered);
    }

    // Atualizar reposição
    const faltas = cacheEstoque.filter(i => i.qtd <= 2).map(i => `• ${i.modelo} (Atual: ${i.qtd})`).join('\n');
    if (document.getElementById('lista-reposicao-txt')) {
        document.getElementById('lista-reposicao-txt').innerText = faltas || "Estoque OK.";
    }
}

// --- TABELA (Design Original Mantido) ---
function renderizarTabelaEstoque(filtered) {
    const tbody = document.getElementById('corpo-estoque');
    if (!tbody) return;

    let h = '';
    if (filtered.length === 0) {
        h = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted)">Nenhum produto encontrado.</td></tr>';
    } else {
        filtered.forEach(p => {
            const badge = p.qtd <= 2 
                ? `<span class="status-badge bg-red"><i class="ri-alarm-warning-line"></i> BAIXO (${p.qtd})</span>` 
                : `<span class="status-badge bg-green">${p.qtd} UN</span>`;
            
            const pString = JSON.stringify(p).replace(/"/g, '&quot;');
            const imagemUrl = p.imagem ? `<img src="${p.imagem}" style="width:30px; height:30px; border-radius:4px; margin-right:8px;" onerror="this.style.display='none'">` : '';

            h += `<tr>
                <td>
                    ${imagemUrl}
                    <b>${p.modelo}</b><br>
                    <small style="color:var(--text-muted); font-size:11px">${p.codigo||'S/C'}</small>
                </td>
                <td style="font-size:12px">${(p.compatibilidade||[]).slice(0,3).join(', ')}...</td>
                <td>${badge}</td>
                <td style="font-weight:700">R$ ${p.repasse.toFixed(2)}</td>
                <td style="text-align:right">
                    <button class="btn btn-sm btn-primary" onclick='abrirVenda("${p.id}",${pString})'><i class="ri-shopping-cart-line"></i></button>
                    ${userNivel!=='JUNIOR' ? `<button class="btn btn-sm btn-secondary" onclick='carregarParaEdicao(${pString})'><i class="ri-pencil-line"></i></button>` : ''}
                </td>
            </tr>`;
        });
    }
    tbody.innerHTML = h;
}

// --- CARDS (Novo - Premium) ---
function renderizarCardsEstoque(filtered) {
    let containerCards = document.getElementById('estoque-cards');
    
    if (!containerCards) {
        // Criar container se não existir
        const tbody = document.getElementById('corpo-estoque');
        if (tbody && tbody.parentElement) {
            containerCards = document.createElement('div');
            containerCards.id = 'estoque-cards';
            containerCards.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            `;
            tbody.parentElement.parentElement.insertBefore(containerCards, tbody.parentElement);
            // Esconder tabela
            tbody.parentElement.style.display = 'none';
        } else {
            return;
        }
    } else {
        // Mostrar container
        containerCards.style.display = 'grid';
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) tableContainer.style.display = 'none';
    }

    if (filtered.length === 0) {
        containerCards.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Nenhum produto encontrado.</div>';
        return;
    }

    let html = '';
    filtered.forEach(p => {
        const statusClass = p.qtd <= 2 ? 'baixo' : p.qtd <= 5 ? 'medio' : 'alto';
        const statusTexto = p.qtd <= 2 ? `BAIXO (${p.qtd})` : `${p.qtd} UN`;
        const imagemUrl = p.imagem || '';
        const pString = JSON.stringify(p).replace(/"/g, '&quot;');

        html += `
            <div class="card" style="display:flex; flex-direction:column; padding:0; overflow:hidden; height:100%;">
                ${imagemUrl ? `<div style="width:100%; height:150px; background:linear-gradient(135deg,var(--primary-glow),rgba(255,255,255,0.05)); overflow:hidden;"><img src="${imagemUrl}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23e2e8f0%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E'"></div>` : ''}
                <div style="padding:12px; flex:1; display:flex; flex-direction:column;">
                    <div style="font-weight:700; font-size:13px; margin-bottom:4px;">${p.modelo}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">Cód: ${p.codigo||'S/C'}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">${(p.compatibilidade||[]).slice(0,2).join(', ') || 'Sem compatibilidade'}</div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; font-size:11px;">
                        <div style="background:var(--bg-body); padding:6px; border-radius:4px; text-align:center;">
                            <div style="color:var(--text-muted); font-size:9px;">Custo</div>
                            <div style="font-weight:700; color:var(--primary);">R$ ${p.compra.toFixed(2)}</div>
                        </div>
                        <div style="background:var(--bg-body); padding:6px; border-radius:4px; text-align:center;">
                            <div style="color:var(--text-muted); font-size:9px;">Venda</div>
                            <div style="font-weight:700; color:var(--primary);">R$ ${p.repasse.toFixed(2)}</div>
                        </div>
                    </div>

                    <div style="margin-bottom:12px;">
                        <span class="status-badge bg-${statusClass === 'baixo' ? 'red' : statusClass === 'medio' ? 'yellow' : 'green'}">
                            📦 ${statusTexto}
                        </span>
                    </div>

                    <div style="display:flex; gap:6px; margin-top:auto;">
                        <button class="btn btn-sm btn-primary" style="flex:1;" onclick='abrirVenda("${p.id}",${pString})'><i class="ri-shopping-cart-line"></i> Vender</button>
                        ${userNivel!=='JUNIOR' ? `<button class="btn btn-sm btn-secondary" style="flex:1;" onclick='carregarParaEdicao(${pString})'><i class="ri-pencil-line"></i> Editar</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    containerCards.innerHTML = html;
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
    ['edit-id','modelo','codigo','qtd','compra','taxa_envio','repasse'].forEach(id=>document.getElementById(id).value='');
    document.querySelectorAll('.moto-check').forEach(c=>c.checked=false);
    imagemTemporaria = null;
    limparPreviewImagem();
}

function limparPreviewImagem() {
    const preview = document.getElementById('preview-imagem');
    if (preview) preview.innerHTML = '';
}

// --- RENDERIZAR MOTOS SELETOR ---
function renderizarMotosSeletor() {
    const container = document.getElementById('moto-selector-list');
    if (!container) return;

    let html = '';
    cacheMotos.forEach(m => {
        html += `<label style="margin-right:10px; white-space:nowrap;">
            <input type="checkbox" class="moto-check" value="${m.nome}"> ${m.nome}
        </label>`;
    });
    
    container.innerHTML = html || '<span style="color:var(--text-muted)">Nenhuma moto cadastrada</span>';
}

// --- UPLOAD DE IMAGEM ---
function handleImageUpload(event) {
    const input = event.target;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (!file.type.startsWith('image/')) {
            alert('Selecione uma imagem válida');
            return;
        }

        imagemTemporaria = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('preview-imagem') || criarPreviewImagem();
            preview.innerHTML = `<img src="${e.target.result}" style="max-width:100px; max-height:100px; border-radius:4px; margin-top:10px;">`;
        };
        reader.readAsDataURL(file);
    }
}

function criarPreviewImagem() {
    const div = document.createElement('div');
    div.id = 'preview-imagem';
    const form = document.getElementById('form-cadastro');
    if (form) form.appendChild(div);
    return div;
}

// --- UPLOAD PARA FIREBASE ---
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
    const c = parseFloat(document.getElementById('compra').value)||0;
    const t = parseFloat(document.getElementById('taxa_envio').value)||0;
    const total = c + t;
    const sugerido = total * (1 + (configEmpresa.margem||40)/100);
    document.getElementById('repasse').placeholder = "Sug: R$ " + sugerido.toFixed(2);
}

// --- SALVAR PRODUTO ---
async function salvarProduto() {
    const id = document.getElementById('edit-id').value;
    const modelo = document.getElementById('modelo').value;
    
    if(!modelo) return alert("Nome obrigatório");

    try {
        const motoArr = [];
        document.querySelectorAll('.moto-check:checked').forEach(c=>motoArr.push(c.value));

        let imagemUrl = '';

        // Se houver imagem temporária, fazer upload
        if (imagemTemporaria) {
            const timestamp = Date.now();
            const nomeArquivo = `${timestamp}_${imagemTemporaria.name}`;
            imagemUrl = await uploadImagemFirebase(imagemTemporaria, nomeArquivo);
            
            if (!imagemUrl && !id) {
                return;
            }
        }

        const p = {
            modelo: document.getElementById('modelo').value,
            codigo: document.getElementById('codigo').value,
            qtd: parseInt(document.getElementById('qtd').value)||0,
            compra: parseFloat(document.getElementById('compra').value)||0,
            taxa_envio: parseFloat(document.getElementById('taxa_envio').value)||0,
            repasse: parseFloat(document.getElementById('repasse').value)||0,
            compatibilidade: motoArr,
            imagem: imagemUrl || '',
            timestamp: Date.now()
        };

        if(id) {
            // Se tem imagem nova, atualiza; senão mantém antiga
            if (!imagemUrl) {
                const produtoAntigo = cacheEstoque.find(e => e.id === id);
                if (produtoAntigo) p.imagem = produtoAntigo.imagem;
            }
            
            await db.collection("estoque_kell").doc(id).update(p);
            registrarAuditoria('ESTOQUE', id, 'EDICAO', {modelo: p.modelo});
        } else {
            const doc = await db.collection("estoque_kell").add(p);
            registrarAuditoria('ESTOQUE', doc.id, 'CRIACAO', {modelo: p.modelo});
        }

        toggleFormCadastro();
        Toastify({text:"✅ Produto Salvo!", style:{background: "var(--primary)"}}).showToast();
        imagemTemporaria = null;

    } catch(e) {
        console.error(e);
        alert("Erro: " + e.message);
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

    // Mostrar imagem atual
    if (p.imagem) {
        const preview = document.getElementById('preview-imagem') || criarPreviewImagem();
        preview.innerHTML = `<div style="margin-top:10px;">
            <img src="${p.imagem}" style="max-width:100px; max-height:100px; border-radius:4px;">
            <div style="font-size:11px; color:var(--text-muted); margin-top:5px;">Clique em 'Escolher arquivo' para alterar</div>
        </div>`;
    }

    document.querySelectorAll('.moto-check').forEach(c=>c.checked = (p.compatibilidade||[]).includes(c.value));
    toggleFormCadastro();
    
    setTimeout(() => {
        document.getElementById('form-cadastro').scrollIntoView({behavior: 'smooth'});
    }, 100);
}

// --- ECOMMERCE ---
function renderizarEcommerce() {
    const tbody = document.getElementById('corpo-ecommerce');
    if(!tbody) return;
    let h = '';
    if(typeof cacheEstoque !== 'undefined') {
        cacheEstoque.forEach(p => {
            const custo = (p.compra||0) + (p.taxa_envio||0);
            h += `<tr><td>${p.modelo}</td><td>R$ ${custo.toFixed(2)}</td><td>R$ ${p.repasse.toFixed(2)}</td><td>${p.eco_venda ? 'R$ '+p.eco_venda.toFixed(2) : '--'}</td><td align="right"><button class="btn btn-sm btn-secondary" onclick='abrirAjusteEco("${p.id}")'>Config</button> <button class="btn btn-sm btn-primary" onclick='abrirVendaEco("${p.id}")'>Vender</button></td></tr>`;
        });
    }
    tbody.innerHTML = h;
}

function abrirAjusteEco(id) {
    itemEcoPendente = cacheEstoque.find(i => i.id === id);
    if(!itemEcoPendente) return;
    document.getElementById('label-peca-eco').innerText = itemEcoPendente.modelo;
    document.getElementById('card-calc-eco').style.display = 'block';
    executarCalculoOnline();
}

function executarCalculoOnline() {
    if(!itemEcoPendente) return;
    const b = (parseFloat(itemEcoPendente.compra)||0) + (parseFloat(itemEcoPendente.taxa_envio)||0);
    const e = parseFloat(document.getElementById('calc_emb').value)||0;
    const tx = parseFloat(document.getElementById('calc_taxa_site').value)||0;
    const fix = parseFloat(document.getElementById('calc_taxa_fixa').value)||0;
    const fr = parseFloat(document.getElementById('calc_frete').value)||0;
    const br = parseFloat(document.getElementById('calc_brinde').value)||0;
    const m = parseFloat(document.getElementById('calc_margem_alvo').value)||0;
    
    const sug = (b + e + fr + br + fix + (b*tx/100)) * (1 + m/100);
    document.getElementById('calc_venda').value = "R$ " + sug.toFixed(2);
}

async function salvarPrecoOnline() {
    if (!itemEcoPendente) return;
    const v = parseFloat(document.getElementById('calc_venda').value.replace("R$ ", ""));
    await db.collection("estoque_kell").doc(itemEcoPendente.id).update({ eco_venda: v });
    document.getElementById('card-calc-eco').style.display = 'none';
    Toastify({text: "Atualizado"}).showToast();
}

// --- WHATSAPP ---
function enviarWhatsapp() {
    window.open("https://wa.me/?text="+encodeURIComponent("*REPOSIÇÃO KELL MOTOS*\n"+document.getElementById('lista-reposicao-txt').innerText));
}
