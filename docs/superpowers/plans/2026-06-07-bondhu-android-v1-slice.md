# Bondhu Android v1 (Vertical Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Android (Kotlin + Compose) Bondhu client that works end-to-end against the live backend: register/login → add & pair a WhatsApp account → see the chat list → open a chat → send and receive text in real time.

**Architecture:** MVVM. Compose screens observe `StateFlow` from Hilt-injected ViewModels; ViewModels call Repositories; Repositories call a Retrofit `BondhuApi` and merge live `Socket.IO` events into their flows. One `SocketManager` singleton holds the JWT-authenticated socket. A `HostSelectionInterceptor` makes the base URL runtime-configurable (BuildConfig default + DataStore override); an `AuthInterceptor` attaches the Bearer JWT. Account scoping is **explicit**: every account-scoped call passes `account` as a query/body param supplied by the repository from `Prefs.activeAccount` (no magic interceptor).

**Tech Stack:** Kotlin 2.0.21 · AGP 8.7.3 · Gradle 8.13 · Jetpack Compose (BOM 2024.12.01) + Material3 · Hilt 2.52 (KSP) · Retrofit 2.11 + Moshi 1.15.1 (KSP codegen) · OkHttp 4.12 · socket.io-client 2.1.0 · Coil 2.7 · DataStore 1.1.1 · Navigation-Compose 2.8.5 · ZXing core 3.5.3 · min/target/compile SDK 26/35/35.

**Source spec:** `docs/superpowers/specs/2026-06-07-bondhu-android-v1-design.md`.

**Backend (already live):** REST + Socket.IO at `https://wa.client-flow.xyz` (prod) / `http://10.0.2.2:3050` (emulator → host dev server). Contract in spec §4. No backend changes in this plan.

---

## Conventions for every task

- **Working dir:** all paths are under `E:\New Whatsapp\android\` unless noted. Run commands from that folder.
- **Build with the bundled JBR.** Gradle/Java are not on PATH; Android Studio's JBR is. Every build command is:
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; .\gradlew.bat <tasks>
  ```
- **Build gate:** a task is done only when its stated gradle command succeeds (`BUILD SUCCESSFUL`).
- **Commit** at the end of each task. Author is the repo default (`nishatbd3388`). End every message with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- **Branch:** do all work on `feat/android-v1-slice` (create in Task 1). Merge to `master` + `git push origin master` only after the final acceptance task.

---

## File map (what gets created, by responsibility)

```
android/
  settings.gradle.kts            root settings, module include, repos
  build.gradle.kts               root plugins (apply false)
  gradle.properties              jvm args, androidx, kotlin
  local.properties               sdk.dir (gitignored)
  gradle/libs.versions.toml      version catalog (single source of versions)
  gradle/wrapper/…               wrapper jar + properties (downloaded)
  gradlew / gradlew.bat          wrapper scripts (downloaded)
  .gitignore                     android ignores
  app/
    build.gradle.kts             app module: plugins, sdk, deps, BuildConfig
    proguard-rules.pro           (empty placeholder, release minify off)
    src/main/AndroidManifest.xml permissions + Application + Activity
    src/main/res/…               themes.xml, strings.xml, launcher icon refs
    src/main/java/com/bondhu/app/
      App.kt                     @HiltAndroidApp
      MainActivity.kt            @AndroidEntryPoint, hosts NavHost
      di/NetworkModule.kt        OkHttp, Retrofit, Moshi, BondhuApi (third-party @Provides only)
      data/store/Prefs.kt        DataStore: jwt, activeAccount, baseUrl, theme (@Inject/@Singleton)
      data/api/BondhuApi.kt      Retrofit interface (v1 surface)
      data/api/Interceptors.kt   HostSelectionInterceptor, AuthInterceptor
      data/socket/SocketManager.kt  one socket, JWT handshake, SharedFlow events
      data/model/Dtos.kt         @JsonClass DTOs (auth, account, chat, message, status)
      data/model/UiModels.kt     UI models + AckTick enum (ConnUi lives with StatusChip in ui/common/Atoms.kt)
      data/model/Mappers.kt      DTO→UI mappers, ack→tick, base-url resolve
      data/repository/AuthRepository.kt
      data/repository/AccountRepository.kt
      data/repository/ChatRepository.kt
      ui/theme/Tokens.kt         raw color tokens from theme.jsx
      ui/theme/Color.kt          Material3 ColorScheme
      ui/theme/Type.kt           Typography
      ui/theme/Theme.kt          BondhuTheme composable
      ui/common/Atoms.kt         BondhuButton, BondhuField, StatusChip, ConnUi, Avatar, EmptyState, ErrorBanner
      ui/nav/Routes.kt           route constants
      ui/nav/BondhuNavHost.kt    NavHost + start-destination gate
      ui/auth/AuthScreen.kt      ui/auth/AuthViewModel.kt
      ui/account/AccountListScreen.kt  ui/account/PairScreen.kt  ui/account/AccountViewModel.kt  ui/account/PairViewModel.kt
      ui/chatlist/ChatListScreen.kt  ui/chatlist/ChatListViewModel.kt
      ui/chat/ChatScreen.kt  ui/chat/ChatViewModel.kt  ui/chat/MessageBubble.kt  ui/chat/Composer.kt
    src/test/java/com/bondhu/app/   JUnit (mappers, interceptor, repos via MockWebServer)
  README.md                      build & run instructions
```

---

## Task 1: Project scaffold (Gradle wrapper, catalog, settings)

**Files:**
- Create: `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties`, `android/gradle/libs.versions.toml`, `android/.gitignore`, `android/local.properties`, `android/gradle/wrapper/gradle-wrapper.properties`

- [ ] **Step 1: Branch**

```powershell
git checkout -b feat/android-v1-slice
```

- [ ] **Step 2: Bootstrap the Gradle wrapper from a downloaded distribution**

The wrapper jar is binary and cannot be hand-written, and gradle/java are not on PATH. Download the Gradle 8.13 distribution once and run `gradle wrapper` to generate `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`, and `gradle/wrapper/gradle-wrapper.properties` inside `android/`:

```powershell
New-Item -ItemType Directory -Force "android" | Out-Null
$zip = "$env:TEMP\gradle-8.13-bin.zip"; $dst = "$env:TEMP\gradle-8.13"
Invoke-WebRequest "https://services.gradle.org/distributions/gradle-8.13-bin.zip" -OutFile $zip
Expand-Archive $zip -DestinationPath $dst -Force
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
& "$dst\gradle-8.13\bin\gradle.bat" wrapper --gradle-version 8.13 --gradle-distribution-url "https://services.gradle.org/distributions/gradle-8.13-bin.zip" --project-dir android
```
Verify `android/gradle/wrapper/gradle-wrapper.properties` ends up with `distributionUrl=...gradle-8.13-bin.zip`. (Alternative if the download is blocked: open `E:\New Whatsapp\android` in Android Studio once — it provisions the wrapper automatically.)

- [ ] **Step 3: `android/local.properties`** (gitignored — points Gradle at the SDK)

```properties
sdk.dir=C\:\\Users\\nisha\\AppData\\Local\\Android\\Sdk
```

- [ ] **Step 4: `android/gradle.properties`**

```properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.caching=true
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
```

- [ ] **Step 5: `android/settings.gradle.kts`**

```kotlin
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "Bondhu"
include(":app")
```

- [ ] **Step 6: `android/gradle/libs.versions.toml`**

```toml
[versions]
agp = "8.7.3"
kotlin = "2.0.21"
ksp = "2.0.21-1.0.28"
coreKtx = "1.15.0"
lifecycle = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.12.01"
navCompose = "2.8.5"
hilt = "2.52"
hiltNavCompose = "1.2.0"
retrofit = "2.11.0"
moshi = "1.15.1"
okhttp = "4.12.0"
socketio = "2.1.0"
coil = "2.7.0"
datastore = "1.1.1"
zxing = "3.5.3"
junit = "4.13.2"
coroutinesTest = "1.9.0"

[libraries]
core-ktx = { module = "androidx.core:core-ktx", version.ref = "coreKtx" }
lifecycle-runtime-ktx = { module = "androidx.lifecycle:lifecycle-runtime-ktx", version.ref = "lifecycle" }
lifecycle-runtime-compose = { module = "androidx.lifecycle:lifecycle-runtime-compose", version.ref = "lifecycle" }
lifecycle-viewmodel-compose = { module = "androidx.lifecycle:lifecycle-viewmodel-compose", version.ref = "lifecycle" }
activity-compose = { module = "androidx.activity:activity-compose", version.ref = "activityCompose" }
compose-bom = { module = "androidx.compose:compose-bom", version.ref = "composeBom" }
compose-ui = { module = "androidx.compose.ui:ui" }
compose-ui-graphics = { module = "androidx.compose.ui:ui-graphics" }
compose-ui-tooling = { module = "androidx.compose.ui:ui-tooling" }
compose-ui-tooling-preview = { module = "androidx.compose.ui:ui-tooling-preview" }
compose-material3 = { module = "androidx.compose.material3:material3" }
compose-material-icons-extended = { module = "androidx.compose.material:material-icons-extended" }
navigation-compose = { module = "androidx.navigation:navigation-compose", version.ref = "navCompose" }
hilt-android = { module = "com.google.dagger:hilt-android", version.ref = "hilt" }
hilt-compiler = { module = "com.google.dagger:hilt-android-compiler", version.ref = "hilt" }
hilt-navigation-compose = { module = "androidx.hilt:hilt-navigation-compose", version.ref = "hiltNavCompose" }
retrofit = { module = "com.squareup.retrofit2:retrofit", version.ref = "retrofit" }
retrofit-moshi = { module = "com.squareup.retrofit2:converter-moshi", version.ref = "retrofit" }
moshi = { module = "com.squareup.moshi:moshi", version.ref = "moshi" }
moshi-kotlin-codegen = { module = "com.squareup.moshi:moshi-kotlin-codegen", version.ref = "moshi" }
okhttp = { module = "com.squareup.okhttp3:okhttp", version.ref = "okhttp" }
okhttp-logging = { module = "com.squareup.okhttp3:logging-interceptor", version.ref = "okhttp" }
okhttp-mockwebserver = { module = "com.squareup.okhttp3:mockwebserver", version.ref = "okhttp" }
socketio = { module = "io.socket:socket.io-client", version.ref = "socketio" }
coil-compose = { module = "io.coil-kt:coil-compose", version.ref = "coil" }
datastore-preferences = { module = "androidx.datastore:datastore-preferences", version.ref = "datastore" }
zxing-core = { module = "com.google.zxing:core", version.ref = "zxing" }
junit = { module = "junit:junit", version.ref = "junit" }
coroutines-test = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-test", version.ref = "coroutinesTest" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
```

- [ ] **Step 7: `android/build.gradle.kts`**

```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
}
```

