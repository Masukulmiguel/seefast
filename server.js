// Ponto de entrada de produção na raiz do repositório.
//
// O Render clona o repositório e corre o Start Command. Este ficheiro existe
// para que `node server.js` funcione directamente: o Start Command padrão
// ("npm start") continua a ser o modo de desenvolvimento (Vite + API em duas
// portas), e `npm run start:prod` é a produção explícita.
//
// Porquê este ficheiro: o Render procura o módulo em
// /opt/render/project/src/server.js. Sem este ficheiro, um Start Command
// "node server.js" falha com "Cannot find module".

import "./server/producao.js";
