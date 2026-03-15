package com.aicastle.backend.config;

import com.aicastle.backend.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JWT Bearer 토큰 검증 후 SecurityContext에 인증 정보 설정. 실패 시 인증 없이 통과시켜
 * Security가 AuthenticationEntryPoint로 401 처리.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

  private static final String AUTHORIZATION_HEADER = "Authorization";
  private static final String BEARER_PREFIX = "Bearer ";

  private final JwtService jwtService;

  public JwtAuthenticationFilter(JwtService jwtService) {
    this.jwtService = jwtService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain)
      throws ServletException, IOException {
    String authHeader = request.getHeader(AUTHORIZATION_HEADER);
    if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
      filterChain.doFilter(request, response);
      return;
    }

    String token = authHeader.substring(BEARER_PREFIX.length()).trim();
    if (token.isEmpty()) {
      filterChain.doFilter(request, response);
      return;
    }

    try {
      if (jwtService.isRefreshToken(token)) {
        filterChain.doFilter(request, response);
        return;
      }
      Long userId = jwtService.getUserIdFromToken(token);
      UsernamePasswordAuthenticationToken authentication =
          new UsernamePasswordAuthenticationToken(
              userId, null, Collections.emptyList());
      SecurityContextHolder.getContext().setAuthentication(authentication);
    } catch (Exception ignored) {
      // 인증 실패 시 SecurityContext 비움, 이후 Security가 401 처리
    }
    filterChain.doFilter(request, response);
  }
}
