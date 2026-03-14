package com.aicastle.backend.service;

import com.aicastle.backend.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/** JWT access/refresh 토큰 발급 및 파싱. */
@Service
public class JwtService {

  private static final String CLAIM_TYPE = "type";
  private static final String TYPE_ACCESS = "access";
  private static final String TYPE_REFRESH = "refresh";

  private final JwtProperties jwtProperties;
  private final SecretKey key;

  public JwtService(JwtProperties jwtProperties) {
    this.jwtProperties = jwtProperties;
    this.key = Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
  }

  public String createAccessToken(Long userId, String email) {
    return createToken(userId, email, TYPE_ACCESS, jwtProperties.getAccessExpirationMs());
  }

  public String createRefreshToken(Long userId, String email) {
    return createToken(userId, email, TYPE_REFRESH, jwtProperties.getRefreshExpirationMs());
  }

  private String createToken(Long userId, String email, String type, long expirationMs) {
    long now = System.currentTimeMillis();
    return Jwts.builder()
        .subject(String.valueOf(userId))
        .claim("email", email)
        .claim(CLAIM_TYPE, type)
        .issuedAt(new Date(now))
        .expiration(new Date(now + expirationMs))
        .signWith(key)
        .compact();
  }

  public Claims parseToken(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
  }

  public Long getUserIdFromToken(String token) {
    return Long.parseLong(parseToken(token).getSubject());
  }

  public boolean isRefreshToken(String token) {
    return TYPE_REFRESH.equals(parseToken(token).get(CLAIM_TYPE, String.class));
  }
}
