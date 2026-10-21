# SeeFast Android — app de recolha de dados (spec de design)

Data: 2026-10-21
Estado: escrito para revisão. O builder não escreve código antes disto ser aprovado.
Documento relacionado: `2026-10-21-persistencia-auth-design.md` (painel).

## 1. Intenção e porquê

O painel SeeFast já está completo: autenticação, papéis, persistência SQLite,
escrita auditada, PWA instalável e **endpoints de ingestão** que aceitam um
token por dispositivo. O que falta é a outra ponta: um programa que corre **no
telemóvel** e reporta o estado desse telemóvel para o painel.

Sem essa ponta, o painel mostra dados de demonstração. Com ela, o painel passa
a mostrar a realidade da família — e o "consentimento explícito" deixa de ser
uma frase no rodapé e passa a ser um ecrã que o utilizador vê e aceita.

## 2. Objectivos

- Correr no Android 8.0+ (API 26) e reportar, com consentimento visível:
  estado/bateria, localização (quando activada), apps instaladas e
  consentimento/permissões.
- Autenticar-se com o **token por dispositivo** que o painel gera (já
  implementado na API).
- Ser instalável por sideload (APK) num instante, sem loja nem conta de
  programador.
- Ser transparente: o utilizador vê sempre o estado do serviço, os dados
  recolhidos e como revogar o consentimento.
- Resistir a Doze/optimização de bateria sem sequestrar o telemóvel.

## 3. Não objectivos (anti-objectivos)

- **Não é um spyware nem um controlador remoto.** Não há injecção de toques,
  sem AccessibilityService, sem MediaProjection, sem `WRITE_SECURE_SETTINGS`,
  sem câmara/microfone, sem SMS, sem leitura de conteúdo de apps.
  (Isto é uma divergência deliberada em relação ao projecto `EndpointX`, que
  faz exactamente essas coisas — ver §9.)
- Não há monitorização de outras pessoas sem o consentimento do dono do
  dispositivo. A app só recolhe dados **do próprio aparelho onde corre**.
- Não há cloud de terceiros, analytics, crash reporting remoto nem ads.
- Não há反 "modo stealth" nem Squash de icon — anti-objectivo explícito.
- Não há multi-utilizador, multi-família ou(partilhamento) de conta.
- Não há Play Store na primeira fase (ver §11).

## 4. Restrições

- **Android moderno restringe o que se pode fazer em segundo plano.** A
  localização contínua exige serviço em primeiro plano; o histórico de uso de
  apps exige uma permissão especial que o utilizador tem de activar a mão em
  *Definições*; o Doze adia trabalho periódico. A app tem de servir e
  explicar isto, não contorná-lo.
- **O servidor é caseiro** (a API do painel). Sem HTTPS, o token viaja em
  claro na LAN. A app tem de avisar e o README do painel já documenta o risco.
- A stack Android já está provada na máquina: Kotlin + Gradle KTS, `compileSdk
  36`, `minSdk 26`, `targetSdk 34`, Java 17, OkHttp, `org.json`,
  `SharedPreferences`, keystore de release. **Reutiliza-se o mesmo
  esqueleto** (`EndpointX\endpoint-android`) por ser código já battle-tested
  nesta máquina.

## 5. Decisões

### 5.1 Identidade e naming
- Package id: **`pt.seefast.agent`** (minha decisão — separado de
  `pt.endpointx.agent`; a app é um produto diferente).
- Nome visível: **SeeFast Agente**.
- Repositório: **novo** (`C:\xampp\htdocs\seefast-android`), copiando o
  esqueleto Gradle do EndpointX mas **sem** o código de controlo remoto.
- Keystore: **novo**, próprio do SeeFast (o do EndpointX não é reutilizado).
  `keystore.properties` fica no `.gitignore` (como no EndpointX).

### 5.2 Stack
- Kotlin, views clássicas (sem Compose) — igual ao EndpointX; menos
  dependências, menos risco.
- OkHttp 4.12 + `org.json` (o EndpointX já usa este par) — coerente com a
  API do painel, que responde em JSON simples.
