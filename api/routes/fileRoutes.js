const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { minioClient } = require('../minioClient');
const db = require('../db');
const authenticateToken = require('../middleware/authenticateToken');
const upload = require('../middleware/uploadMiddleware');
const { MulterError } = require('multer');

const router = express.Router();

// Função para sanitizar nome de arquivo
function sanitizeFilename(filename) {
    if (!filename) return '';
    // 1. Remove a extensão para sanitizar o base name
    const extension = path.extname(filename);
    let baseName = path.basename(filename, extension);

    // 2. Substitui espaços por underscores
    baseName = baseName.replace(/\s+/g, '_');

    // 3. Remove caracteres não permitidos (mantém letras, números, _, -, .)
    //    Atenção: Não estamos permitindo acentos ou caracteres unicode aqui para simplificar.
    //    Para suporte unicode, a regex precisaria ser mais complexa.
    baseName = baseName.replace(/[^a-zA-Z0-9_.-]/g, '');

    // 4. Evita nomes vazios ou apenas pontos
    if (!baseName || /^\.+$/.test(baseName)) {
        return ''; // Retorna vazio se o nome for inválido após sanitização
    }

    // 5. Junta o nome base sanitizado com a extensão original (sanitizada também por segurança)
    const sanitizedExt = extension.replace(/[^a-zA-Z0-9.]/g, '');

    return `${baseName}${sanitizedExt}`;
}

// Função para encontrar um nome de objeto único no MinIO
async function findUniqueObjectName(bucketName, desiredObjectName) {
    let objectName = desiredObjectName;
    let counter = 0;
    const extension = path.extname(objectName);
    const baseName = path.basename(objectName, extension);

    while (true) {
        try {
            // Tenta obter metadados do objeto. Se não existir, lança erro.
            await minioClient.statObject(bucketName, objectName);
            // Se chegou aqui, o objeto existe. Tenta o próximo nome.
            counter++;
            objectName = `${baseName}_(${counter})${extension}`;
        } catch (err) {
            // Verifica se o erro é "não encontrado" (código comum para S3/MinIO)
            if (err.code === 'NotFound' || err.code === 'NoSuchKey') {
                return objectName; // Nome único encontrado!
            }
            // Se for outro erro, relança
            console.error(`Erro ao verificar objeto "${objectName}" no bucket "${bucketName}":`, err);
            throw new Error('Erro ao verificar existência do objeto no MinIO.');
        }
    }
}

