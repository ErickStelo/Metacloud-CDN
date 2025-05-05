const { DataTypes, Sequelize } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const Usuario = sequelize.define('Usuario', {
    usuario_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    usuario_nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    usuario_api_token: {
      type: DataTypes.STRING, // Usaremos STRING, TEXT pode ser excessivo e menos performático para indexação
      allowNull: false,
      unique: true,
      defaultValue: () => crypto.randomBytes(32).toString('hex') // Gera um token seguro de 64 caracteres hex
    },
    usuario_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW') // Define DEFAULT NOW() no DB
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW') // Define DEFAULT NOW() no DB
    }
  }, {
    tableName: 'usuarios', // Nome explícito da tabela
    timestamps: true, // Mantém o gerenciamento automático do Sequelize (especialmente para updatedAt)
    hooks: {
      // Hook para garantir que um novo token seja gerado se explicitamente setado como null ou alterado
      // Não regera automaticamente em cada update, apenas se for pedido.
      beforeValidate: (usuario, options) => {
        // Se for uma criação ou se o token foi explicitamente alterado para um valor "falsy" mas não é uma atualização simples
        // (Este hook pode precisar de ajuste fino dependendo de como você quer gerenciar a regeração de tokens)
        if ((usuario.isNewRecord || usuario.changed('usuario_api_token')) && !usuario.usuario_api_token) {
           usuario.usuario_api_token = crypto.randomBytes(32).toString('hex');
        }
      }
    }
  });

  return Usuario;
}; 