- **WorkManager** para o Reporting periódico (o EndpointX não o usa, mas aqui
  é o que sobrevive ao Doze). *Dependência nova* — a primeira que o projecto
  acrescenta.
- `androidx.security:security-crypto` (EncryptedSharedPreferences) para guardar
  o token. *Dependência nova.*
- **Sem Google Play Services**: a localização usa a `LocationManager` da
  framework (com fallback para `ACCESS_COARSE_LOCATION`), não o
  `FusedLocationProvider`. Motivo: `play-services-location` seria mais uma
  dependência (+2–4 MB) e **exigiria GMS no telemóvel** — em dispositivos sem
  Google Services a recolha de localização falharia em silêncio, que é o pior
  tipo de bug. *Decisão minha.*
- **Sem QR na app**: a câmara está expressamente excluída (§3), por isso o
  enrolment é por digitação/colar de `id` + `token`. *Decisão minha.*
- Room **não** entra: o agente é um reporter, não uma base de dados. Fila de
  espera offline fica num ficheiro JSON simples em armazenamento interno.

### 5.3 Enrolamento (como a app se liga ao painel)
1. O administrador regista o dispositivo **no painel** → a API devolve
   `{ id, nome, token }` (o token só aparece uma vez).
   ⚠️ **A UI de registo ainda não existe no painel** (ver §6 e §15) — hoje o
   `id`+`token` obtém-se por `POST /api/devices` com cookie de admin.
2. Na app, o utilizador introduz: **URL do servidor**, **id do dispositivo** e
   **token** (num único campo `id.token`, para não se errar).
3. A app valida o enlace com um reporte de estado: se o `POST
   /api/devices/:id/estado` responder 200, o enlace está bom.
4. Tudo fica guardado cifrado no dispositivo.
5. A URL tem de apontar à **porta da API (3001)**, não à do Vite (5173) — a Vite
   faz proxy de `/api` mas não é o servidor de dados.

### 5.4 Autenticação
- `Authorization: Bearer <token>` em **todos** os pedidos (a API já valida).
- O token é de portador: quem o tiver consegue reportar.
- ⚠️ **A API actual não tem rotação de token**: `POST /api/devices` cria sempre um `id` novo, e o token antigo continua válido para sempre. A "rotação" real, hoje, é criar um dispositivo novo no painel e re-enrolar a app (com `id` + `token` novos). O dispositivo antigo fica órfão no painel, a mostrar o último estado — a sua remoção é trabalho do painel (§6, §15). Implementar rotação/apagamento no servidor é **trabalho extra do painel**, fora do âmbito desta app.

### 5.5 O que a app recolhe (e o que não)
| Dado | Como | Frequência (minha decisão) |
|---|---|---|
| Estado (online/offline), bateria | `BatteryManager` + conectividade | a cada 15 min |
| Localização | `LocationManager` (framework, sem GMS) | a cada 5 min, **só se o utilizador activar** |
| Apps instaladas | `PackageManager` + `QUERY_ALL_PACKAGES` | a cada 6 h (e no arranque) |
| Tempo de uso por app | `UsageStatsManager` (permissão especial) | a cada 6 h — **depende da resposta à pergunta 3** (§15): hoje a API **não tem endpoint** para isto, logo ou o dado é descartado ou o servidor ganha uma migration + endpoint novo |
| Consentimento e permissões | estado local da app | quando muda |
| **NÃO** recolhe: conteúdos, SMS, chamadas, câmara, microfone, passwords, contactos, ficheiros | — | — |

### 5.6 Consentimento
- Ecrã de consentimento **explícito** no primeiro arranque: o que se recolhe,
  com que frequência, quem vê (o supervisor da conta) e como revogar.
- Um `Switch` visível e permanente nas definições para ligar/desligar cada
  categoria (localização, apps, tempo de uso).
- O estado do consentimento é reportado à API (`POST
  /api/devices/:id/consentimento`) e aparece no painel, na página de
  Permissões.
