package com.aicastle.backend.repository;

import com.aicastle.backend.entity.ScheduleOccurrence;
import com.aicastle.backend.entity.ScheduleOccurrence.ScheduleType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScheduleOccurrenceRepository extends JpaRepository<ScheduleOccurrence, Long> {

  List<ScheduleOccurrence> findByUserAccount_IdAndOccurrenceDateOrderByStartAtAsc(
      Long userAccountId, LocalDate date);

  @Query(
      """
      select o from ScheduleOccurrence o
      where o.userAccount.id = :userId
        and o.occurrenceDate between :start and :end
      order by o.occurrenceDate, o.startAt
      """)
  List<ScheduleOccurrence> findByUserAndMonth(
      @Param("userId") Long userId, @Param("start") LocalDate start, @Param("end") LocalDate end);

  Optional<ScheduleOccurrence> findByUserAccount_IdAndTypeAndRecurringTemplateIdAndOccurrenceDate(
      Long userAccountId, ScheduleType type, Long recurringTemplateId, LocalDate occurrenceDate);

  @Query(
      """
      select o from ScheduleOccurrence o
      where o.userAccount.id = :userId
        and o.occurrenceDate between :startDate and :endDate
      order by o.occurrenceDate, o.startAt, o.id
      """)
  List<ScheduleOccurrence> findByUserAndDateRange(
      @Param("userId") Long userId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  @Query(
      """
      select o from ScheduleOccurrence o
      where o.userAccount.id = :userId
        and o.type = :type
        and o.occurrenceDate between :startDate and :endDate
      order by o.occurrenceDate, o.startAt, o.id
      """)
  List<ScheduleOccurrence> findByUserAndTypeAndDateRange(
      @Param("userId") Long userId,
      @Param("type") ScheduleType type,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  @Query(
      """
      select o from ScheduleOccurrence o
      where o.userAccount.id = :userId
        and o.type = :type
        and o.agentId = :agentId
        and o.occurrenceDate between :startDate and :endDate
      order by o.occurrenceDate, o.startAt, o.id
      """)
  List<ScheduleOccurrence> findByUserAndTypeAndAgentAndDateRange(
      @Param("userId") Long userId,
      @Param("type") ScheduleType type,
      @Param("agentId") Long agentId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  List<ScheduleOccurrence> findByUserAccount_IdAndIdIn(Long userAccountId, List<Long> ids);
}
