# SeeFast Android Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma app Android que corre no telemóvel da criança, recolhe estado, localização, apps instaladas e tempo de uso (só com consentimento explícito) e reporta-os à API do painel SeeFast, autenticando-se com um token por dispositivo.

**Architecture:** App Kotlin, sem Google Play Services, com três camadas: **recoletores** (cada um produz um payload JSON a partir de uma API do sistema Android), **`ApiClient`** (OkHttp, Bearer token, erros tipados) e **agendadores** (WorkManager para o periódico; serviço em primeiro plano com `Handler` para a localização). O estado local (consentimento, servidor, id, token) vive em `EncryptedSharedPreferences`; a fila offline é um ficheiro JSON.

**Tech Stack:** Kotlin 1.9.20 · AGP 8.2.0 · Gradle 8.2 (wrapper) · JDK 17 · compileSdk 36 / minSdk 26 / targetSdk 35 · OkHttp 4.12.0 · WorkManager 2.9.1 · security-crypto 1.1.0-alpha06 · MockWebServer 4.12.0 (testes) · JUnit 4.13.2

**Spec:** `docs/superpowers/specs/2026-10-21-seefast-android-app-design.md` (lê-o antes de começar; o plano argumenta a partir dele)

**Repositório novo:** `C:\xampp\htdocs\seefast-android` (não é o repositório do painel). Copiar este ficheiro de plano para lá na Task 1.

## Global Constraints

- `applicationId` e `namespace`: **`pt.seefast.agent`**. Nome visível: **SeeFast Agente**.
- `minSdk = 26`, `compileSdk = 36`, `buildToolsVersion = "36.1.0"`, `targetSdk = 35` (exigência da Play Store).
- Java/Kotlin: `sourceCompatibility`/`targetCompatibility`/`jvmTarget` = **17**.
- Gradle **8.2**, AGP **8.2.0**, Kotlin **1.9.20** — versões já provadas nesta máquina (o projecto `EndpointX\endpoint-android` compila com elas).
- **Proibido**: AccessibilityService, MediaProjection, `WRITE_SECURE_SETTINGS`, câmara, microfone, Google Play Services (`play-services-*`), `com.google.android.gms`.
- **Dependências permitidas** (lista fechada): `androidx.core:core-ktx:1.13.1`, `androidx.appcompat:appcompat:1.7.0`, `androidx.work:work-runtime-ktx:2.9.1`, `androidx.security:security-crypto:1.1.0-alpha06`, `org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1`, `org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1`, `com.squareup.okhttp3:okhttp:4.12.0`; testes: `junit:junit:4.13.2`, `com.squareup.okhttp3:mockwebserver:4.12.0`. Qualquer outra dependência exige aprovação.
- `isMinifyEnabled = false` (como no EndpointX).
- A assinatura de release usa `keystore.properties` (nunca commitado) ou variáveis de ambiente `SEEFAST_KEYSTORE_FILE` / `SEEFAST_KEYSTORE_PASSWORD` / `SEEFAST_KEY_ALIAS` / `SEEFAST_KEY_PASSWORD`. Keystore **novo**, próprio do SeeFast (o do EndpointX não é reutilizado).
- Todo o tráfego da API leva `Authorization: Bearer <token>`; o token **nunca** vai para query strings nem para logs.
- `network_security_config.xml`: cleartext permitido **apenas** em `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`; HTTPS obrigatório noutros endereços.
- A app **não apaga** dados no servidor; só dados locais.
- Todo o código e os textos de UI em **português (pt-PT)**; identificadores de código em inglês.
- Nada de crashes de background: qualquer excepção de um recollector é apanhada, registada e o serviço continua.

## Review Focus

1. **Token de outro dispositivo** (o `id` do pedido não corresponde ao token) → a API responde **403**; a app tem de distinguir "token inválido" (401, re-ligar) de "token de outro dispositivo" (403, erro de configuração) — não pode re-ligar às cegas.
2. **Token revogado ou errado** → **401**; a app entra em modo "precisa de re-ligação", **pára de reportar** e não insiste (não martela o servidor).
3. **Sem rede / servidor fora do alcance** → o reporte vai para a fila offline, é reenviado depois, e é descartado ao fim de 24 h; nada se perde nem rebenta.
4. **Consentimento revogado a meio** → a app pára a recolha imediatamente, desliga o serviço em primeiro plano e a notificação, e reporta o consentimento revogado.
5. **Permissão de localização revogada enquanto o serviço corre** → o serviço não pode morrer com `SecurityException` nem ficar sem notificação; tem de re-declarar o `foregroundServiceType` e manter-se vivo (ou parar de forma limpa).

## Contrato com a API (fixo — não mudar)

Base URL: a que o utilizador escrever no ecrã de ligação (LAN ou internet). A API responde JSON simples, **sem** envelope `{success, data}`.

| Pedido | Quando | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| `POST /api/devices/{id}/estado` | a cada 15 min | `{"estado":"online","bateria":82,"em":"2026-10-21T12:00:00Z"}` | 200 `{"device":{...}}` | 401/403/400 |
| `POST /api/devices/{id}/localizacao` | a cada 5 min (se activo) | `{"lat":38.7223,"lon":-9.1393,"em":"2026-10-21T12:00:00Z"}` | 200 `{"localizacao":{...}}` | 401/403/400 (coordenadas) |
| `POST /api/devices/{id}/apps` | a cada 6 h | `{"apps":[{"nome":"Instagram","pacote":"com.instagram.android","tamanhoMb":45}]}` | 200 `{"apps":N}` | 401/403/400 |
| `POST /api/devices/{id}/uso` | a cada 6 h | `{"uso":[{"pacote":"com.instagram.android","minutos":145}]}` | 200 `{"registos":N}` | 401/403/400 |
| `POST /api/devices/{id}/consentimento` | quando muda | `{"consentimento":"concedido","camera":false,"microfone":false,"localizacao":true}` | 200 `{"consentimento":"concedido"}` | 401/403 |