- Revogar = desligar os switches + (opcionalmente) apagar os dados locais.
  A app **não** apaga o que já está no servidor — isso é uma acção do
  administrador no painel (decisão de privacidade: quem apaga o histórico?).
  *Decisão do builder: implementar "apagar dados locais"; a remoção no
  servidor fica para o painel.*

### 5.7 Notificação permanente
- Serviço em primeiro plano com notificação persistente ("SeeFast Agente
  activo") enquanto a recolha estiver ligada. É requisito do Android para
  localização em background e é, de propósito, visível.
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` (API 34+).

## 6. Contrato com a API (quase todo implementado)

ATENCAO - O que a API ainda NAO tem (e e preciso decidir se entra no ambito):
- **UI de registo de dispositivo no painel** - hoje so existe o endpoint
  `POST /api/devices`; o administrador tem de o chamar por curl.
- **Rotacao/revogacao de token** - o token antigo continua valido para sempre
  (secao 5.4).
- **Apagar dispositivo** (e os seus dados) - nao existe.
- **Deteccao de dispositivo em silencio** - o painel mostra o `estado` tal e
  qual; um telemovel perdido fica "online" para sempre. Proposta: o painel
  calcula obsolescencia a partir de `ultimo_reporte` (ex.: > 30 min sem
  reporte => "sem resposta"). Decisao minha - trabalho do painel.
- **Endpoint de tempo de uso** - nao existe (ver secao 15, pergunta 3).

| Chamada | Quando | Notas |
|---|---|---|
| `POST /api/devices/:id/estado` | a cada 15 min | `{ estado, bateria, em }` |
| `POST /api/devices/:id/localizacao` | a cada 5 min (se activo) | `{ lat, lon, em }`; 400 se coordenadas inválidas |
| `POST /api/devices/:id/apps` | a cada 6 h | `{ apps: [{ nome, pacote, tamanhoMb }] }`; substitui a lista anterior |
| `POST /api/devices/:id/consentimento` | quando muda | `{ consentimento, camera, microfone, localizacao }` |

Erros: `401` (token inválido → parar e pedir re-enrolamento), `403` (token de
outro dispositivo), `400` (dados inválidos → log, não repetir). A API responde
JSON simples (sem o envelope `{success, data}` que o servidor do EndpointX usa).

## 7. Arquitectura da app

```
pt.seefast.agent
├── MainActivity          # ecrã de consentimento + estado do serviço + definições
├── EnrolamentoActivity   # URL + id + token, valida o enlace
├── data/
│   ├── ApiClient.kt      # OkHttp + JSON, retries, timeouts
│   ├── RecoletorEstado.kt
│   ├── RecoletorLocalizacao.kt
│   ├── RecoletorApps.kt
│   ├── RecoletorUso.kt
│   └── FilaOffline.kt    # reports pendentes em JSON
├── servico/
│   ├── AgenteService.kt  # foreground service + notificação
│   └── BootReceiver.kt   # arranca após reinício
├── dados/
│   ├── Segredos.kt       # EncryptedSharedPreferences (token, server, id)
│   └── Consentimento.kt  # estado dos switches
└── ui/                   # Activities/fragments simples
```

**Arquitectura de execucao (importante - o WorkManager nao serve para tudo):**
- O WorkManager tem **periodo minimo de 15 minutos**. Logo: estado (15 min) e
  apps/uso (6 h) vao por WorkManager.
- A **localizacao a cada 5 min** nao e possivel com WorkManager: e um laco
  com `Handler` dentro do `AgenteService` (servico em primeiro plano com
  notificacao). A app e o WorkManager correm em paralelo, por isso os
  reportes nao podem duplicar: cada recoletor e dono de um campo.
- **Doze**: a rede e suspensa em Doze. O servico em primeiro plano sobrevive,
  mas os timers sao adiados. Para o estado, usar
  `AlarmManager.setAndAllowWhileIdle` (nao exige `SCHEDULE_EXACT_ALARM`). A app
  **nao** promete "5 em 5 minutos exactos" - promete "de 5 em 5 minutos, com
  a melhor esforco do sistema".
- **Foreground service type**: `FOREGROUND_SERVICE_LOCATION` (API 34+) exige a
  permissao de localizacao concedida **no momento** em que se chama
  `startForeground`. Se o utilizador revogar a localizacao, o servico e morto
  com `SecurityException`. Por isso o servico declara `dataSync|location` e
  re-declara o tipo quando o estado das permissoes muda.
- **Boot**: `BootReceiver` arranca o servico em `BOOT_COMPLETED` **apenas se**
  o consentimento estiver activo.

Fluxo de um reporte: o recollector produz um payload -> `ApiClient` envia -> se
falhar (sem rede), `FilaOffline` guarda em JSON e o WorkManager reenvia mais
tarde (limite: 24 h de dados, depois descarta).
## 8. Permissões Android

| Permissão | Para quê | Como se obtém |
|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | falar com a API | normal |
| `POST_NOTIFICATIONS` | notificação do serviço | diálogo do runtime (Android 13+) |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | serviço activo | manifesto |
| `ACCESS_FINE_LOCATION` | localização | diálogo do runtime |
| `ACCESS_BACKGROUND_LOCATION` | localização com app fechada | **definições do sistema**, passo a passo |
| `PACKAGE_USAGE_STATS` | tempo de uso | **definições do sistema** (acesso especial) |
| `QUERY_ALL_PACKAGES` | lista de apps | manifesto (justificação no sideload) |
| `RECEIVE_BOOT_COMPLETED` | arrancar após reinício | manifesto |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | reduzir Doze | dialogo do sistema (a app **deve** ser transparente sobre o porque) |

**Rede sem TLS (HTTP em claro na LAN):** desde a API 28 o Android bloqueia
cleartext por omissao. A app traz um `network_security_config.xml` que
**permite cleartext apenas em gamas privadas** (`10.0.0.0/8`, `172.16.0.0/12`,
`192.168.0.0/16`) e mantem cleartext **proibido** em qualquer outro sitio. Se o
servidor passar a estar na internet, a app passa a exigir HTTPS (e a config
de rede deixa de permitir cleartext). Decisao minha.
A app tem um ecrã de "permissões" que mostra o estado de cada uma e um botão
que leva à definição certa. É o ecrã mais importante da app: sem ele, o
utilizador desiste na segunda ecrã.

## 9. Relação com o projecto EndpointX (divergência deliberada)

O `EndpointX\endpoint-android` já faz: AccessibilityService que injeta toques,
`WRITE_SECURE_SETTINGS` via adb, MediaProjection, e um enrolment com
`POST /api/devices/mobile/register` (envelope `{success, data, error}`).

A SeeFast **não** herda nada disso:

- não precisa de AccessibilityService (só lê dados do sistema);
- não usa MediaProjection nem `WRITE_SECURE_SETTINGS` (não há controlo remoto);
- a API do SeeFast usa JSON simples, não o envelope do EndpointX;
- o `id`/`token` do SeeFast são fornecidos pelo administrador (o EndpointX
  usa um fluxo de auto-enrolamento com `enroll_token`).

Reaproveita-se: esqueleto Gradle KTS, versões (compileSdk 36 / minSdk 26 /
Java 17), `Prefs`-style wrapper, OkHttp + `org.json`, `BootReceiver`,
estrutura de pastas e o processo de build/keystore. Copia-se o ficheiro
`local.properties` (caminho do SDK) para a máquina.

## 10. Privacidade e legal

- A app recolhe dados de **um menor** em geral. O consentimento tem de ser
  explícito, revogável e visível; o painel tem de mostrar o estado do
  consentimento (já mostra).
- Minimização: só se recolhe o que o painel mostra. Sem dados de conteúdo.
- Retenção: **decisão em aberto** (§13, pergunta 4).
- direito de apagamento: o painel precisa de uma acção "apagar dispositivo" —
  **não existe hoje**; é trabalho do painel, não da app.
- Distribuição: sideload só para a própria família. Publicar na Play Store
  implica as políticas de apps de supervisão familiar (indicador visível
  obrigatório, consentimento, e proibição de recolha de dados de outras
  pessoas) — a app já foi desenhada para respeitar isso.

## 11. Build e distribuição

- `assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk` (sideload
  directo no telemóvel, com "instalar apps de fontes desconhecidas").
- `assembleRelease` assinado com o keystore próprio do SeeFast.
- `versionCode`/`versionName` incrementados a cada release; `applicationId`
  `pt.seefast.agent`.
- Ícones: reaproveitar o visual do painel (navy `#102a43` + ciano `#16b9e8`).
- Sem integração CI no primeiro passo (o CI do painel é Node; Android exige
  JDK + SDK, que o GitHub-hosted runner tem, mas a configuração fica para
  depois).

## 12. Testes

- **Unit (JVM)**: `ApiClient` (payloads, erros 401/403/400), mapeamento JSON,
  `FilaOffline` (enfileirar, reenfileirar, expirar).
- **Instrumentação** (opcional, fase tardia): `RecoletorApps` com um dispositivo
  real.
- **Teste manual de aceitacao**: instalar por sideload, activar consentimento,
  ver o painel actualizar com estado e localizacao. **Requer o telemovel do
  utilizador** - nesta maquina nao ha `adb devices` nem AVD, e o acesso
  especial a *Definicoes* (uso de apps, localizacao em segundo plano) nao e
  automatizavel.
- **Testes JVM** com `mockwebserver` (dependencia so de teste) em vez de
  levantar um servidor real; o `ApiClient` recebe o `baseUrl` por injecao.- O `ApiClient` é testado contra um servidor real (o mesmo formato que os
  testes do painel usam: processo separado + porta).

## 13. Marcos

| Marco | Entrega | Critério de aceitação |
|---|---|---|
| **M0** | Esqueleto + ecrã de consentimento + enrolment | APK debug instala; consigo apontar ao servidor e o `POST /estado` responde 200 |
| **M1** | Estado + bateria a cada 15 min | o painel mostra o estado novo **apos recarregar** a pagina (hoje nao ha tempo real - ver secao 15, pergunta 5) || **M2** | Localizacao (foreground service + notificacao) | a pagina de Localizacao mostra a posicao nova apos recarregar; o servico nao e morto pelo Doze nem pela revogacao da permissao || **M3** | Apps instaladas + tempo de uso | a página de Aplicações lista as apps do dispositivo; a decisão de bloqueio do admin é preservada |
| **M4** | Robustez: fila offline, retry, re-enrolamento, ecrã de permissoes | com a rede desligada, nada se perde; com um token trocado (401), a app avisa e pede re-enrolamento com `id` + `token` novos |
## 14. Decisoes que sao minhas (para reveres)

1. `pt.seefast.agent` como package id e repositorio novo.
2. WorkManager + EncryptedSharedPreferences como unicas dependencias novas.
3. Intervalos: 15 min (estado), 5 min (localizacao), 6 h (apps/uso).
4. A app **nao** apaga dados no servidor (so locais); a remocao fica no painel.
5. Sideload primeiro, Play Store depois (ou nunca).
6. A app nao tem ecra de estatisticas de uso nem crash reporting.
7. **Localizacao pela `LocationManager` da framework, sem Google Play Services**
   (a spec pedia `FusedLocationProvider`, que traria a dependencia de GMS).
8. **Sem QR na app** (a camara esta expressamente excluida dos objectivos).
9. **Cleartext permitido apenas em gamas privadas** (10/8, 172.16/12, 192.168/16)
   via `network_security_config.xml`; HTTPS obrigatorio fora disso.
10. **Obsolescencia calculada pelo painel** a partir de `ultimo_reporte` (o
    estado "offline" e praticamente inatingivel: a app so reporta quando tem
    rede).
11. **`tamanhoMb` = tamanho do APK instalado** (`sourceDir` + `splitSourceDirs`),
    que e a unica medida confiavel desde a API 26; a pagina de Aplicacoes
    mostra-o como "tamanho da app".
12. **Servico sempre ligado** (notificacao permanente) enquanto o consentimento
    estiver activo, com `dataSync|location` e re-declaracao do tipo quando as
    permissoes mudam.

## 15. Decisoes do utilizador (respostas) e o que ainda falta

**Respostas (2026-10-21):**

1. **Onde corre a API: os dois.** LAN em desenvolvimento, internet em producao.
   Consequencias na app: o `baseUrl` e configuravel e o `network_security_config`
   permite cleartext **apenas** em gamas privadas (`10/8`, `172.16/12`,
   `192.168/16`); qualquer outro endereco exige **HTTPS**. A app nao valida o
   esquema — segue o que o utilizador escreve — mas o aviso de "sem TLS" e
   mostrado quando o endereco nao e `localhost` nem uma gama privada.
2. **Distribuicao: Play Store**, com as politicas de supervisao familiar.
   Consequencias (ver §17): `targetSdk` tem de subir para 35/36, Play App
   Signing, ficha de "Data safety", politica de privacidade publicada, e
   declaracao do uso de `PACKAGE_USAGE_STATS` e de `QUERY_ALL_PACKAGES`.
3. **Tempo de uso entra no MVP.** Consequencia: o servidor ganha migration +
   endpoint de ingestao de uso, e a pagina de Aplicacoes do painel passa a
   mostrar os minutos por app. (Trabalho no painel, ver §6.)

**Ainda por decidir (mudan o plano, nao bloqueiam o M0):**

4. UI de registo de dispositivo no painel - decide-se na implementacao do
   painel (recomendacao: sim, e simples).
5. Tempo real (polling) no painel - decide-se na implementacao do painel
   (recomendacao: polling de 30 s nas paginas de Dispositivos e Localizacao).
6. Retencao de dados no servidor - por omissao, sem apagamento automatico
   (o painel passa a mostrar a data do ultimo reporte).
## 16. Requisitos da Play Store (distribuicao escolhida: Play Store)

Publicar na Play Store com politicas de supervisao familiar acrescenta
requisitos que a versao sideload nao tem. A app foi desenhada para os
cumprir, mas o trabalho e real:

**Cumprir as politicas (obrigatorio)**
- **Families Policy**: a app recolhe dados de menores, logo tem de declarar a
  categoria certa, ter politica de privacidade publicada e um ecrã de consentimento
  que verifique o consentimento de um adulto.
- **Background location**: so e permitida para "core functionality" de uma app
  de supervisao parental, com consentimento e indicador visivel. A nossa app
  usa servico em primeiro plano com notificacao permanente - o indicador
  visivel que a politica exige.
- **PACKAGE_USAGE_STATS**: exige declaracao no Play Console. Como a app recolhe
  tempo de uso (decisao do utilizador), esta e a permissao mais sensivel do
  conjunto - o ecra de consentimento tem de a explicar por extenso.
- **QUERY_ALL_PACKAGES**: restrita; ha uma declaracao para apps de gestao de
  dispositivos/supervisao parental.
- **Proibido**: AccessibilityService para vigilancia, injecao de toques, leitura
  de SMS, camara/microfone ocultos. A app ja nao usa nenhum deles (§3).
- **Data safety form**: preencher com o que a app recolhe e com que finalidade.

**Tecnico**
- **`targetSdk` 35 ou 36** (a Play exige target API recente para actualizacoes
  de apps). O esqueleto do EndpointX usa `targetSdk 34` - tem de subir.
- **Play App Signing**: gera-se uma chave de upload; a chave de assinatura da
  app e gerida pela Play. (ParaSideload directo, a chave tem de ser nossa.)
- **Versionamento**: `versionCode` tem de subir a cada upload; `versionName`
  legivel.
- **Ficha da loja**: capturas de ecra, descricao, categoria, palavras-chave.

**O que a Play Store NAO resolve**
- A API de producao tem de estar em HTTPS com dominio proprio (a Play exige
  HTTPS para apps que tratam dados de criancas, e o sideload passa a exigir
  dominio + certificado).

## 17. Fora do âmbito (para o builder decidir)

- Tema claro/escuro, material 3, animações.
- Widgets de ecrã principal.
- Suporte a múltiplos servidores (mais de um perfil de servidor).
- Testes de instrumentação completos.
- Publicação na Play Store (assinaturas, ficha da loja, texto legal).
- Integração do agent com o CI do GitHub.
