const { DataTypes, Sequelize } = require('sequelize');

module.exports = (sequelize) => {
  const UsuarioBucket = sequelize.define('usuario_bucket', { // Nome do modelo geralmente singular
    usuario_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'usuarios', // Nome da tabela referenciada
        key: 'usuario_id'
      },
      primaryKey: true // Parte da chave primária composta
    },
    bucket_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'buckets', // Nome da tabela referenciada
        key: 'bucket_id'
      },
      primaryKey: true // Parte da chave primária composta
    },
    // Timestamps explícitos com default
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
    }
    // Se você tivesse campos extras, eles viriam aqui.
    // Ex: nivel_permissao: DataTypes.STRING
  }, {
    tableName: 'usuario_buckets', // Nome explícito da tabela no plural
    timestamps: true // Mantém o gerenciamento do Sequelize
  });

  return UsuarioBucket;
}; 