- `estado` ∈ {`online`, `offline`, `desconhecido`}; a app reporta `online` (só consegue falar com o servidor quando tem rede).
- `bateria` é um inteiro 0–100; `em` é ISO-8601 UTC.
- `id` é o identificador do dispositivo (`dev-xxxxxxxx`); o `token` é o que o painel showed uma vez.
- A app envia sempre o header `Authorization: Bearer <token>` e `Content-Type: application/json`.

## File Structure

```
seefast-android/
├── settings.gradle.kts
├── build.gradle.kts                 # AGP + Kotlin plugins
├── gradle.properties
├── gradle/wrapper/…                 # wrapper 8.2
├── gradlew, gradlew.bat
├── local.properties                 # sdk.dir — NÃO commitar
├── keystore.properties.example      # commitar; o .properties real não
├── .gitignore
├── README.md
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── java/pt/seefast/agent/
        │   │   ├── MainActivity.kt          # ecrã de consentimento + estado do serviço
        │   │   ├── EnrolamentoActivity.kt    # ecrã de ligação (servidor, id, token)
        │   │   ├── ApiClient.kt              # OkHttp + JSON + erros tipados
        │   │   ├── ErroApi.kt                # sealed class: NaoAutenticado / TokenDeOutroDispositivo / Rejeitado / Rede
        │   │   ├── Consentimento.kt          # modelo puro (categorias, estado)
        │   │   ├── Segredos.kt               # EncryptedSharedPreferences
        │   │   ├── FilaOffline.kt            # fila JSON de reports pendentes
        │   │   ├── AgenteService.kt          # foreground service + notificação + Handler 5 min
        │   │   ├── BootReceiver.kt
        │   │   └── recolha/
        │   │       ├── RecoletorEstado.kt     # estado + bateria → payload
        │   │       ├── RecoletorLocalizacao.kt
        │   │       ├── RecoletorApps.kt
        │   │       ├── RecoletorUso.kt
        │   │       └── RelatorioConsentimento.kt
        │   └── res/
        │       ├── values/{strings,themes}.xml
        │       ├── xml/network_security_config.xml
        │       └── mipmap-*/ic_launcher.png
        └── test/java/pt/seefast/agent/        # testes JVM (JUnit4)
```

---

### Task 1: Esqueleto do projecto, wrapper e toolchain a funcionar

**Files:**
- Create: `seefast-android/settings.gradle.kts`, `build.gradle.kts` (raiz), `gradle.properties`, `gradlew`, `gradlew.bat`, `gradle/wrapper/*`
- Create: `seefast-android/app/build.gradle.kts`, `app/proguard-rules.pro`, `app/src/main/AndroidManifest.xml`
- Create: `seefast-android/app/src/main/java/pt/seefast/agent/Consentimento.kt` (esqueleto mínimo)
- Create: `seefast-android/app/src/test/java/pt/seefast/agent/ConsentimentoTeste.kt`
- Create: `seefast-android/.gitignore`, `keystore.properties.example`, `local.properties` (não commitar)
- Test: `app/src/test/java/pt/seefast/agent/ConsentimentoTeste.kt`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: projecto Gradle que compila e corre `./gradlew test`; `Consentimento` (ver Task 2 para a API final — aqui só a classe, com o estado por omissão).

- [ ] **Step 1: Criar o esqueleto Gradle**

Criar `C:\xampp\htdocs\seefast-android` com:
- `settings.gradle.kts`: `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }`, `dependencyResolutionManagement { repositories { google(); mavenCentral() } }`, `rootProject.name = "seefast-android"`, `include(":app")`.
- `build.gradle.kts` (raiz): `plugins { id("com.android.application") version "8.2.0" apply false; id("org.jetbrains.kotlin.android") version "1.9.20" apply false }`.
- `app/build.gradle.kts`: `namespace = "pt.seefast.agent"`, `applicationId = "pt.seefast.agent"`, `compileSdk = 36`, `buildToolsVersion = "36.1.0"`, `minSdk = 26`, `targetSdk = 35`, `versionCode = 1`, `versionName = "0.1.0"`, Java 17, `isMinifyEnabled = false`, e as dependências listadas em Global Constraints.
- `gradle.properties`: `android.useAndroidX=true`, `kotlin.code.style=official`, `org.gradle.jvmargs=-Xmx2048m`.
- `local.properties`: `sdk.dir=C:\\Users\\FMLIDEL-TI\\AppData\\Local\\Android\\Sdk` (caminho real da máquina; **não commitar**).
- `.gitignore`: `local.properties`, `keystore.properties`, `.gradle/`, `build/`, `app/build/`, `*.iml`, `.idea/`.
- `keystore.properties.example` com as quatro chaves vazias.
- `app/src/main/AndroidManifest.xml` com `package` omitido (o namespace vem do Gradle), `<application android:label="SeeFast Agente">` e uma `MainActivity` declarada.
- `app/src/main/res/values/strings.xml` (`app_name` = "SeeFast Agente") e `themes.xml`.

Gerar o wrapper a partir do Gradle já em cache:
```bash
"C:\Users\FMLIDEL-TI\.gradle\wrapper\dists\gradle-8.2-bin\<hash>\gradle-8.2\bin\gradle.bat" wrapper --gradle-version 8.2
```
(se o caminho do `<hash>` diferir, procurá-lo em `%USERPROFILE%\.gradle\wrapper\dists\gradle-8.2-bin`).

- [ ] **Step 2: Escrever o teste que falha**

`app/src/test/java/pt/seefast/agent/ConsentimentoTeste.kt`:
```kotlin
class ConsentimentoTeste {
    @Test fun `sem consentimento nada e recolhido`() {
        val c = Consentimento.padrao()
        assertFalse(c.activo)
        assertFalse(c.localizacao)
        assertFalse(c.apps)
        assertFalse(c.uso)
    }
}
```
- [ ] **Step 3: correr o teste e ver falhar**

Run: `gradlew.bat test` (na raiz de `seefast-android`)
Expected: FAIL com "Unresolved reference: Consentimento".

