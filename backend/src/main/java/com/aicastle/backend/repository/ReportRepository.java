package com.aicastle.backend.repository;

import com.aicastle.backend.entity.Report;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportRepository extends JpaRepository<Report, Long> {

  /** Sliding Window: 해당 사용자·에이전트의 최근 N개 리포트 (report_date 내림차순). */
  @Query(
      "SELECT r FROM Report r WHERE r.userAccount.id = :userId AND r.agentRole.id = :agentRoleId"
          + " ORDER BY r.reportDate DESC")
  List<Report> findRecentByUserAndAgent(
      @Param("userId") Long userId, @Param("agentRoleId") Long agentRoleId, Pageable pageable);

  List<Report> findByUserAccountIdAndReportDate(Long userAccountId, LocalDate reportDate);

  Optional<Report> findByUserAccount_IdAndAgentRole_IdAndReportDate(
      Long userAccountId, Long agentRoleId, LocalDate reportDate);
}
