function renderizarListaMotos() { 
    const selecionadas = new Set(
        Array.from(document.querySelectorAll('.moto-check:checked')).map(el => el.value)
    );
    const busca = (document.getElementById('busca-moto-cadastro')?.value || '').toLowerCase().trim();
    const motosFiltradas = cacheMotos.filter(m => (m.nome || '').toLowerCase().includes(busca));
    const list = motosFiltradas.length
        ? motosFiltradas.map(m=>`<div class="moto-item"><label style="display:flex; align-items:center; gap:8px; width:100%; cursor:pointer;"><input type="checkbox" class="moto-check" value="${m.nome}" ${selecionadas.has(m.nome) ? 'checked' : ''}> <span>${m.nome}</span></label></div>`).join('')
        : '<div style="padding:10px 4px; color:var(--text-muted); text-align:center;">Nenhuma moto encontrada.</div>';
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
        document.getElementById('lista-funcionarios').innerHTML = cacheFuncionarios.map(f=>`<div class="moto-item" style="justify-content:space-between"><span>${f.nome} <small style="color:var(--primary)">(${f.nivel})</small><br><small style="font-size:9px; color:#999">${f.email}</small></span><button class="btn btn-sm btn-danger" onclick="db.collection('funcionarios_kell').doc('${f.id}').delete()">Remover</button></div>`).join(''); 
    }
}

async function salvarFuncionario() {
    const n = document.getElementById('func-nome').value;
    const s = document.getElementById('func-sobrenome').value;
    const nv = document.getElementById('func-nivel').value;
    
    // Validação para evitar logins quebrados
    if(!n || n.trim().length < 2) return alert("Erro: O Nome é obrigatório.");
    if(!s || s.trim().length < 2) return alert("Erro: O Sobrenome é obrigatório para gerar o login.");
    
    // Combina nome e sobrenome
    const nomeCompleto = n.trim() + " " + s.trim();
    
    // Gera o login usando a função global do core.js (que remove acentos e formata)
    // Se formatUsername não estiver disponível por algum erro, faz um fallback simples
    let email = "";
    if (typeof formatUsername === "function") {
        email = formatUsername(nomeCompleto);
    } else {
        // Fallback de segurança caso o core.js tenha falhado
        let clean = nomeCompleto.toLowerCase().replace(/\s+/g, '.').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        email = clean + "@kellmotos.com.br";
    }
    
    try {
        await db.collection("funcionarios_kell").doc(email).set({
            email: email, 
            nome: nomeCompleto, 
            nivel: nv,
            criado_em: Date.now()
        });
        
        const loginVisual = email.split('@')[0];
        
        alert(`✅ FUNCIONÁRIO LIBERADO!\n\nNome: ${nomeCompleto}\nNível: ${nv}\n\n👉 LOGIN DE ACESSO: ${loginVisual}\n\nInforme este login ao funcionário. Ele deve ir em "Alternar Modo" > "CRIAR SENHA" e usar exatamente este login.`);
        
        // Limpa campos
        document.getElementById('func-nome').value = '';
        document.getElementById('func-sobrenome').value = '';
        
    } catch (e) {
        alert("Erro ao registrar no banco: " + e.message);
    }
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
    // Verifica se registrarAuditoria existe
    if(typeof registrarAuditoria === "function") {
        registrarAuditoria('CONFIG', 'empresa', 'ATUALIZACAO_GERAL', {usuario: auth.currentUser.email});
    }
    toggleConfig();
    Toastify({text:"Configurações Salvas!", style:{background: "var(--primary)"}}).showToast();
}
