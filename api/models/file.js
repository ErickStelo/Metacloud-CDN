const { DataTypes, Sequelize } = require('sequelize');

module.exports = (sequelize) => {
  const File = sequelize.define('File', {
    file_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    original_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    unique_name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Nome único usado no MinIO
    },
    mime_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    size_bytes: {
      type: DataTypes.BIGINT, // Usar BIGINT para tamanhos maiores
      allowNull: false,
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
    },
    // usuario_id e bucket_id serão adicionados via associações
    // Você pode adicionar outros metadados aqui, como:
    // description: DataTypes.TEXT,
    // upload_complete: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'files',
    timestamps: true, // Mantém o gerenciamento automático do Sequelize
  });

  return File;
}; 