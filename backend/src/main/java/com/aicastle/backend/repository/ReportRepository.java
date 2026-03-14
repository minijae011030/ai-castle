package com.aicastle.backend.repository;

import com.aicastle.backend.entity.Report;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportRepository extends JpaRepository<Report, Long> {

  /** Sliding Window: 해당 사용자·에이전트의 최근 N개 리포트 (report_date 내림차순). */
  @Query(
      value =
          "SELECT * FROM report WHERE user_account_id = :userId AND agent_role_id = :agentRoleId"
              + " ORDER BY report_date DESC LIMIT :limit",
      nativeQuery = true)
  List<Report> findRecentByUserAndAgent(
      @Param("userId") Long userId,
      @Param("agentRoleId") Long agentRoleId,
      @Param("limit") int limit);

  List<Report> findByUserAccountIdAndReportDate(Long userAccountId, LocalDate reportDate);
}
