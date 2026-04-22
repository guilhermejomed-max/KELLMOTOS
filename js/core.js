// --- CONFIGURAÃ‡ÃƒO FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyCDrwonWKHZ12zhzLKdFWTDgxHc-juX3F0", 
    authDomain: "kellmotos.firebaseapp.com", 
    projectId: "kellmotos", 
    storageBucket: "kellmotos.firebasestorage.app", 
    messagingSenderId: "244705542944", 
    appId: "1:244705542944:web:ff7464334b36ecaa464d45" 
};

// InicializaÃ§Ã£o Ãšnica
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- LISTA DE MESTRES (SEMPRE SENIOR - IGNORA O BANCO) ---
// Adicione aqui todos os e-mails que devem ter acesso total OBRIGATÃ“RIO
const EMAILS_MESTRES = [
    "amg.gui@gmail.com", 
    "admin@kellmotos.com.br"
];

// --- ESTADO GLOBAL ---
let cacheEstoque=[], cacheVendas=[], cacheMotos=[], cacheFuncionarios=[], cacheClientes=[], cacheDespesas=[];
let userNivel = 'SENIOR'; 
let configEmpresa = {
    nome: "KELL MOTOS", 
    cnpj: "", 
    margem: 40, 
    margemEco: 35, 
    imposto_medio: 4, 
    taxa_cartao: 3.5, 
    custo_fixo_medio: 2.00
};

// --- FUNÃ‡ÃƒO DE FORMATAÃ‡ÃƒO DE USUÃRIO ---
function formatUsername(u) { 
    if(!u) return "";
    let clean = u.toLowerCase().trim();
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
    clean = clean.replace(/\s+/g, '.'); // Troca espaÃ§o por ponto
    clean = clean.replace(/[^a-z0-9.@]/g, ""); // Remove caracteres especiais
    return clean.includes("@") ? clean : clean + "@kellmotos.com.br"; 
}

// --- LOGS ---
async function registrarAuditoria(colecao, docId, acao, detalhes) {
    try {
        await db.collection("logs_auditoria").add({
            timestamp: Date.now(),
            data: new Date().toLocaleString('pt-BR'),
            usuario: auth.currentUser ? auth.currentUser.email : 'SISTEMA',
            colecao: colecao,
            doc_afetado: docId,
            acao: acao,
            detalhes: detalhes 
        });
    } catch(e) { console.error("Log erro:", e); }
}

// --- LOGIN & CADASTRO ---
async function fazerLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    if(!u || !p) return Toastify({text: "Preencha todos os campos", style:{background:"var(--danger)"}}).showToast();

    const email = formatUsername(u);

    auth.signInWithEmailAndPassword(email, p)
        .catch(e => {
            let msg = "Erro desconhecido: " + e.message;
            if(e.code === 'auth/user-not-found') msg = "UsuÃ¡rio nÃ£o encontrado. Cadastre-se primeiro.";
            if(e.code === 'auth/wrong-password') msg = "Senha incorreta.";
            if(e.code === 'auth/invalid-email') msg = "Formato de usuÃ¡rio invÃ¡lido.";
            alert(msg);
        });
}

function fazerLogout() { auth.signOut(); }

function alternarModoLogin() {
    const l = document.getElementById('login-fields');
    const s = document.getElementById('setup-fields');
    if(l.style.display !== 'none') {
        l.style.display = 'none';
        s.style.display = 'block';
        document.getElementById('login-title').innerText = "CRIAR SENHA";
    } else {
        l.style.display = 'block';
        s.style.display = 'none';
        document.getElementById('login-title').innerText = "KELL MOTOS PRO";
    }
}

