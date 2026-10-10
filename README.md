# Cronograma

Cronograma em tempo real do **Formação de Líderes**. Site estático (HTML/CSS/JS, sem build), feito para celular e instalável na tela inicial (PWA). Glossário em [CONTEXT.md](CONTEXT.md).

## Editar a programação

Edite [`cronograma.yaml`](cronograma.yaml) e faça push na `master`. O formato está explicado no topo do arquivo. Se houver erro, o site mostra a mensagem no topo da página e continua exibindo a última versão válida para quem já tinha aberto.

## Rodar localmente

```sh
npm start      # http://localhost:8000
npm test       # testes da lógica (node:test, sem dependências)
```

## Alterar o código do site

O site funciona offline por meio de um service worker ([`sw.js`](sw.js)), que guarda uma cópia dos arquivos no celular. Ao mudar o código (HTML, CSS, JS, ícones), e não só o `cronograma.yaml`:

1. **Incremente a versão do cache** em `sw.js` (`const CACHE = 'cronograma-vN'`). É a mudança nesse arquivo que faz quem está com o app aberto receber a versão nova e recarregar sozinho. Sem isso, o código novo só chega quando a pessoa fechar e abrir o app de novo.
2. **Se criar um arquivo novo** que o site usa, adicione-o à lista `ARQUIVOS` em `sw.js`, para que ele funcione offline.

Mudanças só no `cronograma.yaml` não precisam de nada disso: ele é buscado de novo sempre que o app volta do segundo plano.

## Publicar no GitHub Pages

1. Crie o repositório público `cronograma` no GitHub e faça push da `master`.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `master`, pasta `/ (root)`.
3. O site fica em `https://<usuario>.github.io/cronograma/`.

Para instalar no celular: abrir o site e usar **Adicionar à tela inicial** (Android: menu do Chrome; iPhone: botão Compartilhar do Safari).
