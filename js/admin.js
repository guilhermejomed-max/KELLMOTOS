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

document.addEventListener('DOMContentLoaded', () => {
    const nivel = document.getElementById('func-nivel');
    if (nivel && !nivel.dataset.bindedPermissoes) {
        nivel.addEventListener('change', aplicarPresetPermissoesEquipe);
        nivel.dataset.bindedPermissoes = 'true';
    }
    aplicarPresetPermissoesEquipe();
});

async function salvarMoto() { 
    const n = document.getElementById('nova-moto').value; 
    if(n) await db.collection("motos_kell").add({nome:n}); 
    document.getElementById('nova-moto').value=''; 
}

function aplicarPresetPermissoesEquipe() {
    const nivel = document.getElementById('func-nivel')?.value || 'JUNIOR';
    const checks = document.querySelectorAll('.acao-permissao-check');
    const presets = {
        JUNIOR: ['gerenciar_os'],
        PLENO: ['ver_custo','editar_preco','ajustar_estoque','publicar_anuncio','gerenciar_os','exportar_relatorios'],
        SENIOR: ['ver_custo','editar_preco','excluir_orcamento','ajustar_estoque','publicar_anuncio','gerenciar_equipe','ver_auditoria','gerenciar_os','exportar_relatorios']
    };
    const ativos = presets[nivel] || [];
    checks.forEach(check => {
        check.checked = ativos.includes(check.value);
    });
}

function obterAcoesTexto(funcionario) {
    const lista = Array.isArray(funcionario?.acoes_permitidas) ? funcionario.acoes_permitidas : [];
    return lista.length ? lista.join(', ') : 'Sem ações extras';
}

function abrirPerfilFuncionario(id) {
    const funcionario = (cacheFuncionarios || []).find(item => item.id === id);
    if (!funcionario) return alert('Funcionário não encontrado.');

    const box = document.getElementById('perfil-funcionario-conteudo');
    const modal = document.getElementById('modal-perfil-funcionario');
    if (!box || !modal) return;

    box.innerHTML = `
        <div class="modal-subtle-box">
            <div style="font-size:22px; font-weight:800; color:var(--text-main); margin-bottom:6px;">${funcionario.nome || 'Sem nome'}</div>
            <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">${funcionario.email || funcionario.id}</div>
            <div class="form-grid-2">
                <div class="modal-subtle-box"><div class="modal-section-title">Nível</div><div style="font-weight:800; color:var(--text-main);">${funcionario.nivel || 'JUNIOR'}</div></div>
                <div class="modal-subtle-box"><div class="modal-section-title">Criado em</div><div style="font-weight:800; color:var(--text-main);">${funcionario.criado_em ? new Date(funcionario.criado_em).toLocaleString('pt-BR') : '--'}</div></div>
            </div>
            <div class="modal-section-title" style="margin-top:18px;">Permissões por ação</div>
            <div style="font-size:13px; color:var(--text-main); line-height:1.7; margin-top:8px;">${obterAcoesTexto(funcionario)}</div>
        </div>
    `;
    modal.style.display = 'flex';
}

function renderizarAuditoria() {
    const corpo = document.getElementById('corpo-auditoria');
    if (!corpo) return;
    const busca = (document.getElementById('auditoria-busca')?.value || '').toLowerCase().trim();
    const lista = (cacheAuditoria || []).filter(item => {
        if (!busca) return true;
        return [item.usuario, item.colecao, item.acao, JSON.stringify(item.detalhes || {})].join(' ').toLowerCase().includes(busca);
    });

    corpo.innerHTML = lista.length ? lista.map(item => `
        <tr>
            <td>${item.data || '--'}</td>
            <td>${item.usuario || '--'}</td>
            <td>${item.colecao || '--'}</td>
            <td><span class="status-badge bg-green">${item.acao || '--'}</span></td>
            <td style="font-size:12px; color:var(--text-muted);">${Object.entries(item.detalhes || {}).map(([chave, valor]) => `${chave}: ${typeof valor === 'object' ? JSON.stringify(valor) : valor}`).join(' • ') || '--'}</td>
        </tr>
    `).join('') : '<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--text-muted);">Nenhum log encontrado.</td></tr>';
}

function exportarAuditoriaCSV() {
    if (!podeExecutarAcao('exportar_relatorios')) return alert('Você não tem permissão para exportar relatórios.');
    const linhas = [['Data','Usuário','Coleção','Ação','Detalhes']];
    (cacheAuditoria || []).forEach(item => {
        linhas.push([
            item.data || '',
            item.usuario || '',
            item.colecao || '',
            item.acao || '',
            JSON.stringify(item.detalhes || {})
        ]);
    });
    baixarCSV('auditoria_kell.csv', linhas);
}

async function removerFuncionario(id) {
    if (!podeExecutarAcao('gerenciar_equipe')) return alert('Você não tem permissão para remover funcionários.');
    if (!confirm('Remover este funcionário da equipe?')) return;
    await db.collection('funcionarios_kell').doc(id).delete();
    if (typeof registrarAuditoria === "function") {
        registrarAuditoria('EQUIPE', id, 'REMOCAO', { removido_por: auth.currentUser.email });
    }
}

function renderizarListaFuncionarios() { 
    const lista = document.getElementById('lista-funcionarios');
    if(!lista) return;
    lista.innerHTML = cacheFuncionarios.map(f=>`
        <div class="modal-subtle-box" style="margin-top:12px;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                <div>
                    <div style="font-weight:800; color:var(--text-main)">${f.nome || 'Sem nome'} <small style="color:var(--primary)">(${f.nivel || 'JUNIOR'})</small></div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${f.email || f.id}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:8px;"><b>Ações:</b> ${obterAcoesTexto(f)}</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-sm btn-secondary" onclick="abrirPerfilFuncionario('${f.id}')">Perfil</button>
                    ${podeExecutarAcao('gerenciar_equipe') ? `<button class="btn btn-sm btn-danger" onclick="removerFuncionario('${f.id}')">Remover</button>` : ''}
                </div>
            </div>
        </div>
    `).join(''); 
}

async function salvarFuncionario() {
    if (!podeExecutarAcao('gerenciar_equipe')) return alert('Você não tem permissão para gerenciar a equipe.');
    const n = document.getElementById('func-nome').value;
    const s = document.getElementById('func-sobrenome').value;
    const nv = document.getElementById('func-nivel').value;
    const acoesPermitidas = Array.from(document.querySelectorAll('.acao-permissao-check:checked')).map(el => el.value);
    
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
            acoes_permitidas: acoesPermitidas,
            criado_em: Date.now()
        });
        if(typeof registrarAuditoria === "function") {
            registrarAuditoria('EQUIPE', email, 'LIBERACAO', { nome: nomeCompleto, nivel: nv, acoes: acoesPermitidas });
        }
        
        const loginVisual = email.split('@')[0];
        
        alert(`✅ FUNCIONÁRIO LIBERADO!\n\nNome: ${nomeCompleto}\nNível: ${nv}\n\n👉 LOGIN DE ACESSO: ${loginVisual}\n\nInforme este login ao funcionário. Ele deve ir em "Alternar Modo" > "CRIAR SENHA" e usar exatamente este login.`);
        
        // Limpa campos
        document.getElementById('func-nome').value = '';
        document.getElementById('func-sobrenome').value = '';
        aplicarPresetPermissoesEquipe();
        
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
