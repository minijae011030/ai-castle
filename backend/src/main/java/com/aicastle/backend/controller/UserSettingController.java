package com.aicastle.backend.controller;

import com.aicastle.backend.dto.ResultResponse;
import com.aicastle.backend.dto.UserSettingResponse;
import com.aicastle.backend.dto.UserSettingUpdateRequest;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.UserAccountRepository;
import jakarta.validation.Valid;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 사용자 설정 (이름, 일과 시간) 조회/수정 API. */
@RestController
@RequestMapping("/api/user/settings")
public class UserSettingController {

  private final UserAccountRepository userAccountRepository;

  public UserSettingController(UserAccountRepository userAccountRepository) {
    this.userAccountRepository = userAccountRepository;
  }

  private Long getUserId() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof Long)) {
      throw new IllegalStateException("인증 정보가 없습니다.");
    }
    return (Long) principal;
  }

  @GetMapping
  public ResponseEntity<ResultResponse<UserSettingResponse>> getSettings() {
    Long userId = getUserId();
    Optional<UserAccount> optionalUser = userAccountRepository.findById(userId);
    UserAccount user =
        optionalUser.orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    UserSettingResponse body =
        new UserSettingResponse(
            user.getEmail(),
            user.getUserName(),
            user.getDayStartTime(),
            user.getDayEndTime(),
            user.getAge(),
            user.getInterests(),
            user.getIntensity());

    return ResponseEntity.ok(ResultResponse.success(body));
  }

  @PatchMapping
  public ResponseEntity<ResultResponse<UserSettingResponse>> updateSettings(
      @Valid @RequestBody UserSettingUpdateRequest request) {
    Long userId = getUserId();
    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    if (request.userName() != null && !request.userName().isBlank()) {
      user.setUserName(request.userName());
    }
    if (request.dayStartTime() != null) {
      user.setDayStartTime(request.dayStartTime());
    }
    if (request.dayEndTime() != null) {
      user.setDayEndTime(request.dayEndTime());
    }
    if (request.age() != null) {
      user.setAge(request.age());
    }
    if (request.interests() != null) {
      user.setInterests(request.interests());
    }
    if (request.intensity() != null) {
      user.setIntensity(request.intensity());
    }

    UserAccount saved = userAccountRepository.save(user);
    UserSettingResponse body =
        new UserSettingResponse(
            saved.getEmail(),
            saved.getUserName(),
            saved.getDayStartTime(),
            saved.getDayEndTime(),
            saved.getAge(),
            saved.getInterests(),
            saved.getIntensity());

    return ResponseEntity.status(HttpStatus.OK)
        .body(ResultResponse.success("설정이 업데이트되었습니다.", body));
  }
}
