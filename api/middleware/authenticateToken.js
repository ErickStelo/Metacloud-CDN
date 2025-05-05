const { Usuario } = require('../db'); // Ajuste o caminho se necessário

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Pega o token do formato "Bearer TOKEN"

  if (token == null) {
    // Se não há token, não autorizado
    return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
  }

  try {
    // Busca o usuário pelo token no banco de dados
    const usuario = await Usuario.findOne({ where: { usuario_api_token: token } });

    if (!usuario) {
      // Se o token não corresponde a nenhum usuário, acesso proibido
      return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }

    // Anexa o usuário encontrado ao objeto da requisição para uso posterior nas rotas
    // Selecionamos apenas os campos necessários para evitar expor dados sensíveis como o próprio token
    req.user = {
        id: usuario.usuario_id,
        nome: usuario.usuario_nome,
        isAdmin: usuario.usuario_admin
    };

    next(); // Passa para o próximo middleware ou rota
  } catch (error) {
    console.error("Erro durante a autenticação do token:", error);
    return res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
  }
};

module.exports = authenticateToken; 