- [ ] **Step 4: implementar o mínimo**

`app/src/main/java/pt/seefast/agent/Consentimento.kt`:
```kotlin
package pt.seefast.agent

data class Consentimento(
    val activo: Boolean = false,
    val localizacao: Boolean = false,
    val apps: Boolean = false,
    val uso: Boolean = false,
) {
    companion object { fun padrao() = Consentimento() }
}
```
- [ ] **Step 5: correr o teste e ver passar**

Run: `gradlew.bat test` → Expected: PASS (1 teste).

- [ ] **Step 6: confirmar que o APK de debug compila**

Run: `gradlew.bat assembleDebug` → Expected: `app/build/outputs/apk/debug/app-debug.apk` existe.

- [ ] **Step 7: commit**

```bash
git init -b main
git add . && git commit -m "chore: esqueleto Gradle do SeeFast Agente (Kotlin 1.9.20, AGP 8.2.0, Gradle 8.2)"
```

---

### Task 2: Modelo de consentimento e ecrã de consentimento

**Files:**
- Modify: `app/src/main/java/pt/seefast/agent/Consentimento.kt`
- Create: `app/src/main/java/pt/seefast/agent/MainActivity.kt`
- Create: `app/src/main/res/values/strings.xml` (textos do ecrã)
- Test: `app/src/test/java/pt/seefast/agent/ConsentimentoTeste.kt`

**Interfaces:**
- Consumes: `Consentimento` (Task 1).
- Produces: `Consentimento` com a API final:
  - `Consentimento(activo, localizacao, apps, uso)`
  - `fun Consentimento.podeRecolher(categoria: Categoria): Boolean` — `categoria` ∈ {`LOCALIZACAO`, `APPS`, ` USO`} (enum `Categoria` no mesmo ficheiro).
  - `fun Consentimento.paraPayload(): Map<String, Any>` → `{"consentimento": "concedido"|"pendente", "camera": false, "microfone": false, "localizacao": <bool>}`.
  - `fun Consentimento.comLocalizacao(ligado: Boolean)`, `.comApps(ligado: Boolean)`, `.comUso(ligado: Boolean)` — cópias imutáveis.

- [ ] **Step 1: escrever os testes que falham**

Adicionar a `ConsentimentoTeste`:
```kotlin
@Test fun `consentimento activo so recolhe o que foi autorizado`() {
    val c = Consentimento(activo = true, localizacao = true, apps = false, uso = true)
    assertTrue(c.podeRecolher(Categoria.LOCALIZACAO))
    assertFalse(c.podeRecolher(Categoria.APPS))
    assertTrue(c.podeRecolher(Categoria.USO))
}

@Test fun `sem consentimento nada e recolhido mesmo com categorias ligadas`() {
    val c = Consentimento(activo = false, localizacao = true)
    assertFalse(c.podeRecolher(Categoria.LOCALIZACAO))
}

@Test fun `o payload reflecte o consentimento e as categorias`() {
    val c = Consentimento(activo = true, localizacao = true)
    val p = c.paraPayload()
    assertEquals("concedido", p["consentimento"])
    assertEquals(true, p["localizacao"])
    assertEquals(false, p["camera"])
    assertEquals(false, p["microfone"])
}

@Test fun `o consentimento revogado fica pendente no payload`() {
    assertEquals("pendente", Consentimento(activo = false).paraPayload()["consentimento"])
}
```
- [ ] **Step 2: correr e ver falhar**

Run: `gradlew.bat test` → Expected: FAIL (unresolved `podeRecolher`, `Categoria`, `paraPayload`).

- [ ] **Step 3: implementar**

`Consentimento.kt` — adicionar o enum `Categoria { LOCALIZACAO, APPS, USO }`, `podeRecolher`, `paraPayload` e as cópias `com*`. `podeRecolher` devolve `activo && <a categoria correspondente>`.

- [ ] **Step 4: correr e ver passar**

Run: `gradlew.bat test` → Expected: PASS (5 testes).

- [ ] **Step 5: ecrã de consentimento**

`MainActivity` (extends `AppCompatActivity`): mostra o título "SeeFast Agente", o texto que explica **o que é recolhido, com que frequência, quem vê e como revogar** (strings em `strings.xml`), e três `Switch` (Localização / Aplicações / Tempo de uso) + um `Switch` principal "Consentimento". O `Switch` principal só liga/desliga `activo`; as categorias só ficam effective se `activo` for verdadeiro. `MainActivity` **não** arranca recolha nenhuma (ainda não existe serviço) — apenas guarda o estado em memória e mostra o estado actual.
**Ecrã de permissões (mesma task — é o ecrã mais importante da app):** `PermissoesActivity` mostra, uma linha por permissão, o estado (concedida / por conceder / acesso especial) e um botão que abre a definição certa do sistema:

| Permissão | Ecrã do sistema a abrir |
|---|---|
| Localização (runtime) | `Settings.ACTION_APPLICATION_DETAILS_SETTINGS` |
| Localização em segundo plano | `Settings.ACTION_APPLICATION_DETAILS_SETTINGS` (o utilizador tem de activar "Permitir sempre") |
| Tempo de uso (`PACKAGE_USAGE_STATS`) | `Settings.ACTION_USAGE_ACCESS_SETTINGS` |
| Notificações | `Settings.ACTION_APP_NOTIFICATION_SETTINGS` |
| Sem restrições de bateria | `Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` |

Strings exactas (pt-PT), em `strings.xml`: `consent_titulo` = "SeeFast Agente"; `consent_texto` = "O SeeFast recolhe o estado do telemóvel, a localização, as aplicações instaladas e o tempo de uso — apenas com o teu consentimento. Podes desligar cada categoria a qualquer momento."; `consent_categoria_localizacao` = "Localização"; `consent_categoria_apps` = "Aplicações instaladas"; `consent_categoria_uso` = "Tempo de uso"; `consent_recar` = "A recolha só começa depois de aceitares."; `consent_rever` = "Para desligar a recolha: desliga os interruptores acima. O que já foi enviado ao painel só é removido pelo administrador."

