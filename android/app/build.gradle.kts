plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
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

    val ks = System.getenv("ANDROID_KEYSTORE_FILE")
    if (ks != null && file(ks).exists()) {
        signingConfigs {
            create("release") {
                storeFile = file(ks)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
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
