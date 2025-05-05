const Minio = require('minio');
require('dotenv').config();

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT, 10),
  useSSL: process.env.MINIO_USE_SSL === 'true', // Converte string para boolean
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});


module.exports = {
    minioClient,
    // ensureBucketExists // Exporte se quiser usar a função
}; 