- [ ] **Step 6: correr e ver passar**

Run: `gradlew.bat test` → Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add app/src/main/java/pt/seefast/agent/Consentimento.kt app/src/main/java/pt/seefast/agent/MainActivity.kt app/src/main/res/values/strings.xml app/src/test
git commit -m "feat: modelo de consentimento e ecra de consentimento"
```

---

### Task 3: ApiClient — o contrato com a API

**Files:**
- Create: `app/src/main/java/pt/seefast/agent/ErroApi.kt`, `ApiClient.kt`
- Test: `app/src/test/java/pt/seefast/agent/ApiClientTeste.kt`

**Interfaces:**
- Consumes: o contrato fixo na secção "Contrato com a API" deste plano.
- Produces:
  - `sealed class ErroApi { object NaoAutenticado; object TokenDeOutroDispositivo; data class Rejeitado(val codigo: Int, val corpo: String); data class Rede(val causa: Throwable) }`
  - `class ApiClient(private val baseUrl: String, private val token: String, private val http: OkHttpClient = OkHttpClient())`
    - `suspend fun reportarEstado(deviceId: String, estado: String, bateria: Int, em: String): ErroApi?`
    - `suspend fun reportarLocalizacao(deviceId: String, lat: Double, lon: Double, em: String): ErroApi?`
    - `suspend fun reportarApps(deviceId: String, apps: List<AppReportada>): ErroApi?`
    - `suspend fun reportarUso(deviceId: String, uso: List<UsoReportado>): ErroApi?`
    - `suspend fun reportarConsentimento(deviceId: String, payload: Map<String, Any>): ErroApi?`
  - `data class AppReportada(nome: String, pacote: String, tamanhoMb: Int)`
  - `data class UsoReportado(pacote: String, minutos: Int)`
  - `null` = sucesso; `ErroApi` = falha (a API de review focus 1 e 2 é detalhada aqui).

- [ ] **Step 1: escrever os testes que falham**

`ApiClientTeste.kt`, com `MockWebServer`:
```kotlin
@Test fun `envia o token do dispositivo e o corpo do estado`() {
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"device":{"id":"dev-1"}}"""))
    // chamar reportarEstado("dev-1", "online", 82, "2026-10-21T12:00:00Z")
    val req = server.takeRequest()
    assertEquals("POST", req.method)
    assertEquals("/api/devices/dev-1/estado", req.path)
    assertEquals("Bearer tok-123", req.getHeader("Authorization"))
    val corpo = JSONObject(req.body.readUtf8())
    assertEquals("online", corpo.getString("estado"))
    assertEquals(82, corpo.getInt("bateria"))
}

@Test fun `um 401 significa token invalido`() {
    server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"dispositivo_nao_autenticado"}"""))
    assertEquals(ErroApi.NaoAutenticado, client.reportarEstado("dev-1", "online", 50, "em"))
}

