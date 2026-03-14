package com.aicastle.backend.dto;

/**
 * 백엔드 전 구간에서 사용하는 통합 응답 래퍼.
 *
 * @param status HTTP status code 와 동일하게 유지
 * @param message 사용자/프론트가 읽을 수 있는 메시지
 * @param data 실제 비즈니스 데이터
 */
public record ResultResponse<T>(int status, String message, T data) {

  public static <T> ResultResponse<T> success(T data) {
    return new ResultResponse<>(200, "OK", data);
  }

  public static <T> ResultResponse<T> success(String message, T data) {
    return new ResultResponse<>(200, message, data);
  }

  public static <T> ResultResponse<T> error(int status, String message) {
    return new ResultResponse<>(status, message, null);
  }
}