// Rota de Upload
router.post('/file/upload', authenticateToken, upload.single('file'), async (req, res, next) => {
    // Ler campos do corpo da requisição
    const { bucketName, path: requestedPath = '' } = req.body;
    // Converter o campo 'replace' para boolean (false se ausente ou não for "true")
    const replaceFile = String(req.body.replace).toLowerCase() === 'true';
    const usuarioId = req.user.id;
    const isAdmin = req.user.isAdmin;

    // Validar campos obrigatórios - Erros 400 são passados para o handler
    if (!req.file) {
        const err = new Error("Nenhum arquivo enviado (campo 'file' obrigatório).");
        err.statusCode = 400;
        return next(err); // Usa next
    }
    if (!bucketName) {
        const err = new Error("Nome do bucket não fornecido (campo 'bucketName' obrigatório).");
        err.statusCode = 400;
        return next(err); // Usa next
    }

    try {
        // 1. Verificar se o bucket existe no nosso DB
        const bucket = await db.Bucket.findOne({ where: { bucket_nome: bucketName } });
        if (!bucket) {
            const err = new Error(`Bucket "${bucketName}" não encontrado ou não permitido.`);
            err.statusCode = 404;
            return next(err); // Usa next
        }
        const bucketId = bucket.bucket_id;

        // 2. Verificar Permissão do Usuário no Bucket
        if (!isAdmin) {
            const usuario = await db.Usuario.findByPk(usuarioId);
            const temAcesso = await usuario.hasBucket(bucket);
            if (!temAcesso) {
                const err = new Error('Usuário não tem permissão para fazer upload neste bucket.');
                err.statusCode = 403;
                return next(err); // Usa next
            }
        }

        // 3. Verificar se o Bucket Realmente Existe no MinIO
        const bucketExistsInMinio = await minioClient.bucketExists(bucketName);
        if (!bucketExistsInMinio) {
            console.warn(`Tentativa de upload para bucket "${bucketName}" que não existe no MinIO.`);
            const err = new Error(`Bucket "${bucketName}" não existe no armazenamento.`);
            err.statusCode = 404;
            return next(err); // Usa next
        }

        // 4. Sanitizar Path e Nome Original
        const sanitizedPath = requestedPath
            .replace(/\.\./g, '')
            .replace(/[^a-zA-Z0-9\/_-]/g, '')
            .split('/')
            .filter(Boolean)
            .join('/');

        const originalName = req.file.originalname;
        let sanitizedOriginalName = sanitizeFilename(originalName);
        if (!sanitizedOriginalName) {
            console.warn(`Nome original "${originalName}" resultou em nome vazio após sanitização. Usando UUID.`);
            const fileExtension = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '');
            sanitizedOriginalName = `${uuidv4()}${fileExtension}`;
        }

        // 5. Determinar o nome final do objeto
        const objectNameBase = sanitizedPath ? `${sanitizedPath}/${sanitizedOriginalName}` : sanitizedOriginalName;
        let finalObjectName;
        let fileEntry; // Variável para armazenar o registro do arquivo no DB

        if (replaceFile) {
            finalObjectName = objectNameBase;
            // Tentativa de encontrar registro existente no DB para atualizar
            fileEntry = await db.File.findOne({ where: { unique_name: finalObjectName, bucket_id: bucketId } });
        } else {
            // Encontra nome único tratando colisões
            finalObjectName = await findUniqueObjectName(bucketName, objectNameBase);
            // Se não for replace, sempre criaremos um novo registro no DB
            fileEntry = null;
        }

        // 6. Preparar metadados e fazer Upload para o MinIO
        const mimeType = req.file.mimetype;
        const sizeBytes = req.file.size;
        const metaData = { 'Content-Type': mimeType };
        await minioClient.putObject(bucketName, finalObjectName, req.file.buffer, metaData);

        // 7. Salvar/Atualizar metadados no banco de dados
        if (fileEntry) { // Atualiza registro existente (caso replace=true e encontrado)
            fileEntry.original_name = originalName;
            fileEntry.mime_type = mimeType;
            fileEntry.size_bytes = sizeBytes;
            fileEntry.usuario_id = usuarioId; // Atualiza quem modificou por último
            // updatedAt será atualizado automaticamente pelo Sequelize
            await fileEntry.save();
            console.log(`Metadados do arquivo atualizados no DB para: ${finalObjectName}`);
        } else { // Cria novo registro
            fileEntry = await db.File.create({
                original_name: originalName,
                unique_name: finalObjectName,
                mime_type: mimeType,
                size_bytes: sizeBytes,
                usuario_id: usuarioId,
                bucket_id: bucketId,
            });
            console.log(`Novo registro de arquivo criado no DB para: ${finalObjectName}`);
        }

        // 8. Construir URL pública
        const publicUrlBase = process.env.PUBLIC_FILE_URL_BASE;
        const publicUrl = `${publicUrlBase}/${bucketName}/${finalObjectName}`;

        // 9. Retornar sucesso
        res.status(replaceFile && await db.File.count({ where: { unique_name: finalObjectName, bucket_id: bucketId } }) > 0 ? 200 : 201) // Retorna 200 OK se substituiu, 201 Created se novo
           .json({
            message: replaceFile ? 'Arquivo substituído com sucesso!' : 'Upload realizado com sucesso!',
            fileId: fileEntry.file_id,
            fileName: finalObjectName,
            originalName: originalName,
            mimeType: mimeType,
            size: sizeBytes,
            bucket: bucketName,
            url: publicUrl
        });

    } catch (error) {
        console.error("Erro durante o upload:", error);
        // Erros do Multer já têm nome e mensagem, o handler pode identificar
        if (error instanceof MulterError) {
             // Poderíamos definir statusCode aqui se quiséssemos, mas o handler já pega
             // error.statusCode = 400; 
        } else {
            // Para erros genéricos, não definimos statusCode (irá para 500 no handler)
            // A mensagem original do erro será logada, mas não necessariamente enviada ao cliente
        }
        next(error); // Passa qualquer erro para o handler centralizado
    }
});

