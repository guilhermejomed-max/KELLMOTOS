let chartF = null;
let listaItensNF = [];
let clienteExtratoAtual = null;

function obterNomeProdutoFinanceiro(produto) {
    if (!produto) return 'Produto';
    const partes = [produto.marca, produto.nome_peca]
        .map(valor => String(valor || '').trim())
        .filter(Boolean);
    return partes.join(' ') || produto.modelo || produto.nome || 'Produto';
}

// =========================
// CLIENTES NO SELECT DO FIADO
// =========================
function atualizarSelectClientes() {
    const select = document.getElementById('cli-boleto-select');
    if (!select) return;

    const clientes = (typeof cacheClientes !== 'undefined' && Array.isArray(cacheClientes))
        ? [...cacheClientes]
        : [];

    clientes.sort((a, b) => {
        const nomeA = (a.nome || '').toLowerCase();
        const nomeB = (b.nome || '').toLowerCase();
        return nomeA.localeCompare(nomeB, 'pt-BR');
    });

    let html = `<option value="">Selecione um cliente</option>`;

    clientes.forEach(c => {
        const nome = c.nome || 'Cliente sem nome';
        const cpf = c.cpf ? ` • CPF: ${c.cpf}` : '';
        const telefone = c.telefone ? ` • Tel: ${c.telefone}` : '';
        html += `<option value="${c.id}">${nome}${cpf}${telefone}</option>`;
    });

    select.innerHTML = html;
}

