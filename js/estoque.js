function renderizarEstoque() {
    const q = document.getElementById('busca').value.toLowerCase();
    let h = '';
    
    const filtered = cacheEstoque.filter(p=>
        p.modelo.toLowerCase().includes(q) || 
        (p.codigo||'').toLowerCase().includes(q) || 
        (p.compatibilidade||[]).join(' ').toLowerCase().includes(q)
    );
    
    // Ordenação Curva ABC Simplificada (Valor Total Estoque)
    filtered.sort((a,b) => (b.compra * b.qtd) - (a.compra * a.qtd));

    if(filtered.length === 0) {
        h = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted)">Nenhum produto encontrado.</td></tr>';
    } else {
        filtered.forEach(p => {
            const badge = p.qtd<=2 
                ? `<span class="status-badge bg-red"><i class="ri-alarm-warning-line"></i> BAIXO (${p.qtd})</span>` 
                : `<span class="status-badge bg-green">${p.qtd} UN</span>`;
            
            // Passa objeto como string segura para evitar erro de aspas
            const pString = JSON.stringify(p).replace(/"/g, '&quot;');

            h += `<tr>
                <td>
                    <b>${p.modelo}</b><br>
                    <small style="color:var(--text-muted); font-size:11px">${p.codigo||'S/C'}</small>
                </td>
                <td style="font-size:12px">${(p.compatibilidade||[]).slice(0,3).join(', ')}...</td>
                <td>${badge}</td>
                <td style="font-weight:700">R$ ${p.repasse.toFixed(2)}</td>
                <td style="text-align:right">
                    <button class="btn btn-sm btn-primary" onclick='abrirVenda("${p.id}",${pString})'><i class="ri-shopping-cart-line"></i></button>
                    ${userNivel!=='JUNIOR' ? `<button class="btn btn-sm btn-secondary" onclick='carregarParaEdicao(${pString})'><i class="ri-pencil-line"></i></button>`:''}
                </td>
            </tr>`;
        });
    }
    document.getElementById('corpo-estoque').innerHTML = h;
    
    // Relatório de faltas
    const faltas = cacheEstoque.filter(i=>i.qtd<=2).map(i=>`• ${i.modelo} (Atual: ${i.qtd})`).join('\n');
    if(document.getElementById('lista-reposicao-txt')) {
        document.getElementById('lista-reposicao-txt').innerText = faltas || "Estoque OK.";
    }
}

function toggleFormCadastro() { 
    const f = document.getElementById('form-cadastro'); 
    f.classList.toggle('hidden'); 
    if(!f.classList.contains('hidden')) limparFormEstoque();
}

function limparFormEstoque() { 
    ['edit-id','modelo','codigo','qtd','compra','taxa_envio','repasse'].forEach(id=>document.getElementById(id).value=''); 
    document.querySelectorAll('.moto-check').forEach(c=>c.checked=false);
}

function calcularSugerido() { 
    const c = parseFloat(document.getElementById('compra').value)||0; 
    document.getElementById('repasse').placeholder = "Sug: R$ " + (c * (1 + (configEmpresa.margem||40)/100)).toFixed(2);
}

async function salvarProduto() {
    const id = document.getElementById('edit-id').value;
    const motoArr = []; 
    document.querySelectorAll('.moto-check:checked').forEach(c=>motoArr.push(c.value));
    
    const p = {
        modelo: document.getElementById('modelo').value, 
        codigo: document.getElementById('codigo').value,
        qtd: parseInt(document.getElementById('qtd').value)||0, 
        compra: parseFloat(document.getElementById('compra').value)||0,
        taxa_envio: parseFloat(document.getElementById('taxa_envio').value)||0, 
        repasse: parseFloat(document.getElementById('repasse').value)||0,
        compatibilidade: motoArr, 
        timestamp: Date.now()
    };

    if(!p.modelo) return alert("Nome obrigatório");

    try {
        if(id) {
            await db.collection("estoque_kell").doc(id).update(p);
            registrarAuditoria('ESTOQUE', id, 'EDICAO', {modelo: p.modelo});
        } else {
            const doc = await db.collection("estoque_kell").add(p);
            registrarAuditoria('ESTOQUE', doc.id, 'CRIACAO', {modelo: p.modelo});
        }
        toggleFormCadastro(); 
        Toastify({text:"Produto Salvo!", style:{background: "var(--primary)"}}).showToast();
    } catch(e) { console.error(e); }
}

function carregarParaEdicao(p) {
    document.getElementById('edit-id').value=p.id; 
    document.getElementById('modelo').value=p.modelo;
    document.getElementById('codigo').value=p.codigo; 
    document.getElementById('qtd').value=p.qtd;
    document.getElementById('compra').value=p.compra; 
    document.getElementById('taxa_envio').value=p.taxa_envio;
    document.getElementById('repasse').value=p.repasse;
    
    document.querySelectorAll('.moto-check').forEach(c=>c.checked = (p.compatibilidade||[]).includes(c.value));
    toggleFormCadastro();
}

function enviarWhatsapp() { 
    window.open("https://wa.me/?text="+encodeURIComponent("*REPOSIÇÃO KELL MOTOS*\n"+document.getElementById('lista-reposicao-txt').innerText)); 
}