package com.aicastle.backend.service;

import com.aicastle.backend.dto.LoginTokens;
import com.aicastle.backend.dto.SignUpRequest;
import com.aicastle.backend.dto.SignUpResponse;
import com.aicastle.backend.entity.UserAccount;
import com.aicastle.backend.repository.UserAccountRepository;
import java.time.LocalTime;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 회원가입·로그인(이메일+비밀번호) 로직. 비밀번호 BCrypt, JWT access/refresh 발급. */
@Service
public class AuthService {

  private static final LocalTime DEFAULT_DAY_START = LocalTime.of(7, 0);
  private static final LocalTime DEFAULT_DAY_END = LocalTime.of(23, 0);

  private final UserAccountRepository userAccountRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;

  public AuthService(
      UserAccountRepository userAccountRepository,
      PasswordEncoder passwordEncoder,
      JwtService jwtService) {
    this.userAccountRepository = userAccountRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
  }

  @Transactional
  public SignUpResponse signUp(SignUpRequest request) {
    if (userAccountRepository.existsByEmail(request.email())) {
      throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
    }

    String passwordHash = passwordEncoder.encode(request.password());

    UserAccount account =
        new UserAccount(
            request.email(), request.userName(), passwordHash, DEFAULT_DAY_START, DEFAULT_DAY_END);
    account = userAccountRepository.save(account);

    return new SignUpResponse(account.getId(), account.getEmail(), account.getUserName());
  }

  /** 이메일·비밀번호 검증 후 access/refresh 토큰 발급. */
  public LoginTokens login(String email, String password) {
    UserAccount user =
        userAccountRepository
            .findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다."));

    if (!passwordEncoder.matches(password, user.getPasswordHash())) {
      throw new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    String accessToken = jwtService.createAccessToken(user.getId(), user.getEmail());
    String refreshToken = jwtService.createRefreshToken(user.getId(), user.getEmail());
    return new LoginTokens(accessToken, refreshToken);
  }

  /** refresh 토큰으로 access/refresh 토큰 재발급. */
  public LoginTokens refreshTokens(String refreshToken) {
    if (!jwtService.isRefreshToken(refreshToken)) {
      throw new IllegalArgumentException("리프레시 토큰이 유효하지 않습니다.");
    }

    Long userId = jwtService.getUserIdFromToken(refreshToken);
    UserAccount user =
        userAccountRepository
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    String newAccessToken = jwtService.createAccessToken(user.getId(), user.getEmail());
    String newRefreshToken = jwtService.createRefreshToken(user.getId(), user.getEmail());
    return new LoginTokens(newAccessToken, newRefreshToken);
  }
}
