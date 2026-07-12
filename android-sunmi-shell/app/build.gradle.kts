plugins {
    id("com.android.application")
}

android {
    namespace = "au.com.chapter99.sunmishell"
    compileSdk = 34

    defaultConfig {
        applicationId = "au.com.chapter99.sunmishell"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        aidl = true
    }
}

dependencies {
    // Align Kotlin so appcompat's old jdk7/jdk8 artifacts don't clash with stdlib 1.8+
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.9.24"))
    implementation("androidx.appcompat:appcompat:1.7.0")
}

configurations.configureEach {
    resolutionStrategy {
        force(
            "org.jetbrains.kotlin:kotlin-stdlib:1.9.24",
            "org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.9.24",
            "org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.24",
        )
    }
}