- [ ] **Step 8: `android/.gitignore`**

```gitignore
*.iml
.gradle/
/local.properties
.idea/
.DS_Store
/build
/captures
.externalNativeBuild
.cxx
app/build/
```

- [ ] **Step 9: Verify Gradle resolves (no app module yet)**

Run:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat projects
```
Expected: `BUILD SUCCESSFUL`, lists root project `Bondhu` and `:app` not yet existing is fine? — `:app` is included but has no build file yet, so run `.\gradlew.bat help` instead if `projects` complains. Expected either way: `BUILD SUCCESSFUL`. (If it fails on `:app`, that's resolved in Task 2; `help` must still pass.)

- [ ] **Step 10: Commit**

```powershell
git add android/settings.gradle.kts android/build.gradle.kts android/gradle.properties android/gradle/libs.versions.toml android/.gitignore android/gradlew android/gradlew.bat android/gradle/wrapper/gradle-wrapper.properties android/gradle/wrapper/gradle-wrapper.jar
git commit -m "chore(android): gradle scaffold + version catalog + wrapper`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: App module + Hilt Application + empty Compose Activity (first build)

**Files:**
- Create: `android/app/build.gradle.kts`, `android/app/proguard-rules.pro`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/values/strings.xml`, `android/app/src/main/res/values/themes.xml`, `android/app/src/main/java/com/bondhu/app/App.kt`, `android/app/src/main/java/com/bondhu/app/MainActivity.kt`

- [ ] **Step 1: `android/app/build.gradle.kts`**

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.bondhu.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bondhu.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:3050\"")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "BASE_URL", "\"https://wa.client-flow.xyz\"")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.navigation.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.retrofit)
    implementation(libs.retrofit.moshi)
    implementation(libs.moshi)
    ksp(libs.moshi.kotlin.codegen)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.socketio) { exclude(group = "org.json", module = "json") }
    implementation(libs.coil.compose)
    implementation(libs.datastore.preferences)
    implementation(libs.zxing.core)

    debugImplementation(libs.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.moshi)
}
```

- [ ] **Step 2: `android/app/proguard-rules.pro`** — empty file (release minify is off):

```pro
# release minify disabled; no rules needed for v1
```

- [ ] **Step 3: `android/app/src/main/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:name=".App"
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/Theme.Bondhu">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.Bondhu">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```
(`usesCleartextTraffic` is needed for the `http://10.0.2.2:3050` debug server.)

- [ ] **Step 4: `android/app/src/main/res/values/strings.xml`**

```xml
<resources>
    <string name="app_name">Bondhu</string>
</resources>
```

- [ ] **Step 5: `android/app/src/main/res/values/themes.xml`** (Material3 base; Compose drives real colors)

```xml
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="Theme.Bondhu" parent="android:Theme.Material.NoActionBar">
        <item name="android:statusBarColor">#0B141A</item>
        <item name="android:windowBackground">#0B141A</item>
    </style>
</resources>
```

- [ ] **Step 6: `App.kt`**

```kotlin
package com.bondhu.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class App : Application()
```

- [ ] **Step 7: `MainActivity.kt`** (temporary placeholder UI — replaced in Task 9)

```kotlin
package com.bondhu.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Text("Bondhu", modifier = Modifier.wrapContentSize())
                }
            }
        }
    }
}
```

- [ ] **Step 8: First real build**

Run:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:assembleDebug
```
Expected: `BUILD SUCCESSFUL`. This proves the whole toolchain (AGP, Compose compiler, Hilt KSP, Moshi KSP) resolves.

- [ ] **Step 9: Commit**

```powershell
git add android/app
git commit -m "feat(android): app module, Hilt Application, empty Compose activity`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Theme tokens + common atoms (avatar color/initials TDD)

**Files:**
- Create: `ui/theme/Tokens.kt`, `ui/theme/Color.kt`, `ui/theme/Type.kt`, `ui/theme/Theme.kt`, `ui/common/Atoms.kt`, `ui/common/AvatarUtil.kt`
- Test: `app/src/test/java/com/bondhu/app/AvatarUtilTest.kt`

- [ ] **Step 1: Write the failing test** — `AvatarUtilTest.kt`

```kotlin
package com.bondhu.app

import com.bondhu.app.ui.common.avColorIndex
import com.bondhu.app.ui.common.initials
import org.junit.Assert.assertEquals
import org.junit.Test

class AvatarUtilTest {
    @Test fun initials_singleWord_oneLetter() {
        assertEquals("A", initials("Ammu"))
    }
    @Test fun initials_twoWords_twoLetters() {
        assertEquals("RB", initials("Rafiq Bhai"))
    }
    @Test fun initials_empty_isQuestionMark() {
        assertEquals("?", initials(""))
    }
    @Test fun avColorIndex_isStableAndInRange() {
        val a = avColorIndex("Rafiq Bhai")
        val b = avColorIndex("Rafiq Bhai")
        assertEquals(a, b)
        assert(a in 0..8)
    }
}
```

Contract: a single word → its first letter uppercased; ≥2 words → first letters of the first two words; empty/blank → `"?"`.

- [ ] **Step 2: Run test, verify it fails**

Run:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.AvatarUtilTest"
```
Expected: FAIL (unresolved reference `avColorIndex`/`initials`).

- [ ] **Step 3: Implement `ui/common/AvatarUtil.kt`**

```kotlin
package com.bondhu.app.ui.common

import androidx.compose.ui.graphics.Color

val AVATAR_COLORS = listOf(
    Color(0xFF6B8AFE), Color(0xFFE59866), Color(0xFF48C9B0), Color(0xFFEC7063),
    Color(0xFFAF7AC5), Color(0xFF5DADE2), Color(0xFFF4D03F), Color(0xFF52BE80), Color(0xFFE08283),
)

fun avColorIndex(seed: String?): Int {
    val s = seed ?: ""
    var sum = 0
    for (c in s) sum += c.code
    return if (s.isEmpty()) 0 else sum % AVATAR_COLORS.size
}

fun avColor(seed: String?): Color = AVATAR_COLORS[avColorIndex(seed)]

fun initials(name: String?): String {
    val parts = (name ?: "").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (parts.isEmpty()) return "?"
    val first = parts[0].firstOrNull()?.uppercaseChar() ?: return "?"
    if (parts.size == 1) return first.toString()
    val second = parts[1].firstOrNull()?.uppercaseChar()
    return if (second != null) "$first$second" else first.toString()
}
```

- [ ] **Step 4: `ui/theme/Tokens.kt`** (raw tokens from `theme.jsx`)

```kotlin
package com.bondhu.app.ui.theme

import androidx.compose.ui.graphics.Color

object Tokens {
    val Primary = Color(0xFF00A884)
    val PrimaryDk = Color(0xFF008F72)
    val AppBg = Color(0xFF0B141A)
    val Surface = Color(0xFF111B21)
    val Header = Color(0xFF1F2C34)
    val InBubble = Color(0xFF202C33)
    val OutBubble = Color(0xFF005C4B)
    val TextMain = Color(0xFFE9EDEF)
    val TextMut = Color(0xFF8696A0)
    val TextFaint = Color(0xFF667781)
    val Divider = Color(0x29869AA0)
    val Tick = Color(0xFF53BDEB)
    val Field = Color(0xFF2A3942)
    val Danger = Color(0xFFF15C6D)
    val Online = Color(0xFF00A884)
    val OnPrimary = Color(0xFF04130E)
}
```

- [ ] **Step 5: `ui/theme/Color.kt`**

```kotlin
package com.bondhu.app.ui.theme

import androidx.compose.material3.darkColorScheme

val BondhuColorScheme = darkColorScheme(
    primary = Tokens.Primary,
    onPrimary = Tokens.OnPrimary,
    secondary = Tokens.PrimaryDk,
    background = Tokens.AppBg,
    onBackground = Tokens.TextMain,
    surface = Tokens.Surface,
    onSurface = Tokens.TextMain,
    surfaceVariant = Tokens.Header,
    onSurfaceVariant = Tokens.TextMut,
    error = Tokens.Danger,
    outline = Tokens.TextFaint,
)
```

- [ ] **Step 6: `ui/theme/Type.kt`**

```kotlin
package com.bondhu.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val BondhuTypography = Typography(
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 20.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 15.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 11.sp),
)
```
(System font fallback renders Bengali. A bundled Noto Sans Bengali is a deferred-layer polish.)

- [ ] **Step 7: `ui/theme/Theme.kt`**

```kotlin
package com.bondhu.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable

@Composable
fun BondhuTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = BondhuColorScheme,
        typography = BondhuTypography,
        content = content,
    )
}
```

- [ ] **Step 8: `ui/common/Atoms.kt`**

```kotlin
package com.bondhu.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.ui.theme.Tokens

@Composable
fun BondhuButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick, enabled = enabled, modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(24.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary),
    ) { Text(text, fontWeight = FontWeight.SemiBold) }
}

@Composable
fun BondhuField(
    value: String, onValueChange: (String) -> Unit, label: String,
    modifier: Modifier = Modifier, isPassword: Boolean = false, keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text,
) {
    OutlinedTextField(
        value = value, onValueChange = onValueChange, label = { Text(label) },
        singleLine = true, modifier = modifier.fillMaxWidth(),
        visualTransformation = if (isPassword) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Tokens.Field, unfocusedContainerColor = Tokens.Field,
            focusedBorderColor = Tokens.Primary, unfocusedBorderColor = Color.Transparent,
            focusedLabelColor = Tokens.Primary, unfocusedLabelColor = Tokens.TextMut,
            cursorColor = Tokens.Primary,
        ),
        shape = RoundedCornerShape(14.dp),
    )
}

@Composable
fun Avatar(name: String?, modifier: Modifier = Modifier, size: Int = 46) {
    Box(
        modifier = modifier.size(size.dp).clip(CircleShape).background(avColor(name)),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials(name), color = Tokens.AppBg, fontWeight = FontWeight.SemiBold, fontSize = (size * 0.4).sp)
    }
}

enum class ConnUi { Connected, Connecting, QrPending, Pairing, Disconnected }