async function cadastrarPrimeiraSenha() {
    const u = document.getElementById('setup-username').value;
    const p = document.getElementById('setup-password').value;
    
    if(!u || p.length < 6) return alert("A senha deve ter no mÃ­nimo 6 caracteres.");
    
    const email = formatUsername(u);

    // === RECUPERAÃ‡ÃƒO DO ADMIN (SEGURANÃ‡A) ===
    // Se for um dos mestres tentando criar senha, libera e forÃ§a SENIOR no banco
    if(EMAILS_MESTRES.includes(email) || u.toLowerCase() === 'admin') {
        const dadosAdmin = { email: email, nome: "Master Admin", nivel: "SENIOR", criado_em: Date.now() };
        try {
            await auth.createUserWithEmailAndPassword(email, p);
            await db.collection("funcionarios_kell").doc(email).set(dadosAdmin);
            alert("Conta MASTER criada/restaurada! O sistema entrarÃ¡ automaticamente.");
        } catch(e) {
            if(e.code === 'auth/email-already-in-use') {
                await db.collection("funcionarios_kell").doc(email).set(dadosAdmin, {merge: true});
                alert("UsuÃ¡rio Mestre identificado. PermissÃµes restauradas.\nVolte e faÃ§a login.");
                alternarModoLogin();
            } else {
                alert("Erro Admin: " + e.message);
            }
        }
        return;
    }

    // === FLUXO NORMAL (FUNCIONÃRIOS) ===
    const doc = await db.collection("funcionarios_kell").doc(email).get();
    
    if(!doc.exists) {
        return alert(`ACESSO NÃƒO LIBERADO!\n\nO usuÃ¡rio "${email}" nÃ£o foi encontrado.\n\nPeÃ§a para o Admin cadastrar seu Nome no menu 'Equipe'.`);
    }
    
    auth.createUserWithEmailAndPassword(email, p)
        .then(() => alert("Senha criada! Entrando..."))
        .catch(e => {
            if(e.code === 'auth/email-already-in-use') {
                alert("VocÃª jÃ¡ tem senha. Volte e faÃ§a login.");
                alternarModoLogin();
            } else {
                alert("Erro ao criar senha: " + e.message);
            }
        });
}

// --- INICIALIZAÃ‡ÃƒO ---
auth.onAuthStateChanged(u => {
    const loginScreen = document.getElementById('login-screen');
    const mainContent = document.getElementById('main-content');
    
    if(u) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(mainContent) mainContent.style.display = 'block';
        if(document.getElementById('user-name-display')) {
            document.getElementById('user-name-display').innerText = u.email.split('@')[0];
        }
        iniciarApp(); 
        
        // Redireciona com delay
        setTimeout(() => {
            mudarTab('dash');
        }, 1500); 
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(mainContent) mainContent.style.display = 'none';
    }
});

function iniciarApp() {
    if(!auth.currentUser) return;
    const email = auth.currentUser.email;
    
    db.collection("config_kell").doc("empresa").onSnapshot(d => {
        if(d.exists) configEmpresa = d.data();
        if(window.atualizarConfigUI) atualizarConfigUI();
    });

    // --- LÃ“GICA DE NÃVEL BLINDADA (AQUI ESTÃ A CORREÃ‡ÃƒO) ---
    db.collection("funcionarios_kell").doc(email).onSnapshot(d => {
        
        // 1. REGRA SUPREMA: Se estiver na lista EMAILS_MESTRES, Ã© SENIOR e ponto final.
        // Isso ignora qualquer coisa que esteja escrita no banco de dados.
        if (EMAILS_MESTRES.includes(email)) {
            userNivel = 'SENIOR';
            
            // Opcional: Corrige o banco silenciosamente para ficar bonito no cadastro
            if (d.exists && d.data().nivel !== 'SENIOR') {
                db.collection("funcionarios_kell").doc(email).update({nivel: 'SENIOR'});
            }
        } 
        // 2. Se nÃ£o for mestre, obedece o banco
        else if (d.exists) {
            userNivel = d.data().nivel;
        } 
        // 3. Se nÃ£o achar nada, vira JUNIOR por seguranÃ§a
        else {
            userNivel = 'JUNIOR';
        }
        
        // Atualiza a interface
        if(document.getElementById('user-role-display')) {
            document.getElementById('user-role-display').innerText = userNivel;
        }
        
        // Reaplica as permissÃµes imediatamente
        aplicarPermissoes();
    });

    // Carregamento de Dados
    db.collection("estoque_kell").onSnapshot(s => {
        cacheEstoque = s.docs.map(d => ({id: d.id, ...d.data()}));
        if(window.renderizarEstoque) renderizarEstoque();
        if(window.renderizarEcommerce) renderizarEcommerce();
        if(window.renderizarCatalogo) renderizarCatalogo();
        if(window.atualizarKPIs) atualizarKPIs();
    });

    db.collection("vendas_kell").orderBy('timestamp','desc').limit(200).onSnapshot(s => {
        cacheVendas = s.docs.map(d => ({id: d.id, ...d.data()}));
        if(window.renderizarVendas) renderizarVendas();
        if(window.renderizarOrcamentos) renderizarOrcamentos();
        if(window.atualizarKPIs) atualizarKPIs();
        if(document.getElementById('sec-dash') && !document.getElementById('sec-dash').classList.contains('hidden')) {
            if(window.renderizarGraficos) renderizarGraficos();
        }
    });

    db.collection("clientes_kell").onSnapshot(s => {
        cacheClientes = s.docs.map(d => ({id: d.id, ...d.data()}));
        if(window.renderizarBoletos) renderizarBoletos();
        if(window.atualizarSelectClientes) atualizarSelectClientes();
    });
    db.collection("despesas_kell").orderBy('timestamp','desc').limit(50).onSnapshot(s => { 
        cacheDespesas = s.docs.map(d=>({id:d.id,...d.data()})); 
        if(window.renderizarDespesas) renderizarDespesas(); 
    });

    db.collection("motos_kell").onSnapshot(s => { cacheMotos = s.docs.map(d=>({id:d.id,...d.data()})); if(window.renderizarListaMotos) renderizarListaMotos(); });
    db.collection("funcionarios_kell").onSnapshot(s => { cacheFuncionarios = s.docs.map(d=>({id:d.id,...d.data()})); if(window.renderizarListaFuncionarios) renderizarListaFuncionarios(); });
}

