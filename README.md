# HeartSync (CouplesApp)

MVP em Node.js (Express) + SQLite com htmx/Alpine/Tailwind via CDN.

## Executar

1. Instale dependências:
   ```powershell
   npm install
   ```
2. Ambiente de dev:
   ```powershell
   npm run dev
   ```
3. Produção/dev simples:
   ```powershell
   npm start
   ```

Acesse http://localhost:3000.

## Funcionalidade FR-01

- Criar código de convite (24h, uso único)
- Parceiro entra com o código e cria/une o casal
- Sessão via cookie e CSRF ativos

Obs.: Tailwind/htmx por CDN; sem build step.
