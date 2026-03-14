package com.aicastle.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** JWT 설정 (application.properties의 jwt.*). */
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties {

  private String secret = "aicastle-jwt-secret-key-min-32-chars-long";
  private long accessExpirationMs = 900_000L; // 15 min
  private long refreshExpirationMs = 604_800_000L; // 7 days

  public String getSecret() {
    return secret;
  }

  public void setSecret(String secret) {
    this.secret = secret;
  }

  public long getAccessExpirationMs() {
    return accessExpirationMs;
  }

  public void setAccessExpirationMs(long accessExpirationMs) {
    this.accessExpirationMs = accessExpirationMs;
  }

  public long getRefreshExpirationMs() {
    return refreshExpirationMs;
  }

  public void setRefreshExpirationMs(long refreshExpirationMs) {
    this.refreshExpirationMs = refreshExpirationMs;
  }
}
