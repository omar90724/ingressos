const express = require('express');
const fs = require('fs');
const app = express();
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});
const PORT = process.env.PORT || 3000;

// DEFINA A SUA CHAVE DE SEGURANÇA AQUI
const CHAVE_MESTRA = "dedicacao2026*"; 

app.use(express.json());
app.use(express.static('public'));

// Inicializa o JSON
if (!fs.existsSync('ingressos.json')) fs.writeFileSync('ingressos.json', '[]');

app.get('/listar-ingressos', (req, res) => {
    const dados = JSON.parse(fs.readFileSync('ingressos.json', 'utf8'));
    res.json(dados);
});

app.post('/criar-ingresso', (req, res) => {
    const { nome } = req.body;
    const dados = JSON.parse(fs.readFileSync('ingressos.json', 'utf8'));
    const novo = { id: Math.random().toString(36).substring(2, 8).toUpperCase(), nome: nome || "Convidado", utilizado: false };
    dados.push(novo);
    fs.writeFileSync('ingressos.json', JSON.stringify(dados, null, 2));
    res.json(novo);
});

app.post('/gerar-lote', (req, res) => {
    const { prefixo, quantidade } = req.body;
    const dados = JSON.parse(fs.readFileSync('ingressos.json', 'utf8'));
    for (let i = 0; i < parseInt(quantidade); i++) {
        dados.push({ id: `${prefixo}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`, nome: `${prefixo} #${i + 1}`, utilizado: false });
    }
    fs.writeFileSync('ingressos.json', JSON.stringify(dados, null, 2));
    res.json({ mensagem: "Lote gerado!" });
});

// ROTA COM VALIDAÇÃO DE TOKEN
app.post('/validar', (req, res) => {
    const { id, token } = req.body;

    // BLOQUEIO DE SEGURANÇA
    if (token !== CHAVE_MESTRA) {
        return res.status(401).json({ mensagem: "Acesso Negado: Apenas Staff Autorizado." });
    }

    const dados = JSON.parse(fs.readFileSync('ingressos.json', 'utf8'));
    const ingresso = dados.find(t => t.id === id);

    if (!ingresso) return res.status(404).json({ mensagem: "Ingresso Inválido!" });
    if (ingresso.utilizado) return res.status(400).json({ mensagem: "Este ingresso já foi usado!" });

    ingresso.utilizado = true;
    fs.writeFileSync('ingressos.json', JSON.stringify(dados, null, 2));
    res.json({ mensagem: `Sucesso! Bem-vindo(a), ${ingresso.nome}!` });
});

app.post('/limpar-evento', (req, res) => {
    fs.writeFileSync('ingressos.json', '[]');
    res.json({ mensagem: "Resetado" });
});

// Rota para importar lista de nomes com prefixo opcional
app.post('/importar-lista', (req, res) => {
    const { nomes, prefixo } = req.body; // Agora recebe também o prefixo
    if (!Array.isArray(nomes)) return res.status(400).send("Lista inválida");

    const dados = JSON.parse(fs.readFileSync('ingressos.json', 'utf8'));
    
    nomes.forEach(nome => {
        if(nome.trim()) {
            // Se houver prefixo, concatena: "Prefixo - Nome". Se não, apenas "Nome".
            const nomeFinal = prefixo ? `${prefixo} - ${nome.trim()}` : nome.trim();
            
            dados.push({
                id: `I${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
                nome: nomeFinal,
                utilizado: false
            });
        }
    });
    
    fs.writeFileSync('ingressos.json', JSON.stringify(dados, null, 2));
    res.json({ mensagem: "Lista importada com sucesso!" });
});

app.listen(PORT, () => console.log(`Servidor Online na porta ${PORT}`));