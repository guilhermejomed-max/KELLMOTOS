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

// --- AUTH SYSTEM ---
function formatUsername(u) { 
    // Garante formato email (ex: admin -> admin@kellmotos.com.br)
    return u.includes("@") ? u.toLowerCase().trim() : u.toLowerCase().trim().replace(/\s+/g,'.') + "@kellmotos.com.br"; 
}

async function fazerLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    if(!u || !p) {
        return Toastify({text: "Preencha todos os campos", style:{background:"var(--danger)"}}).showToast();
    }

    auth.signInWithEmailAndPassword(formatUsername(u), p)
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
        document.getElementById('login-title').innerText = "CRIAR ACESSO";
    } else {
        l.style.display = 'block';
        s.style.display = 'none';
        document.getElementById('login-title').innerText = "KELL MOTOS PRO";
    }
}

async function cadastrarPrimeiraSenha() {
    const u = document.getElementById('setup-username').value;
    const p = document.getElementById('setup-password').value;
    
    if(!u || p.length < 6) return alert("Dados inválidos. Senha min. 6 caracteres.");
    
    const email = formatUsername(u);

    // --- CORREÇÃO CRÍTICA: LIBERAÇÃO DO ADMIN ---
    // Se o usuário for 'admin', o sistema cria automaticamente sem verificação prévia
    if(u.toLowerCase() === 'admin') {
        try {
            // 1. Cria no Authentication
            await auth.createUserWithEmailAndPassword(email, p);
            
            // 2. Cria no Banco de Dados como SENIOR
            await db.collection("funcionarios_kell").doc(email).set({
                email: email,
                nome: "Administrador",
                nivel: "SENIOR",
                criado_em: Date.now()
            });

            alert("Conta ADMIN criada com sucesso! O sistema fará login.");
            return; // O onAuthStateChanged vai lidar com o login
        } catch(e) {
            // Se der erro (ex: email já existe), tenta logar
            if(e.code === 'auth/email-already-in-use') {
                alert("O Admin já existe. Volte e faça login.");
                alternarModoLogin();
            } else {
                alert("Erro ao criar admin: " + e.message);
            }
            return;
        }
    }
    // --------------------------------------------

    // Para outros usuários, verifica se o Admin liberou
    const d = await db.collection("funcionarios_kell").doc(email).get();
    
    if(!d.exists) return alert("Usuário não autorizado! Peça para o Admin liberar seu acesso no menu Equipe.");
    
    auth.createUserWithEmailAndPassword(email, p)
        .then(() => alert("Conta criada! Faça login."))
        .catch(e => alert(e.message));
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
        
        // Redirecionamento inteligente baseado no nível (delay para carregar o nível)
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
    
    // Configurações Empresa
    db.collection("config_kell").doc("empresa").onSnapshot(d => {
        if(d.exists) configEmpresa = d.data();
        if(window.atualizarConfigUI) atualizarConfigUI();
    });

    // Permissões Funcionário
    db.collection("funcionarios_kell").doc(email).onSnapshot(d => {
        userNivel = d.exists ? d.data().nivel : (email.includes('admin') ? 'SENIOR' : 'JUNIOR');
        
        if(document.getElementById('user-role-display')) {
            document.getElementById('user-role-display').innerText = userNivel;
        }
        aplicarPermissoes();
    });

    // Listeners Real-time
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

// --- NAVEGAÇÃO ---
function mudarTab(t) {
    const tabs = ['estoque','vendas','reposicao','ecommerce','boleto','despesas','dash','funcionarios','motos'];
    
    // 1. Esconde Todas
    tabs.forEach(id => {
        const el = document.getElementById('sec-' + id);
        if(el) el.classList.add('hidden');
    });

    // 2. Mostra Alvo
    const target = document.getElementById('sec-' + t);
    if(target) target.classList.remove('hidden');
    
    // 3. Atualiza Menu (Visual)
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    const activeMenu = document.getElementById('m-' + t);
    if(activeMenu) activeMenu.classList.add('active');

    // 4. Título da Página
    const title = t.charAt(0).toUpperCase() + t.slice(1);
    if(document.getElementById('page-title')) {
        document.getElementById('page-title').innerText = title === 'Dash' ? 'Dashboard' : title;
    }
    
    // 5. Força Renderização de Gráfico e KPIs
    if(t === 'dash') {
        requestAnimationFrame(() => {
            if(window.atualizarKPIs) atualizarKPIs();
            setTimeout(() => {
                if(window.renderizarGraficos) renderizarGraficos();
            }, 100);
        });
    }
}

// --- SISTEMA DE PERMISSÕES HIERÁRQUICO ---
function aplicarPermissoes() {
    const todosMenus = ['m-dash','m-estoque','m-vendas','m-reposicao','m-ecommerce','m-boleto','m-despesas','m-funcionarios','m-motos'];
    const btnConfig = document.getElementById('btn-config-geral');

    // 1. Esconde tudo
    todosMenus.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    if(btnConfig) btnConfig.style.display = 'none';

    // 2. Define permitidos
    let permitidos = [];

    if(userNivel === 'SENIOR') {
        permitidos = todosMenus;
        if(btnConfig) btnConfig.style.display = 'block';
    } 
    else if (userNivel === 'PLENO') {
        permitidos = ['m-dash', 'm-estoque', 'm-vendas', 'm-reposicao', 'm-ecommerce', 'm-boleto', 'm-motos'];
    } 
    else { // JUNIOR
        permitidos = ['m-estoque', 'm-vendas', 'm-motos'];
    }

    // 3. Mostra permitidos
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
