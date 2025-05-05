const { DataTypes, Sequelize } = require('sequelize');

module.exports = (sequelize) => {
  const Bucket = sequelize.define('Bucket', {
    bucket_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    bucket_nome: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Garante que nomes de bucket sejam únicos
    },
    // Definições explícitas para timestamps
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
    // Você pode adicionar mais campos aqui se necessário, por exemplo:
    // regiao: DataTypes.STRING,
    // publico: DataTypes.BOOLEAN
  }, {
    tableName: 'buckets',
    timestamps: true, // Mantém o gerenciamento automático do Sequelize
  });

  return Bucket;
}; 