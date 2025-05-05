const _ = require('lodash');

// Middleware de tratamento de erros centralizado
const errorHandler = (err, req, res, next) => {
  console.error("ERRO DETECTADO PELO HANDLER:", err); // Log do erro completo no servidor

  // Pega o status code do erro, se existir, ou define como 500 (Internal Server Error)
  const statusCode = err.statusCode || 500;

  // Mensagem de erro padrão para erros 500 para não expor detalhes internos
  let message = 'Ocorreu um erro inesperado no servidor.';

  // Se for um erro 'conhecido' (com statusCode < 500), usamos a mensagem do próprio erro.
  // Podemos adicionar mais lógica aqui para tratar tipos específicos de erro (ex: SequelizeValidationError)
  if (statusCode < 500) {
    message = err.message || message; // Usa a mensagem do erro ou a padrão de status < 500
  }
  
  // Verifica se o erro é do Multer (limite de tamanho, etc.)
  if (err.name === 'MulterError') {
      message = `Erro no upload do arquivo: ${err.message} (Campo: ${err.field})`;
      // Geralmente erros do multer são 'Bad Request'
      // statusCode = 400; // Poderia sobrescrever se err.statusCode não estiver setado
  }

  // TODO: Em ambiente de produção, evitar enviar o stack trace
  const errorResponse = {
    error: {
      message: message,
      // Apenas incluir detalhes extras (como 'code' do multer) se não for erro 500 genérico
      ...(statusCode !== 500 && err.code && { code: err.code }),
      // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined, // Exemplo para incluir stack em dev
    }
  };

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler; 