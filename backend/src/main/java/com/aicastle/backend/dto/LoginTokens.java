package com.aicastle.backend.dto;

/** 로그인 시 발급된 access/refresh 토큰 쌍. (컨트롤러에서 body/cookie 분리용) */
public record LoginTokens(String accessToken, String refreshToken) {}
