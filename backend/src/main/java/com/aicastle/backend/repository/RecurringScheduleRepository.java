package com.aicastle.backend.repository;

import com.aicastle.backend.entity.RecurringSchedule;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecurringScheduleRepository extends JpaRepository<RecurringSchedule, Long> {

  List<RecurringSchedule> findByUserAccount_IdOrderByPeriodStartAsc(Long userAccountId);

  Optional<RecurringSchedule> findByIdAndUserAccount_Id(Long id, Long userAccountId);
}
