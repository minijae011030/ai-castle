package com.aicastle.backend.openai;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "openai")
public record OpenAiProperties(
    String apiKey,
    /** 최종 응답·TODO JSON·스트리밍 CHAT 등에 사용 (고품질 모델 권장). */
    String model,
    String baseUrl,
    /** 라우팅·추론·계획 보조 등에 사용 (저비용 모델 권장). 비우면 model 과 동일. */
    String inferenceModel) {}
