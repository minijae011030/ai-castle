package com.aicastle.backend.repository;

import com.aicastle.backend.entity.RecurringScheduleTemplate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecurringScheduleTemplateRepository
    extends JpaRepository<RecurringScheduleTemplate, Long> {

  List<RecurringScheduleTemplate> findByUserAccount_Id(Long userAccountId);
}
