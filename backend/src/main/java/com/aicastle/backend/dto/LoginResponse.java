package com.aicastle.backend.dto;

/** 로그인 성공 시 body (accessToken). refreshToken은 쿠키로 전달. */
public record LoginResponse(String accessToken) {}