function mudarTab(t) {
    const tabs = ['estoque','vendas','catalogo','reposicao','ecommerce','boleto','despesas','dash','funcionarios','motos'];
    tabs.forEach(id => {
        const el = document.getElementById('sec-' + id);
        if(el) el.classList.add('hidden');
    });
    const target = document.getElementById('sec-' + t);
    if(target) target.classList.remove('hidden');
    
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    const activeMenu = document.getElementById('m-' + t);
    if(activeMenu) activeMenu.classList.add('active');

    const title = t.charAt(0).toUpperCase() + t.slice(1);
    if(document.getElementById('page-title')) {
        document.getElementById('page-title').innerText = title === 'Dash' ? 'Dashboard' : title;
    }
    
    if(t === 'dash') {
        requestAnimationFrame(() => {
            if(window.atualizarKPIs) atualizarKPIs();
            setTimeout(() => { if(window.renderizarGraficos) renderizarGraficos(); }, 100);
        });
    }

    if(t === 'vendas') {
        requestAnimationFrame(() => {
            if(window.focarCampoCodigoVenda) focarCampoCodigoVenda();
        });
    }
}

function aplicarPermissoes() {
    const todosMenus = ['m-dash','m-estoque','m-vendas','m-catalogo','m-reposicao','m-ecommerce','m-boleto','m-despesas','m-funcionarios','m-motos'];
    const btnConfig = document.getElementById('btn-config-geral');

    // 1. Esconde tudo
    todosMenus.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    if(btnConfig) btnConfig.style.display = 'none';

    // 2. Define o que cada um vÃª
    let permitidos = [];
    if(userNivel === 'SENIOR') {
        permitidos = todosMenus;
        if(btnConfig) btnConfig.style.display = 'block';
    } 
    else if (userNivel === 'PLENO') {
        permitidos = ['m-dash', 'm-estoque', 'm-vendas', 'm-catalogo', 'm-reposicao', 'm-ecommerce', 'm-boleto', 'm-motos'];
    } 
    else { 
        // JUNIOR
        permitidos = ['m-estoque', 'm-vendas', 'm-catalogo', 'm-motos'];
    }

    // 3. Exibe os permitidos
    permitidos.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'flex';
    });
}

function toggleSidebarMini() { document.getElementById('sidebar').classList.toggle('collapsed'); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function togglePrivacy() { document.body.classList.toggle('privacy-on'); }
function fecharModais() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); if (window.fecharScannerCodigo) fecharScannerCodigo(true); }
function toggleConfig() { 
    const m = document.getElementById('modal-config');
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; 
}

