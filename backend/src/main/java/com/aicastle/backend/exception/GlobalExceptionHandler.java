package com.aicastle.backend.exception;

import com.aicastle.backend.dto.ResultResponse;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

/** 전역 예외 핸들러. 항상 ResultResponse 포맷으로 반환한다. */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ResultResponse<Map<String, String>>> handleValidationException(
      MethodArgumentNotValidException ex) {
    Map<String, String> validationErrors = new HashMap<>();
    ex.getBindingResult()
        .getFieldErrors()
        .forEach(error -> validationErrors.put(error.getField(), error.getDefaultMessage()));

    ResultResponse<Map<String, String>> body =
        ResultResponse.error(HttpStatus.BAD_REQUEST.value(), "요청 값이 올바르지 않습니다.");

    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  @ExceptionHandler(NoHandlerFoundException.class)
  public ResponseEntity<ResultResponse<Void>> handleNoHandlerFound(NoHandlerFoundException ex) {
    ResultResponse<Void> body =
        ResultResponse.error(HttpStatus.NOT_FOUND.value(), "요청한 경로를 찾을 수 없습니다.");
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ResultResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
    HttpStatus status = HttpStatus.BAD_REQUEST;
    ResultResponse<Void> body = ResultResponse.error(status.value(), ex.getMessage());
    return ResponseEntity.status(status).body(body);
  }

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<ResultResponse<Void>> handleIllegalState(IllegalStateException ex) {
    HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
    ResultResponse<Void> body = ResultResponse.error(status.value(), ex.getMessage());
    return ResponseEntity.status(status).body(body);
  }

  @ExceptionHandler(DataAccessException.class)
  public ResponseEntity<ResultResponse<Void>> handleDataAccess(DataAccessException ex) {
    HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
    ResultResponse<Void> body = ResultResponse.error(status.value(), "데이터베이스 처리 중 오류가 발생했습니다.");
    return ResponseEntity.status(status).body(body);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ResultResponse<Void>> handleUnknown(Exception ex) {
    HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
    // 디버깅을 위해 서버 로그에 스택트레이스를 남긴다.
    log.error("Unhandled exception", ex);
    String message =
        ex.getMessage() == null || ex.getMessage().isBlank()
            ? "알 수 없는 오류가 발생했습니다."
            : ex.getMessage();
    ResultResponse<Void> body = ResultResponse.error(status.value(), message);
    return ResponseEntity.status(status).body(body);
  }
}