// Rota de Exclusão
router.delete('/file', authenticateToken, async (req, res, next) => {
    // Ler bucketName e path (novo nome do parâmetro) do corpo
    const { bucketName, path: objectPath } = req.body;
    const usuarioId = req.user.id;
    const isAdmin = req.user.isAdmin;

    // Validar entrada
    if (!bucketName || !objectPath) {
        const err = new Error('Campos "bucketName" e "path" são obrigatórios.');
        err.statusCode = 400;
        return next(err); // Usa next
    }

    try {
        // 1. Encontrar o registro do arquivo no DB usando unique_name (que agora é objectPath)
        const fileRecord = await db.File.findOne({
            where: { unique_name: objectPath }, // Usar objectPath
            include: [{
                model: db.Bucket,
                where: { bucket_nome: bucketName },
                required: true // Garante que só encontre se o bucketName corresponder
            }]
        });

        if (!fileRecord) {
            const err = new Error('Arquivo não encontrado no banco de dados para este bucket e path.');
            err.statusCode = 404;
            return next(err); // Usa next
        }

        // 2. Verificar Permissão para Excluir
        // Permite se for admin OU se for o usuário que fez o upload original
        if (!isAdmin && fileRecord.usuario_id !== usuarioId) {
            const err = new Error('Usuário não tem permissão para excluir este arquivo.');
            err.statusCode = 403;
            return next(err); // Usa next
        }

        // 3. Remover o objeto do MinIO usando objectPath
        try {
            await minioClient.removeObject(bucketName, objectPath); // Usar objectPath
            console.log(`Arquivo "${objectPath}" removido do bucket MinIO "${bucketName}".`); // Log atualizado
        } catch (minioError) {
            // Se o erro for 'NotFound', talvez o arquivo já não existisse no MinIO.
            // Consideramos a operação bem-sucedida do ponto de vista do usuário,
            // pois o objetivo (arquivo não existir mais) foi alcançado.
            // Logamos um aviso, mas continuamos para remover do DB.
            if (minioError.code === 'NoSuchKey' || minioError.code === 'NotFound') {
                console.warn(`Arquivo "${objectPath}" não encontrado no MinIO durante a exclusão, mas será removido do DB.`); // Log atualizado
            } else {
                // Se for outro erro do MinIO, lançamos para o catch externo.
                throw minioError;
            }
        }

        // 4. Remover o registro do banco de dados
        await fileRecord.destroy();
        console.log(`Registro do arquivo "${objectPath}" removido do banco de dados.`); // Log atualizado

        // 5. Retornar sucesso (204 No Content é comum para DELETE)
        res.status(204).send();

    } catch (error) {
        console.error("Erro durante a exclusão do arquivo:", error);
        // Não precisa mais verificar error.code aqui, o handler fará isso
        next(error); // Passa o erro para o handler centralizado
    }
});

// Função auxiliar para buscar arquivo e verificar permissão (usada por /download e /info)
// Modificada para chamar next(error) em caso de falha
async function findAndAuthorizeFile(req, res, next) {
    const params = req.method === 'GET' ? req.query : req.body; // Usa query para GET, body para POST/outros
    const { bucketName, path: objectPath } = params;
    const usuarioId = req.user.id;
    const isAdmin = req.user.isAdmin;

    // Validar entrada
    if (!bucketName || !objectPath) {
        const err = new Error(`Parâmetros "bucketName" e "path" são obrigatórios (${req.method === 'GET' ? 'query' : 'body'}).`);
        err.statusCode = 400;
        next(err); // Usa next
        return null; // Indica erro
    }

    try {
        const fileRecord = await db.File.findOne({
            where: { unique_name: objectPath },
            include: [
                {
                    model: db.Bucket,
                    where: { bucket_nome: bucketName },
                    required: true
                },
                {
                    model: db.Usuario, // Inclui o usuário que fez o upload
                    attributes: ['usuario_id', 'usuario_nome'] // Seleciona apenas campos seguros
                }
            ]
        });

        if (!fileRecord) {
            const err = new Error('Arquivo não encontrado no banco de dados para este bucket e path.');
            err.statusCode = 404;
            next(err); // Usa next
            return null; // Indica erro
        }

        // Verificar Permissão de Acesso
        let hasAccess = false;
        if (isAdmin || fileRecord.usuario_id === usuarioId) {
            hasAccess = true;
        } else {
            const usuario = await db.Usuario.findByPk(usuarioId);
            if (usuario) {
                hasAccess = await usuario.hasBucket(fileRecord.Bucket);
            }
        }

        if (!hasAccess) {
            const err = new Error('Usuário não tem permissão para acessar este arquivo.');
            err.statusCode = 403;
            next(err); // Usa next
            return null; // Indica erro
        }

        return fileRecord; // Retorna o registro do arquivo se tudo ok

    } catch (error) {
        console.error("Erro ao buscar/autorizar arquivo:", error);
        // Passa o erro para o handler centralizado
        next(error);
        return null; // Indica erro
    }
}

