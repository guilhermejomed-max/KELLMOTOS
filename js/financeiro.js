let chartF = null;
let listaItensNF = [];
let clienteExtratoAtual = null;
let fiadoManualEdicaoId = null;
let fiadoEdicaoClienteOriginalId = null;

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

    ['cli-boleto-select', 'boleto-manual-cliente', 'editar-orc-boleto-select', 'editar-fiado-cliente-select'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const valorAtual = select.value || '';
        select.innerHTML = html;
        if (valorAtual && clientes.some(c => c.id === valorAtual)) {
            select.value = valorAtual;
        }
    });
}

// =========================
// DASHBOARD KPI
// =========================
function atualizarKPIs() {
    const hj = new Date().toLocaleDateString('pt-BR');
    let fat = 0, luc = 0, est = 0, vendasHoje = 0;

    const vendas = (typeof cacheVendas !== 'undefined' && Array.isArray(cacheVendas)) ? cacheVendas.filter(v => v.tipo !== 'ORCAMENTO' && v.tipo !== 'ORDEM_SERVICO') : [];
    const estoque = (typeof cacheEstoque !== 'undefined' && Array.isArray(cacheEstoque)) ? cacheEstoque : [];
    const clientes = (typeof cacheClientes !== 'undefined' && Array.isArray(cacheClientes)) ? cacheClientes : [];

    vendas.forEach(v => {
        if (v.data === hj) {
            fat += (parseFloat(v.venda) || 0);
            luc += (parseFloat(v.lucro) || 0);
            vendasHoje += 1;
        }
    });

    estoque.forEach(p => est += ((parseFloat(p.custo_medio ?? p.compra) || 0) * (parseFloat(p.qtd) || 0)));
    const ticketMedio = vendasHoje ? (fat / vendasHoje) : 0;
    const baixoEstoque = estoque.filter(p => (parseInt(p.qtd) || 0) <= 2);
    const clientesFiado = clientes.filter(c => (parseFloat(c.debito) || 0) > 0);
    const basePendente = estoque.filter(p => {
        const status = String(p.status_base_troca || 'NORMAL').toUpperCase();
        return status === 'BASE_PENDENTE' || status === 'AGUARDANDO_RETIFICA';
    });
    const agora = Date.now();
    const prazoRevisao = agora + (30 * 24 * 60 * 60 * 1000);
    const revisoesProximas = vendas
        .flatMap(v => Array.isArray(v.agenda_revisao) ? v.agenda_revisao.map(item => ({ ...item, cliente: v.cliente || 'Consumidor' })) : [])
        .filter(item => item.proxima_revisao_ts && item.proxima_revisao_ts <= prazoRevisao)
        .sort((a, b) => (a.proxima_revisao_ts || 0) - (b.proxima_revisao_ts || 0));

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

    if (document.getElementById('kpi-revisoes-proximas'))
        document.getElementById('kpi-revisoes-proximas').innerText = revisoesProximas.length;

    if (document.getElementById('kpi-base-pendente'))
        document.getElementById('kpi-base-pendente').innerText = basePendente.length;

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
        revisoesProximas.slice(0, 2).forEach(item => {
            alertas.push({
                titulo: item.cliente || 'Cliente',
                detalhe: `Retorno previsto para ${item.proxima_revisao} • ${item.nome}`,
                tipo: 'warning'
            });
        });
        basePendente.slice(0, 2).forEach(item => {
            alertas.push({
                titulo: obterNomeProdutoFinanceiro(item),
                detalhe: `Situação: ${item.status_base_troca === 'AGUARDANDO_RETIFICA' ? 'Aguardando retífica' : 'Base pendente'}`,
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

    const lucroPorProduto = {};
    vendas.forEach(v => {
        const itensVenda = Array.isArray(v.itens) && v.itens.length ? v.itens : [{
            nome: v.peca || 'Item',
            qtd: parseInt(v.qtd) || 1,
            total: parseFloat(v.venda) || 0,
            custo_unitario: ((parseFloat(v.venda) || 0) - (parseFloat(v.lucro) || 0)) / Math.max(parseInt(v.qtd) || 1, 1)
        }];

        itensVenda.forEach(item => {
            const nome = item.nome || 'Item';
            const qtd = parseInt(item.qtd) || 0;
            const total = parseFloat(item.total) || 0;
            const custoUnitario = parseFloat(item.custo_unitario) || 0;
            const lucroItem = total - (qtd * custoUnitario);
            if (!lucroPorProduto[nome]) lucroPorProduto[nome] = { lucro: 0, qtd: 0 };
            lucroPorProduto[nome].lucro += lucroItem;
            lucroPorProduto[nome].qtd += qtd;
        });
    });

    const rankingLucro = Object.entries(lucroPorProduto).sort((a, b) => b[1].lucro - a[1].lucro);
    const vendasRecentesPorProduto = {};
    const limiteParado = agora - (180 * 24 * 60 * 60 * 1000);
    vendas.forEach(v => {
        const partesData = String(v.data || '').split('/');
        const dataVendaTs = partesData.length === 3 ? new Date(partesData[2], partesData[1] - 1, partesData[0]).getTime() : 0;
        const itensVenda = Array.isArray(v.itens) && v.itens.length ? v.itens : [{ nome: v.peca || 'Item', qtd: parseInt(v.qtd) || 1 }];
        itensVenda.forEach(item => {
            const chave = item.produtoId || item.id || item.codigo || item.nome;
            if (dataVendaTs >= limiteParado) {
                vendasRecentesPorProduto[chave] = (vendasRecentesPorProduto[chave] || 0) + (parseInt(item.qtd) || 0);
            }
        });
    });
    const itensParados = estoque.filter(item => {
        const chave = item.id || item.codigo || item.modelo;
        const temSaida = (vendasRecentesPorProduto[chave] || 0) > 0;
        return !temSaida && (parseInt(item.qtd) || 0) > 0 && (parseInt(item.timestamp) || 0) < limiteParado;
    });

    const abcEl = document.getElementById('dash-abc-lista');
    if (abcEl) {
        const classeA = rankingLucro.slice(0, 3);
        abcEl.innerHTML = `
            ${classeA.length ? classeA.map((item, index) => `
                <div class="dashboard-list-row">
                    <span><b style="color:var(--primary)">A${index + 1}.</b> ${item[0]}</span>
                    <span class="status-badge bg-green">R$ ${item[1].lucro.toFixed(2)}</span>
                </div>
            `).join('') : '<div class="dashboard-empty-state">Sem vendas suficientes para curva ABC.</div>'}
            <div style="margin:14px 0 8px; font-size:11px; font-weight:700; color:var(--text-muted); text-transform:none;">Peças paradas há mais de 6 meses</div>
            ${itensParados.slice(0, 3).map(item => `
                <div class="dashboard-list-row">
                    <span>${obterNomeProdutoFinanceiro(item)}</span>
                    <span class="status-badge bg-red">Promover</span>
                </div>
            `).join('') || '<div class="dashboard-empty-state">Nenhum item parado crítico no momento.</div>'}
        `;
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
    const vendas = (typeof cacheVendas !== 'undefined' && Array.isArray(cacheVendas)) ? cacheVendas.filter(v => v.tipo !== 'ORCAMENTO' && v.tipo !== 'ORDEM_SERVICO') : [];

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

function normalizarTextoComparacao(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function obterVendasDoCliente(id, nomeCliente = '') {
    const nomeNormalizado = normalizarTextoComparacao(nomeCliente);
    return (cacheVendas || []).filter(venda => {
        if (venda.clienteId === id) return true;
        if (venda.pagamento !== 'BOLETO') return false;
        if (!venda.clienteId && nomeNormalizado) {
            return normalizarTextoComparacao(venda.cliente) === nomeNormalizado;
        }
        return false;
    });
}

function dataBRParaInput(dataBR) {
    const partes = String(dataBR || '').split('/');
    if (partes.length !== 3) return '';
    return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
}

function dataInputParaBR(dataInput) {
    if (!dataInput) return new Date().toLocaleDateString('pt-BR');
    const partes = String(dataInput).split('-');
    if (partes.length !== 3) return dataInput;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function horaParaInput(hora) {
    const partes = String(hora || '').split(':');
    if (partes.length < 2) return new Date().toTimeString().slice(0, 5);
    return `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
}

function localizarClienteDoFiado(venda) {
    if (!venda) return null;
    return (cacheClientes || []).find(cliente => cliente.id === venda.clienteId)
        || (clienteExtratoAtual ? (cacheClientes || []).find(cliente => cliente.id === clienteExtratoAtual) : null)
        || (cacheClientes || []).find(cliente => normalizarTextoComparacao(cliente.nome) === normalizarTextoComparacao(venda.cliente))
        || null;
}

function obterValorTotalFiado(venda) {
    return parseFloat(venda?.venda) || 0;
}

function obterPagamentosFiado(venda) {
    return (Array.isArray(venda?.pagamentos_parciais) ? venda.pagamentos_parciais : [])
        .map(pagamento => ({
            ...pagamento,
            valor: parseFloat(pagamento.valor) || 0
        }))
        .filter(pagamento => pagamento.valor > 0);
}

function obterValorPagoFiado(venda) {
    const total = obterValorTotalFiado(venda);
    const pagoRegistrado = parseFloat(venda?.valor_pago_fiado);
    const pagoParcelas = obterPagamentosFiado(venda).reduce((soma, pagamento) => soma + pagamento.valor, 0);
    if (Number.isFinite(pagoRegistrado) && pagoRegistrado > 0) return Math.min(total, pagoRegistrado);
    if (pagoParcelas > 0) return Math.min(total, pagoParcelas);
    return venda?.pagamento_efetivado ? total : 0;
}

function obterSaldoFiado(venda) {
    if (venda?.pagamento_efetivado) return 0;
    const saldoRegistrado = parseFloat(venda?.saldo_fiado);
    if (Number.isFinite(saldoRegistrado) && saldoRegistrado >= 0) return saldoRegistrado;
    return Math.max(0, obterValorTotalFiado(venda) - obterValorPagoFiado(venda));
}

function obterResumoPagamentosFiado(venda) {
    const pagamentos = obterPagamentosFiado(venda);
    if (!pagamentos.length) return '';
    return pagamentos
        .map(pagamento => `R$ ${pagamento.valor.toFixed(2)} em ${pagamento.data || '--'}`)
        .join(' • ');
}

function renderizarResumoValoresFiado(venda) {
    const total = obterValorTotalFiado(venda);
    if (venda?.pagamento !== 'BOLETO') return `R$ ${total.toFixed(2)}`;
    const pago = obterValorPagoFiado(venda);
    const falta = obterSaldoFiado(venda);
    return `
        <div>Total: R$ ${total.toFixed(2)}</div>
        <div style="color:#15803d;">Pago: R$ ${pago.toFixed(2)}</div>
        <div style="color:#dc2626;">Falta: R$ ${falta.toFixed(2)}</div>
    `;
}

function criarRegistroPagamentoFiado(valor, observacao = '') {
    return {
        id: `pgto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        valor,
        data: new Date().toLocaleString('pt-BR'),
        observacao: observacao || 'Pagamento avulso',
        operador: auth.currentUser?.email || 'SISTEMA'
    };
}

// =========================
// EXTRATO COMPLETO
// =========================
function abrirExtratoCompleto(id, dataInicio = "", dataFim = "") {
    clienteExtratoAtual = id;
    const cl = cacheClientes.find(c => c.id === id);
    if (!cl) return;

    let vendas = obterVendasDoCliente(id, cl.nome);

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
        const valor = obterValorTotalFiado(v);
        const valorPago = obterValorPagoFiado(v);
        const saldoFiado = obterSaldoFiado(v);
        const resumoPagamentos = obterResumoPagamentosFiado(v);
        totalComprado += valor;
        totalPago += valorPago;
        totalDevendo += saldoFiado;

        const statusBadge = saldoFiado <= 0.01
            ? `<span style="color:#059669; font-weight:700; background:#d1fae5; padding:2px 6px; border-radius:4px; font-size:10px;">PAGO</span>`
            : valorPago > 0.01
                ? `<span style="color:#2563eb; font-weight:700; background:#dbeafe; padding:2px 6px; border-radius:4px; font-size:10px;">PARCIAL</span>`
            : `<span style="color:#dc2626; font-weight:700; background:#fee2e2; padding:2px 6px; border-radius:4px; font-size:10px;">ABERTO</span>`;

        const podeSelecionar = saldoFiado > 0.01;

        htmlLinhas += `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:6px; font-size:11px;">${v.data}<br><span style="color:#999; font-size:9px;">${v.hora}</span></td>
            <td style="padding:6px; font-size:11px; color:#334155;">
                ${v.peca}
                ${resumoPagamentos ? `<div style="margin-top:4px; color:#2563eb; font-size:9px;">Pagamentos: ${resumoPagamentos}</div>` : ''}
            </td>
            <td style="padding:6px; text-align:right; font-size:11px;">
                <div style="font-weight:700;">Total: R$ <span class="blur-sensitive">${valor.toFixed(2)}</span></div>
                <div style="color:#15803d;">Pago: R$ <span class="blur-sensitive">${valorPago.toFixed(2)}</span></div>
                <div style="color:#dc2626;">Falta: R$ <span class="blur-sensitive">${saldoFiado.toFixed(2)}</span></div>
            </td>
            <td style="padding:6px; text-align:center;">${statusBadge}</td>
            <td style="padding:6px; text-align:center;">
                ${podeSelecionar ? `<input type="checkbox" class="checkbox-liquidacao" data-venda-id="${v.id}" data-valor="${saldoFiado.toFixed(2)}" onchange="atualizarResumoLiquidacao()">` : '-'}
            </td>
            <td style="padding:6px; text-align:center;" class="no-print" data-html2canvas-ignore="true">
                ${podeSelecionar ? `<button class="btn btn-sm btn-primary" onclick="registrarPagamentoParcialFiado('${v.id}')">Receber parcial</button>` : ''}
                <button class="btn btn-sm btn-secondary" onclick="abrirEdicaoFiadoManual('${v.id}')">Editar</button>
            </td>
        </tr>`;
    });

    const saldoFinal = totalDevendo > 0.01 ? totalDevendo : (parseFloat(cl.debito) || 0);

    document.getElementById('extrato-visualizacao').innerHTML = `
        <div style="padding:20px; font-family:'Inter', 'Segoe UI', Arial, sans-serif; width:100%; box-sizing:border-box;">

            <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #0f172a; padding-bottom:15px;">
                <h2 style="margin:0; color:#0f172a; font-size:22px; text-transform:none; letter-spacing:0;">${configEmpresa.nome}</h2>
                <div style="font-size:11px; color:#64748b; margin-top:5px; line-height:1.4;">
                    ${configEmpresa.endereco ? configEmpresa.endereco + ' • ' : ''}
                    CNPJ: ${configEmpresa.cnpj || 'Não Informado'}<br>
                    Tel: ${configEmpresa.telefone || 'Não Informado'}
                </div>
                <div style="margin-top:10px; font-weight:700; font-size:12px; color:#0f172a; border:1px solid #0f172a; display:inline-block; padding:4px 12px; border-radius:20px; text-transform:none;">
                    Extrato de Débitos / Promissória
                </div>
            </div>

            <div data-html2canvas-ignore="true" class="no-print" style="display:flex; gap:5px; margin-bottom:20px; background:#f1f5f9; padding:8px; border-radius:8px; align-items:flex-end; border:1px solid #e2e8f0;">
                <div style="flex:1;">
                    <label style="font-size:9px; font-weight:700; color:#64748b; display:block;">DE:</label>
                    <input type="date" id="filtro-extrato-inicio" class="input-style" style="margin:0; padding:4px; height:28px; font-size:11px;" value="${dataInicio}">
                </div>
                <div style="flex:1;">
                    <label style="font-size:9px; font-weight:700; color:#64748b; display:block;">ATÉ:</label>
                    <input type="date" id="filtro-extrato-fim" class="input-style" style="margin:0; padding:4px; height:28px; font-size:11px;" value="${dataFim}">
                </div>
                <button class="btn btn-primary" style="padding:0 10px; height:28px; font-size:11px;" onclick="aplicarFiltroExtrato()">Filtrar</button>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:20px;">
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <tr>
                        <td style="color:#64748b; font-weight:700; width:80px; padding-bottom:4px;">CLIENTE:</td>
                        <td style="font-weight:700; color:#0f172a; font-size:13px; padding-bottom:4px;">${cl.nome}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:700; padding-bottom:4px;">CPF:</td>
                        <td style="color:#334155; padding-bottom:4px;">${cl.cpf || 'Não informado'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:700; padding-bottom:4px;">CONTATO:</td>
                        <td style="color:#334155; padding-bottom:4px;">${cl.telefone || 'Não informado'}</td>
                    </tr>
                    <tr>
                        <td style="color:#64748b; font-weight:700;">ENDEREÇO:</td>
                        <td style="color:#334155;">${cl.endereco || 'Não informado'}</td>
                    </tr>
                </table>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:20px;">
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">
                    <small style="color:#64748b; font-weight:700; font-size:8px; text-transform:none;">Total Comprado</small>
                    <div style="font-size:12px; font-weight:700; color:#334155;">R$ <span class="blur-sensitive">${totalComprado.toFixed(2)}</span></div>
                </div>
                <div style="background:#f0fdf4; padding:8px; border-radius:6px; border:1px solid #bbf7d0; text-align:center;">
                    <small style="color:#15803d; font-weight:700; font-size:8px; text-transform:none;">Total Pago</small>
                    <div style="font-size:12px; font-weight:700; color:#166534;">R$ <span class="blur-sensitive">${totalPago.toFixed(2)}</span></div>
                </div>
                <div style="background:#fef2f2; padding:8px; border-radius:6px; border:1px solid #fecaca; text-align:center;">
                    <small style="color:#b91c1c; font-weight:700; font-size:8px; text-transform:none;">Em Aberto</small>
                    <div style="font-size:14px; font-weight:700; color:#dc2626;">R$ <span class="blur-sensitive">${saldoFinal.toFixed(2)}</span></div>
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
                        <th style="padding:8px; text-align:center; width:14%;" class="no-print" data-html2canvas-ignore="true">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlLinhas || '<tr><td colspan="6" style="text-align:center; padding:15px; font-style:italic; color:#94a3b8;">Nenhum registro encontrado no período.</td></tr>'}
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
                        <span style="font-size:11px; font-weight:700; color:#0f172a; text-transform:none;">${cl.nome}</span><br>
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
        cacheVendas.filter(v => v.tipo !== 'ORDEM_SERVICO').forEach(v => {
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
    const dev = cacheClientes.filter(c => (parseFloat(c.debito) || 0) > 0.01);

    document.getElementById('corpo-boletos').innerHTML = dev.map(c => `
        <tr style="cursor:pointer; transition:0.2s;" onmouseover="this.style.background='var(--bg-body)'" onmouseout="this.style.background='transparent'">
            <td onclick="abrirExtratoCompleto('${c.id}')">
                <div style="font-weight:700; color:var(--text-main)">${c.nome}</div>
                <small style="color:var(--text-muted)">${c.telefone || ''}</small>
            </td>
            <td>${c.cpf || '--'}</td>
            <td><span class="status-badge bg-red" style="font-size:12px;">R$ <span class="blur-sensitive">${(parseFloat(c.debito) || 0).toFixed(2)}</span></span></td>
            <td align="right">
                <button class="btn btn-sm btn-secondary" onclick="abrirPainelCliente('${c.id}')">Painel</button>
                <button class="btn btn-sm btn-secondary" onclick="abrirExtratoCompleto('${c.id}')"><i class="ri-file-list-3-line"></i></button>
                <button class="btn btn-sm btn-secondary" onclick="abrirEdicaoFiadoPorCliente('${c.id}')"><i class="ri-edit-2-line"></i></button>
                <button class="btn btn-sm btn-primary" onclick="liquidarDebito('${c.id}')"><i class="ri-check-double-line"></i></button>
            </td>
        </tr>
    `).join('');

    const hist = cacheClientes.filter(c => (parseFloat(c.debito) || 0) <= 0.01);
    document.getElementById('corpo-historico-pagamentos').innerHTML = hist.map(c => `
        <tr>
            <td onclick="abrirExtratoCompleto('${c.id}')"><b>${c.nome}</b></td>
            <td>${c.cpf || '--'}</td>
            <td><span class="status-badge bg-green">Em dia</span></td>
            <td align="right" style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn btn-sm btn-secondary" onclick="abrirPainelCliente('${c.id}')">Painel</button>
                <button class="btn btn-sm btn-secondary" onclick="abrirExtratoCompleto('${c.id}')"><i class="ri-file-list-3-line"></i></button>
                <button class="btn btn-sm btn-secondary" onclick="abrirEdicaoFiadoPorCliente('${c.id}')"><i class="ri-edit-2-line"></i></button>
            </td>
        </tr>
    `).join('');
}

function abrirEdicaoFiadoPorCliente(id) {
    const cliente = (cacheClientes || []).find(item => item.id === id);
    if (!cliente) return alert('Cliente não encontrado.');

    const lancamentos = obterVendasDoCliente(id, cliente.nome)
        .filter(item => item.pagamento === 'BOLETO')
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (!lancamentos.length) {
        return alert('Esse cliente não tem lançamento de fiado para editar.');
    }

    abrirEdicaoFiadoManual(lancamentos[0].id);
}

function abrirPainelCliente(id) {
    const cliente = (cacheClientes || []).find(item => item.id === id);
    const box = document.getElementById('painel-cliente-detalhes');
    const vazio = document.getElementById('painel-cliente-vazio');
    if (!cliente || !box || !vazio) return;

    const compras = obterVendasDoCliente(id, cliente.nome).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const totalComprado = compras.reduce((acc, item) => acc + (parseFloat(item.venda) || 0), 0);
    const totalPagoFiado = compras
        .filter(item => item.pagamento === 'BOLETO')
        .reduce((acc, item) => acc + obterValorPagoFiado(item), 0);
    const revisoes = compras.flatMap(v => Array.isArray(v.agenda_revisao) ? v.agenda_revisao : []).sort((a, b) => (a.proxima_revisao_ts || 0) - (b.proxima_revisao_ts || 0));
    const ultimasPecas = compras.slice(0, 5).map(v => v.peca || 'Item');

    vazio.style.display = 'none';
    box.style.display = 'block';
    box.innerHTML = `
        <div class="form-grid-4">
            <div class="modal-subtle-box"><div class="modal-section-title">Cliente</div><div style="font-weight:700; color:var(--text-main);">${cliente.nome || '--'}</div><div style="font-size:12px; color:var(--text-muted); margin-top:6px;">${cliente.telefone || 'Sem telefone'}</div></div>
            <div class="modal-subtle-box"><div class="modal-section-title">Total comprado</div><div style="font-weight:700; color:var(--text-main);">R$ ${totalComprado.toFixed(2)}</div><div style="font-size:12px; color:var(--text-muted); margin-top:6px;">${compras.length} compra(s)</div></div>
            <div class="modal-subtle-box"><div class="modal-section-title">Pago no fiado</div><div style="font-weight:700; color:#15803d;">R$ ${totalPagoFiado.toFixed(2)}</div><div style="font-size:12px; color:var(--text-muted); margin-top:6px;">Pagamentos avulsos</div></div>
            <div class="modal-subtle-box"><div class="modal-section-title">Fiado atual</div><div style="font-weight:700; color:${(parseFloat(cliente.debito) || 0) > 0 ? '#b91c1c' : 'var(--text-main)'};">R$ ${(parseFloat(cliente.debito) || 0).toFixed(2)}</div><div style="font-size:12px; color:var(--text-muted); margin-top:6px;">CPF: ${cliente.cpf || '--'}</div></div>
        </div>
        <div class="form-grid-2" style="margin-top:16px;">
            <div class="modal-subtle-box">
                <div class="modal-section-title">Próximas revisões</div>
                ${revisoes.slice(0, 5).map(item => `<div class="dashboard-list-row"><span>${item.nome}</span><span class="status-badge bg-green">${item.proxima_revisao || '--'}</span></div>`).join('') || '<div class="dashboard-empty-state">Nenhuma revisão programada.</div>'}
            </div>
            <div class="modal-subtle-box">
                <div class="modal-section-title">Últimas peças / serviços</div>
                ${ultimasPecas.map(item => `<div class="dashboard-list-row"><span>${item}</span><span class="status-badge bg-green">Compra</span></div>`).join('') || '<div class="dashboard-empty-state">Sem compras registradas.</div>'}
            </div>
        </div>
        <div class="table-container" style="margin-top:16px;">
            <table>
                <thead><tr><th>Data</th><th>Resumo</th><th>Valores</th><th>Retorno</th></tr></thead>
                <tbody>
                    ${compras.slice(0, 12).map(item => `
                        <tr>
                            <td>${item.data || '--'}</td>
                            <td>${item.peca || '--'}</td>
                            <td>${renderizarResumoValoresFiado(item)}</td>
                            <td>${item.proxima_revisao || '--'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="4" style="text-align:center; padding:18px; color:var(--text-muted);">Sem histórico para este cliente.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function exportarClientesCSV() {
    if (!podeExecutarAcao('exportar_relatorios')) return alert('Você não tem permissão para exportar relatórios.');
    const linhas = [['Nome','CPF','Telefone','Endereço','Débito']];
    (cacheClientes || []).forEach(cliente => {
        linhas.push([cliente.nome || '', cliente.cpf || '', cliente.telefone || '', cliente.endereco || '', (parseFloat(cliente.debito) || 0).toFixed(2)]);
    });
    baixarCSV('clientes_kell.csv', linhas);
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

async function registrarPagamentoParcialFiado(vendaId) {
    const venda = (cacheVendas || []).find(item => item.id === vendaId);
    if (!venda) return alert('Lançamento não encontrado.');
    if (venda.pagamento !== 'BOLETO') return alert('Esse lançamento não é fiado.');

    const cliente = localizarClienteDoFiado(venda);
    if (!cliente) return alert('Cliente do fiado não encontrado.');

    const saldoAtual = obterSaldoFiado(venda);
    if (saldoAtual <= 0.01) return alert('Esse lançamento já está quitado.');

    const valorTexto = prompt(`Quanto o cliente pagou agora?\nSaldo atual: R$ ${saldoAtual.toFixed(2)}`, '');
    if (valorTexto === null) return;

    const valorRecebido = parseFloat(String(valorTexto).replace(',', '.')) || 0;
    if (valorRecebido <= 0) return alert('Informe um valor maior que zero.');
    if (valorRecebido - saldoAtual > 0.01) return alert(`O valor informado é maior que o saldo restante de R$ ${saldoAtual.toFixed(2)}.`);

    const observacao = prompt('Observação do pagamento (opcional):', '') || '';
    const clienteRef = db.collection("clientes_kell").doc(cliente.id);
    const vendaRef = db.collection("vendas_kell").doc(vendaId);
    let quitado = false;

    await db.runTransaction(async t => {
        const clienteDoc = await t.get(clienteRef);
        const vendaDoc = await t.get(vendaRef);
        if (!clienteDoc.exists) throw new Error("Cliente não encontrado.");
        if (!vendaDoc.exists) throw new Error("Lançamento não encontrado.");

        const vendaAtual = vendaDoc.data() || {};
        const saldoVenda = obterSaldoFiado(vendaAtual);
        const valorAplicado = Math.min(valorRecebido, saldoVenda);
        if (valorAplicado <= 0.01) throw new Error("Esse lançamento já está quitado.");

        const totalVenda = obterValorTotalFiado(vendaAtual);
        const novoPago = Math.min(totalVenda, obterValorPagoFiado(vendaAtual) + valorAplicado);
        const novoSaldo = Math.max(0, totalVenda - novoPago);
        quitado = novoSaldo <= 0.01;
        const registro = criarRegistroPagamentoFiado(valorAplicado, observacao);
        const debitoAtual = parseFloat(clienteDoc.data().debito) || 0;

        t.update(vendaRef, {
            pagamentos_parciais: firebase.firestore.FieldValue.arrayUnion(registro),
            valor_pago_fiado: novoPago,
            saldo_fiado: novoSaldo,
            pagamento_efetivado: quitado,
            data_pagamento: quitado ? registro.data : firebase.firestore.FieldValue.delete()
        });

        t.update(clienteRef, {
            debito: Math.max(0, debitoAtual - valorAplicado)
        });
    });

    if (typeof registrarAuditoria === 'function') {
        registrarAuditoria('CLIENTES', vendaId, 'FIADO_PAGAMENTO_PARCIAL', {
            cliente: cliente.nome,
            valor: valorRecebido,
            quitado
        });
    }

    Toastify({ text: quitado ? 'Fiado quitado!' : 'Pagamento parcial registrado!', style: { background: 'var(--primary)' } }).showToast();
    abrirExtratoCompleto(cliente.id);
    abrirPainelCliente(cliente.id);
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
        let totalRecebidoReal = 0;

        for (const item of selecionados) {
            const vendaRef = db.collection("vendas_kell").doc(item.id);
            const vendaDoc = await t.get(vendaRef);
            if (!vendaDoc.exists) continue;
            const venda = vendaDoc.data() || {};
            const saldoVenda = obterSaldoFiado(venda);
            const valorAplicado = Math.min(item.valor, saldoVenda);
            if (valorAplicado <= 0.01) continue;

            const totalVenda = obterValorTotalFiado(venda);
            const novoPago = Math.min(totalVenda, obterValorPagoFiado(venda) + valorAplicado);
            const novoSaldo = Math.max(0, totalVenda - novoPago);
            const registro = criarRegistroPagamentoFiado(valorAplicado, 'Quitação pelo extrato');
            totalRecebidoReal += valorAplicado;

            t.update(vendaRef, {
                pagamentos_parciais: firebase.firestore.FieldValue.arrayUnion(registro),
                valor_pago_fiado: novoPago,
                saldo_fiado: novoSaldo,
                pagamento_efetivado: novoSaldo <= 0.01,
                data_pagamento: novoSaldo <= 0.01 ? registro.data : firebase.firestore.FieldValue.delete()
            });
        }

        t.update(clienteRef, { debito: Math.max(0, debitoAtual - totalRecebidoReal) });
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
    if (!podeExecutarAcao('ajustar_estoque')) return alert('Você não tem permissão para registrar entrada de NF.');

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
    if (typeof registrarMovimentacaoProduto === 'function') {
        for (const item of listaItensNF) {
            const produtoId = item.id_existente || (cacheEstoque || []).find(prod => obterNomeProdutoFinanceiro(prod) === item.nome)?.id;
            if (produtoId) {
                await registrarMovimentacaoProduto(produtoId, {
                    tipo: 'ENTRADA_NF',
                    motivo: `NF ${document.getElementById('nf-numero').value || 'S/N'}`,
                    impacto: `+${parseFloat(item.qtd) || 0} unidade(s)`,
                    data: new Date().toLocaleString('pt-BR'),
                    usuario: auth.currentUser?.email || 'SISTEMA'
                });
            }
        }
    }
    if (typeof registrarAuditoria === 'function') registrarAuditoria('ESTOQUE', 'nf', 'ENTRADA_NF', { numero: document.getElementById('nf-numero').value || 'S/N', itens: listaItensNF.length });
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

async function registrarFiadoManual() {
    const clienteId = document.getElementById('boleto-manual-cliente')?.value || '';
    const item = String(document.getElementById('boleto-manual-item')?.value || '').trim();
    const qtd = parseInt(document.getElementById('boleto-manual-qtd')?.value) || 0;
    const valorUnitario = parseFloat(document.getElementById('boleto-manual-valor')?.value) || 0;

    if (!clienteId) return alert('Selecione um cliente.');
    if (!item) return alert('Informe o item ou serviço.');
    if (qtd <= 0) return alert('Informe uma quantidade válida.');
    if (valorUnitario <= 0) return alert('Informe um valor válido.');

    const total = qtd * valorUnitario;
    const clienteRef = db.collection('clientes_kell').doc(clienteId);
    const vendaRef = db.collection('vendas_kell').doc();

    await db.runTransaction(async t => {
        const clienteDoc = await t.get(clienteRef);
        if (!clienteDoc.exists) throw new Error('Cliente não encontrado.');
        const cliente = clienteDoc.data() || {};
        const agora = new Date();

        t.update(clienteRef, {
            debito: firebase.firestore.FieldValue.increment(total)
        });

        t.set(vendaRef, {
            numero: `FIADO-${Date.now()}`,
            itens: [{
                id: `manual-${Date.now()}`,
                produtoId: '',
                nome: item,
                marca: '',
                nome_peca: item,
                codigo: '',
                qtd,
                unitario: valorUnitario,
                total,
                origem: 'FIADO_MANUAL'
            }],
            peca: item,
            produtoId: '',
            qtd,
            venda: total,
            unitario: valorUnitario,
            cliente: cliente.nome || 'Cliente',
            clienteId,
            pagamento: 'BOLETO',
            pagamento_efetivado: false,
            observacao: 'Lançamento manual no fiado',
            data: agora.toLocaleDateString('pt-BR'),
            hora: agora.toLocaleTimeString('pt-BR'),
            timestamp: Date.now(),
            origem: 'FIADO_MANUAL',
            operador: auth.currentUser?.email || 'SISTEMA',
            tipo: 'VENDA'
        });
    });

    if (typeof registrarAuditoria === 'function') {
        registrarAuditoria('CLIENTES', clienteId, 'FIADO_MANUAL_LANCADO', {
            item,
            qtd,
            valor_unitario: valorUnitario,
            total
        });
    }

    document.getElementById('boleto-manual-item').value = '';
    document.getElementById('boleto-manual-qtd').value = '';
    document.getElementById('boleto-manual-valor').value = '';

    Toastify({ text: 'Lançamento manual adicionado ao fiado!', style: { background: 'var(--primary)' } }).showToast();
}

function resetarEdicaoFiadoManual() {
    fiadoManualEdicaoId = null;
    fiadoEdicaoClienteOriginalId = null;
    ['editar-fiado-cliente','editar-fiado-cliente-select','editar-fiado-status','editar-fiado-data','editar-fiado-hora','editar-fiado-item','editar-fiado-qtd','editar-fiado-valor','editar-fiado-observacao'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const status = document.getElementById('editar-fiado-status');
    if (status) status.value = 'ABERTO';
}

function abrirEdicaoFiadoManual(id) {
    const venda = (cacheVendas || []).find(item => item.id === id);
    if (!venda) return alert('Lançamento não encontrado.');
    if (venda.pagamento !== 'BOLETO') return alert('Esse lançamento não é fiado.');

    if (typeof atualizarSelectClientes === 'function') atualizarSelectClientes();

    const cliente = localizarClienteDoFiado(venda);
    if (!cliente) return alert('Cliente do fiado não encontrado.');

    fiadoManualEdicaoId = id;
    fiadoEdicaoClienteOriginalId = cliente.id;

    const qtd = parseInt(venda.qtd) || (Array.isArray(venda.itens) ? venda.itens.reduce((acc, item) => acc + (parseInt(item.qtd) || 0), 0) : 1) || 1;
    const valorUnitario = parseFloat(venda.unitario) || ((parseFloat(venda.venda) || 0) / Math.max(qtd, 1));

    document.getElementById('editar-fiado-cliente').value = cliente.nome || venda.cliente || '';
    document.getElementById('editar-fiado-cliente-select').value = cliente.id;
    document.getElementById('editar-fiado-status').value = venda.pagamento_efetivado ? 'PAGO' : 'ABERTO';
    document.getElementById('editar-fiado-data').value = dataBRParaInput(venda.data);
    document.getElementById('editar-fiado-hora').value = horaParaInput(venda.hora);
    document.getElementById('editar-fiado-item').value = venda.peca || venda.itens?.[0]?.nome || '';
    document.getElementById('editar-fiado-qtd').value = qtd;
    document.getElementById('editar-fiado-valor').value = valorUnitario.toFixed(2);
    document.getElementById('editar-fiado-observacao').value = venda.observacao || '';
    document.getElementById('modal-editar-fiado').style.display = 'flex';
}

async function salvarEdicaoFiadoManual() {
    if (!fiadoManualEdicaoId) return alert('Nenhum lançamento de fiado selecionado para edição.');

    const clienteNovoId = document.getElementById('editar-fiado-cliente-select')?.value || '';
    const clienteNovo = (cacheClientes || []).find(cliente => cliente.id === clienteNovoId);
    const status = document.getElementById('editar-fiado-status')?.value || 'ABERTO';
    const dataInput = document.getElementById('editar-fiado-data')?.value || '';
    const horaInput = document.getElementById('editar-fiado-hora')?.value || '';
    const item = String(document.getElementById('editar-fiado-item')?.value || '').trim();
    const qtd = parseInt(document.getElementById('editar-fiado-qtd')?.value) || 0;
    const valorUnitario = parseFloat(document.getElementById('editar-fiado-valor')?.value) || 0;
    const observacao = String(document.getElementById('editar-fiado-observacao')?.value || '').trim();

    if (!clienteNovo) return alert('Selecione um cliente válido.');
    if (!item) return alert('Informe o item ou serviço.');
    if (qtd <= 0) return alert('Informe uma quantidade válida.');
    if (valorUnitario <= 0) return alert('Informe um valor válido.');

    const vendaRef = db.collection('vendas_kell').doc(fiadoManualEdicaoId);
    const novoTotal = qtd * valorUnitario;
    const pagamentoEfetivado = status === 'PAGO';
    const dataBR = dataInputParaBR(dataInput);
    const horaFinal = horaInput || new Date().toTimeString().slice(0, 5);
    const timestampEditado = dataInput
        ? new Date(`${dataInput}T${horaFinal}`).getTime()
        : Date.now();

    await db.runTransaction(async t => {
        const vendaDoc = await t.get(vendaRef);
        if (!vendaDoc.exists) throw new Error('Lançamento não encontrado.');
        const venda = vendaDoc.data() || {};
        if (venda.pagamento !== 'BOLETO') throw new Error('Esse lançamento não é fiado.');

        const clienteAntigoId = venda.clienteId || fiadoEdicaoClienteOriginalId || clienteExtratoAtual || '';
        const clienteAntigoRef = clienteAntigoId ? db.collection('clientes_kell').doc(clienteAntigoId) : null;
        const clienteNovoRef = db.collection('clientes_kell').doc(clienteNovoId);

        const clienteAntigoDoc = clienteAntigoRef ? await t.get(clienteAntigoRef) : null;
        const clienteNovoDoc = clienteAntigoId === clienteNovoId && clienteAntigoDoc
            ? clienteAntigoDoc
            : await t.get(clienteNovoRef);

        if (clienteAntigoRef && !clienteAntigoDoc.exists) throw new Error('Cliente original do fiado não encontrado.');
        if (!clienteNovoDoc.exists) throw new Error('Cliente selecionado não encontrado.');

        const debitoAnterior = obterSaldoFiado(venda);
        const pagoAnterior = obterValorPagoFiado(venda);
        const valorPagoNovo = pagamentoEfetivado ? novoTotal : Math.min(novoTotal, pagoAnterior);
        const debitoNovo = pagamentoEfetivado ? 0 : Math.max(0, novoTotal - valorPagoNovo);
        const estaQuitado = pagamentoEfetivado || debitoNovo <= 0.01;

        if (clienteAntigoId === clienteNovoId) {
            const saldoAtual = parseFloat(clienteNovoDoc.data().debito) || 0;
            t.update(clienteNovoRef, { debito: Math.max(0, saldoAtual - debitoAnterior + debitoNovo) });
        } else {
            if (clienteAntigoRef && clienteAntigoDoc?.exists) {
                const saldoAntigo = parseFloat(clienteAntigoDoc.data().debito) || 0;
                t.update(clienteAntigoRef, { debito: Math.max(0, saldoAntigo - debitoAnterior) });
            }
            const saldoNovo = parseFloat(clienteNovoDoc.data().debito) || 0;
            t.update(clienteNovoRef, { debito: Math.max(0, saldoNovo + debitoNovo) });
        }

        const itemBase = Array.isArray(venda.itens) && venda.itens.length ? venda.itens[0] : {};
        const custoTotal = parseFloat(venda.financeiro?.custo_prod) || (Array.isArray(venda.itens)
            ? venda.itens.reduce((acc, itemVenda) => acc + ((parseFloat(itemVenda.custo_unitario) || 0) * (parseInt(itemVenda.qtd) || 0)), 0)
            : 0);
        const lucro = novoTotal - custoTotal;
        const financeiro = venda.financeiro
            ? { ...venda.financeiro, lucro_liquido: lucro }
            : (custoTotal ? { custo_prod: custoTotal, lucro_liquido: lucro } : undefined);

        const updatePayload = {
            cliente: clienteNovo.nome || venda.cliente || 'Cliente',
            clienteId: clienteNovoId,
            pagamento: 'BOLETO',
            pagamento_efetivado: estaQuitado,
            valor_pago_fiado: valorPagoNovo,
            saldo_fiado: debitoNovo,
            data_pagamento: estaQuitado ? (venda.data_pagamento || new Date().toLocaleString('pt-BR')) : firebase.firestore.FieldValue.delete(),
            itens: [{
                id: itemBase.id || `fiado-${fiadoManualEdicaoId}`,
                produtoId: itemBase.produtoId || venda.produtoId || '',
                nome: item,
                marca: itemBase.marca || '',
                nome_peca: item,
                codigo: itemBase.codigo || '',
                qtd,
                unitario: valorUnitario,
                total: novoTotal,
                origem: itemBase.origem || venda.origem || 'FIADO'
            }],
            peca: item,
            qtd,
            venda: novoTotal,
            unitario: valorUnitario,
            observacao: observacao || venda.observacao || 'Lançamento no fiado',
            data: dataBR,
            hora: horaFinal,
            timestamp: Number.isNaN(timestampEditado) ? (venda.timestamp || Date.now()) : timestampEditado,
            atualizado_em: Date.now(),
            atualizado_por: auth.currentUser?.email || 'SISTEMA',
            operador: venda.operador || auth.currentUser?.email || 'SISTEMA',
            lucro
        };

        if (financeiro) updatePayload.financeiro = financeiro;

        t.update(vendaRef, updatePayload);
    });

    if (typeof registrarAuditoria === 'function') {
        registrarAuditoria('CLIENTES', fiadoManualEdicaoId, 'FIADO_EDITADO', {
            cliente: clienteNovo.nome,
            status,
            item,
            qtd,
            valor_unitario: valorUnitario,
            total: novoTotal
        });
    }

    Toastify({ text: 'Fiado atualizado com sucesso!', style: { background: 'var(--primary)' } }).showToast();
    fecharModais();
    abrirExtratoCompleto(clienteNovoId);
}
