package com.aicastle.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:aicastle_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "openai.api-key=dummy",
      "openai.model=gpt-4.1-mini",
      "jwt.secret=test-jwt-secret-for-context-load"
    })
class BackendApplicationTests {

  @Test
  void contextLoads() {}
}
