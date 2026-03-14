package com.aicastle.backend.controller;

import com.aicastle.backend.dto.LoginRequest;
import com.aicastle.backend.dto.LoginResponse;
import com.aicastle.backend.dto.LoginTokens;
import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.dto.SignUpRequest;
import com.aicastle.backend.dto.SignUpResponse;
import com.aicastle.backend.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 회원가입·로그인 API. 로그인 시 body=accessToken, cookie=refreshToken. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private static final String REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
  private static final int REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

  private final AuthService authService;

  @Value("${app.refresh-cookie-secure:false}")
  private boolean refreshCookieSecure;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/signup")
  public ResponseEntity<ResultResponse<SignUpResponse>> signUp(
      @Valid @RequestBody SignUpRequest request) {
    SignUpResponse data = authService.signUp(request);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ResultResponse.success("회원가입이 완료되었습니다.", data));
  }

  @PostMapping("/login")
  public ResponseEntity<ResultResponse<LoginResponse>> login(
      @Valid @RequestBody LoginRequest request, HttpServletResponse response) {
    LoginTokens tokens = authService.login(request.email(), request.password());

    Cookie refreshCookie = new Cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken());
    refreshCookie.setHttpOnly(true);
    refreshCookie.setPath("/");
    refreshCookie.setMaxAge(REFRESH_COOKIE_MAX_AGE_SECONDS);
    refreshCookie.setSecure(refreshCookieSecure);
    refreshCookie.setAttribute("SameSite", "Lax");
    response.addCookie(refreshCookie);

    LoginResponse body = new LoginResponse(tokens.accessToken());
    return ResponseEntity.ok(ResultResponse.success("로그인되었습니다.", body));
  }
}