@Composable
fun StatusChip(state: ConnUi) {
    val (label, color) = when (state) {
        ConnUi.Connected -> "Connected" to Tokens.Online
        ConnUi.Connecting -> "Authenticating" to Tokens.TextMut
        ConnUi.QrPending -> "Scan QR" to Tokens.TextMut
        ConnUi.Pairing -> "Pairing" to Tokens.TextMut
        ConnUi.Disconnected -> "Disconnected" to Tokens.Danger
    }
    Surface(color = color.copy(alpha = 0.16f), shape = RoundedCornerShape(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) {
            Box(Modifier.size(7.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(6.dp))
            Text(label, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun EmptyState(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, color = Tokens.TextMut, textAlign = TextAlign.Center)
    }
}

@Composable
fun ErrorBanner(message: String, onDismiss: () -> Unit) {
    Surface(color = Tokens.Danger.copy(alpha = 0.15f), shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().padding(12.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(message, color = Tokens.Danger, modifier = Modifier.weight(1f))
            TextButton(onClick = onDismiss) { Text("Dismiss", color = Tokens.Danger) }
        }
    }
}
```

- [ ] **Step 9: Run the test, verify it passes**

Run:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.AvatarUtilTest"
```
Expected: PASS.

- [ ] **Step 10: Build gate + commit**

```powershell
.\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/ui android/app/src/test
git commit -m "feat(android): theme tokens, common atoms, avatar util (tested)`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: DataStore Prefs (@Inject-provided)

**Files:**
- Create: `data/store/Prefs.kt`

> Hilt note: `Prefs` is provided by its own `@Inject` constructor (`@Singleton` + `@ApplicationContext`), so **no Hilt module is needed** for it. Do NOT also add a `@Provides` for `Prefs` — that would double-bind the type and fail the Hilt compile.

- [ ] **Step 1: `data/store/Prefs.kt`**

```kotlin
package com.bondhu.app.data.store

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.bondhu.app.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "bondhu")

@Singleton
class Prefs @Inject constructor(@ApplicationContext private val context: Context) {
    private val ds = context.dataStore

    private object Keys {
        val JWT = stringPreferencesKey("jwt")
        val ACTIVE_ACCOUNT = stringPreferencesKey("active_account")
        val BASE_URL = stringPreferencesKey("base_url")
        val THEME = stringPreferencesKey("theme")
    }

    val jwt: Flow<String?> = ds.data.map { it[Keys.JWT] }
    val activeAccount: Flow<String?> = ds.data.map { it[Keys.ACTIVE_ACCOUNT] }
    val baseUrl: Flow<String> = ds.data.map { it[Keys.BASE_URL] ?: BuildConfig.BASE_URL }

    suspend fun setJwt(v: String?) = ds.edit { p -> if (v == null) p.remove(Keys.JWT) else p[Keys.JWT] = v }
    suspend fun setActiveAccount(v: String?) = ds.edit { p -> if (v == null) p.remove(Keys.ACTIVE_ACCOUNT) else p[Keys.ACTIVE_ACCOUNT] = v }
    suspend fun setBaseUrl(v: String) = ds.edit { it[Keys.BASE_URL] = v }

    // Blocking reads for OkHttp interceptors (called off the main thread).
    fun jwtBlocking(): String? = runBlocking { jwt.first() }
    fun baseUrlBlocking(): String = runBlocking { baseUrl.first() }
    fun activeAccountBlocking(): String? = runBlocking { activeAccount.first() }
}
```

- [ ] **Step 2: Build gate + commit**

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/data/store
git commit -m "feat(android): DataStore Prefs (jwt/account/baseUrl), @Inject-provided`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: DTOs, UI models, mappers (ack→tick TDD)

**Files:**
- Create: `data/model/Dtos.kt`, `data/model/UiModels.kt`, `data/model/Mappers.kt`
- Test: `app/src/test/java/com/bondhu/app/MappersTest.kt`

- [ ] **Step 1: Write the failing test** — `MappersTest.kt`

```kotlin
package com.bondhu.app

import com.bondhu.app.data.model.AckTick
import com.bondhu.app.data.model.ChatDto
import com.bondhu.app.data.model.MessageDto
import com.bondhu.app.data.model.ackTick
import com.bondhu.app.data.model.toUi
import org.junit.Assert.assertEquals
import org.junit.Test

class MappersTest {
    @Test fun ackTick_maps() {
        assertEquals(AckTick.NONE, ackTick(0))
        assertEquals(AckTick.SENT, ackTick(1))
        assertEquals(AckTick.DELIVERED, ackTick(2))
        assertEquals(AckTick.READ, ackTick(3))
        assertEquals(AckTick.READ, ackTick(4))
    }

    @Test fun messageDto_mapsToUi() {
        val dto = MessageDto(
            msgId = "m1", chatJid = "c@lid", fromMe = true, type = "text",
            body = "hi", timestamp = 1000L, ack = 2, translated = "salut", transcript = null, senderName = null,
        )
        val ui = dto.toUi()
        assertEquals("m1", ui.id)
        assertEquals(true, ui.fromMe)
        assertEquals("hi", ui.body)
        assertEquals("salut", ui.translated)
        assertEquals(AckTick.DELIVERED, ui.ack)
    }

    @Test fun chatDto_mapsToUi_unreadAndPreview() {
        val dto = ChatDto(
            jid = "c@lid", name = "Ammu", isGroup = false,
            lastMessageAt = 1234L, lastMessagePreview = "hello", unreadCount = 3,
        )
        val ui = dto.toUi()
        assertEquals("Ammu", ui.title)
        assertEquals(3, ui.unread)
        assertEquals("hello", ui.preview)
    }

    @Test fun chatDto_nullName_fallsBackToJidPrefix() {
        val ui = ChatDto(jid = "8801712345678@s.whatsapp.net").toUi()
        assertEquals("+8801712345678", ui.title)
    }
}
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.MappersTest"
```
Expected: FAIL (unresolved references).

- [ ] **Step 3: `data/model/Dtos.kt`**

> Keys below are **confirmed** against `server/src/db/repositories/messages.repo.ts` (`MessagesRepo.map`) and `chats.repo.ts` (`ChatsRepo.map`) + the route extras in `whatsapp.routes.ts`. Chat rows use `lastMessagePreview`/`unreadCount`/`isGroup` (NOT `lastMessage`/`unread`) and carry no `fromMe`/`ack`. Message `timestamp` is epoch **seconds**. Moshi ignores unknown JSON keys (`senderJid`, `reactions`), so they're omitted here.

```kotlin
package com.bondhu.app.data.model

import com.squareup.moshi.JsonClass

// --- Auth ---
@JsonClass(generateAdapter = true)
data class AuthRequest(val email: String, val password: String, val name: String? = null)

@JsonClass(generateAdapter = true)
data class UserDto(val id: String, val email: String, val name: String?)

@JsonClass(generateAdapter = true)
data class AuthResponse(val token: String, val user: UserDto)

// --- Accounts ---
@JsonClass(generateAdapter = true)
data class AccountDto(
    val id: String,
    val label: String?,
    val phone: String?,
    val status: String,
    val qr: String? = null,
)

@JsonClass(generateAdapter = true)
data class AccountsResponse(val accounts: List<AccountDto>)

@JsonClass(generateAdapter = true)
data class CreateAccountRequest(val label: String? = null)

@JsonClass(generateAdapter = true)
data class CreateAccountResponse(val accountId: String)

@JsonClass(generateAdapter = true)
data class PairRequest(val phone: String)

@JsonClass(generateAdapter = true)
data class StatusResponse(
    val connected: Boolean,
    val state: String,
    val phoneNumber: String? = null,
    val qr: String? = null,
    val pairingCode: String? = null,
)

// --- Chats / messages ---
// Matches ChatsRepo.map(): { jid, name, isGroup, lastMessageAt, lastMessagePreview, unreadCount }
@JsonClass(generateAdapter = true)
data class ChatDto(
    val jid: String,
    val name: String? = null,
    val isGroup: Boolean = false,
    val lastMessageAt: Long? = null,
    val lastMessagePreview: String? = null,
    val unreadCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class ChatsResponse(val chats: List<ChatDto>)

// Matches MessagesRepo.map() + route extras. `timestamp` is epoch SECONDS
// (Baileys). Unknown keys (senderJid, reactions) are ignored by Moshi.
@JsonClass(generateAdapter = true)
data class MessageDto(
    val msgId: String,
    val chatJid: String,
    val fromMe: Boolean,
    val type: String,
    val body: String? = null,
    val timestamp: Long,
    val ack: Int? = null,
    val translated: String? = null,
    val transcript: String? = null,
    val senderName: String? = null,
)

@JsonClass(generateAdapter = true)
data class MessagesResponse(val lang: String?, val messages: List<MessageDto>)

@JsonClass(generateAdapter = true)
data class SendRequest(
    val account: String,
    val chatId: String,
    val message: String,
    val translateTo: String? = null,
)

@JsonClass(generateAdapter = true)
data class SendResponse(
    val success: Boolean,
    val msgId: String? = null,
    val sentText: String? = null,
    val original: String? = null,
)

@JsonClass(generateAdapter = true)
data class OkResponse(val success: Boolean = true)
```

- [ ] **Step 4: `data/model/UiModels.kt`**

```kotlin
package com.bondhu.app.data.model

enum class AckTick { NONE, SENT, DELIVERED, READ }

data class Account(
    val id: String,
    val label: String,
    val phone: String?,
    val status: String,
    val qr: String?,
)

data class ChatRow(
    val jid: String,
    val title: String,
    val preview: String,
    val timestamp: Long, // epoch seconds
    val unread: Int,
)

data class Message(
    val id: String,
    val chatJid: String,
    val fromMe: Boolean,
    val type: String,
    val body: String?,
    val timestamp: Long,
    val ack: AckTick,
    val translated: String?,
    val transcript: String?,
    val senderName: String?,
)
```

- [ ] **Step 5: `data/model/Mappers.kt`**

```kotlin
package com.bondhu.app.data.model

fun ackTick(ack: Int?): AckTick = when (ack ?: 0) {
    0 -> AckTick.NONE
    1 -> AckTick.SENT
    2 -> AckTick.DELIVERED
    else -> AckTick.READ // 3 = read, 4 = played -> show read
}

fun AccountDto.toUi(): Account = Account(
    id = id,
    label = (label?.takeIf { it.isNotBlank() }) ?: (phone ?: "WhatsApp account"),
    phone = phone,
    status = status,
    qr = qr,
)

fun ChatDto.toUi(): ChatRow = ChatRow(
    jid = jid,
    title = (name?.takeIf { it.isNotBlank() }) ?: ("+" + jid.substringBefore("@")),
    preview = lastMessagePreview ?: "",
    timestamp = lastMessageAt ?: 0L,
    unread = unreadCount,
)

fun MessageDto.toUi(): Message = Message(
    id = msgId,
    chatJid = chatJid,
    fromMe = fromMe,
    type = type,
    body = body,
    timestamp = timestamp,
    ack = ackTick(ack),
    translated = translated,
    transcript = transcript,
    senderName = senderName,
)
```

- [ ] **Step 6: Run the test, verify it passes**

Run:
```powershell
.\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.MappersTest"
```
Expected: PASS.

- [ ] **Step 7: Build gate + commit**

```powershell
.\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/data/model android/app/src/test
git commit -m "feat(android): DTOs, UI models, mappers (ack/chat/message tested)`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Network layer — interceptors, BondhuApi, NetworkModule (interceptor TDD)

**Files:**
- Create: `data/api/Interceptors.kt`, `data/api/BondhuApi.kt`, `di/NetworkModule.kt`
- Test: `app/src/test/java/com/bondhu/app/AuthInterceptorTest.kt`

- [ ] **Step 1: Write the failing test** — `AuthInterceptorTest.kt`

```kotlin
package com.bondhu.app

import com.bondhu.app.data.api.AuthInterceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test

class AuthInterceptorTest {
    @Test fun addsBearerHeader_whenTokenPresent() {
        val server = MockWebServer().apply { enqueue(MockResponse().setBody("{}")); start() }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenProvider = { "abc123" }))
            .build()
        client.newCall(Request.Builder().url(server.url("/api/me")).build()).execute().close()
        val recorded = server.takeRequest()
        assertEquals("Bearer abc123", recorded.getHeader("Authorization"))
        server.shutdown()
    }

    @Test fun noHeader_whenTokenNull() {
        val server = MockWebServer().apply { enqueue(MockResponse().setBody("{}")); start() }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenProvider = { null }))
            .build()
        client.newCall(Request.Builder().url(server.url("/api/login")).build()).execute().close()
        val recorded = server.takeRequest()
        assertEquals(null, recorded.getHeader("Authorization"))
        server.shutdown()
    }
}
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.AuthInterceptorTest"
```
Expected: FAIL (unresolved `AuthInterceptor`).

- [ ] **Step 3: `data/api/Interceptors.kt`**

```kotlin
package com.bondhu.app.data.api

import com.bondhu.app.data.store.Prefs
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/** Attaches `Authorization: Bearer <jwt>` when a token exists. */
class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    @Inject constructor(prefs: Prefs) : this({ prefs.jwtBlocking() })
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider()
        val req = chain.request()
        val out = if (token.isNullOrEmpty()) req
        else req.newBuilder().header("Authorization", "Bearer $token").build()
        return chain.proceed(out)
    }
}

/** Rewrites scheme/host/port to the runtime-configured base URL (Prefs override
 *  or BuildConfig default). Retrofit's static baseUrl is only a placeholder. */
class HostSelectionInterceptor @Inject constructor(private val prefs: Prefs) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val base = prefs.baseUrlBlocking().toHttpUrl()
        val req = chain.request()
        val newUrl = req.url.newBuilder()
            .scheme(base.scheme).host(base.host).port(base.port).build()
        return chain.proceed(req.newBuilder().url(newUrl).build())
    }
}
```

- [ ] **Step 4: `data/api/BondhuApi.kt`** (v1 surface only)

```kotlin
package com.bondhu.app.data.api

import com.bondhu.app.data.model.*
import retrofit2.http.*

interface BondhuApi {
    // NOTE: auth routes are mounted at /api/auth in server.ts (app.use('/api/auth', authRoutes)).
    @POST("api/auth/login")
    suspend fun login(@Body body: AuthRequest): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: AuthRequest): AuthResponse

    @GET("api/auth/me")
    suspend fun me(): UserDto

    @GET("api/accounts")
    suspend fun accounts(): AccountsResponse

    @POST("api/accounts")
    suspend fun createAccount(@Body body: CreateAccountRequest): CreateAccountResponse

    @POST("api/accounts/{id}/pair")
    suspend fun pair(@Path("id") id: String, @Body body: PairRequest): OkResponse

    @DELETE("api/accounts/{id}")
    suspend fun removeAccount(@Path("id") id: String): OkResponse

    @GET("api/status")
    suspend fun status(@Query("account") account: String): StatusResponse

    @GET("api/chats")
    suspend fun chats(
        @Query("account") account: String,
        @Query("limit") limit: Int = 30,
        @Query("offset") offset: Int = 0,
    ): ChatsResponse

    @GET("api/messages/{chatId}")
    suspend fun messages(
        @Path("chatId") chatId: String,
        @Query("account") account: String,
        @Query("limit") limit: Int = 50,
        @Query("before") before: Long? = null,
    ): MessagesResponse

    @POST("api/send")
    suspend fun send(@Body body: SendRequest): SendResponse

    @POST("api/chats/{chatId}/mark-read")
    suspend fun markRead(
        @Path("chatId") chatId: String,
        @Query("account") account: String,
    ): OkResponse
}
```
(`markRead` sends an empty POST body; the server resolves `account` from the `?account=` query param.)

- [ ] **Step 5: `di/NetworkModule.kt`**

```kotlin
package com.bondhu.app.di

import com.bondhu.app.data.api.AuthInterceptor
import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.api.HostSelectionInterceptor
import com.bondhu.app.BuildConfig
import com.squareup.moshi.Moshi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides @Singleton
    fun moshi(): Moshi = Moshi.Builder().build()

    @Provides @Singleton
    fun okHttp(auth: AuthInterceptor, host: HostSelectionInterceptor): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(host)
            .addInterceptor(auth)
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
                }
            }
            .build()

    @Provides @Singleton
    fun retrofit(client: OkHttpClient, moshi: Moshi): Retrofit =
        Retrofit.Builder()
            // Placeholder host; HostSelectionInterceptor rewrites it at runtime.
            .baseUrl(BuildConfig.BASE_URL.let { if (it.endsWith("/")) it else "$it/" })
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    @Provides @Singleton
    fun bondhuApi(retrofit: Retrofit): BondhuApi = retrofit.create(BondhuApi::class.java)
}
```

- [ ] **Step 6: Run the interceptor test, verify it passes**

Run:
```powershell
.\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.AuthInterceptorTest"
```
Expected: PASS.

- [ ] **Step 7: Build gate + commit**

```powershell
.\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/data/api android/app/src/main/java/com/bondhu/app/di/NetworkModule.kt android/app/src/test
git commit -m "feat(android): retrofit api, auth + host interceptors, network module (tested)`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: SocketManager (@Inject-provided)

**Files:**
- Create: `data/socket/SocketManager.kt`

> Hilt note: `SocketManager` is `@Singleton` with an `@Inject` constructor, so it needs **no module**. Do NOT add a `@Provides` for it (double-bind → Hilt compile error).

- [ ] **Step 1: `data/socket/SocketManager.kt`**

```kotlin
package com.bondhu.app.data.socket

import com.bondhu.app.data.store.Prefs
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/** A backend Socket.IO event with its JSON payload (always carries accountId). */
data class SocketEvent(val name: String, val payload: JSONObject)

@Singleton
class SocketManager @Inject constructor(private val prefs: Prefs) {

    private var socket: Socket? = null

    private val _events = MutableSharedFlow<SocketEvent>(
        extraBufferCapacity = 64, onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    val events: SharedFlow<SocketEvent> = _events

    // Emitted whenever the socket (re)connects, so screens can re-sync.
    private val _connects = MutableSharedFlow<Unit>(extraBufferCapacity = 4, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val connects: SharedFlow<Unit> = _connects

    private val forwarded = listOf(
        "status", "message", "message_ack", "chat_update",
        "message_reaction", "message_delete", "message_edit", "presence",
    )

    @Synchronized
    fun connect() {
        if (socket?.connected() == true) return
        val token = prefs.jwtBlocking() ?: return
        val base = prefs.baseUrlBlocking()
        val opts = IO.Options().apply {
            auth = mapOf("token" to token)
            reconnection = true
            transports = arrayOf("websocket")
        }
        val s = IO.socket(base, opts)
        s.on(Socket.EVENT_CONNECT) { _connects.tryEmit(Unit) }
        forwarded.forEach { name ->
            s.on(name) { args ->
                val obj = args.firstOrNull() as? JSONObject ?: JSONObject()
                _events.tryEmit(SocketEvent(name, obj))
            }
        }
        socket = s
        s.connect()
    }

    @Synchronized
    fun disconnect() {
        socket?.let { it.off(); it.disconnect(); it.close() }
        socket = null
    }

    /** Reconnect with the latest token/base (call after login or server change). */
    @Synchronized
    fun reset() {
        disconnect()
        connect()
    }
}
```

- [ ] **Step 2: Build gate + commit**

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/data/socket
git commit -m "feat(android): SocketManager (JWT handshake, event SharedFlow), @Inject-provided`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: AuthRepository + AuthViewModel (repository TDD via MockWebServer)

**Files:**
- Create: `data/repository/AuthRepository.kt`, `ui/auth/AuthViewModel.kt`
- Test: `app/src/test/java/com/bondhu/app/AuthRepositoryTest.kt`

- [ ] **Step 1: Write the failing test** — `AuthRepositoryTest.kt`

```kotlin
package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.AuthRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class AuthRepositoryTest {
    private fun apiFor(server: MockWebServer): BondhuApi =
        Retrofit.Builder().baseUrl(server.url("/"))
            .client(OkHttpClient()).addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
            .build().create(BondhuApi::class.java)

    @Test fun login_returnsTokenAndUser() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"token":"tok","user":{"id":"u1","email":"a@b.com","name":"A"}}"""))
            start()
        }
        val tokens = mutableListOf<String?>()
        val repo = AuthRepository(apiFor(server), saveToken = { tokens.add(it) })
        val res = repo.login("a@b.com", "secret")
        assertEquals("tok", res.token)
        assertEquals("u1", res.user.id)
        assertEquals(listOf<String?>("tok"), tokens)
        server.shutdown()
    }
}
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.AuthRepositoryTest"
```
Expected: FAIL.

- [ ] **Step 3: `data/repository/AuthRepository.kt`**

```kotlin
package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.AuthRequest
import com.bondhu.app.data.model.AuthResponse
import com.bondhu.app.data.store.Prefs
import javax.inject.Inject

class AuthRepository(
    private val api: BondhuApi,
    private val saveToken: suspend (String) -> Unit,
) {
    @Inject constructor(api: BondhuApi, prefs: Prefs) : this(api, { prefs.setJwt(it) })

    suspend fun login(email: String, password: String): AuthResponse {
        val res = api.login(AuthRequest(email.trim(), password))
        saveToken(res.token)
        return res
    }

    suspend fun register(email: String, password: String, name: String): AuthResponse {
        val res = api.register(AuthRequest(email.trim(), password, name.trim()))
        saveToken(res.token)
        return res
    }
}
```

- [ ] **Step 4: `ui/auth/AuthViewModel.kt`**

```kotlin
package com.bondhu.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.repository.AuthRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isRegister: Boolean = false,
    val email: String = "",
    val password: String = "",
    val name: String = "",
    val server: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repo: AuthRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state

    init {
        viewModelScope.launch {
            _state.value = _state.value.copy(server = prefs.baseUrlBlocking())
        }
    }

    fun toggleMode() { _state.value = _state.value.copy(isRegister = !_state.value.isRegister, error = null) }
    fun onEmail(v: String) { _state.value = _state.value.copy(email = v) }
    fun onPassword(v: String) { _state.value = _state.value.copy(password = v) }
    fun onName(v: String) { _state.value = _state.value.copy(name = v) }
    fun onServer(v: String) { _state.value = _state.value.copy(server = v) }
    fun clearError() { _state.value = _state.value.copy(error = null) }

    fun submit() {
        val s = _state.value
        if (s.email.isBlank() || s.password.isBlank()) {
            _state.value = s.copy(error = "Email and password required"); return
        }
        _state.value = s.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                if (s.server.isNotBlank()) prefs.setBaseUrl(s.server.trim())
                if (s.isRegister) repo.register(s.email, s.password, s.name)
                else repo.login(s.email, s.password)
                socket.reset()
                _state.value = _state.value.copy(loading = false, success = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message ?: "Login failed")
            }
        }
    }
}
```

- [ ] **Step 5: Run the repository test, verify it passes**

Run:
```powershell
.\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.AuthRepositoryTest"
```
Expected: PASS.

- [ ] **Step 6: Build gate + commit**

```powershell
.\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/data/repository/AuthRepository.kt android/app/src/main/java/com/bondhu/app/ui/auth/AuthViewModel.kt android/app/src/test
git commit -m "feat(android): AuthRepository + AuthViewModel (login/register, tested)`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Routes, NavHost gate, AuthScreen, wire MainActivity

**Files:**
- Create: `ui/nav/Routes.kt`, `ui/nav/BondhuNavHost.kt`, `ui/auth/AuthScreen.kt`
- Modify: `MainActivity.kt`

- [ ] **Step 1: `ui/nav/Routes.kt`**

```kotlin
package com.bondhu.app.ui.nav

object Routes {
    const val SPLASH = "splash"
    const val AUTH = "auth"
    const val ACCOUNTS = "accounts"
    const val PAIR = "pair/{accountId}"
    const val CHAT_LIST = "chatlist"
    const val CHAT = "chat/{chatId}"

    fun pair(accountId: String) = "pair/$accountId"
    fun chat(chatId: String) = "chat/${android.net.Uri.encode(chatId)}"
}
```

- [ ] **Step 2: `ui/auth/AuthScreen.kt`**

```kotlin
package com.bondhu.app.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.ui.common.BondhuButton
import com.bondhu.app.ui.common.BondhuField
import com.bondhu.app.ui.theme.Tokens

@Composable
fun AuthScreen(onAuthed: () -> Unit, vm: AuthViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(s.success) { if (s.success) onAuthed() }
    LaunchedEffect(s.error) { s.error?.let { snackbar.showSnackbar(it); vm.clearError() } }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, containerColor = Tokens.AppBg) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(48.dp))
            Text("Bondhu", color = Tokens.TextMain, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            Text("Chat across languages", color = Tokens.TextMut)
            Spacer(Modifier.height(32.dp))

            TabRow(selectedTabIndex = if (s.isRegister) 1 else 0, containerColor = Tokens.Field, contentColor = Tokens.Primary) {
                Tab(selected = !s.isRegister, onClick = { if (s.isRegister) vm.toggleMode() }, text = { Text("Log in") })
                Tab(selected = s.isRegister, onClick = { if (!s.isRegister) vm.toggleMode() }, text = { Text("Create account") })
            }
            Spacer(Modifier.height(20.dp))

            if (s.isRegister) {
                BondhuField(s.name, vm::onName, "Name")
                Spacer(Modifier.height(12.dp))
            }
            BondhuField(s.email, vm::onEmail, "Email", keyboardType = KeyboardType.Email)
            Spacer(Modifier.height(12.dp))
            BondhuField(s.password, vm::onPassword, "Password", isPassword = true)
            Spacer(Modifier.height(12.dp))
            BondhuField(s.server, vm::onServer, "Server URL")
            Spacer(Modifier.height(20.dp))

            BondhuButton(
                text = if (s.loading) "Please wait…" else if (s.isRegister) "Create account" else "Log in",
                onClick = vm::submit, enabled = !s.loading, modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))
            Text("By continuing you agree to Bondhu's Terms & Privacy.", color = Tokens.TextFaint, fontSize = 12.sp, textAlign = TextAlign.Center)
        }
    }
}
```

- [ ] **Step 3: `ui/nav/BondhuNavHost.kt`** (start-destination gate; account + chat screens are placeholders until their tasks)

```kotlin
package com.bondhu.app.ui.nav

import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.bondhu.app.ui.auth.AuthScreen

@Composable
fun BondhuNavHost(gateVm: GateViewModel = hiltViewModel()) {
    val nav = rememberNavController()
    val start by gateVm.start.collectAsState()

    if (start == null) return // splash: deciding

    NavHost(navController = nav, startDestination = start!!) {
        composable(Routes.AUTH) {
            AuthScreen(onAuthed = {
                nav.navigate(Routes.ACCOUNTS) { popUpTo(Routes.AUTH) { inclusive = true } }
            })
        }
        composable(Routes.ACCOUNTS) {
            // Replaced in Task 11
            com.bondhu.app.ui.common.EmptyState("Accounts — coming in Task 11")
        }
        composable(Routes.CHAT_LIST) {
            // Replaced in Task 12
            com.bondhu.app.ui.common.EmptyState("Chats — coming in Task 12")
        }
    }
}
```

- [ ] **Step 4: `ui/nav/GateViewModel.kt`** (its own file; decides the start destination)

```kotlin
package com.bondhu.app.ui.nav

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GateViewModel @Inject constructor(
    private val prefs: Prefs,
    private val socket: SocketManager,
) : ViewModel() {
    private val _start = MutableStateFlow<String?>(null)
    val start: StateFlow<String?> = _start

    init {
        viewModelScope.launch {
            val jwt = prefs.jwt.first()
            val account = prefs.activeAccount.first()
            _start.value = when {
                jwt.isNullOrEmpty() -> Routes.AUTH
                account.isNullOrEmpty() -> Routes.ACCOUNTS
                else -> { socket.connect(); Routes.CHAT_LIST }
            }
        }
    }
}
```

- [ ] **Step 5: Modify `MainActivity.kt`**

```kotlin
package com.bondhu.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.bondhu.app.ui.nav.BondhuNavHost
import com.bondhu.app.ui.theme.BondhuTheme
import com.bondhu.app.ui.theme.Tokens
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BondhuTheme {
                Surface(Modifier.fillMaxSize(), color = Tokens.AppBg) {
                    BondhuNavHost()
                }
            }
        }
    }
}
```

- [ ] **Step 6: Build gate**

Run:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:assembleDebug
```
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 7: Manual smoke (optional but recommended)** — install on emulator/device with a running dev server and confirm the Auth screen renders and login navigates to the Accounts placeholder.

```powershell
.\gradlew.bat :app:installDebug
```

- [ ] **Step 8: Commit**

```powershell
git add android/app/src/main/java/com/bondhu/app/ui/nav android/app/src/main/java/com/bondhu/app/ui/auth/AuthScreen.kt android/app/src/main/java/com/bondhu/app/MainActivity.kt
git commit -m "feat(android): nav gate, splash, AuthScreen wired to MainActivity`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: AccountRepository + AccountViewModel (TDD)

**Files:**
- Create: `data/repository/AccountRepository.kt`, `ui/account/AccountViewModel.kt`
- Test: `app/src/test/java/com/bondhu/app/AccountRepositoryTest.kt`

- [ ] **Step 1: Write the failing test** — `AccountRepositoryTest.kt`

```kotlin
package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.AccountRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class AccountRepositoryTest {
    private fun apiFor(server: MockWebServer): BondhuApi =
        Retrofit.Builder().baseUrl(server.url("/")).client(OkHttpClient())
            .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
            .build().create(BondhuApi::class.java)

    @Test fun list_mapsAccounts() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"accounts":[{"id":"a1","label":"Personal","phone":"+1","status":"connected","qr":null}]}"""))
            start()
        }
        val repo = AccountRepository(apiFor(server))
        val list = repo.list()
        assertEquals(1, list.size)
        assertEquals("a1", list[0].id)
        assertEquals("Personal", list[0].label)
        server.shutdown()
    }

    @Test fun add_returnsAccountId() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"accountId":"a2"}"""))
            start()
        }
        val repo = AccountRepository(apiFor(server))
        assertEquals("a2", repo.add())
        server.shutdown()
    }
}
```

- [ ] **Step 2: Run test, verify it fails**

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.AccountRepositoryTest"
```
Expected: FAIL.

- [ ] **Step 3: `data/repository/AccountRepository.kt`**

```kotlin
package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.Account
import com.bondhu.app.data.model.CreateAccountRequest
import com.bondhu.app.data.model.PairRequest
import com.bondhu.app.data.model.StatusResponse
import com.bondhu.app.data.model.toUi
import javax.inject.Inject

class AccountRepository @Inject constructor(private val api: BondhuApi) {
    suspend fun list(): List<Account> = api.accounts().accounts.map { it.toUi() }
    suspend fun add(label: String? = null): String = api.createAccount(CreateAccountRequest(label)).accountId
    suspend fun pair(accountId: String, phone: String) { api.pair(accountId, PairRequest(phone)) }
    suspend fun remove(accountId: String) { api.removeAccount(accountId) }
    suspend fun status(accountId: String): StatusResponse = api.status(accountId)
}
```

- [ ] **Step 4: `ui/account/AccountViewModel.kt`**

```kotlin
package com.bondhu.app.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.model.Account
import com.bondhu.app.data.repository.AccountRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AccountListUiState(
    val loading: Boolean = true,
    val accounts: List<Account> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val repo: AccountRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
) : ViewModel() {

    private val _state = MutableStateFlow(AccountListUiState())
    val state: StateFlow<AccountListUiState> = _state

    init {
        refresh()
        viewModelScope.launch {
            socket.events.collect { ev ->
                if (ev.name == "status") refresh()
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            try {
                _state.value = _state.value.copy(loading = true, error = null)
                _state.value = _state.value.copy(loading = false, accounts = repo.list())
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message)
            }
        }
    }

    /** Create (or reuse) a pending account and return its id for the Pair screen. */
    fun addAccount(onCreated: (String) -> Unit) {
        viewModelScope.launch {
            try { onCreated(repo.add()) }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }

    fun selectAccount(id: String, onSelected: () -> Unit) {
        viewModelScope.launch {
            prefs.setActiveAccount(id)
            socket.reset()
            onSelected()
        }
    }

    fun removeAccount(id: String) {
        viewModelScope.launch {
            try { repo.remove(id); refresh() }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }
}
```

- [ ] **Step 5: Run the test, verify it passes**

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.AccountRepositoryTest"
```
Expected: PASS.

- [ ] **Step 6: Build gate + commit**

```powershell
.\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/data/repository/AccountRepository.kt android/app/src/main/java/com/bondhu/app/ui/account/AccountViewModel.kt android/app/src/test
git commit -m "feat(android): AccountRepository + AccountViewModel (list/add/pair/remove, tested)`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: AccountListScreen + PairScreen (QR via ZXing) + nav

**Files:**
- Create: `ui/account/AccountListScreen.kt`, `ui/account/PairScreen.kt`, `ui/account/PairViewModel.kt`, `ui/common/QrCode.kt`
- Modify: `ui/nav/BondhuNavHost.kt` (replace Accounts placeholder, add Pair route)

- [ ] **Step 1: `ui/common/QrCode.kt`** (encode a string to a Compose `ImageBitmap`)

```kotlin
package com.bondhu.app.ui.common

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

fun encodeQr(content: String, size: Int = 512): ImageBitmap {
    val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size)
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
    for (x in 0 until size) for (y in 0 until size) {
        bmp.setPixel(x, y, if (matrix[x, y]) Color.BLACK else Color.WHITE)
    }
    return bmp.asImageBitmap()
}

@Composable
fun QrImage(content: String, modifier: Modifier = Modifier) {
    val img = remember(content) { encodeQr(content) }
    Image(bitmap = img, contentDescription = "QR code", modifier = modifier)
}
```

- [ ] **Step 2: `ui/account/AccountListScreen.kt`**

```kotlin
package com.bondhu.app.ui.account

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.data.model.Account
import com.bondhu.app.ui.common.Avatar
import com.bondhu.app.ui.common.ConnUi
import com.bondhu.app.ui.common.EmptyState
import com.bondhu.app.ui.common.StatusChip
import com.bondhu.app.ui.theme.Tokens

private fun statusToUi(status: String): ConnUi = when (status) {
    "connected" -> ConnUi.Connected
    "qr_pending" -> ConnUi.QrPending
    "pairing" -> ConnUi.Pairing
    "authenticating", "connecting" -> ConnUi.Connecting
    else -> ConnUi.Disconnected
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountListScreen(
    onAddAccount: (String) -> Unit,
    onOpenAccount: () -> Unit,
    vm: AccountViewModel = hiltViewModel(),
) {
    val s by vm.state.collectAsStateWithLifecycle()
    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = { TopAppBar(title = { Text("Your accounts") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = Tokens.Header, titleContentColor = Tokens.TextMain)) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { vm.addAccount(onAddAccount) },
                containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary,
                icon = { Icon(Icons.Default.Add, null) }, text = { Text("Add account") },
            )
        },
    ) { pad ->
        when {
            s.loading -> Box(Modifier.fillMaxSize().padding(pad), Alignment.Center) { CircularProgressIndicator(color = Tokens.Primary) }
            s.accounts.isEmpty() -> EmptyState("No accounts yet. Tap Add account.", Modifier.padding(pad))
            else -> LazyColumn(Modifier.fillMaxSize().padding(pad)) {
                items(s.accounts, key = { it.id }) { acc ->
                    AccountRow(acc, onClick = { vm.selectAccount(acc.id) { onOpenAccount() } })
                    HorizontalDivider(color = Tokens.Divider)
                }
            }
        }
    }
}

@Composable
private fun AccountRow(acc: Account, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(acc.label)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(acc.label, color = Tokens.TextMain, fontWeight = FontWeight.SemiBold)
            Text(acc.phone ?: "—", color = Tokens.TextMut)
        }
        StatusChip(statusToUi(acc.status))
    }
}
```

- [ ] **Step 3: `ui/account/PairViewModel.kt`**

```kotlin
package com.bondhu.app.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.repository.AccountRepository
import com.bondhu.app.data.socket.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PairUiState(
    val qr: String? = null,
    val pairingCode: String? = null,
    val state: String = "connecting",
    val phone: String = "",
    val connected: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class PairViewModel @Inject constructor(
    private val repo: AccountRepository,
    private val socket: SocketManager,
) : ViewModel() {

    private val _state = MutableStateFlow(PairUiState())
    val state: StateFlow<PairUiState> = _state
    private var accountId: String = ""

    fun bind(accountId: String) {
        this.accountId = accountId
        socket.connect()
        poll()
        viewModelScope.launch {
            socket.events.collect { ev ->
                if (ev.name != "status") return@collect
                if (ev.payload.optString("accountId") != accountId) return@collect
                val st = ev.payload.optString("status")
                _state.value = _state.value.copy(
                    state = st,
                    qr = ev.payload.optString("qr").ifEmpty { _state.value.qr },
                    pairingCode = ev.payload.optString("code").ifEmpty { _state.value.pairingCode },
                    connected = st == "connected",
                )
            }
        }
    }

    private fun poll() {
        viewModelScope.launch {
            try {
                val s = repo.status(accountId)
                _state.value = _state.value.copy(
                    state = s.state, qr = s.qr ?: _state.value.qr,
                    pairingCode = s.pairingCode ?: _state.value.pairingCode, connected = s.connected,
                )
            } catch (_: Exception) { /* socket will deliver updates */ }
        }
    }

    fun onPhone(v: String) { _state.value = _state.value.copy(phone = v) }

    fun requestPairingCode() {
        val phone = _state.value.phone.filter { it.isDigit() }
        if (phone.isEmpty()) { _state.value = _state.value.copy(error = "Enter phone number"); return }
        viewModelScope.launch {
            try { repo.pair(accountId, phone); poll() }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }
}
```

- [ ] **Step 4: `ui/account/PairScreen.kt`**

```kotlin
package com.bondhu.app.ui.account

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.ui.common.BondhuButton
import com.bondhu.app.ui.common.BondhuField
import com.bondhu.app.ui.common.QrImage
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PairScreen(accountId: String, onConnected: () -> Unit, vm: PairViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    var tab by remember { mutableStateOf(0) }
    LaunchedEffect(accountId) { vm.bind(accountId) }
    LaunchedEffect(s.connected) { if (s.connected) onConnected() }

    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = { TopAppBar(title = { Text("Link a device") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = Tokens.Header, titleContentColor = Tokens.TextMain)) },
        bottomBar = {
            Surface(color = Tokens.Header) {
                Text(
                    when (s.state) { "connected" -> "Connected"; "qr_pending" -> "Waiting for you to scan…"; "pairing" -> "Enter the code in WhatsApp"; else -> s.state },
                    color = Tokens.TextMut, modifier = Modifier.fillMaxWidth().padding(16.dp), textAlign = TextAlign.Center,
                )
            }
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            TabRow(selectedTabIndex = tab, containerColor = Tokens.Field, contentColor = Tokens.Primary) {
                Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("QR code") })
                Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Pairing code") })
            }
            Spacer(Modifier.height(24.dp))
            if (tab == 0) {
                if (s.qr.isNullOrEmpty()) {
                    CircularProgressIndicator(color = Tokens.Primary)
                    Spacer(Modifier.height(12.dp)); Text("Generating QR…", color = Tokens.TextMut)
                } else {
                    Surface(color = androidx.compose.ui.graphics.Color.White, shape = MaterialTheme.shapes.medium) {
                        QrImage(s.qr!!, Modifier.size(240.dp).padding(12.dp))
                    }
                    Spacer(Modifier.height(12.dp))
                    Text("WhatsApp › Linked Devices › Link a device", color = Tokens.TextMut, textAlign = TextAlign.Center)
                }
            } else {
                Text("Enter the number to link, then type this code in WhatsApp › Linked Devices › Link with phone number.", color = Tokens.TextMut, textAlign = TextAlign.Center)
                Spacer(Modifier.height(16.dp))
                BondhuField(s.phone, vm::onPhone, "Phone number (with country code)")
                Spacer(Modifier.height(12.dp))
                BondhuButton("Get pairing code", vm::requestPairingCode, Modifier.fillMaxWidth())
                Spacer(Modifier.height(24.dp))
                if (!s.pairingCode.isNullOrEmpty()) {
                    Text("YOUR PAIRING CODE", color = Tokens.TextMut, fontSize = 12.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(s.pairingCode!!, color = Tokens.TextMain, fontSize = 32.sp, fontWeight = FontWeight.Bold, letterSpacing = 4.sp)
                }
            }
        }
    }
}
```

- [ ] **Step 5: Modify `ui/nav/BondhuNavHost.kt`** — replace Accounts placeholder + add Pair

```kotlin
package com.bondhu.app.ui.nav

import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.bondhu.app.ui.account.AccountListScreen
import com.bondhu.app.ui.account.PairScreen
import com.bondhu.app.ui.auth.AuthScreen
import com.bondhu.app.ui.common.EmptyState

@Composable
fun BondhuNavHost(gateVm: GateViewModel = hiltViewModel()) {
    val nav = rememberNavController()
    val start by gateVm.start.collectAsState()
    if (start == null) return

    NavHost(navController = nav, startDestination = start!!) {
        composable(Routes.AUTH) {
            AuthScreen(onAuthed = { nav.navigate(Routes.ACCOUNTS) { popUpTo(Routes.AUTH) { inclusive = true } } })
        }
        composable(Routes.ACCOUNTS) {
            AccountListScreen(
                onAddAccount = { accountId -> nav.navigate(Routes.pair(accountId)) },
                onOpenAccount = { nav.navigate(Routes.CHAT_LIST) { popUpTo(Routes.ACCOUNTS) } },
            )
        }
        composable(Routes.PAIR, arguments = listOf(navArgument("accountId") { type = NavType.StringType })) { entry ->
            val accountId = entry.arguments?.getString("accountId") ?: ""
            PairScreen(accountId = accountId, onConnected = {
                nav.navigate(Routes.ACCOUNTS) { popUpTo(Routes.ACCOUNTS) { inclusive = true } }
            })
        }
        composable(Routes.CHAT_LIST) {
            EmptyState("Chats — coming in Task 12")
        }
    }
}
```

- [ ] **Step 6: Build gate**

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:assembleDebug
```
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 7: Commit**

```powershell
git add android/app/src/main/java/com/bondhu/app/ui/account android/app/src/main/java/com/bondhu/app/ui/common/QrCode.kt android/app/src/main/java/com/bondhu/app/ui/nav/BondhuNavHost.kt
git commit -m "feat(android): AccountList + Pair (QR/code) screens + nav`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: ChatRepository (chats) + ChatListViewModel + ChatListScreen

**Files:**
- Create: `data/repository/ChatRepository.kt`, `ui/chatlist/ChatListViewModel.kt`, `ui/chatlist/ChatListScreen.kt`
- Modify: `ui/nav/BondhuNavHost.kt` (replace ChatList placeholder, add Chat route)
- Test: `app/src/test/java/com/bondhu/app/ChatRepositoryTest.kt`

- [ ] **Step 1: Write the failing test** — `ChatRepositoryTest.kt`

```kotlin
package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.ChatRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class ChatRepositoryTest {
    private fun apiFor(server: MockWebServer): BondhuApi =
        Retrofit.Builder().baseUrl(server.url("/")).client(OkHttpClient())
            .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
            .build().create(BondhuApi::class.java)

    @Test fun chats_mapToRows() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"chats":[{"jid":"c@lid","name":"Ammu","isGroup":false,"lastMessageAt":99,"lastMessagePreview":"hi","unreadCount":2}]}"""))
            start()
        }
        val repo = ChatRepository(apiFor(server))
        val rows = repo.chats("acc1")
        assertEquals(1, rows.size)
        assertEquals("Ammu", rows[0].title)
        assertEquals(2, rows[0].unread)
        server.shutdown()
    }
}
```

- [ ] **Step 2: Run test, verify it fails**

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.ChatRepositoryTest"
```
Expected: FAIL.

- [ ] **Step 3: `data/repository/ChatRepository.kt`** (chats now; messages/send added in Task 13)

```kotlin
package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.data.model.toUi
import javax.inject.Inject

class ChatRepository @Inject constructor(private val api: BondhuApi) {
    suspend fun chats(account: String, limit: Int = 30, offset: Int = 0): List<ChatRow> =
        api.chats(account, limit, offset).chats.map { it.toUi() }
}
```

- [ ] **Step 4: `ui/chatlist/ChatListViewModel.kt`**

```kotlin
package com.bondhu.app.ui.chatlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.data.repository.ChatRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatListUiState(
    val loading: Boolean = true,
    val chats: List<ChatRow> = emptyList(),
    val account: String? = null,
    val error: String? = null,
)

@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val repo: ChatRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
) : ViewModel() {

    private val _state = MutableStateFlow(ChatListUiState())
    val state: StateFlow<ChatListUiState> = _state

    init {
        viewModelScope.launch {
            _state.value = _state.value.copy(account = prefs.activeAccount.first())
            refresh()
        }
        // Re-sync on any new message / chat update / socket reconnect.
        viewModelScope.launch { socket.events.collect { if (it.name == "message" || it.name == "chat_update") refresh() } }
        viewModelScope.launch { socket.connects.collect { refresh() } }
    }

    fun refresh() {
        val acc = _state.value.account ?: return
        viewModelScope.launch {
            try { _state.value = _state.value.copy(loading = false, chats = repo.chats(acc), error = null) }
            catch (e: Exception) { _state.value = _state.value.copy(loading = false, error = e.message) }
        }
    }
}
```

- [ ] **Step 5: `ui/chatlist/ChatListScreen.kt`**

```kotlin
package com.bondhu.app.ui.chatlist

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.ui.common.Avatar
import com.bondhu.app.ui.common.EmptyState
import com.bondhu.app.ui.theme.Tokens
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ts is epoch SECONDS (Baileys); Date expects millis.
private fun shortTime(ts: Long): String =
    if (ts <= 0) "" else SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ts * 1000))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(onOpenChat: (String) -> Unit, vm: ChatListViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = { TopAppBar(title = { Text("Bondhu") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = Tokens.Header, titleContentColor = Tokens.TextMain)) },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* new chat – deferred layer */ }, containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary) {
                Icon(Icons.Default.Edit, "New chat")
            }
        },
    ) { pad ->
        when {
            s.loading -> Box(Modifier.fillMaxSize().padding(pad), Alignment.Center) { CircularProgressIndicator(color = Tokens.Primary) }
            s.chats.isEmpty() -> EmptyState("No chats yet.", Modifier.padding(pad))
            else -> LazyColumn(Modifier.fillMaxSize().padding(pad)) {
                items(s.chats, key = { it.jid }) { row ->
                    ChatRowItem(row, s.account, onClick = { onOpenChat(row.jid) })
                    HorizontalDivider(color = Tokens.Divider)
                }
            }
        }
    }
}