@Test fun `um 403 significa token de outro dispositivo`() {
    server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"token_de_outro_dispositivo"}"""))
    assertEquals(ErroApi.TokenDeOutroDispositivo, client.reportarEstado("dev-2", "online", 50, "em"))
}

@Test fun `um 400 e um erro de dados`() {
    server.enqueue(MockResponse().setResponseCode(400).setBody("""{"error":"coordenadas_invalidas"}"""))
    val e = client.reportarLocalizacao("dev-1", 91.0, 0.0, "em")
    assertTrue(e is ErroApi.Rejeitado)
}

@Test fun `sem rede devolve erro de rede`() {
    server.shutdown()   // porta fechada
    assertTrue(client.reportarEstado("dev-1", "online", 50, "em") is ErroApi.Rede)
}
```
- [ ] **Step 2: correr e ver falhar**

Run: `gradlew.bat test --tests "*ApiClientTeste*"` → Expected: FAIL (unresolved `ErroApi`, `ApiClient`).

- [ ] **Step 3: implementar**

`ErroApi.kt` com o `sealed class` acima. `ApiClient.kt`:
- `baseUrl` sem barra final (`trimEnd('/')`).
- Cada `reportar*` faz `POST` para o path indicado, com `Authorization: Bearer <token>` e `Content-Type: application/json`; corpo `JSONObject` com os campos da tabela do contrato.
- Interpreta a resposta: 200 → `null`; 401 → `ErroApi.NaoAutenticado`; 403 → `ErroApi.TokenDeOutroDispositivo`; 400/4xx/5xx → `ErroApi.Rejeitado(codigo, corpo)`; `IOException` → `ErroApi.Rede(causa)`.
- Timeout de 20 s (ligar) / 30 s (ler), como no EndpointX.
- **Nunca** registar o token em logs.

- [ ] **Step 4: correr e ver passar**

Run: `gradlew.bat test --tests "*ApiClientTeste*"` → Expected: PASS (5 testes).

- [ ] **Step 5: commit**

```bash
git add app/src/main/java/pt/seefast/agent/ApiClient.kt app/src/main/java/pt/seefast/agent/ErroApi.kt app/src/test/java/pt/seefast/agent/ApiClientTeste.kt
git commit -m "feat: ApiClient com o contrato de ingestao da API"
```

---

### Task 4: Segredos cifrados e ecrã de ligação (enrolamento)

**Files:**
- Create: `app/src/main/java/pt/seefast/agent/Segredos.kt`, `EnrolamentoActivity.kt`
- Modify: `app/src/main/AndroidManifest.xml` (declarar `EnrolamentoActivity`)
- Test: `app/src/test/java/pt/seefast/agent/SegredosTeste.kt`

**Interfaces:**
- Consumes: `ApiClient` (Task 3).
- Produces:
  - `class Segredos(context: Context)` com `servidor(): String`, `guardarServidor(v: String)`, `deviceId(): String`, `guardarDeviceId(v: String)`, `token(): String`, `guardarToken(v: String)`, `limpar()`, `temLigacao(): Boolean`.
  - `EnrolamentoActivity`: campos `URL do servidor`, `ID do dispositivo`, `Token` (o token aceita `id.token` colado num único campo e separa os dois). Botão "Ligar".

- [ ] **Step 1: escrever os testes que falham**

`SegredosTeste.kt` (usar `ApplicationProvider.getApplicationContext()` — exige `androidx.test:core` como dependência de teste):
```kotlin
@Test fun `guarda e le o servidor o id e o token`() {
    val s = Segredos(ApplicationProvider.getApplicationContext())
    s.guardarServidor("http://192.168.1.10:3001")
    s.guardarDeviceId("dev-abc")
    s.guardarToken("tok-123")
    assertEquals("http://192.168.1.10:3001", s.servidor())
    assertEquals("dev-abc", s.deviceId())
    assertEquals("tok-123", s.token())
    assertTrue(s.temLigacao())
}

@Test fun `sem ligacao guardada nao ha nada`() {
    val s = Segredos(ApplicationProvider.getApplicationContext())
    s.limpar()
    assertFalse(s.temLigacao())
}
```
Adicionar `testImplementation("androidx.test:core:1.6.1")` (dependência de teste, permitida).

- [ ] **Step 2: correr e ver falhar**

Run: `gradlew.bat test --tests "*SegredosTeste*"` → Expected: FAIL (unresolved `Segredos`).

- [ ] **Step 3: implementar**

`Segredos.kt`: `EncryptedSharedPreferences` (chave "seefast_seguros", `MasterKey` com `MasterKeys.AES256_GCM_SPEC`) com as chaves `servidor`, `device_id`, `token`. `limpar()` apaga tudo.

`EnrolamentoActivity`: três campos com `label` e `hint`; o campo do servidor tem o hint "http://192.168.1.10:3001" (**a porta da API, 3001 — não a 5173 do Vite**); ao carregar "Ligar":
1. valida URL (tem de começar por `http://` ou `https://`; se for `http://` e o host não for `localhost` nem uma gama privada, mostra um aviso mas deixa avançar);
2. separa `id` e `token` (se colar `id.token`, corta no primeiro ponto — **atenção**: o id tem formato `dev-xxxxxxxx`, sem pontos; o token é hex, sem pontos → cortar no primeiro ponto é seguro);
3. valida a ligação com `ApiClient(baseUrl, token).reportarEstado(id, "online", nivelBateria, agoraIso)`; se der `NaoAutenticado` → mensagem "Token inválido"; se der `TokenDeOutroDispositivo` → "Este token não corresponde a este dispositivo"; se der `Rede` → "Não foi possível ligar ao servidor";
4. se sucesso → guarda em `Segredos` e volta ao `MainActivity`.

- [ ] **Step 4: correr e ver passar**

Run: `gradlew.bat test --tests "*SegredosTeste*"` → Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add app/src/main/java/pt/seefast/agent/Segredos.kt app/src/main/java/pt/seefast/agent/EnrolamentoActivity.kt app/src/main/AndroidManifest.xml app/src/test/java/pt/seefast/agent/SegredosTeste.kt
git commit -m "feat: segredos cifrados e ecra de ligacao"
```

---

### Task 5: Recolha de estado com WorkManager + fila offline

**Files:**
- Create: `app/src/main/java/pt/seefast/agent/recolha/RecoletorEstado.kt`
- Create: `app/src/main/java/pt/seefast/agent/FilaOffline.kt`
- Create: `app/src/main/java/pt/seefast/agent/AgenteWorker.kt`
- Test: `app/src/test/java/pt/seefast/agent/RecoletorEstadoTeste.kt`, `app/src/test/java/pt/seefast/agent/FilaOfflineTeste.kt`

**Interfaces:**
- Consumes: `ApiClient` (Task 3), `Segredos` (Task 4), `Consentimento` (Task 2).
- Produces:
  - `object RecoletorEstado { fun payload(estado: String, bateria: Int, em: String): JSONObject }` — payload puro, testável sem Android.
  - `class FilaOffline(context: Context)` com `enfileirar(tipo: TipoReport, corpo: JSONObject)`, `tirar(): List<Pair<TipoReport, JSONObject>>`, `limpar()`, `contar(): Int`, `expirarMaisQue(horas: Int): Int`.
  - `enum class TipoReport { ESTADO, LOCALIZACAO, APPS, USO, CONSENTIMENTO }`
  - `enum class Decisao { ENVIAR, ENFILEIRAR, FALHAR }` e `AgenteWorker.decisaoPara(e: ErroApi?): Decisao` — função **pura** (testável sem Android): `null` → ENVIAR; `Rede` → ENFILEIRAR; `NaoAutenticado`/`TokenDeOutroDispositivo`/`Rejeitado` → FALHAR.
  - `object AgenteScheduler { fun agendarEstado(); fun agendarApps(); fun cancelar() }` — usa `WorkManager.enqueueUniquePeriodicWork` com `ExistingPeriodicWorkPolicy.KEEP`.
  - `class AgenteWorker(context: Context, params: WorkerParameters) : CoroutineWorker` — envia o estado; se a API falhar com `Rede`, enfileira e devolve `Result.retry()`; se falhar com `NaoAutenticado`/`TokenDeOutroDispositivo`, **não** enfileira e devolve `Result.failure()` (e marca "precisa de re-ligação").

- [ ] **Step 1: escrever os testes que falham**

```kotlin
// RecoletorEstadoTeste
@Test fun `o payload do estado tem os campos do contrato`() {
    val p = RecoletorEstado.payload("online", 82, "2026-10-21T12:00:00Z")
    assertEquals("online", p.getString("estado"))
    assertEquals(82, p.getInt("bateria"))
    assertEquals("2026-10-21T12:00:00Z", p.getString("em"))
}

// FilaOfflineTeste
@Test fun `enfileirar e tirar devolve o mesmo report pela ordem`() {
    val f = FilaOffline(context)
    f.limpar()
    f.enfileirar(TipoReport.ESTADO, JSONObject().put("estado", "online"))
    f.enfileirar(TipoReport.APPS, JSONObject().put("apps", 1))
    val r = f.tirar()
    assertEquals(2, r.size)
    assertEquals(TipoReport.ESTADO, r[0].first)
    assertEquals(TipoReport.APPS, r[1].first)
}

@Test fun `reports com mais de 24 horas sao descartados`() {
    val f = FilaOffline(context)
    f.limpar()
    f.enfileirar(TipoReport.ESTADO, JSONObject().put("estado", "online"))
    assertEquals(1, f.expirarMaisQue(0))   // 0 horas = expira já
    assertEquals(0, f.contar())
}
@Test fun `um 401 ou 403 nao volta a ser tentado`() {
    assertEquals(Decisao.FALHAR, AgenteWorker.decisaoPara(ErroApi.NaoAutenticado))
    assertEquals(Decisao.FALHAR, AgenteWorker.decisaoPara(ErroApi.TokenDeOutroDispositivo))
}

@Test fun `sem rede o report fica para depois`() {
    assertEquals(Decisao.ENFILEIRAR, AgenteWorker.decisaoPara(ErroApi.Rede(IOException("offline"))))
}

@Test fun `sem erro o report e enviado`() {
    assertEquals(Decisao.ENVIAR, AgenteWorker.decisaoPara(null))
}
```
- [ ] **Step 2: correr e ver falhar**

Run: `gradlew.bat test --tests "*RecoletorEstadoTeste*" --tests "*FilaOfflineTeste*"` → Expected: FAIL (unresolved).

- [ ] **Step 3: implementar**

`RecoletorEstado.payload` — `JSONObject` com `estado`, `bateria` (0–100, limitado), `em`.

`FilaOffline` — ficheiro JSON em `filesDir/reportes.json`; cada entrada `{"tipo": "...", "corpo": {...}, "em": "<iso>"}`; `expirarMaisQue(horas)` remove entradas com `em` mais antiga que `horas` e devolve quantas removeu; escrever o ficheiro de forma atómica (escrever temporário + `renameTo`).

`AgenteWorker`:
- lê `Segredos`; sem ligação → `Result.success()` (não faz nada).
- monta o payload de estado (bateria via `BatteryManager`, `em` = agora em ISO-8601 UTC).
- `reportarEstado`; se `null` → sucesso; se `ErroApi.Rede` → enfileira e `Result.retry()`; se `ErroApi.NaoAutenticado`/`TokenDeOutroDispositivo` → `Result.failure()` **sem** enfileirar; se `ErroApi.Rejeitado` → `Result.failure()`.
- **Antes** de reportar, esvazia a fila: se houver reports pendentes, tentá-los primeiro (pela ordem) e só depois envia o novo.
- Agendamento: `WorkManager.enqueueUniquePeriodicWork("estado", ExistingPeriodicWorkPolicy.KEEP, PeriodicWorkRequestBuilder<AgenteWorker>(15, TimeUnit.MINUTES))` — feito num `AgenteScheduler` (classe nova, `object`) chamado pelo `MainActivity` quando o consentimento é aceite.

- [ ] **Step 4: correr e ver passar**

Run: `gradlew.bat test --tests "*RecoletorEstadoTeste*" --tests "*FilaOfflineTeste*"` → Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add app/src/main/java/pt/seefast/agent/recolha/RecoletorEstado.kt app/src/main/java/pt/seefast/agent/FilaOffline.kt app/src/main/java/pt/seefast/agent/AgenteWorker.kt app/src/test
git commit -m "feat: recolha de estado com WorkManager e fila offline"
```

---

### Task 6: Localização — serviço em primeiro plano

**Files:**
- Create: `app/src/main/java/pt/seefast/agent/recolha/RecoletorLocalizacao.kt`
- Create: `app/src/main/java/pt/seefast/agent/AgenteService.kt`
- Create: `app/src/main/java/pt/seefast/agent/BootReceiver.kt`
- Modify: `app/src/main/AndroidManifest.xml` (permissões, serviço, receiver, `network_security_config.xml`)
- Create: `app/src/main/res/xml/network_security_config.xml`, `app/src/main/res/values/strings.xml` (notificação)
- Test: `app/src/test/java/pt/seefast/agent/RecoletorLocalizacaoTeste.kt`

**Interfaces:**
- Consumes: `ApiClient`, `Segredos`, `Consentimento`, `FilaOffline`, `TipoReport`.
- Produces:
  - `object RecoletorLocalizacao { fun payload(lat: Double, lon: Double, em: String): JSONObject }` — o corpo tem **exactamente** `lat`, `lon` e `em` (o contrato da API não tem mais campos; a precisão fica só no log local).
  - `class AgenteService : Service` — `startForeground` com `ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION` (e `dataSync`), notificação persistente "SeeFast Agente activo", `Handler` com ciclo de 5 min que pede a localização e reporta.
  - `class BootReceiver : BroadcastReceiver` — arranca o serviço em `BOOT_COMPLETED` **apenas se** o consentimento estiver activo.

- [ ] **Step 1: escrever o teste que falha**

```kotlin
class RecoletorLocalizacaoTeste {
    @Test fun `o payload da localizacao tem os campos do contrato`() {
        val p = RecoletorLocalizacao.payload(38.7223, -9.1393, "2026-10-21T12:00:00Z")
        assertEquals(38.7223, p.getDouble("lat"), 0.0001)
        assertEquals(-9.1393, p.getDouble("lon"), 0.0001)
        assertEquals("2026-10-21T12:00:00Z", p.getString("em"))
        assertEquals(3, p.length())
    }
}
```
- [ ] **Step 2: correr e ver falhar**

Run: `gradlew.bat test --tests "*RecoletorLocalizacaoTeste*"` → Expected: FAIL (unresolved).

- [ ] **Step 3: implementar**

`RecoletorLocalizacao.payload` — `JSONObject` com `lat`, `lon`, `em` (e `precisao` quando não nula).

`AgenteService`:
- `onStartCommand`: garante `startForeground(NOTIF_ID, notificacao, tipo)` com `FOREGROUND_SERVICE_TYPE_LOCATION or FOREGROUND_SERVICE_TYPE_DATA_SYNC`; se o `SecurityException` for lançado (permissão revogada), **captura-o**, muda o tipo para `DATA_SYNC` e volta a chamar `startForeground` — nunca deixar o serviço morrer com `SecurityException` (Review Focus 5).
- Ciclo com `Handler(Looper.getMainLooper())` a cada 5 min: pedir localização (`LocationManager` com `ACCESS_FINE_LOCATION`, fallback `ACCESS_COARSE_LOCATION` via `getBestProvider`), reportar via `ApiClient`, ou enfileirar se der `ErroApi.Rede`.
- **Não** usa Play Services.
- A notificação tem de ser visível: canal "servico" (importance LOW), texto "SeeFast Agente activo — recolhe a localização enquanto o consentimento estiver activo".
- Se o consentimento for revogado (verificado a cada ciclo e por `BroadcastReceiver` do `MainActivity`), **parar** o serviço (`stopSelf`) e parar a notificação.

`BootReceiver` — `BOOT_COMPLETED`: se `Segredos().temLigacao()` e o consentimento estiver activo, arrancar o serviço.

`AndroidManifest.xml` — permissões: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `FOREGROUND_SERVICE_DATA_SYNC`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `INTERNET`, `ACCESS_NETWORK_STATE`; `<service android:foregroundServiceType="location|dataSync" android:exported="false">`; `<receiver android:exported="true">` para `BOOT_COMPLETED`; `android:networkSecurityConfig="@xml/network_security_config"`.

`network_security_config.xml`:
```xml
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">10.0.0.0/8</domain>
    <domain includeSubdomains="true">172.16.0.0/12</domain>
    <domain includeSubdomains="true">192.168.0.0/16</domain>
    <domain includeSubdomains="true">localhost</domain>
  </domain-config>
</network-security-config>
```
(Se o `domain` não aceitar CIDR, usar `base-config` com `cleartextTrafficPermitted="false"` e um `domain-config` por gama — verificar no primeiro build; se CIDR não funcionar, documentar a alternativa no README.)

- [ ] **Step 4: correr e ver passar**

Run: `gradlew.bat test --tests "*RecoletorLocalizacaoTeste*"` → Expected: PASS.

- [ ] **Step 5: build do APK**

Run: `gradlew.bat assembleDebug` → Expected: APK gerado sem erros de manifest.

- [ ] **Step 6: commit**

```bash
git add app/src/main
git commit -m "feat: localizacao com servico em primeiro plano (5 min, sem Play Services)"
```

---

### Task 7: Aplicações instaladas e tempo de uso

**Files:**
- Create: `app/src/main/java/pt/seefast/agent/recolha/RecoletorApps.kt`, `RecoletorUso.kt`
- Modify: `app/src/main/AndroidManifest.xml` (`QUERY_ALL_PACKAGES`, `PACKAGE_USAGE_STATS`)
- Test: `app/src/test/java/pt/seefast/agent/RecoletorAppsTeste.kt`, `RecoletorUsoTeste.kt`

**Interfaces:**
- Consumes: `ApiClient`, `FilaOffline`, `TipoReport`, `AppReportada`, `UsoReportado`.
- Produces:
  - `object RecoletorApps { fun payload(apps: List<AppReportada>): JSONObject }` — `{"apps":[{"nome","pacote","tamanhoMb"}]}`
  - `object RecoletorUso { fun payload(uso: List<UsoReportado>): JSONObject }` — `{"uso":[{"pacote","minutos"}]}`
  - `object RecoletorApps { fun tamanhoInstalado(info: ApplicationInfo): Int }` — soma de `sourceDir` + `splitSourceDirs` em MB (medida possível desde a API 26).

- [ ] **Step 1: escrever os testes que falham**

```kotlin
// RecoletorAppsTeste
@Test fun `o payload das apps tem nome pacote e tamanho`() {
    val p = RecoletorApps.payload(listOf(AppReportada("Instagram", "com.instagram.android", 45)))
    val apps = p.getJSONArray("apps")
    assertEquals(1, apps.length())
    assertEquals("Instagram", apps.getJSONObject(0).getString("nome"))
    assertEquals("com.instagram.android", apps.getJSONObject(0).getString("pacote"))
    assertEquals(45, apps.getJSONObject(0).getInt("tamanhoMb"))
}

// RecoletorUsoTeste
@Test fun `o payload de uso tem pacote e minutos`() {
    val p = RecoletorUso.payload(listOf(UsoReportado("com.instagram.android", 145)))
    val uso = p.getJSONArray("uso")
    assertEquals("com.instagram.android", uso.getJSONObject(0).getString("pacote"))
    assertEquals(145, uso.getJSONObject(0).getInt("minutos"))
}

@Test fun `entradas de uso invalidas sao ignoradas`() {
    val p = RecoletorUso.payload(listOf(UsoReportado("", -5)))
    assertEquals(0, p.getJSONArray("uso").length())
}
```
- [ ] **Step 2: correr e ver falhar**

Run: `gradlew.bat test --tests "*RecoletorAppsTeste*" --tests "*RecoletorUsoTeste*"` → Expected: FAIL (unresolved).

- [ ] **Step 3: implementar**

- `RecoletorApps.payload` — mapeia para `JSONObject` com `nome`, `pacote`, `tamanhoMb`; ignora entradas sem pacote.
- `RecoletorUso.payload` — mapeia para `JSONObject` com `pacote`, `minutos`; ignora pacote vazio ou minutos negativos/NaN.
- Versões Android (no mesmo objecto, métodos que usam o sistema):
  - `RecoletorApps.listar(context: Context): List<AppReportada>` — `PackageManager.getInstalledApplications(0)`, filtrar as do sistema? (manter todas), `tamanhoInstalado` a partir de `ApplicationInfo.sourceDir` + `splitSourceDirs`.
  - `RecoletorUso.listar(context: Context): List<UsoReportado>` — `UsageStatsManager.queryEvents` / `queryUsageStats`; se a permissão especial não estiver concedida, devolver lista vazia (e a app mostrar "falta activar o acesso ao tempo de uso").
- Agendar: no `AgenteWorker` (ou num worker próprio `AppsWorker` com intervalo de 6 h) enviar apps e uso. Prefere-se um worker próprio: `AppsWorker` (6 h) — cria-o e regista-o no mesmo `AgenteScheduler`.
- Manifest: `QUERY_ALL_PACKAGES` e `PACKAGE_USAGE_STATS` (`tools:ignore="QueryAllPackagesPermission"` para a Play).

- [ ] **Step 4: correr e ver passar**

Run: `gradlew.bat test --tests "*RecoletorAppsTeste*" --tests "*RecoletorUsoTeste*"` → Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add app/src/main app/src/test
git commit -m "feat: apps instaladas e tempo de uso (6 h)"
```

---

### Task 8: Relatório de consentimento, ícones, release e README

**Files:**
- Create: `app/src/main/java/pt/seefast/agent/recolha/RelatorioConsentimento.kt`
- Modify: `app/src/main/java/pt/seefast/agent/MainActivity.kt` (reportar consentimento ao servidor)
- Create: `app/src/main/res/mipmap-*/ic_launcher.png` (ícones), `app/src/main/res/values/strings.xml` (versão)
- Create: `README.md`, `keystore` (gerado, **não** commitar)
- Test: `app/src/test/java/pt/seefast/agent/RelatorioConsentimentoTeste.kt`

**Interfaces:**
- Consumes: `Consentimento.paraPayload()`, `ApiClient.reportarConsentimento`.
- Produces: app pronta a sideload; `README.md` com instruções de instalação e configuração.

- [ ] **Step 1: escrever o teste que falha**

```kotlin
class RelatorioConsentimentoTeste {
    @Test fun `o consentimento revogado e reportado como pendente`() {
        val p = RelatorioConsentimento.payload(Consentimento(activo = false, localizacao = true))
        assertEquals("pendente", p.getString("consentimento"))
        assertEquals(false, p.getBoolean("localizacao"))
    }
}
```
- [ ] **Step 2: correr e ver falhar**

Run: `gradlew.bat test --tests "*RelatorioConsentimentoTeste*"` → Expected: FAIL (unresolved).

- [ ] **Step 3: implementar**

`RelatorioConsentimento.payload(consentimento: Consentimento): JSONObject` — reusa `Consentimento.paraPayload()` mas converte para `JSONObject` (o `Map` não é serializável directamente). Ao mudar o consentimento no `MainActivity`, o app chama `ApiClient.reportarConsentimento(deviceId, payload)` e, se o resultado for `ErroApi.Rede`, enfileira (`TipoReport.CONSENTIMENTO`).

- [ ] **Step 4: correr e ver passar**

Run: `gradlew.bat test` → Expected: PASS (suite completa).

- [ ] **Step 5: ícones e versão**

- Ícones: navy `#102a43` + ciano `#16b9e8`, nos `mipmap` densities (mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192) — reaproveitar o visual do painel (escudo com olho).
- `versionName = "0.1.0"`, `versionCode = 1` (bump a cada release).

- [ ] **Step 6: release assinado**

Gerar o keystore (uma vez, **fora** do repositório):
```bash
keytool -genkeypair -v -keystore C:\Users\FMLIDEL-TI\seefast-agent.jks -alias seefast -keyalg RSA -keysize 2048 -validity 10000
```
Preencher `keystore.properties` (não commitar) com `storeFile`, `storePassword`, `keyAlias`, `keyPassword`; o `app/build.gradle.kts` lê esse ficheiro (ou as variáveis `SEEFAST_KEYSTORE_*`) como no EndpointX.

Run: `gradlew.bat assembleRelease` → Expected: `app/build/outputs/apk/release/app-release.apk`.

- [ ] **Step 7: README da app**

`README.md` com: o que é, o que recolhe, como ligar (URL, id, token), como activar as permissões especiais, como revogar, como reportar um bug, e o aviso de que a Play Store exige a declaração de `PACKAGE_USAGE_STATS`.

- [ ] **Step 8: checklist de aceitação manual (no telemóvel do utilizador)**

Não há `adb devices` nem emulador nesta máquina, por isso esta verificação é manual. Lista para o utilizador executar, por ordem:
1. Instalar `app-debug.apk` (ou `app-release.apk`) no telemóvel.
2. Abrir a app → ecrã de consentimento → ligar o consentimento.
3. Abrir o ecrã de permissões → conceder localização, tempo de uso e notificações.
4. Ligar no painel: Dispositivos → "Registar dispositivo" → copiar o `id` e o `token`.
5. Na app, ecrã de ligação → servidor `http://<ip-do-PC>:3001`, `id` e `token` → "Ligar". O ecrã de permissões deve ficar acessível.
6. No painel, o dispositivo deve aparecer em Dispositivos com estado e bateria.
7. Activar a localização → esperar 5 min → a Localização no painel actualiza.
8. **Revogar a permissão de localização com o serviço a correr** → a app **não** deve morrer nem ficar sem notificação (Review Focus 5).
9. Desligar a rede → a app deve enfileirar; repôr a rede → os reports saem.
10. Ligar/desligar o consentimento → a recolha pára e o painel reflecte "pendente".
11. Em Samsung/Xiaomi: verificar as restrições de bateria da app (estas marcas matam mais apps em segundo plano).

- [ ] **Step 9: commit**

```bash
git add app README.md
git commit -m "feat: relatorio de consentimento, icones, release assinado e README"
```

---

## Fora do plano (fica para depois)

- Publicação na Play Store (ficha, Data safety, política de privacidade, Play App Signing).
- Testes de instrumentação (requer aparelho/emulador — não há `adb devices` nesta máquina).
- Suporte a múltiplos servidores, widget de ecrã principal, tema escuro.
- `onboarding` com leitura de QR (excluído: a câmara está fora de âmbito).
- Relatório de erros/crashes remoto.
