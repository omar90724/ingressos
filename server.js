const express = require('express');
const fs = require('fs');
const app = express();
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const JSZip = require('jszip');

app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});
const PORT = process.env.PORT || 3000;

// DEFINA A SUA CHAVE DE SEGURANÇA AQUI
const CHAVE_MESTRA = "dedicacao2026*"; 

app.use(express.json());
app.use(express.static('public'));

app.get('/descarregar-todos', async (req, res) => {
    const zip = new JSZip();
    const pasta = path.join(__dirname, 'public', 'convites_pdf');

    if (!fs.existsSync(pasta)) return res.status(404).send("Gere os PDFs primeiro!");

    const ficheiros = fs.readdirSync(pasta);
    ficheiros.forEach(nome => {
        const conteudo = fs.readFileSync(path.join(pasta, nome));
        zip.file(nome, conteudo);
    });

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=todos_os_convites.zip');
    res.send(buffer);
});

app.post('/gerar-pdfs', async (req, res) => {
    try {
        const dados = JSON.parse(fs.readFileSync('ingressos.json', 'utf8'));
        const pastaPDFs = path.join(__dirname, 'public', 'convites_pdf');
        if (!fs.existsSync(pastaPDFs)) fs.mkdirSync(pastaPDFs, { recursive: true });

        const logoPath = path.join(__dirname, 'logo-evento.png'); 

        for (const ingresso of dados) {
            // 1. FORMATO 9:16 (360x640 pts)
            const doc = new PDFDocument({
                size: [360, 640], 
                margin: 0
            });

            const stream = fs.createWriteStream(path.join(pastaPDFs, `convite_${ingresso.id+" - "+ingresso.nome}.pdf`));
            doc.pipe(stream);

            // --- DESIGN VERTICAL 9:16 ---

            // Fundo Branco total
            doc.rect(0, 0, 360, 640).fill('#ffffff');

            // FAIXA SUPERIOR
            doc.rect(0, 0, 360, 40).fill('#f8f8f8');
            doc.fillColor('#777777').fontSize(9).font('Helvetica').text("DEDICAÇÃO DO SALÃO DO REINO", 0, 15, { align: 'center' });

            // LOGÓTIPO (Centralizado no topo)
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 155, 70, { width: 50 }); // X: 180 - (50/2) = 155
            }

            // NOME DO CONVIDADO (Grande e Centralizado)
            doc.fillColor('#000000')
               .fontSize(22)
               .font('Helvetica-Bold')
               .text(ingresso.nome.toUpperCase(), 20, 160, { align: 'center' });

            // ID
            doc.fillColor('#888888')
               .fontSize(12)
               .font('Helvetica')
               .text(`ID: ${ingresso.id}`, { align: 'center' });

            // LINHA DIVISÓRIA
            doc.strokeColor('#eeeeee').lineWidth(1)
               .moveTo(60, 240).lineTo(300, 240).stroke();

            // INFORMAÇÕES (Data e Local)
            doc.fillColor('#444444')
               .fontSize(14)
               .font('Helvetica')
               .text("19 de abril de 2026", 0, 270, { align: 'center' });
            
            doc.fontSize(12)
               .text("08h30", { align: 'center' });

            doc.moveDown(1.5);
            doc.fontSize(11)
               .fillColor('#666666')
               .text("Rua Leopolodo Rodrigues, 67\nCentro, Estância, SE", { align: 'center', lineGap: 2 });

            // QR CODE (Grande e bem visível no centro/baixo)
            const urlValidacao = `${req.protocol}://${req.get('host')}/validar-auto.html?id=${ingresso.id}`;
            const qrBuffer = await QRCode.toBuffer(urlValidacao, { margin: 1, width: 140 });
            doc.image(qrBuffer, 110, 400, { width: 140 }); // X: 180 - (140/2) = 110

            // TEXTO DE INSTRUÇÃO
            doc.fillColor('#999999').fontSize(10)
               .text("Apresente este QR Code na entrada", 0, 560, { align: 'center' });

            // FAIXA INFERIOR (Rodapé)
            doc.rect(0, 610, 360, 30).fill('#f8f8f8');
            doc.fillColor('#aaaaaa').fontSize(8)
               .text("CONVITE INDIVIDUAL E INTRANSFERÍVEL", 0, 620, { align: 'center' });

            doc.end();
        }

        res.json({ mensagem: "PDFs 9:16 gerados com sucesso!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensagem: "Erro ao gerar PDFs verticais." });
    }
});

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
        dados.push({ 
            // O prefixo entra aqui no ID
            id: `${prefixo}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`, 
            // O nome fica limpo, apenas com o número da sequência
            nome: `Convidado #${i + 1}`, 
            utilizado: false 
        });
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

// Rota para importar lista de nomes com prefixo no ID
app.post('/importar-lista', (req, res) => {
    const { nomes, prefixo } = req.body; 
    if (!Array.isArray(nomes)) return res.status(400).send("Lista inválida");

    const dados = JSON.parse(fs.readFileSync('ingressos.json', 'utf8'));
    
    nomes.forEach(nome => {
        if(nome.trim()) {
            // Definimos o ID usando o prefixo enviado (ou 'I' como padrão se não houver prefixo)
            const prefixoID = prefixo ? prefixo.toUpperCase() : 'I';
            
            dados.push({
                // O prefixo agora vai no ID
                id: `${prefixoID}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
                // O nome fica limpo, apenas com o que foi enviado na lista
                nome: nome.trim(),
                utilizado: false
            });
        }
    });
    
    fs.writeFileSync('ingressos.json', JSON.stringify(dados, null, 2));
    res.json({ mensagem: "Lista importada com sucesso!" });
});

// Rota para eliminar um ingresso específico
app.delete('/eliminar-ingresso/:id', (req, res) => {
    const { id } = req.params;
    const dados = JSON.parse(fs.readFileSync('ingressos.json', 'utf8'));
    
    // Filtramos a lista: guardamos apenas os que NÃO têm o ID informado
    const novaLista = dados.filter(ingresso => ingresso.id !== id);

    if (dados.length === novaLista.length) {
        return res.status(404).json({ mensagem: "Ingresso não encontrado!" });
    }

    fs.writeFileSync('ingressos.json', JSON.stringify(novaLista, null, 2));
    res.json({ mensagem: "Ingresso eliminado com sucesso!" });
});

app.listen(PORT, () => console.log(`Servidor Online na porta ${PORT}`));