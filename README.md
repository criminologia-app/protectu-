# PROTECTTÚ — como publicar

## 1. Firebase (5 minutos)
1. console.firebase.google.com → o seu projeto → **Build → Authentication → Sign-in method → Anónimo → Ativar**.
2. **Authentication → Settings → Authorized domains** → adicione `SEU-UTILIZADOR.github.io`.
3. **Build → Realtime Database → Criar base de dados** → separador **Regras** → cole o conteúdo de `database.rules.json` → **Publicar**.
4. ⚙ **Configurações do projeto → Seus apps → Web (`</>`)** → copie a config para `firebase-config.js`.
   O `apiKey` correto começa por `AIza…` (o valor antigo `1:…:android:…` era um App ID Android).
5. (Recomendado) Google Cloud → Credenciais → restrinja a chave a `https://SEU-UTILIZADOR.github.io/*`.

## 2. GitHub Pages
Envie **todo o conteúdo desta pasta** para a raiz do repositório (Settings → Pages → branch main / root).
Apague os ficheiros antigos: `app.html`, `app.js`, `login-comunidade.html`, `pricipal.html`.

## 3. Depois de cada atualização
Aumente `CACHE_VERSION` em `sw.js` para os telemóveis receberem a versão nova.

## Notas
- Entrada: `index.html` (efeito) → `home.html` (painel). A app instalada abre direto em `home.html`.
- A web **não envia SMS sozinha**: o S.O.S abre a app de SMS com o texto pronto e a pessoa carrega em Enviar.
- Se o utilizador limpar os dados do browser, perde a identidade anónima e entra outra vez com a senha.

## Central de Controlo (só administrador) — `central.html`
1. Authentication → Sign-in method → ativar **E-mail/Senha**.
2. Authentication → Users → **Adicionar utilizador** (o seu e-mail + palavra-passe forte). Copie o **UID**.
3. Realtime Database → Dados → adicione `admins` → `COLE_O_UID` = `true` (booleano).
4. Publique de novo as regras de `database.rules.json`.
5. Abra `…/central.html`. Bloqueia sozinha após 15 min sem atividade.

## Polícia na Central
Na Central (coluna da direita) registe as unidades: nome, número e posição (botão "Marcar posição no mapa").
Quando um S.O.S fica sem resposta mais do que o tempo escolhido, a Central mostra a unidade mais próxima com Ligar e SMS.
**Republique as regras** (`database.rules.json`): há uma secção nova `config/police`.