// =========================
// DASHBOARD KPI
// =========================
function atualizarKPIs() {
    const hj = new Date().toLocaleDateString('pt-BR');
    let fat = 0, luc = 0, est = 0, vendasHoje = 0;

    const vendas = (typeof cacheVendas !== 'undefined' && Array.isArray(cacheVendas)) ? cacheVendas.filter(v => v.tipo !== 'ORCAMENTO') : [];
    const estoque = (typeof cacheEstoque !== 'undefined' && Array.isArray(cacheEstoque)) ? cacheEstoque : [];
    const clientes = (typeof cacheClientes !== 'undefined' && Array.isArray(cacheClientes)) ? cacheClientes : [];

    vendas.forEach(v => {
        if (v.data === hj) {
            fat += (parseFloat(v.venda) || 0);
            luc += (parseFloat(v.lucro) || 0);
            vendasHoje += 1;
        }
    });

    estoque.forEach(p => est += ((parseFloat(p.compra) || 0) * (parseFloat(p.qtd) || 0)));
    const ticketMedio = vendasHoje ? (fat / vendasHoje) : 0;
    const baixoEstoque = estoque.filter(p => (parseInt(p.qtd) || 0) <= 2);
    const clientesFiado = clientes.filter(c => (parseFloat(c.debito) || 0) > 0);

    if (document.getElementById('kpi-faturamento'))
        document.getElementById('kpi-faturamento').innerHTML =
            `R$ <span class="blur-sensitive">${fat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;

    if (document.getElementById('kpi-lucro'))
        document.getElementById('kpi-lucro').innerHTML =
            `R$ <span class="blur-sensitive">${luc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;

    if (document.getElementById('kpi-estoque'))
        document.getElementById('kpi-estoque').innerHTML =
            `R$ <span class="blur-sensitive">${est.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;

    if (document.getElementById('kpi-ticket-medio'))
        document.getElementById('kpi-ticket-medio').innerHTML =
            `R$ <span class="blur-sensitive">${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`;

    if (document.getElementById('kpi-vendas-hoje'))
        document.getElementById('kpi-vendas-hoje').innerText = vendasHoje;

    if (document.getElementById('kpi-baixo-estoque'))
        document.getElementById('kpi-baixo-estoque').innerText = `${baixoEstoque.length} itens`;

    if (document.getElementById('kpi-baixo-estoque-side'))
        document.getElementById('kpi-baixo-estoque-side').innerText = baixoEstoque.length;

    if (document.getElementById('kpi-clientes-fiado'))
        document.getElementById('kpi-clientes-fiado').innerText = clientesFiado.length;

    if (document.getElementById('dash-resumo-data'))
        document.getElementById('dash-resumo-data').innerText = hj;

    const resumoOperacao = document.getElementById('dash-resumo-operacao');
    if (resumoOperacao) {
        resumoOperacao.innerText = `Hoje foram ${vendasHoje} venda(s), ticket médio de R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} e ${baixoEstoque.length} item(ns) pedindo reposição.`;
    }

    const counts = {};
    vendas.forEach(v => {
        if (Array.isArray(v.itens) && v.itens.length) {
            v.itens.forEach(item => {
                const nome = item.nome || item.peca || 'Item';
                counts[nome] = (counts[nome] || 0) + (parseInt(item.qtd) || 0);
            });
            return;
        }

        const n = v.peca || 'Item';
        counts[n] = (counts[n] || 0) + (parseInt(v.qtd) || 0);
    });

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const elLista = document.getElementById('top-produtos-lista');
    if (elLista) {
        elLista.innerHTML = top.length ? top.map((t, i) => `
            <div class="dashboard-list-row">
                <span><b style="color:var(--primary)">${i + 1}.</b> ${t[0]}</span>
                <span class="status-badge bg-green">${t[1]} un</span>
            </div>
        `).join('') : '<div class="dashboard-empty-state">Sem vendas registradas.</div>';
    }

    const alertasEl = document.getElementById('dash-alertas-lista');
    if (alertasEl) {
        const alertas = [];
        baixoEstoque.slice(0, 4).forEach(item => {
            alertas.push({
                titulo: obterNomeProdutoFinanceiro(item),
                detalhe: `Estoque atual: ${parseInt(item.qtd) || 0} unidade(s)`,
                tipo: 'warning'
            });
        });
        clientesFiado.slice(0, 2).forEach(cliente => {
            alertas.push({
                titulo: cliente.nome || 'Cliente',
                detalhe: `Fiado em aberto: R$ ${(parseFloat(cliente.debito) || 0).toFixed(2)}`,
                tipo: 'finance'
            });
        });

        alertasEl.innerHTML = alertas.length ? alertas.map(alerta => `
            <div class="dashboard-alert-item ${alerta.tipo}">
                <strong>${alerta.titulo}</strong>
                <span>${alerta.detalhe}</span>
            </div>
        `).join('') : '<div class="dashboard-empty-state">Nenhum alerta importante no momento.</div>';
    }
}

// =========================
// GRÁFICOS
// =========================
function renderizarGraficos() {
    const canvas = document.getElementById('chart-fat');
    if (!canvas) return;
    if (canvas.clientHeight === 0) return;

    const ctx = canvas.getContext('2d');

    if (chartF) {
        chartF.destroy();
        chartF = null;
    }

    const labels = [];
    const dataValues = [];
    const vendas = (typeof cacheVendas !== 'undefined' && Array.isArray(cacheVendas)) ? cacheVendas.filter(v => v.tipo !== 'ORCAMENTO') : [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dataStr = d.toLocaleDateString('pt-BR');

        labels.push(dataStr.slice(0, 5));

        const totalDia = vendas
            .filter(v => v.data === dataStr)
            .reduce((acc, curr) => acc + (parseFloat(curr.venda) || 0), 0);

        dataValues.push(totalDia);
    }

    chartF = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento (R$)',
                data: dataValues,
                backgroundColor: '#10b981',
                borderRadius: 6,
                barThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        callback: function (value) { return 'R$ ' + value; }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// =========================
// EXTRATO COMPLETO
// =========================
function abrirExtratoCompleto(id, dataInicio = "", dataFim = "") {
    clienteExtratoAtual = id;
    const cl = cacheClientes.find(c => c.id === id);
    if (!cl) return;

    let vendas = cacheVendas.filter(v => v.clienteId === id);

    if (dataInicio || dataFim) {
        vendas = vendas.filter(v => {
            const partes = v.data.split('/');
            const dataVenda = new Date(partes[2], partes[1] - 1, partes[0]);

            const dInicio = dataInicio ? new Date(dataInicio) : new Date(0);
            const dFim = dataFim ? new Date(dataFim) : new Date();
            dFim.setHours(23, 59, 59);

            return dataVenda >= dInicio && dataVenda <= dFim;
        });
    }

    vendas.sort((a, b) => b.timestamp - a.timestamp);

    let totalComprado = 0, totalPago = 0, totalDevendo = 0, htmlLinhas = '';

    vendas.forEach(v => {
        const valor = parseFloat(v.venda) || 0;
        totalComprado += valor;
        if (v.pagamento_efetivado) totalPago += valor;
        else totalDevendo += valor;

        const statusBadge = v.pagamento_efetivado
            ? `<span style="color:#059669; font-weight:bold; background:#d1fae5; padding:2px 6px; border-radius:4px; font-size:10px;">PAGO</span>`
            : `<span style="color:#dc2626; font-weight:bold; background:#fee2e2; padding:2px 6px; border-radius:4px; font-size:10px;">ABERTO</span>`;

        const podeSelecionar = !v.pagamento_efetivado;

        htmlLinhas += `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:6px; font-size:11px;">${v.data}<br><span style="color:#999; font-size:9px;">${v.hora}</span></td>
            <td style="padding:6px; font-size:11px; color:#334155;">${v.peca}</td>
            <td style="padding:6px; text-align:right; font-size:11px; font-weight:bold;">R$ <span class="blur-sensitive">${valor.toFixed(2)}</span></td>
            <td style="padding:6px; text-align:center;">${statusBadge}</td>
            <td style="padding:6px; text-align:center;">
                ${podeSelecionar ? `<input type="checkbox" class="checkbox-liquidacao" data-venda-id="${v.id}" data-valor="${valor.toFixed(2)}" onchange="atualizarResumoLiquidacao()">` : '-'}
            </td>
        </tr>`;
    });

    const saldoFinal = cl.debito > 0 ? cl.debito : totalDevendo;

    document.getElementById('extrato-visualizacao').innerHTML = `
        <div style="padding:20px; font-family:'Plus Jakarta Sans', sans-serif; width:100%; box-sizing:border-box;">

            <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #0f172a; padding-bottom:15px;">
                <h2 style="margin:0; color:#0f172a; font-size:22px; text-transform:uppercase; letter-spacing:-0.5px;">${configEmpresa.nome}</h2>
                <div style="font-size:11px; color:#64748b; margin-top:5px; line-height:1.4;">
                    ${configEmpresa.endereco ? configEmpresa.endereco + ' • ' : ''}
                    CNPJ: ${configEmpresa.cnpj || 'Não Informado'}<br>
                    Tel: ${configEmpresa.telefone || 'Não Informado'}
                </div>
                <div style="margin-top:10px; font-weight:800; font-size:12px; color:#0f172a; border:1px solid #0f172a; display:inline-block; padding:4px 12px; border-radius:20px; text-transform:uppercase;">
                    Extrato de Débitos / Promissória
                </div>
            </div>

            <div data-html2canvas-ignore="true" class="no-print" style="display:flex; gap:5px; margin-bottom:20px; background:#f1f5f9; padding:8px; border-radius:8px; align-items:flex-end; border:1px solid #e2e8f0;">
                <div style="flex:1;">
                    <label style="font-size:9px; font-weight:bold; color:#64748b; display:block;">DE:</label>
                    <input type="date" id="filtro-extrato-inicio" class="input-style" style="margin:0; padding:4px; height:28px; font-size:11px;" value="${dataInicio}">
                </div>
                <div style="flex:1;">
                    <label style="font-size:9px; font-weight:bold; color:#64748b; display:block;">ATÉ:</label>
                    <input type="date" id="filtro-extrato-fim" class="input-style" style="margin:0; padding:4px; height:28px; font-size:11px;" value="${dataFim}">
                </div>
                <button class="btn btn-primary" style="padding:0 10px; height:28px; font-size:11px;" onclick="aplicarFiltroExtrato()">Filtrar</button>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:20px;">
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <tr>
                        <td style="color:#64748b; font-weight:bold; width:80px; padding-bottom:4px;">CLIENTE:</td>
                        <td style="font-weight:bold; color:#0f172a; font-size:13px; padding-bottom:4px;">${cl.nome}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:bold; padding-bottom:4px;">CPF:</td>
                        <td style="color:#334155; padding-bottom:4px;">${cl.cpf || 'Não informado'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:bold; padding-bottom:4px;">CONTATO:</td>
                        <td style="color:#334155; padding-bottom:4px;">${cl.telefone || 'Não informado'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:bold;">ENDEREÇO:</td>
                        <td style="color:#334155;">${cl.endereco || 'Não informado'}</td>
                    </tr>
                </table>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:20px;">
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:uppercase;">Total Comprado</small>
                    <div style="font-size:12px; font-weight:800; color:#334155;">R$ <span class="blur-sensitive">${totalComprado.toFixed(2)}</span></div>
                </div>
                <div style="background:#f0fdf4; padding:8px; border-radius:6px; border:1px solid #bbf7d0; text-align:center;">
                    <small style="color:#15803d; font-weight:700; font-size:8px; text-transform:uppercase;">Total Pago</small>
                    <div style="font-size:12px; font-weight:800; color:#166534;">R$ <span class="blur-sensitive">${totalPago.toFixed(2)}</span></div>
                </div>
                <div style="background:#fef2f2; padding:8px; border-radius:6px; border:1px solid #fecaca; text-align:center;">
                    <small style="color:#b91c1c; font-weight:700; font-size:8px; text-transform:uppercase;">Em Aberto</small>
                    <div style="font-size:14px; font-weight:800; color:#dc2626;">R$ <span class="blur-sensitive">${saldoFinal.toFixed(2)}</span></div>
                </div>
            </div>

            <div data-html2canvas-ignore="true" class="no-print" style="margin-bottom:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-secondary" style="padding:6px 10px; font-size:11px;" onclick="toggleSelecaoDebitosCliente(true)">Marcar em aberto</button>
                    <button class="btn btn-secondary" style="padding:6px 10px; font-size:11px;" onclick="toggleSelecaoDebitosCliente(false)">Limpar seleção</button>
                </div>
                <div id="resumo-liquidacao" style="font-size:11px; color:#475569; font-weight:700;">
                    Nenhum debito selecionado
                </div>
            </div>

            <table style="width:100%; border-collapse: collapse; font-size:11px;">
                <thead>
                    <tr style="background:#f1f5f9; color:#475569; border-top:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1;">
                        <th style="padding:8px; text-align:left; width:22%;">Data</th>
                        <th style="padding:8px; text-align:left;">Descrição / Serviço</th>
                        <th style="padding:8px; text-align:right; width:20%;">Valor</th>
                        <th style="padding:8px; text-align:center; width:15%;">Status</th>
                        <th style="padding:8px; text-align:center; width:13%;">Receber</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlLinhas || '<tr><td colspan="5" style="text-align:center; padding:15px; font-style:italic; color:#94a3b8;">Nenhum registro encontrado no período.</td></tr>'}
                </tbody>
            </table>

            <div data-html2canvas-ignore="true" class="no-print" style="margin-top:12px; display:flex; justify-content:flex-end;">
                <button class="btn btn-primary" onclick="liquidarDebitosSelecionados('${cl.id}')">Receber selecionados</button>
            </div>

            <div style="margin-top:40px; page-break-inside: avoid;">
                <p style="font-size:9px; text-align:justify; color:#64748b; line-height:1.4; margin-bottom:30px; border-top:1px solid #e2e8f0; padding-top:10px;">
                    <strong>TERMO DE RECONHECIMENTO DE DÍVIDA:</strong> Reconheço(emos) a exatidão desta conta e a dívida nela discriminada, comprometendo-me(nos) a pagá-la na data de vencimento ou quando solicitada. O não pagamento sujeitará o devedor às penalidades da lei e restrição de crédito.
                </p>

                <div style="display:flex; justify-content:center; margin-top:10px;">
                    <div style="text-align:center; width:70%;">
                        <div style="border-top:1px dashed #0f172a; margin-bottom:5px;"></div>
                        <span style="font-size:11px; font-weight:bold; color:#0f172a; text-transform:uppercase;">${cl.nome}</span><br>
                        <span style="font-size:9px; color:#64748b;">Assinatura do Responsável / Devedor</span>
                    </div>
                </div>
            </div>

            <div style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:5px; text-align:center; font-size:8px; color:#94a3b8;">
                Documento emitido em ${new Date().toLocaleString('pt-BR')} pelo Sistema KELL MOTOS PRO
            </div>
        </div>
    `;
    document.getElementById('modal-extrato').style.display = 'flex';
    atualizarResumoLiquidacao();
}
function aplicarFiltroExtrato() {
    const inicio = document.getElementById('filtro-extrato-inicio').value;
    const fim = document.getElementById('filtro-extrato-fim').value;
    abrirExtratoCompleto(clienteExtratoAtual, inicio, fim);
}

function baixarExtratoPDF() {
    const el = document.getElementById('extrato-visualizacao');
    const opt = {
        margin: 5,
        filename: `Extrato_${clienteExtratoAtual}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(el).set(opt).save();
}

function obterDebitosSelecionados() {
    return [...document.querySelectorAll('.checkbox-liquidacao:checked')].map(el => ({
        id: el.dataset.vendaId,
        valor: parseFloat(el.dataset.valor) || 0
    }));
}

function atualizarResumoLiquidacao() {
    const resumo = document.getElementById('resumo-liquidacao');
    if (!resumo) return;

    const itens = obterDebitosSelecionados();
    const total = itens.reduce((soma, item) => soma + item.valor, 0);
    resumo.innerText = itens.length
        ? `${itens.length} debito(s) selecionado(s) • R$ ${total.toFixed(2)}`
        : 'Nenhum debito selecionado';
}

function toggleSelecaoDebitosCliente(marcar) {
    document.querySelectorAll('.checkbox-liquidacao').forEach(el => {
        el.checked = marcar;
    });
    atualizarResumoLiquidacao();
}
// =========================
// DRE GERENCIAL
// =========================
function gerarRelatorioGeral() {
    let receitaBruta = 0, custosProdutos = 0, impostosTotal = 0, taxasPgtoTotal = 0, lucroLiquido = 0;

    if (typeof cacheVendas !== 'undefined') {
        cacheVendas.forEach(v => {
            const vendaVal = parseFloat(v.venda) || 0;
            const lucroVal = parseFloat(v.lucro) || 0;

            receitaBruta += vendaVal;
            lucroLiquido += lucroVal;

            if (v.financeiro) {
                custosProdutos += (parseFloat(v.financeiro.custo_prod) || 0);
                impostosTotal += (parseFloat(v.financeiro.impostos) || 0);
                taxasPgtoTotal += (parseFloat(v.financeiro.taxas_pgto) || 0);
            } else {
                custosProdutos += (vendaVal * 0.6);
            }
        });
    }

    const html = `
        <div style="font-family: 'Courier New', Courier, monospace; padding: 30px; border:1px solid #ccc; max-width:100%;">
            <h2 style="text-align:center; margin-bottom:5px;">${configEmpresa.nome}</h2>
            <h3 style="text-align:center; margin-top:0;">DRE GERENCIAL - SINTÉTICO</h3>
            <hr style="border:1px dashed #000">

            <div style="display:flex; justify-content:space-between; margin:10px 0;">
                <b>(+) RECEITA OPERACIONAL BRUTA</b>
                <b>R$ <span class="blur-sensitive">${receitaBruta.toFixed(2)}</span></b>
            </div>

            <div style="display:flex; justify-content:space-between; color:#b91c1c;">
                <span>(-) CUSTOS DOS PRODUTOS (CMV)</span>
                <span>R$ <span class="blur-sensitive">${custosProdutos.toFixed(2)}</span></span>
            </div>
            <div style="display:flex; justify-content:space-between; color:#b91c1c;">
                <span>(-) TAXAS E IMPOSTOS ESTIMADOS</span>
                <span>R$ <span class="blur-sensitive">${(impostosTotal + taxasPgtoTotal).toFixed(2)}</span></span>
            </div>

            <hr style="border:1px solid #000; margin: 15px 0;">

            <div style="display:flex; justify-content:space-between; font-size:18px;">
                <b>(=) LUCRO LÍQUIDO ESTIMADO</b>
                <b style="color:${lucroLiquido >= 0 ? 'green' : 'red'}">R$ <span class="blur-sensitive">${lucroLiquido.toFixed(2)}</span></b>
            </div>

            <div style="margin-top:20px; font-size:12px; text-align:center;">
                Margem Líquida Atual: ${receitaBruta > 0 ? ((lucroLiquido / receitaBruta) * 100).toFixed(1) : 0}%
            </div>
        </div>
    `;

    document.getElementById('relatorio-preview-box').innerHTML = html;
    document.getElementById('modal-relatorio').style.display = 'flex';
}

function baixarRelatorioPDF() {
    const opt = { margin: 10, filename: `DRE.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } };
    html2pdf().from(document.getElementById('relatorio-preview-box')).set(opt).save();
}

// =========================
// DESPESAS E BOLETOS
// =========================
function renderizarBoletos() {
    if (typeof cacheClientes === 'undefined') return;
    const dev = cacheClientes.filter(c => c.debito > 0.01);

    document.getElementById('corpo-boletos').innerHTML = dev.map(c => `
        <tr style="cursor:pointer; transition:0.2s;" onmouseover="this.style.background='var(--bg-body)'" onmouseout="this.style.background='transparent'">
            <td onclick="abrirExtratoCompleto('${c.id}')">
                <div style="font-weight:700; color:var(--text-main)">${c.nome}</div>
                <small style="color:var(--text-muted)">${c.telefone || ''}</small>
            </td>
            <td>${c.cpf || '--'}</td>
            <td><span class="status-badge bg-red" style="font-size:12px;">R$ <span class="blur-sensitive">${c.debito.toFixed(2)}</span></span></td>
            <td align="right">
                <button class="btn btn-sm btn-secondary" onclick="abrirExtratoCompleto('${c.id}')"><i class="ri-file-list-3-line"></i></button>
                <button class="btn btn-sm btn-primary" onclick="liquidarDebito('${c.id}')"><i class="ri-check-double-line"></i></button>
            </td>
        </tr>
    `).join('');

    const hist = cacheClientes.filter(c => !c.debito || c.debito <= 0.01);
    document.getElementById('corpo-historico-pagamentos').innerHTML = hist.map(c => `
        <tr>
            <td onclick="abrirExtratoCompleto('${c.id}')"><b>${c.nome}</b></td>
            <td>${c.cpf || '--'}</td>
            <td align="right"><button class="btn btn-sm btn-secondary" onclick="abrirExtratoCompleto('${c.id}')">Ver Histórico</button></td>
        </tr>
    `).join('');
}

function renderizarDespesas() {
    if (typeof cacheDespesas === 'undefined') return;
    let h = '', t = 0;
    cacheDespesas.forEach(d => {
        t += d.valor;
        h += `<tr><td>${d.data}</td><td>${d.fornecedor}</td><td>${d.descricao}</td><td>R$ <span class="blur-sensitive">${d.valor.toFixed(2)}</span></td><td><button onclick="db.collection('despesas_kell').doc('${d.id}').delete()">X</button></td></tr>`;
    });
    document.getElementById('corpo-despesas').innerHTML = h;
    document.getElementById('total-despesas-mes').innerText = "R$ " + t.toFixed(2);
}

async function liquidarDebito(id) {
    abrirExtratoCompleto(id);
}

async function liquidarDebitosSelecionados(id = clienteExtratoAtual) {
    const selecionados = obterDebitosSelecionados();
    if (!id) return;
    if (selecionados.length === 0) return alert("Selecione pelo menos um débito em aberto.");

    const totalRecebido = selecionados.reduce((soma, item) => soma + item.valor, 0);
    if (!confirm(`Confirmar recebimento de R$ ${totalRecebido.toFixed(2)} em ${selecionados.length} débito(s)?`)) return;

    const clienteRef = db.collection("clientes_kell").doc(id);

    await db.runTransaction(async t => {
        const clienteDoc = await t.get(clienteRef);
        if (!clienteDoc.exists) throw new Error("Cliente não encontrado.");

        const debitoAtual = parseFloat(clienteDoc.data().debito) || 0;
        const novoDebito = Math.max(0, debitoAtual - totalRecebido);

        selecionados.forEach(item => {
            const vendaRef = db.collection("vendas_kell").doc(item.id);
            t.update(vendaRef, {
                pagamento_efetivado: true,
                data_pagamento: new Date().toLocaleString('pt-BR')
            });
        });

        t.update(clienteRef, { debito: novoDebito });
    });

    Toastify({ text: "Baixa realizada com sucesso!", style: { background: "var(--primary)" } }).showToast();
    abrirExtratoCompleto(id);
}

async function salvarDespesa() {
    const d = {
        fornecedor: document.getElementById('desp-fornecedor').value,
        descricao: document.getElementById('desp-descricao').value,
        valor: parseFloat(document.getElementById('desp-valor').value) || 0,
        data: document.getElementById('desp-data').value.split('-').reverse().join('/'),
        tipo: 'SIMPLES',
        timestamp: Date.now()
    };
    await db.collection("despesas_kell").add(d);
}

function mudarAbaDespesa(t) {
    document.getElementById('view-desp-simples').style.display = t === 'simples' ? 'block' : 'none';
    document.getElementById('view-desp-nf').style.display = t === 'nf' ? 'block' : 'none';

    document.getElementById('tab-desp-simples').classList.toggle('btn-primary', t === 'simples');
    document.getElementById('tab-desp-simples').classList.toggle('btn-secondary', t !== 'simples');
    document.getElementById('tab-desp-nf').classList.toggle('btn-primary', t === 'nf');
    document.getElementById('tab-desp-nf').classList.toggle('btn-secondary', t !== 'nf');
}

function buscarProdParaNF() {
    const q = document.getElementById('nf-busca-prod').value.toLowerCase();
    const div = document.getElementById('nf-sugestoes');
    if (q.length < 2) { div.style.display = 'none'; return; }
    const f = (typeof cacheEstoque !== 'undefined' ? cacheEstoque : []).filter(p => obterNomeProdutoFinanceiro(p).toLowerCase().includes(q));
    div.innerHTML = f.map(p => `<div style="padding:10px; cursor:pointer; border-bottom:1px solid #eee;" onclick='selecionarProdNF(${JSON.stringify(p)})'>${obterNomeProdutoFinanceiro(p)}</div>`).join('');
    div.style.display = 'block';
}

function selecionarProdNF(p) {
    document.getElementById('nf-prod-id').value = p.id;
    document.getElementById('nf-prod-nome').value = obterNomeProdutoFinanceiro(p);
    document.getElementById('nf-prod-custo').value = p.compra;
    document.getElementById('nf-sugestoes').style.display = 'none';
}

function addProdutoNaListaNF() {
    const i = {
        id_existente: document.getElementById('nf-prod-id').value,
        nome: document.getElementById('nf-prod-nome').value,
        qtd: parseFloat(document.getElementById('nf-prod-qtd').value),
        custo: parseFloat(document.getElementById('nf-prod-custo').value),
        venda: parseFloat(document.getElementById('nf-prod-venda').value) || 0
    };
    if (!i.nome) return;
    i.total = i.qtd * i.custo;
    listaItensNF.push(i); renderizarListaItensNF();

    document.getElementById('nf-prod-id').value = '';
    document.getElementById('nf-prod-nome').value = '';
    document.getElementById('nf-prod-qtd').value = '';
    document.getElementById('nf-prod-custo').value = '';
    document.getElementById('nf-prod-venda').value = '';
}

function renderizarListaItensNF() {
    let h = '', t = 0;
    listaItensNF.forEach((i, x) => {
        t += i.total;
        h += `<tr><td>${i.nome}</td><td>${i.qtd}</td><td>${i.total.toFixed(2)}</td><td><button class="btn btn-sm btn-danger" onclick="listaItensNF.splice(${x},1);renderizarListaItensNF()">X</button></td></tr>`;
    });
    document.getElementById('nf-lista-itens').innerHTML = h;
    if (document.getElementById('nf-soma-itens')) document.getElementById('nf-soma-itens').innerText = "R$ " + t.toFixed(2);
}

async function finalizarEntradaNF() {
    if (listaItensNF.length === 0) return alert("Adicione itens à lista primeiro.");

    const batch = db.batch();
    listaItensNF.forEach(i => {
        if (i.id_existente) {
            batch.update(db.collection("estoque_kell").doc(i.id_existente), {
                qtd: firebase.firestore.FieldValue.increment(i.qtd),
                compra: i.custo,
                repasse: i.venda || undefined
            });
        } else {
            const ref = db.collection("estoque_kell").doc();
            batch.set(ref, {
                marca: '',
                nome_peca: i.nome,
                modelo: i.nome,
                qtd: i.qtd,
                compra: i.custo,
                repasse: i.venda || 0,
                timestamp: Date.now()
            });
        }
    });

    const nfValor = parseFloat(document.getElementById('nf-valor-total').value) || 0;
    if (nfValor > 0) {
        const dRef = db.collection("despesas_kell").doc();
        batch.set(dRef, {
            fornecedor: document.getElementById('nf-fornecedor').value || 'Fornecedor NF',
            descricao: 'NF: ' + (document.getElementById('nf-numero').value || 'S/N'),
            valor: nfValor,
            data: document.getElementById('nf-data').value ? document.getElementById('nf-data').value.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR'),
            tipo: 'NF',
            timestamp: Date.now()
        });
    }

    await batch.commit();
    listaItensNF = []; renderizarListaItensNF();
    Toastify({ text: "Entrada de Nota Fiscal concluída!", style: { background: "var(--primary)" } }).showToast();

    document.getElementById('nf-numero').value = '';
    document.getElementById('nf-valor-total').value = '';
    document.getElementById('nf-fornecedor').value = '';
}

function toggleModalCadastroCliente() {
    const m = document.getElementById('modal-cadastro-cliente');
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

async function cadastrarCliente() {
    const c = {
        nome: document.getElementById('boleto-cliente-nome').value,
        cpf: document.getElementById('boleto-cliente-cpf').value,
        telefone: document.getElementById('boleto-cliente-tel').value,
        endereco: document.getElementById('boleto-cliente-end').value,
        debito: 0,
        timestamp: Date.now()
    };
    if (!c.nome) return alert("Nome obrigatório");
    await db.collection("clientes_kell").add(c);
    Toastify({ text: "Cliente Cadastrado", style: { background: "var(--primary)" } }).showToast();
    toggleModalCadastroCliente();

    // Atualiza imediatamente o select do fiado
    setTimeout(() => {
        if (typeof atualizarSelectClientes === 'function') {
            atualizarSelectClientes();
        }
    }, 300);
}





