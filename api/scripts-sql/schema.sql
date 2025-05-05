-- Script SQL gerado a partir dos modelos Sequelize
-- ATENÇÃO: Em desenvolvimento, o `sequelize.sync({ alter: true })` pode gerenciar
--          automaticamente as alterações no schema. Este script serve como referência
--          e para configuração inicial manual, se necessário.

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    usuario_id SERIAL PRIMARY KEY,
    usuario_nome VARCHAR(255) NOT NULL,
    usuario_api_token VARCHAR(255) NOT NULL UNIQUE,
    usuario_admin BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Buckets
CREATE TABLE IF NOT EXISTS buckets (
    bucket_id SERIAL PRIMARY KEY,
    bucket_nome VARCHAR(255) NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Arquivos (Files)
CREATE TABLE IF NOT EXISTS files (
    file_id SERIAL PRIMARY KEY,
    original_name VARCHAR(255) NOT NULL,
    unique_name VARCHAR(255) NOT NULL UNIQUE, -- Inclui o path, se houver
    mime_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(usuario_id) ON DELETE SET NULL ON UPDATE CASCADE, -- O que fazer se o usuário for deletado? SET NULL ou CASCADE?
    bucket_id INTEGER REFERENCES buckets(bucket_id) ON DELETE CASCADE ON UPDATE CASCADE, -- Se o bucket for deletado, deleta os arquivos associados
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Junção Usuario <-> Bucket (Muitos para Muitos)
CREATE TABLE IF NOT EXISTS "Usuario_buckets" (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    bucket_id INTEGER NOT NULL REFERENCES buckets(bucket_id) ON DELETE CASCADE ON UPDATE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, bucket_id)
);

-- Índices (Opcionais, mas podem melhorar performance)
CREATE INDEX IF NOT EXISTS idx_files_usuario_id ON files(usuario_id);
CREATE INDEX IF NOT EXISTS idx_files_bucket_id ON files(bucket_id); 