package com.aicastle.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExecutionChain;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Security보다 먼저 실행되어, /api/** 중 매핑 없는 경로는 404(ResultResponse)로 응답. Security가 401을 먼저 보내는 것을 막기 위함.
 */
public class ApiNotFoundFilter extends OncePerRequestFilter {

  private static final String API_PREFIX = "/api/";
  private static final String NOT_FOUND_JSON =
      "{\"status\":404,\"message\":\"요청한 경로를 찾을 수 없습니다.\",\"data\":null}";

  private final RequestMappingHandlerMapping requestMappingHandlerMapping;

  public ApiNotFoundFilter(RequestMappingHandlerMapping requestMappingHandlerMapping) {
    this.requestMappingHandlerMapping = requestMappingHandlerMapping;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    if (!request.getRequestURI().startsWith(API_PREFIX)) {
      filterChain.doFilter(request, response);
      return;
    }

    try {
      HandlerExecutionChain chain = requestMappingHandlerMapping.getHandler(request);
      if (chain == null || chain.getHandler() == null) {
        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        response.setContentType("application/json;charset=UTF-8");
        response.getOutputStream().write(NOT_FOUND_JSON.getBytes(StandardCharsets.UTF_8));
        return;
      }
    } catch (Exception ignored) {
      // 예외 시 그대로 통과시키고 이후 필터/Dispatcher에서 처리
    }
    filterChain.doFilter(request, response);
  }
}
