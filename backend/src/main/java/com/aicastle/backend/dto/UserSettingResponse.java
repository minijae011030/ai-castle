package com.aicastle.backend.dto;

import java.time.LocalTime;

/** 사용자 설정 조회 응답. */
public record UserSettingResponse(
    String email,
    String userName,
    LocalTime dayStartTime,
    LocalTime dayEndTime,
    Integer age,
    String interests,
    String intensity) {}
