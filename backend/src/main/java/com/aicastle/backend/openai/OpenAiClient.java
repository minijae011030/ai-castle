package com.aicastle.backend.openai;

import com.aicastle.backend.openai.OpenAiChatDtos.ChatCompletionRequest;
import com.aicastle.backend.openai.OpenAiChatDtos.ChatCompletionResponse;
import com.aicastle.backend.openai.OpenAiChatDtos.Message;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OpenAiClient {

  private final OpenAiProperties properties;
  private final RestClient restClient;

  public OpenAiClient(OpenAiProperties properties) {
    this.properties = properties;
    String baseUrl =
        properties.baseUrl() == null || properties.baseUrl().isBlank()
            ? "https://api.openai.com"
            : properties.baseUrl().trim();

    this.restClient =
        RestClient.builder()
            .baseUrl(baseUrl)
            .defaultHeader(
                HttpHeaders.AUTHORIZATION,
                "Bearer " + (properties.apiKey() == null ? "" : properties.apiKey()))
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();
  }

  public String createChatCompletion(String systemPrompt, String userContent) {
    if (properties.apiKey() == null || properties.apiKey().isBlank()) {
      throw new IllegalStateException("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
    }
    if (properties.model() == null || properties.model().isBlank()) {
      throw new IllegalStateException("openai.model 이 설정되어 있지 않습니다.");
    }

    ChatCompletionRequest request =
        ChatCompletionRequest.of(properties.model().trim(), systemPrompt, userContent, 0.2);

    ChatCompletionResponse response =
        restClient
            .post()
            .uri("/v1/chat/completions")
            .body(request)
            .retrieve()
            .body(ChatCompletionResponse.class);

    if (response == null || response.choices() == null || response.choices().isEmpty()) {
      throw new IllegalStateException("OpenAI 응답이 비어 있습니다.");
    }

    Message message = response.choices().get(0).message();
    if (message == null || message.content() == null) {
      throw new IllegalStateException("OpenAI 메시지 응답이 비어 있습니다.");
    }
    return message.content();
  }
}
