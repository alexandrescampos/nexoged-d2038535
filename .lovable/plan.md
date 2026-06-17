## Diagnóstico
O job Windows falhou antes do empacotamento, durante `npm ci`, porque a dependência nativa `pkcs11js` executa `node-gyp rebuild` e precisa do compilador C++ do Visual Studio/MSVC. O runner `windows-latest` tem Visual Studio, mas o `node-gyp` não conseguiu detectar/configurar a instalação automaticamente.

## Plano
1. Ajustar `.github/workflows/build-signer.yml` no job Windows para preparar o ambiente C++ antes de `npm ci`.
2. Adicionar uma etapa condicional só para Windows usando `ilammy/msvc-dev-cmd@v1`, que inicializa `cl.exe`, Windows SDK e variáveis do MSVC no PATH.
3. Fixar também a arquitetura `x64` para evitar detecção errada.
4. Manter Linux/macOS inalterados.
5. Após aplicar, você roda novamente o workflow no GitHub Actions.

## Resultado esperado
- `npm ci` passa no Windows.
- `pkcs11js` compila corretamente.
- O workflow segue para `Package (win32)` e gera `NexoGED-Assinador-win32-x64.zip`.

## Observação
Se o Windows ainda falhar por causa do Python 3.14, o próximo ajuste será fixar Python 3.12 no workflow antes do `npm ci`, mas primeiro vale corrigir o MSVC porque é o erro explícito no log.