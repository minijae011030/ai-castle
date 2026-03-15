package com.aicastle.backend.repository;

import com.aicastle.backend.entity.CalendarEvent;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

  List<CalendarEvent> findByUserAccount_IdOrderByStartAtAsc(Long userAccountId);

  Optional<CalendarEvent> findByIdAndUserAccount_Id(Long id, Long userAccountId);

  boolean existsByIdAndUserAccount_Id(Long id, Long userAccountId);

  /** 해당 사용자의 특정 기간 내 캘린더 이벤트 (HITL 컨텍스트 주입용). */
  @Query(
      "SELECT e FROM CalendarEvent e WHERE e.userAccount.id = :userId "
          + "AND e.startAt < :rangeEnd AND e.endAt > :rangeStart ORDER BY e.startAt")
  List<CalendarEvent> findByUserAndTimeRange(
      @Param("userId") Long userId,
      @Param("rangeStart") LocalDateTime rangeStart,
      @Param("rangeEnd") LocalDateTime rangeEnd);
}
