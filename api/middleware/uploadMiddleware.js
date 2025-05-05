const multer = require('multer');

// Configuração do Multer para armazenar arquivos em memória
// Isso é útil para processar o arquivo antes de enviá-lo para o MinIO
const storage = multer.memoryStorage();

// Filtro opcional para aceitar apenas certos tipos de arquivo
const fileFilter = (req, file, cb) => {
  // Exemplo: Aceitar apenas imagens jpeg e png
  // if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
  //   cb(null, true);
  // } else {
  //   cb(new Error('Tipo de arquivo inválido. Apenas JPEG e PNG são permitidos.'), false);
  // }
  // Por enquanto, aceita qualquer arquivo:
  cb(null, true);
};

// Limite de tamanho do arquivo (ex: 50MB)
const limits = {
  fileSize: 50 * 1024 * 1024, // 50 MB
};

// Cria a instância do Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  // limits: limits,
});

module.exports = upload; 