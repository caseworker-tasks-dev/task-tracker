FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./gradlew --no-daemon bootJar

FROM eclipse-temurin:21-jre
RUN useradd --system --no-create-home app
COPY --from=build /app/build/libs/test-backend.jar /app/app.jar
USER app
EXPOSE 4000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
