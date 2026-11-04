plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.samuelreisen.siddur"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.samuelreisen.siddur"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        // The "shell" version that update files check against (minShell in scripts/mark.config.json).
        versionName = "1.1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")

    testImplementation("junit:junit:4.13.2")
    // Android's org.json is a stub in local unit tests; use the real library there.
    testImplementation("org.json:json:20240303")
}
