## Diagnóstico

A query da página Favoritos está encontrando o ID favoritado no backend:

```text
ged_user_favorites -> document_id: a8a3a7be-4445-4e82-9a12-d379ff8baeee
```

O documento existe e está ativo:

```text
title: Nota Fiscal Haff
organization_id: aeb523a6-aef7-4131-b84e-27ff723f906c
status: active
past_id: e8432102-96a7-419d-82a9-dbcf6193f548
```

Mas a query executada pelo front-end na página Favoritos adiciona também:

```text
past_id=is.null
```

Isso filtra apenas documentos na raiz. Como o favorito está dentro de uma pasta (`past_id` preenchido), o backend retorna `[]`.

## Plano de correção

1. Ajustar `src/repository/gedRepository.ts` para ignorar o filtro de pasta quando `isFavorite=true`.
   - A página Favoritos deve listar favoritos em qualquer pasta.
   - O filtro `folderId === null -> past_id is null` continuará valendo para a tela normal de documentos.

2. Marcar explicitamente o retorno de listas favoritas com uma flag interna, por exemplo `__isFavoriteList`, para que o update otimista já existente no hook consiga remover o item imediatamente ao desfavoritar.

3. Revisar `src/hooks/useGED.ts` apenas se necessário para garantir que o cache otimista reconheça a lista de favoritos e invalide a query correta.

4. Validar pelo sinal principal:
   - A query da tela Favoritos não deve mais conter `past_id=is.null`.
   - O documento favoritado deve aparecer mesmo estando dentro de pasta.