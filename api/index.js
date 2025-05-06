require('dotenv').config(); // Carrega variáveis do .env

const express = require('express');
const _ = require('lodash'); // Exemplo de uso do lodash
const fs = require('fs'); // Importar fs para ler o arquivo
const path = require('path'); // Importar path para montar o caminho
const db = require('./db'); // Importa a configuração do banco de dados
const authenticateToken = require('./middleware/authenticateToken'); // Importa o middleware
const fileRoutes = require('./routes/fileRoutes'); // Importa as rotas de arquivos
const swaggerUi = require('swagger-ui-express'); // Importar swagger-ui
const { minioClient } = require('./minioClient'); // Importar o minioClient
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler'); // Importar o handler de erro

const app = express();
const PORT = process.env.API_PORT || 3000;

// Ler o arquivo swagger.json
const swaggerFilePath = path.join(__dirname, 'docs', 'swagger.json');
let swaggerDocument;
try {
    const swaggerFileContent = fs.readFileSync(swaggerFilePath, 'utf8');
    swaggerDocument = JSON.parse(swaggerFileContent);
    // Atualizar dinamicamente a URL do servidor no Swagger lido do arquivo
    if (swaggerDocument.servers && swaggerDocument.servers[0]) {
        swaggerDocument.servers[0].url = `http://localhost:${PORT}`;
    }
    console.log('Arquivo Swagger docs/swagger.json carregado com sucesso.');
} catch (error) {
    console.error('Erro ao ler ou parsear o arquivo swagger.json:', error);
    // Decide o que fazer em caso de erro: usar um spec padrão, encerrar, etc.
    // Por enquanto, vamos apenas logar e continuar sem a doc UI.
    swaggerDocument = { // Fallback básico se o arquivo falhar
        openapi: '3.0.0',
        info: { title: 'API Docs (Erro ao carregar)', version: '0.0.0' },
        paths: {}
    };
}

// --- Middleware ---
app.use(express.json()); // Para parsear JSON no corpo das requisições
app.use(helmet()); // Adiciona headers de segurança básicos

// Remover // TODO: Configurar cliente MinIO
// Remover // TODO: Implementar rotas (auth, upload, delete, etc)

// --- Rotas --- 
// Rota de Health Check
const startTime = Date.now();
app.get('/health', (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    res.status(200).json({ 
        status: 'UP', 
        timestamp: new Date().toISOString(),
        uptime: uptimeSeconds
    });
});

// Rota para obter informações do usuário autenticado
app.get('/me', authenticateToken, (req, res) => {
    res.json({ 
        id: req.user.id, 
        nome: req.user.nome, 
        isAdmin: req.user.isAdmin 
    });
});

// Monta as rotas de arquivos diretamente na raiz (sem prefixo '/files')
// O NGINX externo tratará o roteamento baseado no domínio/prefixo (ex: /api)
app.use('/', fileRoutes);

// Servir Swagger UI usando o documento lido do arquivo
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Middleware de tratamento de erros (DEVE SER O ÚLTIMO middleware)
app.use(errorHandler);

// --- Inicialização --- 

// Adicionada função para encapsular a inicialização
const startServer = async () => {
    try {
        // 1. Sincronizar banco de dados
        await db.sequelize.sync({ alter: true }); // Usar alter: true em dev, CUIDADO em prod
        console.log('Banco de dados sincronizado com sucesso.');

        // 2. Testar conexão com MinIO
        try {
            console.log('Tentando conectar ao MinIO...');
            await minioClient.listBuckets(); // Tenta listar buckets para verificar conexão/auth
            console.log('Conexão com MinIO estabelecida com sucesso.');
        } catch (minioError) {
            console.error('----------------------------------------------------');
            console.error('ERRO FATAL: Falha ao conectar com o MinIO.');
            console.error('Verifique as variáveis de ambiente MINIO_* (.env) e se o serviço MinIO está acessível.');
            console.error('Erro detalhado:', minioError.message || minioError);
            console.error('----------------------------------------------------');
            process.exit(1); // Encerra a aplicação se não conseguir conectar ao MinIO
        }

        // 3. Iniciar servidor Express
        app.listen(PORT, () => {
            console.log(`API rodando em http://localhost:${PORT}`);
            console.log(`Documentação Swagger disponível em http://localhost:${PORT}/docs`);
        });

    } catch (error) {
        console.error('Erro ao iniciar a aplicação:', error);
        process.exit(1);
    }
};

// Chamar a função de inicialização
startServer();

module.exports = app; // Exportar app para possíveis testes 