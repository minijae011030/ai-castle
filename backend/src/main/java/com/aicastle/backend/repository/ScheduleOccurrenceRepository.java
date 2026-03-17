package com.aicastle.backend.repository;

import com.aicastle.backend.entity.ScheduleOccurrence;
import java.time.LocalDate;
import java.util.List;
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
}
