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
    implementation("androidx.appcompat:appcompat:1.7.0")
}
