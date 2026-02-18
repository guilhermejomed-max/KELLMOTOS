function renderizarListaMotos() { 
    const list = cacheMotos.map(m=>`<div class="moto-item"><input type="checkbox" class="moto-check" value="${m.nome}"> ${m.nome}</div>`).join('');
    if(document.getElementById('moto-selector-list')) document.getElementById('moto-selector-list').innerHTML=list;
    if(document.getElementById('lista-motos-gerencia')) {
        document.getElementById('lista-motos-gerencia').innerHTML = cacheMotos.map(m=>`<div class="moto-item" style="justify-content:space-between"><span>${m.nome}</span><button class="btn btn-sm btn-danger" onclick="db.collection('motos_kell').doc('${m.id}').delete()">X</button></div>`).join('');
    }
}

async function salvarMoto() { 
    const n = document.getElementById('nova-moto').value; 
    if(n) await db.collection("motos_kell").add({nome:n}); 
    document.getElementById('nova-moto').value=''; 
}

function renderizarListaFuncionarios() { 
    if(document.getElementById('lista-funcionarios')) {
        document.getElementById('lista-funcionarios').innerHTML = cacheFuncionarios.map(f=>`<div class="moto-item" style="justify-content:space-between"><span>${f.nome} <small style="color:var(--primary)">(${f.nivel})</small></span><button class="btn btn-sm btn-danger" onclick="db.collection('funcionarios_kell').doc('${f.id}').delete()">Remover</button></div>`).join(''); 
    }
}

async function salvarFuncionario() {
    const n = document.getElementById('func-nome').value;
    const s = document.getElementById('func-sobrenome').value;
    const nv = document.getElementById('func-nivel').value;
    
    if(!n) return;
    const email = formatUsername(n+"."+s);
    await db.collection("funcionarios_kell").doc(email).set({email, nome:n, nivel:nv});
    Toastify({text:"Acesso liberado: "+email, style:{background:"var(--primary)"}}).showToast();
}

function atualizarConfigUI() {
    if(!document.getElementById('cfg-nome')) return;
    document.getElementById('cfg-nome').value = configEmpresa.nome || "";
    document.getElementById('cfg-cnpj').value = configEmpresa.cnpj || "";
    document.getElementById('cfg-endereco').value = configEmpresa.endereco || "";
    document.getElementById('cfg-telefone').value = configEmpresa.telefone || "";
    
    document.getElementById('cfg-imposto').value = configEmpresa.imposto_medio || 0;
    document.getElementById('cfg-taxa-cartao').value = configEmpresa.taxa_cartao || 0;
    document.getElementById('cfg-custo-fixo').value = configEmpresa.custo_fixo_medio || 0;
    document.getElementById('cfg-margem').value = configEmpresa.margem || 0;
    document.getElementById('cfg-margem-eco').value = configEmpresa.margemEco || 0;
}

async function salvarConfigGeral() {
    const cfg = {
        nome: document.getElementById('cfg-nome').value, 
        cnpj: document.getElementById('cfg-cnpj').value,
        endereco: document.getElementById('cfg-endereco').value, 
        telefone: document.getElementById('cfg-telefone').value,
        margem: parseFloat(document.getElementById('cfg-margem').value)||0, 
        margemEco: parseFloat(document.getElementById('cfg-margem-eco').value)||0,
        imposto_medio: parseFloat(document.getElementById('cfg-imposto').value)||0,
        taxa_cartao: parseFloat(document.getElementById('cfg-taxa-cartao').value)||0,
        custo_fixo_medio: parseFloat(document.getElementById('cfg-custo-fixo').value)||0
    };
    
    await db.collection("config_kell").doc("empresa").set(cfg);
    registrarAuditoria('CONFIG', 'empresa', 'ATUALIZACAO_GERAL', {usuario: auth.currentUser.email});
    toggleConfig();
    Toastify({text:"Configurações Salvas!", style:{background: "var(--primary)"}}).showToast();
}