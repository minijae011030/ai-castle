package com.aicastle.backend.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/** ApiNotFoundFilter를 Security보다 먼저 실행되도록 등록. */
@Configuration
public class FilterOrderConfig {

  @Bean
  public ApiNotFoundFilter apiNotFoundFilter(
      RequestMappingHandlerMapping requestMappingHandlerMapping) {
    return new ApiNotFoundFilter(requestMappingHandlerMapping);
  }

  @Bean
  public FilterRegistrationBean<ApiNotFoundFilter> apiNotFoundFilterRegistration(
      ApiNotFoundFilter filter) {
    FilterRegistrationBean<ApiNotFoundFilter> registration =
        new FilterRegistrationBean<>(filter);
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
    return registration;
  }
}
