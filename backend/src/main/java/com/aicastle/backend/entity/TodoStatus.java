package com.aicastle.backend.entity;

/** 협상 플로우: PENDING → NEGOTIATING → ACCEPTED, 완료 시 DONE. */
public enum TodoStatus {
  PENDING,
  NEGOTIATING,
  ACCEPTED,
  DONE,
  CANCELLED
}
