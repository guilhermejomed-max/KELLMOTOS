// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyCDrwonWKHZ12zhzLKdFWTDgxHc-juX3F0", 
    authDomain: "kellmotos.firebaseapp.com", 
    projectId: "kellmotos", 
    storageBucket: "kellmotos.firebasestorage.app", 
    messagingSenderId: "244705542944", 
    appId: "1:244705542944:web:ff7464334b36ecaa464d45" 
};

// Inicialização Única
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- LISTA DE MESTRES (SEMPRE SENIOR) ---
// Adicione aqui os emails que nunca podem perder acesso
const EMAILS_MESTRES = ["amg.gui@gmail.com", "admin@kellmotos.com.br"];

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

// --- FUNÇÃO DE FORMATAÇÃO DE USUÁRIO ---
function formatUsername(u) { 
    if(!u) return "";
    let clean = u.toLowerCase().trim();
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
    clean = clean.replace(/\s+/g, '.'); // Troca espaço por ponto
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
            if(e.code === 'auth/user-not-found') msg = "Usuário não encontrado. Cadastre-se primeiro.";
            if(e.code === 'auth/wrong-password') msg = "Senha incorreta.";
            if(e.code === 'auth/invalid-email') msg = "Formato de usuário inválido.";
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
    
    if(!u || p.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");
    
    const email = formatUsername(u);

    // === RECUPERAÇÃO DO ADMIN (SEGURANÇA) ===
    if(u.toLowerCase() === 'admin') {
        const dadosAdmin = { email: email, nome: "Administrador", nivel: "SENIOR", criado_em: Date.now() };
        try {
            await auth.createUserWithEmailAndPassword(email, p);
            await db.collection("funcionarios_kell").doc(email).set(dadosAdmin);
            alert("Conta ADMIN criada! O sistema entrará automaticamente.");
        } catch(e) {
            if(e.code === 'auth/email-already-in-use') {
                // Se o email existe, garante que o banco de dados também tenha o admin
                await db.collection("funcionarios_kell").doc(email).set(dadosAdmin, {merge: true});
                alert("O usuário Admin já existia. Permissões restauradas.\nVolte e faça login com sua senha.");
                alternarModoLogin();
            } else {
                alert("Erro Admin: " + e.message);
            }
        }
        return;
    }

    // === FLUXO NORMAL (FUNCIONÁRIOS) ===
    const doc = await db.collection("funcionarios_kell").doc(email).get();
    
    if(!doc.exists) {
        return alert(`ACESSO NÃO LIBERADO!\n\nO usuário "${email}" não foi encontrado no sistema.\n\nPeça para o Administrador cadastrar seu Nome e Sobrenome no menu 'Equipe'.`);
    }
    
    auth.createUserWithEmailAndPassword(email, p)
        .then(() => alert("Senha criada com sucesso! Entrando..."))
        .catch(e => {
            if(e.code === 'auth/email-already-in-use') {
                alert("Você já tem senha cadastrada. Volte e faça login.");
                alternarModoLogin();
            } else {
                alert("Erro ao criar senha: " + e.message);
            }
        });
}

// --- INICIALIZAÇÃO ---
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
        
        // Redireciona com pequeno delay para garantir carregamento do nível
        setTimeout(() => {
            if(userNivel === 'JUNIOR') mudarTab('vendas');
            else mudarTab('dash');
        }, 1200); 
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

    // --- LÓGICA DE NÍVEL BLINDADA ---
    db.collection("funcionarios_kell").doc(email).onSnapshot(d => {
        // 1. Verifica se é um Mestre (Hardcoded)
        if(EMAILS_MESTRES.includes(email) || email.startsWith('admin@')) {
            userNivel = 'SENIOR';
        } 
        // 2. Se não for mestre, busca do banco
        else if (d.exists) {
            userNivel = d.data().nivel;
        } 
        // 3. Se não achar, padrão é Junior
        else {
            userNivel = 'JUNIOR';
        }
        
        if(document.getElementById('user-role-display')) {
            document.getElementById('user-role-display').innerText = userNivel;
        }
        aplicarPermissoes();
    });

    // Carregamento de Dados em Tempo Real
    db.collection("estoque_kell").onSnapshot(s => {
        cacheEstoque = s.docs.map(d => ({id: d.id, ...d.data()}));
        if(window.renderizarEstoque) renderizarEstoque();
        if(window.renderizarEcommerce) renderizarEcommerce();
        if(window.atualizarKPIs) atualizarKPIs();
    });

    db.collection("vendas_kell").orderBy('timestamp','desc').limit(200).onSnapshot(s => {
        cacheVendas = s.docs.map(d => ({id: d.id, ...d.data()}));
        if(window.renderizarVendas) renderizarVendas();
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
    const tabs = ['estoque','vendas','reposicao','ecommerce','boleto','despesas','dash','funcionarios','motos'];
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
}

function aplicarPermissoes() {
    const todosMenus = ['m-dash','m-estoque','m-vendas','m-reposicao','m-ecommerce','m-boleto','m-despesas','m-funcionarios','m-motos'];
    const btnConfig = document.getElementById('btn-config-geral');

    // 1. Esconde tudo primeiro
    todosMenus.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    if(btnConfig) btnConfig.style.display = 'none';

    // 2. Define o que cada um vê
    let permitidos = [];
    if(userNivel === 'SENIOR') {
        permitidos = todosMenus;
        if(btnConfig) btnConfig.style.display = 'block';
    } 
    else if (userNivel === 'PLENO') {
        permitidos = ['m-dash', 'm-estoque', 'm-vendas', 'm-reposicao', 'm-ecommerce', 'm-boleto', 'm-motos'];
    } 
    else { 
        // JUNIOR (Padrão)
        permitidos = ['m-estoque', 'm-vendas', 'm-motos'];
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
function fecharModais() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }
function toggleConfig() { 
    const m = document.getElementById('modal-config');
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; 
}
