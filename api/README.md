# Backend da API de Gerenciamento de Arquivos

Este é o backend da aplicação de gerenciamento de arquivos, desenvolvido em Node.js com Express, Sequelize (PostgreSQL) e MinIO.

## Visão Geral

A API permite que usuários autenticados façam upload, download, exclusão e obtenham informações sobre arquivos armazenados em buckets MinIO. O acesso é controlado por tokens de API por usuário e permissões associadas a buckets específicos ou status de administrador.

**Tecnologias Principais:**

*   **Node.js:** Ambiente de execução JavaScript.
*   **Express:** Framework web para Node.js.
*   **Sequelize:** ORM para interagir com o banco de dados PostgreSQL.
*   **PostgreSQL:** Banco de dados relacional para armazenar metadados e permissões.
*   **MinIO:** Servidor de armazenamento de objetos compatível com S3.
*   **dotenv:** Gerenciamento de variáveis de ambiente.
*   **jsonwebtoken:** (Implícito pela autenticação) Embora não mencionado explicitamente, a autenticação Bearer Token geralmente usa JWT. *Nota: A descrição original menciona tokens estáticos, o README pode precisar de ajuste se for o caso.*
*   **multer:** Middleware para lidar com uploads `multipart/form-data`.
*   **helmet:** Middleware para adicionar headers básicos de segurança HTTP.
*   **swagger-ui-express:** Para servir a documentação interativa da API.

## Funcionalidades

*   **Upload de Arquivos:** `POST /files/upload` (requer autenticação, permissão no bucket, `multipart/form-data` com `file`, `bucketName`, `path` opcional, `replace` opcional).
*   **Exclusão de Arquivos:** `DELETE /files` (requer autenticação, permissão de admin ou dono do arquivo, corpo JSON com `bucketName` e `path`).
*   **Informações do Arquivo:** `POST /files/info` (requer autenticação, permissão no bucket ou dono, corpo JSON com `bucketName` e `path`).
*   **Download de Arquivos:** `GET /files/download` (requer autenticação, permissão no bucket ou dono, query params `bucketName` e `path`).
*   **Status da API:** `GET /health` (público).
*   **Informações do Usuário:** `GET /me` (requer autenticação).
*   **Documentação da API:** `GET /docs` (servida via Swagger UI).

## Configuração e Instalação

1.  **Pré-requisitos:**
    *   Node.js (versão LTS recomendada)
    *   npm ou yarn
    *   Instância PostgreSQL acessível
    *   Instância MinIO acessível

2.  **Clonar o repositório (se aplicável):**
    ```bash
    git clone <url-do-repositorio>
    cd metacloud/backend
    ```

3.  **Instalar Dependências:**
    ```bash
    npm install
    ```

4.  **Configurar Variáveis de Ambiente:**
    *   Crie um arquivo `.env` na raiz da pasta `backend`.
    *   Copie o conteúdo de `.env.example` (se existir) ou adicione as seguintes variáveis:

    ```dotenv
    # Configurações da Aplicação
    PORT=3000 # Porta onde a API será executada
    NODE_ENV=development # ou production

    # Configurações do Banco de Dados (PostgreSQL via Sequelize)
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=seu_usuario_db
    DB_PASSWORD=sua_senha_db
    DB_NAME=seu_banco_db

    # Configurações do MinIO
    MINIO_ENDPOINT=localhost
    MINIO_PORT=9000
    MINIO_USE_SSL=false # true se o MinIO usa HTTPS
    MINIO_ACCESS_KEY=sua_access_key_minio
    MINIO_SECRET_KEY=sua_secret_key_minio

    # Configuração da URL Pública (Opcional, para links de download/acesso)
    # Se omitido, usará http://localhost:PORT/files como base
    PUBLIC_FILE_URL_BASE=http://seu-dominio-publico.com/files
    ```

    *   **Importante:** Ajuste os valores conforme seu ambiente. A variável `STATIC_API_TOKENS` precisa corresponder à lógica implementada em `middleware/authenticateToken.js`. A descrição inicial menciona que a verificação é feita no middleware, implicando que essa variável ou uma consulta ao DB é usada lá.

5.  **Banco de Dados:**
    *   Certifique-se de que o banco de dados (`DB_NAME`) e o usuário (`DB_USER`) existam no PostgreSQL.
    *   Ao iniciar a API, o Sequelize tentará sincronizar os modelos com o banco (`sequelize.sync({ alter: true })`). Isso pode alterar tabelas existentes. Para produção, considere usar migrações.
    *   Um schema de referência pode ser encontrado em `scripts-sql/schema.sql` (se gerado).

6.  **MinIO:**
    *   Certifique-se de que o servidor MinIO esteja rodando e acessível.
    *   Os buckets referenciados nas requisições (ex: `bucketName`) precisam existir no MinIO *e* no banco de dados (tabela `buckets`) para que os uploads funcionem.

## Executando a Aplicação

```bash
npm start
```

Ou para desenvolvimento com reinicialização automática (se `nodemon` estiver instalado):

```bash
npm run dev # (Necessário adicionar o script "dev": "nodemon index.js" em package.json)
```

A API estará disponível em `http://localhost:PORT` (ou a porta configurada). A documentação interativa estará em `http://localhost:PORT/docs`.

## Autenticação

A API utiliza tokens Bearer estáticos para autenticação. Cada requisição para endpoints protegidos deve incluir o header:

```
Authorization: Bearer <seu-token-aqui>
```

O token é validado pelo middleware `middleware/authenticateToken.js`. Os tokens válidos e os usuários associados são atualmente definidos na variável de ambiente `STATIC_API_TOKENS` (ou consultados no banco de dados, dependendo da implementação exata do middleware).

## Segurança

*   **Helmet:** O middleware `helmet` é utilizado para definir headers HTTP de segurança básicos, ajudando a proteger contra vulnerabilidades comuns (XSS, clickjacking, etc.).
*   **Autenticação/Autorização:** O acesso aos arquivos é restrito com base no token do usuário e suas permissões (admin, dono do arquivo ou acesso ao bucket via tabela `usuario_buckets`).
*   **Sanitização:** Nomes de arquivos e paths são sanitizados para remover caracteres potencialmente perigosos e evitar path traversal (`../`).

## Tratamento de Erros

A API implementa um **middleware de tratamento de erros centralizado** (`middleware/errorHandler.js`). Qualquer erro ocorrido durante o processamento de uma requisição (seja um erro de validação, permissão, banco de dados, MinIO ou erro inesperado) é capturado por este middleware.

*   Erros são logados no console do servidor.
*   Respostas de erro são padronizadas em formato JSON.
*   Para erros do servidor (status 500), mensagens genéricas são enviadas ao cliente para evitar expor detalhes internos.
*   Para erros conhecidos (status < 500, como 400, 403, 404), mensagens mais específicas definidas no código (usando `err.message` e `err.statusCode`) são retornadas.

As rotas em `routes/fileRoutes.js` foram refatoradas para usar `next(error)` em seus blocos `catch`, garantindo que todos os erros sejam delegados ao handler centralizado.