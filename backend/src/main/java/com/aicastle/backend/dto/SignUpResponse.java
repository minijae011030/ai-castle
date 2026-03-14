package com.aicastle.backend.dto;

/** 회원가입 성공 시 응답 (비밀번호 제외). */
public record SignUpResponse(Long user_id, String email, String user_name) {}
