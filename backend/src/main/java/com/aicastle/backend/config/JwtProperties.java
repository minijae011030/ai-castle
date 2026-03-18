package com.aicastle.backend.config;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

/** JWT 설정 (application.properties의 jwt.*). */
@Validated
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties {

  @NotBlank(message = "JWT_SECRET 환경 변수가 설정되어야 합니다.")
  private String secret;

  private long accessExpirationMs = 900_000L; // 15 min
  private long refreshExpirationMs = 604_800_000L; // 7 days
}