@Composable
private fun ChatRowItem(row: ChatRow, account: String?, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(row.title)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(row.title, color = Tokens.TextMain, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(row.preview, color = Tokens.TextMut, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(shortTime(row.timestamp), color = Tokens.TextMut, fontSize = 11.sp)
            if (row.unread > 0) {
                Spacer(Modifier.height(4.dp))
                Badge(containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary) { Text(row.unread.toString()) }
            }
        }
    }
}
```

(Profile-pic loading via Coil — building the `/api/profile-pic?account=&id=&token=` URL and rendering with `AsyncImage` — is a deferred-layer step; v1 shows initials avatars to keep the slice lean.)

- [ ] **Step 6: Modify `ui/nav/BondhuNavHost.kt`** — replace ChatList placeholder + add Chat route

Replace the `composable(Routes.CHAT_LIST) { EmptyState(...) }` block with:
```kotlin
        composable(Routes.CHAT_LIST) {
            com.bondhu.app.ui.chatlist.ChatListScreen(onOpenChat = { jid -> nav.navigate(Routes.chat(jid)) })
        }
        composable(
            Routes.CHAT,
            arguments = listOf(androidx.navigation.navArgument("chatId") { type = androidx.navigation.NavType.StringType }),
        ) { entry ->
            val chatId = android.net.Uri.decode(entry.arguments?.getString("chatId") ?: "")
            // Replaced in Task 13
            com.bondhu.app.ui.common.EmptyState("Chat $chatId — coming in Task 13")
        }
