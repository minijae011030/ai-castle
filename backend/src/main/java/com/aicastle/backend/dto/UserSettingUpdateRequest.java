package com.aicastle.backend.dto;

import java.time.LocalTime;

/** 사용자 설정 수정 요청. */
public record UserSettingUpdateRequest(
    String userName,
    LocalTime dayStartTime,
    LocalTime dayEndTime,
    Integer age,
    String interests,
    String intensity) {}
