package com.aicastle.backend.openai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

public class OpenAiChatDtos {

  public record ChatCompletionRequest(
      String model, List<Message> messages, Double temperature, ResponseFormat response_format) {

    public static ChatCompletionRequest of(
        String model, String systemPrompt, String userContent, double temperature) {
      return new ChatCompletionRequest(
          model,
          List.of(new Message("system", systemPrompt), new Message("user", userContent)),
          temperature,
          null);
    }

    public static ChatCompletionRequest ofMessages(
        String model, List<Message> messages, double temperature) {
      return new ChatCompletionRequest(model, messages, temperature, null);
    }

    public static ChatCompletionRequest ofMessagesWithResponseFormat(
        String model, List<Message> messages, double temperature, ResponseFormat responseFormat) {
      return new ChatCompletionRequest(model, messages, temperature, responseFormat);
    }
  }

  public record Message(String role, String content) {}

  public record ResponseFormat(String type, JsonSchema json_schema) {
    public static ResponseFormat todoJsonSchemaV1() {
      // OpenAI Structured Output (json_schema) 형식. strict=true로 모델 출력 형태를 강제한다.
      return new ResponseFormat(
          "json_schema",
          new JsonSchema(
              "todo_mode_v1",
              true,
              new Schema(
                  "object",
                  new Properties(
                      new SchemaString("string"),
                      new SchemaTodoArray(
                          "array",
                          new TodoItemSchema(
                              "object",
                              new TodoItemProperties(
                                  new SchemaString("string"),
                                  new SchemaNullableString("string", true),
                                  new SchemaNullableInteger("integer", true),
                                  new SchemaEnum("string", List.of("LOW", "MEDIUM", "HIGH")),
                                  new SchemaEnum("string", List.of("TODO", "DONE")),
                                  new SchemaString("string"),
                                  new SchemaString("string"),
                                  new SchemaString("string")),
                              // Structured Output 규칙: required는 properties의 모든 키를 포함해야 한다.
                              // (nullable이어도 포함)
                              List.of(
                                  "title",
                                  "description",
                                  "estimateMinutes",
                                  "priority",
                                  "status",
                                  "scheduledDate",
                                  "startAt",
                                  "endAt"),
                              false))),
                  List.of("text", "todo"),
                  false)));
    }
  }

  public record JsonSchema(String name, boolean strict, Schema schema) {}

  public record Schema(
      String type,
      Properties properties,
      List<String> required,
      @com.fasterxml.jackson.annotation.JsonProperty("additionalProperties")
          boolean additionalProperties) {}

  public record Properties(Object text, Object todo) {}

  public record SchemaString(String type) {}

  public record SchemaNullableString(String type, boolean nullable) {}

  public record SchemaNullableInteger(String type, boolean nullable) {}

  public record SchemaEnum(
      String type, @com.fasterxml.jackson.annotation.JsonProperty("enum") List<String> values) {}

  public record SchemaTodoArray(String type, TodoItemSchema items) {}

  public record TodoItemSchema(
      String type,
      TodoItemProperties properties,
      List<String> required,
      @com.fasterxml.jackson.annotation.JsonProperty("additionalProperties")
          boolean additionalProperties) {}

  public record TodoItemProperties(
      Object title,
      Object description,
      Object estimateMinutes,
      Object priority,
      Object status,
      Object scheduledDate,
      Object startAt,
      Object endAt) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ChatCompletionResponse(List<Choice> choices) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Choice(Message message) {}
}
