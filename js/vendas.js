let vendaPendente = null;
let itemEcoPendente = null;

// --- RENDERIZAÇÃO DA LISTA DE VENDAS ---
function renderizarVendas() {
    const tbody = document.getElementById('corpo-vendas');
    if (!tbody) return; 

    let h = '';
    const lista = (typeof cacheVendas !== 'undefined') ? cacheVendas : [];

    lista.slice(0, 50).forEach(v => {
        const numero = v.numero || '---';
        const origem = v.origem || 'BALCAO';
        const cliente = v.cliente || 'Consumidor';
        const peca = v.peca || 'Item Indefinido';
        const valor = parseFloat(v.venda || 0).toFixed(2);
        const vendaSafe = JSON.stringify(v).replace(/"/g, '&quot;');

        h += `<tr>
            <td><b style="color:var(--primary)">#${numero}</b></td>
            <td><span class="status-badge" style="background:rgba(0,0,0,0.05)">${origem}</span></td>
            <td>${cliente}</td>
            <td>${peca}</td>
            <td>R$ ${valor}</td>
            <td style="text-align:right">
                <button class="btn btn-sm btn-secondary" onclick='gerarCupom(${vendaSafe})'><i class="ri-printer-line"></i></button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = h;
}

// --- FLUXO DE VENDA ---
function abrirVenda(id, p) { 
    vendaPendente = { ...p, id, origem: 'BALCAO' }; 
    document.getElementById('m-qtd-titulo').innerText = p.modelo; 
    document.getElementById('venda-qtd-input').value = 1; 
    document.getElementById('modal-qtd').style.display = 'flex'; 
}

function abrirVendaEco(id) { 
    const p = cacheEstoque.find(i => i.id === id); 
    if (!p.eco_venda) return alert("Configure preço online"); 
    vendaPendente = { ...p, id, repasse: p.eco_venda, origem: 'ECO' }; 
    document.getElementById('m-qtd-titulo').innerText = p.modelo + " (WEB)"; 
    document.getElementById('venda-qtd-input').value = 1; 
    document.getElementById('modal-qtd').style.display = 'flex'; 
}

function abrirModalCliente() { 
    vendaPendente.qtdVenda = parseInt(document.getElementById('venda-qtd-input').value) || 1; 
    fecharModais(); 
    document.getElementById('modal-cliente').style.display = 'flex'; 
}

function mostrarSelecaoCliente() { 
    const isBoleto = document.getElementById('cli-pgto').value === 'BOLETO';
    document.getElementById('selecao-cliente-boleto').style.display = isBoleto ? 'block' : 'none'; 
}

async function confirmarVenda() {
    if (!vendaPendente) return;
    const ref = db.collection("estoque_kell").doc(vendaPendente.id);
    const cliNome = document.getElementById('cli-nome').value || "Consumidor";
    const pgto = document.getElementById('cli-pgto').value;
    
    try {
        const res = await db.runTransaction(async t => {
            const doc = await t.get(ref);
            if (!doc.exists) throw "Produto não encontrado";
            if (doc.data().qtd < vendaPendente.qtdVenda) throw "Sem estoque";
            
            const seqRef = db.collection("config_kell").doc("sequencial");
            const sDoc = await t.get(seqRef);
            const num = (sDoc.exists ? sDoc.data().ultimoPedido : 0) + 1;
            
            const total = vendaPendente.qtdVenda * vendaPendente.repasse;
            const custo = vendaPendente.qtdVenda * doc.data().compra;
            const lucro = total - custo;

            const venda = {
                numero: num, peca: vendaPendente.modelo, qtd: vendaPendente.qtdVenda,
                venda: total, unitario: vendaPendente.repasse,
                cliente: cliNome, pagamento: pgto, 
                data: new Date().toLocaleDateString('pt-BR'), hora: new Date().toLocaleTimeString('pt-BR'),
                timestamp: Date.now(), origem: vendaPendente.origem, operador: auth.currentUser.email,
                financeiro: { custo_prod: custo, lucro_liquido: lucro },
                lucro: lucro, pagamento_efetivado: true
            };

            if(pgto === 'BOLETO') {
                const cliId = document.getElementById('cli-boleto-select').value;
                if(cliId) {
                    const cDoc = await t.get(db.collection("clientes_kell").doc(cliId));
                    venda.cliente = cDoc.data().nome; venda.clienteId = cliId; venda.pagamento_efetivado = false;
                    t.update(db.collection("clientes_kell").doc(cliId), { debito: firebase.firestore.FieldValue.increment(total) });
                }
            }

            t.update(ref, { qtd: doc.data().qtd - vendaPendente.qtdVenda });
            t.set(seqRef, { ultimoPedido: num }, { merge: true });
            t.set(db.collection("vendas_kell").doc(), venda);
            return venda;
        });
        
        fecharModais(); gerarCupom(res); 
        Toastify({text: "Venda OK!", style: {background: "green"}}).showToast();
    } catch(e) { alert(e); }
}

// --- CUPOM TÉRMICO COM ALTURA DINÂMICA (CORREÇÃO DE CORTE) ---
function gerarCupom(v) {
    document.getElementById('cp-empresa-nome').innerText = configEmpresa.nome;
    document.getElementById('cp-empresa-end').innerText = configEmpresa.endereco || "";
    document.getElementById('cp-empresa-cnpj').innerText = configEmpresa.cnpj;
    document.getElementById('cp-empresa-tel').innerText = configEmpresa.telefone || "";
    document.getElementById('cp-num').innerText = "#" + v.numero;
    document.getElementById('cp-data').innerText = v.data + ' ' + v.hora;
    document.getElementById('cp-cli').innerText = v.cliente.slice(0, 30);
    
    document.getElementById('cp-itens').innerHTML = `
        <tr>
            <td style="padding:2px 0;">${v.peca.slice(0, 25)}</td>
            <td align="center">${v.qtd}</td>
            <td align="right">${v.venda.toFixed(2)}</td>
        </tr>
    `;
    
    document.getElementById('cp-total').innerText = "R$ " + v.venda.toFixed(2);
    document.getElementById('cp-pgto').innerText = v.pagamento;
    document.getElementById('cp-operador').innerText = (v.operador || 'sis').split('@')[0];
    
    document.getElementById('qrcode-venda').innerHTML = "";
    new QRCode(document.getElementById('qrcode-venda'), { text: "PED-" + v.numero, width: 80, height: 80 });

    const wrapper = document.getElementById('cupom-wrapper');
    const element = document.getElementById('cupom-print');
    wrapper.style.display = 'flex';
    
    setTimeout(() => {
        // CÁLCULO DA ALTURA EXATA PARA NÃO CORTAR
        const contentHeight = element.offsetHeight;
        // Converte pixels para mm (aprox) + 10mm de margem de segurança no final
        const heightInMm = (contentHeight * 0.264583) + 10; 

        const opt = {
            margin: 0, 
            filename: `Recibo_${v.numero}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, scrollY: 0 }, 
            // AQUI ESTÁ A CORREÇÃO: Altura dinâmica baseada no conteúdo
            jsPDF: { unit: 'mm', format: [80, heightInMm] } 
        };
        
        html2pdf().from(element).set(opt).save()
            .then(() => wrapper.style.display = 'none');
    }, 500);
}

// --- E-COMMERCE ---
function renderizarEcommerce() {
    const tbody = document.getElementById('corpo-ecommerce');
    if(!tbody) return;
    let h = '';
    if(typeof cacheEstoque !== 'undefined') {
        cacheEstoque.forEach(p => {
            const custo = (p.compra || 0) + (p.taxa_envio || 0);
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