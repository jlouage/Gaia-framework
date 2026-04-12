plugins {
    kotlin("jvm") version "1.9.0"
}

val integrationTest by tasks.registering(Test::class) {
    description = "Runs integration tests."
    group = "verification"
}