```

- [ ] **Step 7: Run the test, verify it passes**

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.ChatRepositoryTest"
```
Expected: PASS.

- [ ] **Step 8: Build gate + commit**

```powershell
.\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/data/repository/ChatRepository.kt android/app/src/main/java/com/bondhu/app/ui/chatlist android/app/src/main/java/com/bondhu/app/ui/nav/BondhuNavHost.kt android/app/src/test
git commit -m "feat(android): ChatRepository(chats) + ChatList screen + live refresh (tested)`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Chat (text) — messages, send, live append/ack

**Files:**
- Modify: `data/repository/ChatRepository.kt` (add messages/send/markRead)
- Create: `ui/chat/ChatViewModel.kt`, `ui/chat/ChatScreen.kt`, `ui/chat/MessageBubble.kt`, `ui/chat/Composer.kt`
- Modify: `ui/nav/BondhuNavHost.kt` (replace Chat placeholder)
- Test: `app/src/test/java/com/bondhu/app/ChatSendTest.kt`

- [ ] **Step 1: Write the failing test** — `ChatSendTest.kt`

```kotlin
package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.ChatRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class ChatSendTest {
    private fun apiFor(server: MockWebServer): BondhuApi =
        Retrofit.Builder().baseUrl(server.url("/")).client(OkHttpClient())
            .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
            .build().create(BondhuApi::class.java)

    @Test fun send_postsBodyAndReturnsMsgId() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"success":true,"msgId":"m9","sentText":"hi","original":null}"""))
            start()
        }
        val repo = ChatRepository(apiFor(server))
        val res = repo.send("acc1", "c@lid", "hi", null)
        assertEquals("m9", res.msgId)
        val recorded = server.takeRequest()
        assertEquals("/api/send", recorded.path)
        assertTrue(recorded.body.readUtf8().contains("\"chatId\":\"c@lid\""))
        server.shutdown()
    }

    @Test fun messages_returnedOldestFirst() = runTest {
        // Server returns newest-first (DESC); repo must return oldest-first for display.
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"lang":"bn","messages":[{"msgId":"m2","chatJid":"c@lid","fromMe":true,"type":"text","body":"yo","timestamp":2,"ack":2},{"msgId":"m1","chatJid":"c@lid","fromMe":false,"type":"text","body":"hi","timestamp":1,"ack":0}]}"""))
            start()
        }
        val repo = ChatRepository(apiFor(server))
        val msgs = repo.messages("acc1", "c@lid")
        assertEquals(2, msgs.size)
        assertEquals("m1", msgs.first().id)   // oldest first
        assertEquals("m2", msgs.last().id)    // newest last
        server.shutdown()
    }
}
```

