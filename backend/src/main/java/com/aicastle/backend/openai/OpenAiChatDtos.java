package com.aicastle.backend.openai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

public class OpenAiChatDtos {

  public record ChatCompletionRequest(String model, List<Message> messages, Double temperature) {

    public static ChatCompletionRequest of(
        String model, String systemPrompt, String userContent, double temperature) {
      return new ChatCompletionRequest(
          model,
          List.of(new Message("system", systemPrompt), new Message("user", userContent)),
          temperature);
    }
  }

  public record Message(String role, String content) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ChatCompletionResponse(List<Choice> choices) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Choice(Message message) {}
}
