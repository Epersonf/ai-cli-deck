import java.security.KeyStore
import java.security.MessageDigest

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// This repository owns one update identity; never fall back to a machine's debug key.
val deckSigningKey = rootProject.file("signing/deck.keystore")
check(deckSigningKey.isFile) { "Missing versioned signing/deck.keystore; refusing to change signing identity" }
val deckKeyStore = KeyStore.getInstance(deckSigningKey, "android".toCharArray())
val deckCertificate = deckKeyStore.getCertificate("androiddebugkey")
val deckFingerprint = MessageDigest.getInstance("SHA-256")
    .digest(deckCertificate.encoded).joinToString("") { "%02x".format(it) }
check(deckFingerprint == "aaf81956135b6b459e13370732a0769a27af4c40315497d77d66afb26988b3ec") {
    "Unexpected signing certificate: $deckFingerprint"
}

android {
    namespace = "dev.epersonf.deck"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.epersonf.deck"
        minSdk = 26
        // targetSdk 28 keeps exec() of files in app storage allowed (same choice as Termux).
        // The APK is sideloaded, not published on Google Play.
        targetSdk = 28
        versionCode = (System.getenv("DECK_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("DECK_VERSION_NAME") ?: "0.1.0"
        ndk { abiFilters += "arm64-v8a" }
    }

    signingConfigs {
        create("release") {
            storeFile = deckSigningKey
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    packaging {
        // proot & co. ship as lib*.so so they land in nativeLibraryDir, the only place an app may exec from.
        jniLibs.useLegacyPackaging = true
    }

    lint { abortOnError = false; checkReleaseBuilds = false }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("org.apache.commons:commons-compress:1.27.1")
}
