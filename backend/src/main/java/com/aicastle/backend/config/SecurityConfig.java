package com.aicastle.backend.config;

import com.aicastle.backend.service.JwtService;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

/** Spring Security 설정. JWT 기반 인증, permitAll 경로 외 401. */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

  private static final String[] PERMIT_ALL_PATHS = {
    "/api/auth/signup",
    "/api/auth/login",
    "/api/health",
    "/error",
    "/api/auth/refresh",
    "/api/debug/**",
  };

  @Bean
  public SecurityFilterChain securityFilterChain(
      HttpSecurity http, JwtService jwtService, CorsConfigurationSource corsConfigurationSource)
      throws Exception {
    return http.cors(cors -> cors.configurationSource(corsConfigurationSource))
        .csrf(csrf -> csrf.disable())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR)
                    .permitAll()
                    .requestMatchers(PERMIT_ALL_PATHS)
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            ex ->
                ex.authenticationEntryPoint(new JsonAuthenticationEntryPoint("인증이 필요합니다."))
                    .accessDeniedHandler(
                        (request, response, accessDeniedException) -> {
                          if (response.isCommitted()) {
                            return;
                          }
                          response.setStatus(403);
                          response.setContentType("application/json;charset=UTF-8");
                          response
                              .getOutputStream()
                              .write(
                                  "{\"status\":403,\"message\":\"접근 권한이 없습니다.\",\"data\":null}"
                                      .getBytes(java.nio.charset.StandardCharsets.UTF_8));
                        }))
        .addFilterBefore(
            new JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter.class)
        .build();
  }
}