// Rota para Obter Informações do Arquivo (agora POST com body)
router.post('/file/info', authenticateToken, async (req, res, next) => {
    try {
        // Usa a função auxiliar refatorada, que chama next() em caso de erro
        const fileRecord = await findAndAuthorizeFile(req, res, next);
        if (!fileRecord) return; // Se retornou null, o erro já foi tratado por next(err)

        // Se chegou aqui, a busca e autorização foram bem-sucedidas

        // Retornar Informações JSON
        const publicUrlBase = process.env.PUBLIC_FILE_URL_BASE || `http://localhost:${process.env.PORT || 3000}/files`;
        const publicUrl = `${publicUrlBase}/${fileRecord.Bucket.bucket_nome}/${fileRecord.unique_name}`;

        res.status(200).json({
            fileId: fileRecord.file_id,
            path: fileRecord.unique_name,
            originalName: fileRecord.original_name,
            mimeType: fileRecord.mime_type,
            size: fileRecord.size_bytes,
            bucket: fileRecord.Bucket.bucket_nome,
            uploadedAt: fileRecord.createdAt,
            lastModified: fileRecord.updatedAt,
            uploader: fileRecord.Usuario ? fileRecord.Usuario.usuario_nome : null,
            url: publicUrl // Mantém a URL pública
        });

    } catch (error) { // Catch para erros inesperados DENTRO desta rota (improvável com a func aux)
        console.error("Erro inesperado na rota /info:", error);
        next(error); // Delega ao handler central
    }
});

// Rota para Download do Arquivo (permanece GET com query params)
router.get('/file/download', authenticateToken, async (req, res, next) => {
    try {
        // Usa a função auxiliar refatorada
        const fileRecord = await findAndAuthorizeFile(req, res, next);
        if (!fileRecord) return; // Erro já tratado por next(err) na função auxiliar

        const bucketName = fileRecord.Bucket.bucket_nome;
        const objectPath = fileRecord.unique_name;

        // Ação: Download
        const stat = await minioClient.statObject(bucketName, objectPath);
        const stream = await minioClient.getObject(bucketName, objectPath);

        const safeOriginalName = sanitizeFilename(fileRecord.original_name) || 'download';

        res.setHeader('Content-Disposition', `attachment; filename="${safeOriginalName}"`);
        res.setHeader('Content-Type', fileRecord.mime_type);
        res.setHeader('Content-Length', stat.size);

        stream.pipe(res);

        // Listener de erro no stream agora também usa next()
        stream.on('error', (streamError) => {
            console.error("Erro no stream do MinIO durante download:", streamError);
            // Cria um erro com mensagem específica para o stream
            const err = new Error('Erro ao ler o arquivo do armazenamento.');
            err.originalError = streamError; // Anexa o erro original se necessário
            next(err); // Passa para o handler centralizado
        });

        // Não há mais catch aqui, pois o erro do stream é tratado acima
        // e erros no statObject/getObject serão pegos pelo catch externo abaixo

    } catch(error) { // Pega erros do statObject, getObject ou outros erros síncronos
        console.error(`Erro ao obter objeto para download:`, error);
        if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
            error.statusCode = 404;
            error.message = 'Arquivo não encontrado no armazenamento.';
        } else {
            // Outros erros do MinIO ou inesperados vão como 500
            error.message = error.message || 'Erro ao acessar o arquivo no armazenamento.';
        }
        next(error); // Passa o erro (com status code e mensagem ajustados) para o handler
    }
});

module.exports = router; 