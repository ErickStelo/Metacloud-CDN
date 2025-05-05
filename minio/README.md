# Servico do MinIO

MinIO é uma plataforma de armazenamento de objetos de alta performance, compatível com a API S3 da Amazon. Ele é projetado para ser simples de usar e altamente escalável, permitindo o armazenamento de grandes quantidades de dados não estruturados, como fotos, vídeos, backups e logs. MinIO pode ser implementado em ambientes de nuvem privada, pública ou híbrida, oferecendo uma solução flexível e eficiente para necessidades de armazenamento moderno.


### Modo standalone

O modo standalone do MinIO executa o serviço em um único nó, ideal para desenvolvimento ou uso simples, sem necessidade de alta disponibilidade.

1. Alterar o `docker-compose.yaml` e manter o comando de inicialização como abaixo:
   
   ```yaml
   command: server /data --console-address ":9001"
   ```

Neste modo, é possivel ter dois servicos rodando em standalone e configurar o servico A para replicar objetos de um bucket para o servico B
   
### Modo Distribuido

No modo distribuído, o MinIO opera em um cluster de múltiplos nós (serviços), garantindo alta disponibilidade e resiliência a falhas. Ideal para ambientes que exigem escalabilidade e tolerância a falhas.

1. Alterar o `docker-compose.yaml` e manter o comando de inicialização como abaixo:
   
   ```yaml
   command: server --console-address ":9001" "http://minio1:9000/data" "http://minio2:9000/data"
   ```
   Todos os servicos do MinIo que irão fazer parte do cluster devem ser definidos logo após o primeiro, seguindo o formato do exemplo acima, onde há dois servicos do MinIo rodando em hosts/servidores diferentes.

   Neste modo, tudo oque oque for feito em um cluster, será replicado para os demais.

   **OBS**: 
   - Todos os clusters devem possuir o mesmo comando de inicializacao.
   - É normal que os servicos deem logs de erro até que todos os clusters estejam funcionando e acessíveis.
  
#### Proxy e loadbalance

É necessário configurar no NGINX um balanceamento de carga entre os clusters e garantir que ele sempre entregue o conteudo solicitado.

Observe o arquivo `nginx_example.txt`
