const { Sequelize } = require('sequelize');
require('dotenv').config(); // Garante que as variáveis de ambiente sejam carregadas

const sequelize = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres', // Ou 'mysql', 'sqlite', 'mariadb', 'mssql'
    logging: process.env.NODE_ENV === 'development' ? console.log : false, // Log SQL queries in development
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Carregar modelos
db.Usuario = require('./models/usuario')(sequelize, Sequelize);
db.Bucket = require('./models/bucket')(sequelize, Sequelize);
db.File = require('./models/file')(sequelize, Sequelize);
db.UsuarioBucket = require('./models/usuario_bucket')(sequelize, Sequelize);

// Definir Associações
// Relação Usuario <-> Bucket (Many-to-Many)
db.Usuario.belongsToMany(db.Bucket, { through: db.UsuarioBucket, foreignKey: 'usuario_id', otherKey: 'bucket_id' });
db.Bucket.belongsToMany(db.Usuario, { through: db.UsuarioBucket, foreignKey: 'bucket_id', otherKey: 'usuario_id' });

// Relações com File
// Um Usuário pode ter muitos Files (One-to-Many)
db.Usuario.hasMany(db.File, { foreignKey: 'usuario_id' });
db.File.belongsTo(db.Usuario, { foreignKey: 'usuario_id' });

// Um Bucket pode conter muitos Files (One-to-Many)
db.Bucket.hasMany(db.File, { foreignKey: 'bucket_id' });
db.File.belongsTo(db.Bucket, { foreignKey: 'bucket_id' });

// Função para testar a conexão e sincronizar modelos (opcional, útil para dev)
db.connect = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
    // Cuidado: { force: true } apaga e recria as tabelas. Use com moderação em dev.
    // await sequelize.sync({ force: process.env.NODE_ENV === 'development' });
    await sequelize.sync({ alter: true }); // Tenta alterar tabelas existentes para corresponder ao modelo
    console.log("Modelos sincronizados com o banco de dados.");
  } catch (error) {
    console.error('Não foi possível conectar ao banco de dados:', error);
    process.exit(1); // Sai da aplicação se não conseguir conectar ao DB
  }
};

module.exports = db; 