package com.aicastle.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

/** 인증 실패 시 401 + ResultResponse JSON 응답. */
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

  private final String message;

  public JsonAuthenticationEntryPoint(String message) {
    this.message = message;
  }

  @Override
  public void commence(
      HttpServletRequest request,
      HttpServletResponse response,
      AuthenticationException authException)
      throws IOException {
    if (response.isCommitted()) {
      return;
    }
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType("application/json;charset=UTF-8");
    String escaped =
        message
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");
    String json = "{\"status\":401,\"message\":\"" + escaped + "\",\"data\":null}";
    response.getOutputStream().write(json.getBytes(StandardCharsets.UTF_8));
  }
}