- [ ] **Step 2: Run test, verify it fails**

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.ChatSendTest"
```
Expected: FAIL (`send`/`messages` not on ChatRepository).

- [ ] **Step 3: Extend `data/repository/ChatRepository.kt`**

```kotlin
package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.data.model.Message
import com.bondhu.app.data.model.SendRequest
import com.bondhu.app.data.model.SendResponse
import com.bondhu.app.data.model.toUi
import javax.inject.Inject

class ChatRepository @Inject constructor(private val api: BondhuApi) {

    suspend fun chats(account: String, limit: Int = 30, offset: Int = 0): List<ChatRow> =
        api.chats(account, limit, offset).chats.map { it.toUi() }

    suspend fun messages(account: String, chatId: String, before: Long? = null, limit: Int = 50): List<Message> =
        // Backend returns newest-first (ORDER BY timestamp DESC); the chat list paints
        // top-to-bottom, so sort ascending (oldest first, newest last) for display.
        api.messages(chatId, account, limit, before).messages.map { it.toUi() }.sortedBy { it.timestamp }

    suspend fun send(account: String, chatId: String, message: String, translateTo: String?): SendResponse =
        api.send(SendRequest(account = account, chatId = chatId, message = message, translateTo = translateTo))

    suspend fun markRead(account: String, chatId: String) {
        api.markRead(chatId, account)
    }
}
```

- [ ] **Step 4: `ui/chat/ChatViewModel.kt`**

```kotlin
package com.bondhu.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.model.AckTick
import com.bondhu.app.data.model.Message
import com.bondhu.app.data.model.ackTick
import com.bondhu.app.data.repository.ChatRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatUiState(
    val loading: Boolean = true,
    val messages: List<Message> = emptyList(),
    val draft: String = "",
    val sending: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val repo: ChatRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = _state
    private var account: String = ""
    private var chatId: String = ""

    fun bind(chatId: String) {
        this.chatId = chatId
        viewModelScope.launch {
            account = prefs.activeAccount.first() ?: return@launch
            load()
            runCatching { repo.markRead(account, chatId) }
        }
        viewModelScope.launch { socket.events.collect { onEvent(it.name, it.payload) } }
        viewModelScope.launch { socket.connects.collect { load() } }
    }

    private fun onEvent(name: String, payload: org.json.JSONObject) {
        when (name) {
            "message" -> {
                if (payload.optString("chatJid") != chatId) return
                val m = Message(
                    id = payload.optString("msgId"),
                    chatJid = chatId,
                    fromMe = payload.optBoolean("fromMe"),
                    type = payload.optString("type", "text"),
                    body = payload.optString("body").ifEmpty { null },
                    timestamp = payload.optLong("timestamp"),
                    ack = ackTick(if (payload.has("ack")) payload.optInt("ack") else 0),
                    translated = payload.optString("translated").ifEmpty { null },
                    transcript = payload.optString("transcript").ifEmpty { null },
                    senderName = payload.optString("senderName").ifEmpty { null },
                )
                upsert(m)
                viewModelScope.launch { runCatching { repo.markRead(account, chatId) } }
            }
            "message_ack" -> {
                val id = payload.optString("msgId"); val ack = ackTick(payload.optInt("ack"))
                _state.value = _state.value.copy(messages = _state.value.messages.map { if (it.id == id) it.copy(ack = ack) else it })
            }
        }
    }

    private fun upsert(m: Message) {
        val cur = _state.value.messages
        val idx = cur.indexOfFirst { it.id == m.id }
        val next = if (idx >= 0) cur.toMutableList().also { it[idx] = m } else (cur + m)
        _state.value = _state.value.copy(messages = next.sortedBy { it.timestamp })
    }

    private fun load() {
        viewModelScope.launch {
            try { _state.value = _state.value.copy(loading = false, messages = repo.messages(account, chatId), error = null) }
            catch (e: Exception) { _state.value = _state.value.copy(loading = false, error = e.message) }
        }
    }

    fun onDraft(v: String) { _state.value = _state.value.copy(draft = v) }

    fun send() {
        val text = _state.value.draft.trim()
        if (text.isEmpty() || account.isEmpty()) return
        _state.value = _state.value.copy(draft = "", sending = true)
        viewModelScope.launch {
            try {
                val res = repo.send(account, chatId, text, translateTo = null)
                if (res.msgId != null) upsert(
                    // timestamp in epoch SECONDS to match server-delivered messages
                    Message(res.msgId, chatId, true, "text", res.sentText ?: text, System.currentTimeMillis() / 1000, AckTick.SENT, null, null, null)
                )
                _state.value = _state.value.copy(sending = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(sending = false, error = e.message, draft = text)
            }
        }
    }
}
```

- [ ] **Step 5: `ui/chat/MessageBubble.kt`**

```kotlin
package com.bondhu.app.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.data.model.AckTick
import com.bondhu.app.data.model.Message
import com.bondhu.app.ui.theme.Tokens
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ts is epoch SECONDS (Baileys); Date expects millis.
private fun hhmm(ts: Long) = if (ts <= 0) "" else SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ts * 1000))

