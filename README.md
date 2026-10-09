# Cronograma

Cronograma em tempo real do **Formação de Líderes**. Site estático (HTML/CSS/JS, sem build), feito para celular e instalável na tela inicial (PWA). Glossário em [CONTEXT.md](CONTEXT.md).

## Editar a programação

Edite [`cronograma.yaml`](cronograma.yaml) e faça push na `master`. O formato está explicado no topo do arquivo. Se houver erro, o site mostra a mensagem no topo da página e continua exibindo a última versão válida para quem já tinha aberto.

## Rodar localmente

```sh
npm start      # http://localhost:8000
npm test       # testes da lógica (node:test, sem dependências)
```

## Publicar no GitHub Pages

1. Crie o repositório público `cronograma` no GitHub e faça push da `master`.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `master`, pasta `/ (root)`.
3. O site fica em `https://<usuario>.github.io/cronograma/`.

Para instalar no celular: abrir o site e usar **Adicionar à tela inicial** (Android: menu do Chrome; iPhone: botão Compartilhar do Safari).