let scannerCodigoInstancia = null;
let scannerCodigoContexto = null;
let scannerCodigoAtivo = false;

function localizarProdutoPorCodigo(codigo) {
    const codigoLimpo = String(codigo || '').trim().toLowerCase();
    if (!codigoLimpo || !Array.isArray(cacheEstoque)) return null;
    return cacheEstoque.find(item => String(item.codigo || '').trim().toLowerCase() === codigoLimpo) || null;
}

function atualizarStatusScannerCodigo(texto) {
    const el = document.getElementById('scanner-codigo-status');
    if (el) el.innerText = texto;
}

async function abrirScannerCodigo(contexto = 'entrada') {
    scannerCodigoContexto = contexto;

    if (typeof Html5Qrcode !== 'function') {
        alert('Leitor de câmera não disponível neste aparelho.');
        return;
    }

    const modal = document.getElementById('modal-scanner-codigo');
    if (!modal) return;

    modal.style.display = 'flex';
    atualizarStatusScannerCodigo('Abrindo câmera...');

    if (scannerCodigoAtivo) return;

    try {
        scannerCodigoInstancia = new Html5Qrcode('scanner-codigo-reader');
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || !cameras.length) throw new Error('Nenhuma câmera encontrada.');

        const camera = cameras.find(c => /back|rear|traseira|environment/i.test(c.label || '')) || cameras[0];
        await scannerCodigoInstancia.start(
            camera.id,
            { fps: 10, qrbox: { width: 260, height: 140 }, aspectRatio: 1.7778 },
            decodedText => processarCodigoLido(decodedText),
            () => {}
        );
        scannerCodigoAtivo = true;
        atualizarStatusScannerCodigo('Posicione o código de barras dentro da câmera.');
    } catch (e) {
        console.error(e);
        atualizarStatusScannerCodigo('Não foi possível abrir a câmera.');
        alert('Não foi possível abrir a câmera para leitura.');
        fecharScannerCodigo(true);
    }
}

async function fecharScannerCodigo(silencioso = false) {
    const modal = document.getElementById('modal-scanner-codigo');
    if (modal) modal.style.display = 'none';

    try {
        if (scannerCodigoInstancia && scannerCodigoAtivo) {
            await scannerCodigoInstancia.stop();
        }
    } catch (e) {
        if (!silencioso) console.error(e);
    }

    try {
        if (scannerCodigoInstancia) {
            await scannerCodigoInstancia.clear();
        }
    } catch (e) {
        if (!silencioso) console.error(e);
    }

    scannerCodigoInstancia = null;
    scannerCodigoAtivo = false;
    scannerCodigoContexto = null;
}

function processarCodigoLido(codigo) {
    const codigoLido = String(codigo || '').trim();
    if (!codigoLido) return;

    if (scannerCodigoContexto === 'entrada') {
        const form = document.getElementById('form-cadastro');
        if (form && form.classList.contains('hidden') && typeof toggleFormCadastro === 'function') {
            toggleFormCadastro();
        }

        const produto = localizarProdutoPorCodigo(codigoLido);
        if (produto && typeof carregarParaEdicao === 'function') {
            carregarParaEdicao(produto);
            Toastify({ text: 'Produto localizado pelo código!', style: { background: 'var(--primary)' } }).showToast();
        } else {
            const campoCodigo = document.getElementById('codigo');
            if (campoCodigo) campoCodigo.value = codigoLido;
            Toastify({ text: 'Código preenchido no cadastro.', style: { background: 'var(--primary)' } }).showToast();
        }
        fecharScannerCodigo(true);
        return;
    }

    if (scannerCodigoContexto === 'venda') {
        const inputVenda = document.getElementById('venda-codigo-input');
        if (inputVenda) inputVenda.value = codigoLido;
        venderPorCodigo(codigoLido);
        fecharScannerCodigo(true);
    }
}

function venderPorCodigo(codigo) {
    const produto = localizarProdutoPorCodigo(codigo);
    if (!produto) {
        alert('Produto não encontrado para esse código.');
        return;
    }

    if (typeof abrirVenda === 'function') {
        abrirVenda(produto.id, produto);
    }
}

function venderPorCodigoManual() {
    const input = document.getElementById('venda-codigo-input');
    venderPorCodigo(input ? input.value : '');
}






