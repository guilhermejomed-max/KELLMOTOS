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

// --- SISTEMA DE AUDITORIA ---
async function registrarAuditoria(colecao, docId, acao, detalhes) {
    try {
        const log = {
            timestamp: Date.now(),
            data: new Date().toLocaleString('pt-BR'),
            usuario: auth.currentUser ? auth.currentUser.email : 'SISTEMA',
            colecao: colecao,
            doc_afetado: docId,
            acao: acao,
            detalhes: detalhes 
        };
        await db.collection("logs_auditoria").add(log);
    } catch(e) {
        console.error("Falha ao auditar:", e);
    }
}

// --- AUTH SYSTEM (CORRIGIDO) ---
function formatUsername(u) { 
    if(!u) return "";
    // 1. Converte para minusculo e remove espaços das pontas
    let clean = u.toLowerCase().trim();
    // 2. Substitui qualquer espaço no meio por ponto
    clean = clean.replace(/\s+/g, '.');
    // 3. Remove pontos duplicados ou pontos no final/início (Ex: "joao." vira "joao")
    clean = clean.replace(/\.+/g, '.').replace(/^\./, '').replace(/\.$/, '');
    
    // Se já for email, retorna. Se não, adiciona o domínio.
    return clean.includes("@") ? clean : clean + "@kellmotos.com.br"; 
}

async function fazerLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    if(!u || !p) {
        return Toastify({text: "Preencha todos os campos", style:{background:"var(--danger)"}}).showToast();
    }

    const emailFormatado = formatUsername(u);

    auth.signInWithEmailAndPassword(emailFormatado, p)
        .catch(e => {
            console.error(e);
            let msg = "Usuário ou senha inválidos";
            if(e.code === 'auth/user-not-found') msg = "Usuário não encontrado. Cadastre-se primeiro.";
            if(e.code === 'auth/wrong-password') msg = "Senha incorreta.";
            Toastify({text: msg, style:{background:"var(--danger)"}}).showToast();
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

    // --- LIBERAÇÃO MASTER ADMIN ---
    if(u.toLowerCase() === 'admin') {
        try {
            await auth.createUserWithEmailAndPassword(email, p);
            await db.collection("funcionarios_kell").doc(email).set({
                email: email, nome: "Administrador", nivel: "SENIOR", criado_em: Date.now()
            });
            alert("Conta ADMIN criada! O sistema entrará automaticamente.");
            return;
        } catch(e) {
            if(e.code === 'auth/email-already-in-use') {
                alert("O Admin já existe. Volte e faça login.");
                alternarModoLogin();
            } else { alert("Erro: " + e.message); }
            return;
        }
    }
    // ------------------------------

    // Verifica se o Admin liberou este email no banco
    const d = await db.collection("funcionarios_kell").doc(email).get();
    
    if(!d.exists) {
        return alert(`ACESSO NEGADO!\n\nO usuário "${email}" não foi encontrado.\n\nPeça para o Admin cadastrar seu Nome e Sobrenome exatamente como você digitou.`);
    }
    
    // Se existe no banco, cria a autenticação (senha)
    auth.createUserWithEmailAndPassword(email, p)
        .then(() => alert("Sucesso! Sua senha foi criada. O sistema entrará automaticamente."))
        .catch(e => {
            if(e.code === 'auth/email-already-in-use') {
                alert("Você já criou uma senha para este usuário.\nVolte e faça login normalmente.");
                alternarModoLogin();
            } else {
                alert("Erro ao criar senha: " + e.message);
            }
        });
}

// Observador de Login
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
        
        // Redirecionamento
        setTimeout(() => {
            if(userNivel === 'JUNIOR') mudarTab('vendas');
            else mudarTab('dash');
        }, 800); 
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(mainContent) mainContent.style.display = 'none';
    }
});

function iniciarApp() {
    const email = auth.currentUser.email;
    
    // Configurações
    db.collection("config_kell").doc("empresa").onSnapshot(d => {
        if(d.exists) configEmpresa = d.data();
        if(window.atualizarConfigUI) atualizarConfigUI();
    });

    // Nível do Usuário
    db.collection("funcionarios_kell").doc(email).onSnapshot(d => {
        userNivel = d.exists ? d.data().nivel : (email.includes('admin') ? 'SENIOR' : 'JUNIOR');
        if(document.getElementById('user-role-display')) {
            document.getElementById('user-role-display').innerText = userNivel;
        }
        aplicarPermissoes();
    });

    // Listeners
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

    todosMenus.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    if(btnConfig) btnConfig.style.display = 'none';

    let permitidos = [];
    if(userNivel === 'SENIOR') {
        permitidos = todosMenus;
        if(btnConfig) btnConfig.style.display = 'block';
    } 
    else if (userNivel === 'PLENO') {
        permitidos = ['m-dash', 'm-estoque', 'm-vendas', 'm-reposicao', 'm-ecommerce', 'm-boleto', 'm-motos'];
    } 
    else { 
        permitidos = ['m-estoque', 'm-vendas', 'm-motos'];
    }

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