@Composable
fun MessageBubble(m: Message) {
    val align = if (m.fromMe) Alignment.End else Alignment.Start
    val bg = if (m.fromMe) Tokens.OutBubble else Tokens.InBubble
    Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 3.dp), horizontalAlignment = align) {
        Column(
            Modifier.widthIn(max = 300.dp).clip(RoundedCornerShape(12.dp)).background(bg).padding(horizontal = 10.dp, vertical = 6.dp),
        ) {
            if (!m.fromMe && m.senderName != null) {
                Text(m.senderName, color = Tokens.Primary, fontSize = 12.sp)
            }
            Text(m.body ?: (if (m.type != "text") "[${m.type}]" else ""), color = Tokens.TextMain)
            if (m.translated != null) {
                Text(m.translated, color = Tokens.TextMut, fontSize = 13.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.align(Alignment.End)) {
                Text(hhmm(m.timestamp), color = Tokens.TextFaint, fontSize = 10.sp)
                if (m.fromMe) {
                    Spacer(Modifier.width(4.dp))
                    when (m.ack) {
                        AckTick.NONE, AckTick.SENT -> Icon(Icons.Default.Done, null, tint = Tokens.TextFaint, modifier = Modifier.size(14.dp))
                        AckTick.DELIVERED -> Icon(Icons.Default.DoneAll, null, tint = Tokens.TextFaint, modifier = Modifier.size(14.dp))
                        AckTick.READ -> Icon(Icons.Default.DoneAll, null, tint = Tokens.Tick, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 6: `ui/chat/Composer.kt`**

```kotlin
package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.bondhu.app.ui.theme.Tokens

@Composable
fun Composer(draft: String, sending: Boolean, onDraft: (String) -> Unit, onSend: () -> Unit) {
    Surface(color = Tokens.Header) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = draft, onValueChange = onDraft, modifier = Modifier.weight(1f),
                placeholder = { Text("Message", color = Tokens.TextMut) }, maxLines = 5,
                shape = RoundedCornerShape(22.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Tokens.Field, unfocusedContainerColor = Tokens.Field,
                    focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent,
                    cursorColor = Tokens.Primary, focusedTextColor = Tokens.TextMain, unfocusedTextColor = Tokens.TextMain,
                ),
            )
            Spacer(Modifier.width(8.dp))
            FloatingActionButton(
                onClick = onSend, containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary,
                modifier = Modifier.size(48.dp),
            ) { Icon(Icons.Default.Send, "Send") }
        }
    }
}
```

- [ ] **Step 7: `ui/chat/ChatScreen.kt`**

```kotlin
package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(chatId: String, title: String, onBack: () -> Unit, vm: ChatViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    LaunchedEffect(chatId) { vm.bind(chatId) }
    LaunchedEffect(s.messages.size) { if (s.messages.isNotEmpty()) listState.animateScrollToItem(s.messages.lastIndex) }

    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Tokens.Header, titleContentColor = Tokens.TextMain, navigationIconContentColor = Tokens.TextMain),
            )
        },
        bottomBar = { Composer(s.draft, s.sending, vm::onDraft, vm::send) },
    ) { pad ->
        if (s.loading) {
            Box(Modifier.fillMaxSize().padding(pad), androidx.compose.ui.Alignment.Center) { CircularProgressIndicator(color = Tokens.Primary) }
        } else {
            LazyColumn(state = listState, modifier = Modifier.fillMaxSize().padding(pad), contentPadding = PaddingValues(vertical = 8.dp)) {
                items(s.messages, key = { it.id }) { MessageBubble(it) }
            }
        }
    }
}
```

- [ ] **Step 8: Modify `ui/nav/BondhuNavHost.kt`** — replace the Chat placeholder

Replace the `composable(Routes.CHAT, ...)` body with:
```kotlin
        composable(
            Routes.CHAT,
            arguments = listOf(androidx.navigation.navArgument("chatId") { type = androidx.navigation.NavType.StringType }),
        ) { entry ->
            val chatId = android.net.Uri.decode(entry.arguments?.getString("chatId") ?: "")
            com.bondhu.app.ui.chat.ChatScreen(
                chatId = chatId,
                title = "+" + chatId.substringBefore("@"),
                onBack = { nav.popBackStack() },
            )
        }
```

- [ ] **Step 9: Run the tests, verify they pass**

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.ChatSendTest"
```
Expected: PASS (both cases).

- [ ] **Step 10: Build gate + commit**

```powershell
.\gradlew.bat :app:assembleDebug
git add android/app/src/main/java/com/bondhu/app/data/repository/ChatRepository.kt android/app/src/main/java/com/bondhu/app/ui/chat android/app/src/main/java/com/bondhu/app/ui/nav/BondhuNavHost.kt android/app/src/test
git commit -m "feat(android): Chat text — messages, send, live append/ack (tested)`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Final integration — socket lifecycle, README, device acceptance

**Files:**
- Create: `android/README.md`
- Verify: full slice on a real device against the live server.

- [ ] **Step 1: Confirm socket lifecycle is correct**

Review that the socket connects after login (`AuthViewModel.submit` → `socket.reset()`), after account select (`AccountViewModel.selectAccount` → `socket.reset()`), and on app start when already authed (`GateViewModel` → `socket.connect()`). No code change expected; if a path is missing a `connect()`, add it. Build gate:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat :app:assembleDebug
```

- [ ] **Step 2: Run the full unit suite**

```powershell
.\gradlew.bat :app:testDebugUnitTest
```
Expected: all tests PASS (AvatarUtil, Mappers, AuthInterceptor, AuthRepository, AccountRepository, ChatRepository, ChatSend).

- [ ] **Step 3: `android/README.md`**

````markdown
# Bondhu Android

Native Kotlin/Compose client for the Bondhu backend (REST + Socket.IO).

## Build
Gradle/Java are not required on PATH — use Android Studio's bundled JBR:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat :app:assembleDebug      # build
.\gradlew.bat :app:installDebug       # install on a connected device/emulator
.\gradlew.bat :app:testDebugUnitTest  # unit tests
```
Or open `E:\New Whatsapp\android` in Android Studio and Run.

## Server
- Debug build defaults to `http://10.0.2.2:3050` (emulator → host dev server).
- Release build defaults to `https://wa.client-flow.xyz`.
- The login screen has a **Server URL** field that overrides the default
  (persisted) — set it to `https://wa.client-flow.xyz` to test on a real phone.

## v1 scope
Auth (email/password) → accounts → pair (QR / code) → chat list → text chat,
real-time over Socket.IO while the app is foregrounded. Voice, image, reactions,
reply/forward/edit/delete, translation UI, TTS, settings, and background push
are deferred layers.
````

- [ ] **Step 4: Device acceptance (manual, live server)**

Install on a real phone (set Server URL to `https://wa.client-flow.xyz`):
```powershell
.\gradlew.bat :app:installDebug
```
Walk the checklist (spec §9):
1. Register or log in → lands on Accounts.
2. Add account → Pair screen shows a QR (and a pairing code after entering a phone).
3. Scan with WhatsApp (Linked devices) → status flips to **Connected** → auto-returns to Accounts.
4. Tap the account → Chat list populates.
5. Open a chat → history loads; send a text → it appears and arrives on the other phone.
6. Have the other phone reply → it appears live; ack ticks update (✓ → ✓✓ → blue).
7. Kill & reopen the app → still logged in, lands on the chat list.

Record any failures and fix before merging (use systematic-debugging for any bug).

- [ ] **Step 5: Commit README + finish the branch**

```powershell
git add android/README.md
git commit -m "docs(android): build/run README + v1 acceptance notes`n`nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Then follow superpowers:finishing-a-development-branch to merge `feat/android-v1-slice` → `master` and `git push origin master`.

---

## Self-review notes (coverage)

- **Spec §1 decisions:** email/password auth (T8/T9), foreground-only socket (T7/T14), real event names (T7 forwarded list), generic API keys (deferred), new-chat compose (deferred). ✅
- **Spec §2 stack:** all pinned in T1 catalog + T2 module. ✅
- **Spec §3 theme:** Tokens/Color/Type/Theme + atoms (T3). ✅
- **Spec §4 API/socket contract:** BondhuApi (T6), SocketManager events (T7). ✅
- **Spec §5 architecture:** repositories + viewmodels + interceptors + Prefs (T4–T13). ✅
- **Spec §6 package structure:** matches created paths. ✅
- **Spec §7 navigation:** Routes + gate (T9), Pair/Accounts/ChatList/Chat (T11–T13). ✅
- **Spec §8 phasing:** T1–T7 plumbing, T8–T13 features, T14 integration. ✅
- **Spec §9 testing:** JUnit on pure logic (T3,5,6,8,10,12,13) + manual device acceptance (T14). ✅

**Known follow-ups (deferred layer, not this plan):** Coil profile-pic loading with `?token=`, pull-to-refresh, infinite older-message scroll (`before=` cursor wired in repo, UI trigger pending), new-chat compose screen, all rich-messaging + translation/voice/TTS + Settings.
