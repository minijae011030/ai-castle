package com.aicastle.backend.openai;

import com.aicastle.backend.openai.OpenAiChatDtos.ChatCompletionRequest;
import com.aicastle.backend.openai.OpenAiChatDtos.ChatCompletionResponse;
import com.aicastle.backend.openai.OpenAiChatDtos.ImageUrlContentPart;
import com.aicastle.backend.openai.OpenAiChatDtos.Message;
import com.aicastle.backend.openai.OpenAiChatDtos.ResponseFormat;
import com.aicastle.backend.openai.OpenAiChatDtos.ResponsesCreateRequest;
import com.aicastle.backend.openai.OpenAiChatDtos.ResponsesInputImage;
import com.aicastle.backend.openai.OpenAiChatDtos.ResponsesInputMessage;
import com.aicastle.backend.openai.OpenAiChatDtos.ResponsesInputText;
import com.aicastle.backend.openai.OpenAiChatDtos.TextContentPart;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OpenAiClient {

  private static final Logger log = LoggerFactory.getLogger(OpenAiClient.class);
  private static final Pattern FIREBASE_TOKEN_PATTERN = Pattern.compile("(token=)[^&\"\\s]+");
  private static final Pattern DATA_URL_BASE64_PATTERN =
      Pattern.compile("(data:[^,]+,)[A-Za-z0-9+/=]+");

  private final OpenAiProperties properties;
  private final RestClient restClient;
  private final ObjectMapper objectMapper;

  public OpenAiClient(OpenAiProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
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

  /**
   * Chat Completions 스트리밍을 사용해 delta를 순차적으로 흘려준다.
   *
   * <p>프론트에서 "한 글자씩/한 줄씩" 나오는 UX를 위해 사용한다.
   *
   * <p>주의: 이 메서드는 CHAT(텍스트) 모드에만 사용한다. (TODO structured output/vision은 별도 경로)
   */
  public void streamChatCompletionWithMessages(
      List<Message> messages, Consumer<String> onDelta, Consumer<String> onError) {
    if (properties.apiKey() == null || properties.apiKey().isBlank()) {
      throw new IllegalStateException("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
    }
    if (properties.model() == null || properties.model().isBlank()) {
      throw new IllegalStateException("openai.model 이 설정되어 있지 않습니다.");
    }
    if (messages == null || messages.isEmpty()) {
      throw new IllegalArgumentException("messages 는 비어 있을 수 없습니다.");
    }
    Objects.requireNonNull(onDelta, "onDelta must not be null");
    Objects.requireNonNull(onError, "onError must not be null");

    String baseUrl =
        properties.baseUrl() == null || properties.baseUrl().isBlank()
            ? "https://api.openai.com"
            : properties.baseUrl().trim();

    try {
      URL url = new URL(baseUrl + "/v1/responses");
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("POST");
      conn.setDoOutput(true);
      conn.setConnectTimeout(10_000);
      conn.setReadTimeout(60_000);
      conn.setRequestProperty(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey().trim());
      conn.setRequestProperty(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
      conn.setRequestProperty(HttpHeaders.ACCEPT, "text/event-stream");

      // stream=true 추가
      List<ResponsesInputMessage> responseInputMessages = new ArrayList<>();
      for (Message message : messages) {
        if (message == null) continue;
        if (!(message.content() instanceof String textContent)) continue;
        List<Object> parts = new ArrayList<>();
        // Responses API 규격:
        // - user/system 역할은 input_text
        // - assistant 역할은 output_text (input_text 사용 시 400 invalid_value)
        String contentType = "assistant".equals(message.role()) ? "output_text" : "input_text";
        parts.add(new ResponsesInputText(contentType, textContent));
        responseInputMessages.add(new ResponsesInputMessage(message.role(), parts));
      }

      ObjectNode requestNode = objectMapper.createObjectNode();
      requestNode.put("model", properties.model().trim());
      requestNode.put("temperature", 0.2);
      requestNode.put("stream", true);
      requestNode.set("input", objectMapper.valueToTree(responseInputMessages));
      String requestJson = requestNode.toString();

      try (OutputStream os = conn.getOutputStream()) {
        os.write(requestJson.getBytes(StandardCharsets.UTF_8));
        os.flush();
      }

      int status = conn.getResponseCode();
      log.info("[OPENAI_STREAM] status={}", status);
      InputStream is =
          status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream();
      if (is == null) {
        onError.accept("OpenAI 스트림 연결에 실패했습니다. status=" + status);
        return;
      }

      if (status < 200 || status >= 300) {
        String errorBody = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        String compactErrorBody = errorBody == null ? "" : errorBody.trim();
        if (compactErrorBody.length() > 400) {
          compactErrorBody = compactErrorBody.substring(0, 400) + "...";
        }
        log.warn("[OPENAI_STREAM] non-2xx status={}, body={}", status, compactErrorBody);
        onError.accept(
            "OpenAI 스트림 호출 실패(status="
                + status
                + ")"
                + (compactErrorBody.isBlank() ? "" : " - " + compactErrorBody));
        return;
      }

      boolean emittedAnyText = false;
      try (BufferedReader br =
          new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
        String line;
        while ((line = br.readLine()) != null) {
          if (line.isBlank()) continue;
          if (!line.startsWith("data:")) continue;

          String payload = line.substring("data:".length()).trim();
          if (payload.isEmpty()) continue;
          if ("[DONE]".equals(payload)) {
            return;
          }

          try {
            JsonNode root = objectMapper.readTree(payload);
            String eventType = root.path("type").asText("");
            if ("response.output_text.delta".equals(eventType)) {
              String text = root.path("delta").asText("");
              if (!text.isEmpty()) {
                emittedAnyText = true;
                onDelta.accept(text);
              }
              continue;
            }

            // 일부 모델/응답 경로에서는 delta 대신 completed에서만 텍스트가 전달될 수 있다.
            if ("response.completed".equals(eventType)) {
              String completedText = extractOutputTextFromCompleted(root);
              if (!completedText.isBlank()) {
                if (!emittedAnyText) {
                  onDelta.accept(completedText);
                }
                return;
              }
              continue;
            }

            if ("error".equals(eventType)) {
              String errorMessage =
                  root.path("error").path("message").asText("OpenAI 스트림 오류가 발생했습니다.");
              log.warn("[OPENAI_STREAM] event error={}", errorMessage);
              onError.accept(errorMessage);
              return;
            }
          } catch (Exception parseError) {
            // 스트리밍 중 일부 라인이 깨져도 전체를 중단하지 않는다.
            log.warn("[OPENAI_STREAM] parse failed: {}", parseError.getMessage());
            onError.accept("OpenAI 스트림 파싱에 실패했습니다.");
          }
        }
      }
      log.info("[OPENAI_STREAM] completed emittedAnyText={}", emittedAnyText);
    } catch (Exception e) {
      log.error("[OPENAI_STREAM] failed: {}", e.getMessage(), e);
      onError.accept("OpenAI 스트림 호출에 실패했습니다. " + (e.getMessage() == null ? "" : e.getMessage()));
    }
  }

  private String extractOutputTextFromCompleted(JsonNode completedEvent) {
    if (completedEvent == null || completedEvent.isNull()) return "";
    JsonNode response = completedEvent.path("response");
    JsonNode output = response.path("output");
    if (!output.isArray()) return "";

    StringBuilder textBuffer = new StringBuilder();
    for (JsonNode outputItem : output) {
      if (outputItem == null || !"message".equals(outputItem.path("type").asText(""))) continue;
      JsonNode content = outputItem.path("content");
      if (!content.isArray()) continue;
      for (JsonNode part : content) {
        if (part == null) continue;
        if (!"output_text".equals(part.path("type").asText(""))) continue;
        String text = part.path("text").asText("");
        if (!text.isBlank()) {
          textBuffer.append(text);
        }
      }
    }
    return textBuffer.toString();
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
    if (message.content() instanceof String content) {
      return content;
    }
    // OpenAI 응답은 content가 string이어야 한다. 방어적으로 toString을 사용하되
    // 타입이 예상과 다르면 예외를 던져 추적을 돕는다.
    throw new IllegalStateException("OpenAI 메시지 content 타입이 예상과 다릅니다.");
  }

  public String createChatCompletionWithMessages(List<Message> messages) {
    if (properties.apiKey() == null || properties.apiKey().isBlank()) {
      throw new IllegalStateException("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
    }
    if (properties.model() == null || properties.model().isBlank()) {
      throw new IllegalStateException("openai.model 이 설정되어 있지 않습니다.");
    }
    if (messages == null || messages.isEmpty()) {
      throw new IllegalArgumentException("messages 는 비어 있을 수 없습니다.");
    }

    ChatCompletionRequest request =
        ChatCompletionRequest.ofMessages(properties.model().trim(), messages, 0.2);

    try {
      String json = objectMapper.writeValueAsString(request);
      // token=... 부분만 마스킹 (URL 전체를 로그로 남기지 않음)
      json = FIREBASE_TOKEN_PATTERN.matcher(json).replaceAll("$1****");
    } catch (Exception ignored) {
      // 로깅 실패는 무시
    }

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
    if (message.content() instanceof String content) {
      return content;
    }
    throw new IllegalStateException("OpenAI 메시지 content 타입이 예상과 다릅니다.");
  }

  /** TODO 모드 전용: Structured Output(JSON Schema)로 응답을 강제한다. */
  public String createTodoJsonWithMessages(List<Message> messages) {
    if (properties.apiKey() == null || properties.apiKey().isBlank()) {
      throw new IllegalStateException("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
    }
    if (properties.model() == null || properties.model().isBlank()) {
      throw new IllegalStateException("openai.model 이 설정되어 있지 않습니다.");
    }
    if (messages == null || messages.isEmpty()) {
      throw new IllegalArgumentException("messages 는 비어 있을 수 없습니다.");
    }

    ChatCompletionRequest request =
        ChatCompletionRequest.ofMessagesWithResponseFormat(
            properties.model().trim(), messages, 0.2, ResponseFormat.todoJsonSchemaV1());

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
    if (message.content() instanceof String content) {
      return content;
    }
    throw new IllegalStateException("OpenAI 메시지 content 타입이 예상과 다릅니다.");
  }

  /**
   * CHAT + 이미지(vision)를 확실히 태우기 위해 /v1/responses 를 사용한다.
   *
   * <p>OpenAI Chat Completions 멀티모달에서 모델이 이미지를 무시하는 케이스가 있어, responses API의 input_text /
   * input_image 형태로 변환해 호출한다.
   */
  public String createVisionResponseWithMessages(List<Message> messages) {
    if (properties.apiKey() == null || properties.apiKey().isBlank()) {
      throw new IllegalStateException("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
    }
    if (properties.model() == null || properties.model().isBlank()) {
      throw new IllegalStateException("openai.model 이 설정되어 있지 않습니다.");
    }
    if (messages == null || messages.isEmpty()) {
      throw new IllegalArgumentException("messages 는 비어 있을 수 없습니다.");
    }

    StringBuilder instructions = new StringBuilder();
    for (Message m : messages) {
      if (m == null || !"system".equals(m.role())) continue;
      Object content = m.content();
      if (!(content instanceof String s) || s.isBlank()) continue;
      if (instructions.length() > 0) instructions.append("\n\n");
      instructions.append(s);
    }

    // 마지막 user message만 멀티모달로 변환한다. (포맷 문제 최소화)
    List<?> lastUserParts = null;
    String lastUserText = null;
    for (int i = messages.size() - 1; i >= 0; i--) {
      Message m = messages.get(i);
      if (m == null || !"user".equals(m.role())) continue;
      Object content = m.content();
      if (content instanceof String s) lastUserText = s;
      if (content instanceof List<?> list) lastUserParts = list;
      break;
    }

    // 멀티모달 part 수집
    String lastImageUrl = null;
    List<ResponsesInputText> textParts = new ArrayList<>();

    if (lastUserParts != null) {
      for (Object part : lastUserParts) {
        if (part instanceof TextContentPart textPart) {
          textParts.add(new ResponsesInputText("input_text", textPart.text()));
        } else if (part instanceof ImageUrlContentPart imagePart) {
          lastImageUrl = imagePart.image_url().url();
        }
      }
    }

    // 마지막 user가 string(content)으로 들어온 케이스를 방어적으로 처리
    if ((textParts == null || textParts.isEmpty()) && lastUserText != null) {
      textParts.add(new ResponsesInputText("input_text", lastUserText));
    }

    if (textParts.isEmpty()) {
      textParts.add(new ResponsesInputText("input_text", ""));
    }

    // 이미지가 없으면 텍스트만 보내는 CHAT fallback
    if (lastImageUrl == null || lastImageUrl.isBlank()) {
      List<ResponsesInputMessage> inputMessages =
          List.of(new ResponsesInputMessage("user", new ArrayList<>(List.of(textParts.get(0)))));
      ResponsesCreateRequest request =
          new ResponsesCreateRequest(
              properties.model().trim(), instructions.toString(), inputMessages, 0.2);
      try {
        String json = objectMapper.writeValueAsString(request);
        json = FIREBASE_TOKEN_PATTERN.matcher(json).replaceAll("$1****");
      } catch (Exception ignored) {
      }
      String responseBody =
          restClient.post().uri("/v1/responses").body(request).retrieve().body(String.class);
      JsonNode response;
      try {
        response = objectMapper.readTree(responseBody);
      } catch (Exception e) {
        throw new IllegalStateException("OpenAI responses JSON 파싱에 실패했습니다.", e);
      }
      JsonNode output = response.get("output");
      if (output != null && output.isArray()) {
        for (JsonNode item : output) {
          if (item == null) continue;
          if (!"message".equals(item.path("type").asText())) continue;
          JsonNode content = item.get("content");
          if (content == null || !content.isArray()) continue;
          for (JsonNode part : content) {
            if (part == null) continue;
            if ("output_text".equals(part.path("type").asText())) {
              return part.path("text").asText("");
            }
          }
        }
      }
      throw new IllegalStateException("OpenAI responses에서 output_text를 찾지 못했습니다.");
    }

    // data URL은 한 번만 다운로드해서 재사용
    String dataUrl = imageUrlToDataUrl(lastImageUrl);

    String visionModel = properties.model().trim();

    record Attempt(String label, String imagePayload, boolean imageFirst) {}
    List<Attempt> attempts =
        List.of(
            new Attempt("data-url-string", dataUrl, true),
            new Attempt("external-url-string", lastImageUrl, false));

    String lastAssistantText = null;
    for (Attempt attempt : attempts) {
      List<Object> responseParts = new ArrayList<>();

      ResponsesInputImage imagePart =
          new ResponsesInputImage("input_image", attempt.imagePayload, "high");

      if (attempt.imageFirst) {
        responseParts.add(imagePart);
        responseParts.addAll(textParts);
      } else {
        responseParts.addAll(textParts);
        responseParts.add(imagePart);
      }

      List<ResponsesInputMessage> inputMessages =
          List.of(new ResponsesInputMessage("user", responseParts));

      ResponsesCreateRequest request =
          new ResponsesCreateRequest(visionModel, instructions.toString(), inputMessages, 0.2);

      try {
        String json = objectMapper.writeValueAsString(request);
        json = FIREBASE_TOKEN_PATTERN.matcher(json).replaceAll("$1****");
        json = DATA_URL_BASE64_PATTERN.matcher(json).replaceAll("$1****");
      } catch (Exception ignored) {
      }

      String responseBody;
      try {
        responseBody =
            restClient.post().uri("/v1/responses").body(request).retrieve().body(String.class);
      } catch (Exception e) {
        continue;
      }
      JsonNode response;
      try {
        response = objectMapper.readTree(responseBody);
      } catch (Exception e) {
        // 이 시도는 패스하고 다음 attempt로 넘어간다.
        continue;
      }

      JsonNode output = response.get("output");
      if (output == null || !output.isArray()) continue;

      String foundText = null;
      for (JsonNode item : output) {
        if (item == null) continue;
        if (!"message".equals(item.path("type").asText())) continue;
        JsonNode content = item.get("content");
        if (content == null || !content.isArray()) continue;
        for (JsonNode part : content) {
          if (part == null) continue;
          if ("output_text".equals(part.path("type").asText())) {
            foundText = part.path("text").asText(null);
            break;
          }
        }
        if (foundText != null) break;
      }

      if (foundText == null) continue;
      lastAssistantText = foundText;
      if (!looksLikeImageFetchFailure(foundText)) {
        return foundText;
      }
      log.info(
          "[OPENAI][vision] attempt failed, continue. attempt={} text={}",
          attempt.label,
          foundText);
    }

    // 이미지 인식 실패 문구가 반복되면, 긴 히스토리/지시문 오염 가능성이 높다.
    // 따라서 컨텍스트 없는 최소 요청으로 한 번 더 재시도한다.
    String minimalRetryText = retryVisionWithMinimalContext(visionModel, lastImageUrl);
    if (minimalRetryText != null && !minimalRetryText.isBlank()) {
      return minimalRetryText;
    }

    // 모든 시도에서 이미지 인식 실패 문구만 돌아온 경우라도,
    // 500으로 끊지 않고 모델의 실제 응답 텍스트를 반환해 프론트에서 원인 파악이 가능하게 한다.
    if (lastAssistantText != null && !lastAssistantText.isBlank()) {
      return lastAssistantText;
    }

    throw new IllegalStateException("OpenAI responses에서 output_text를 찾지 못했습니다.");
  }

  private boolean looksLikeImageFetchFailure(String text) {
    if (text == null) return false;
    // 현재 모델이 반환하는 대표 문구를 휴리스틱으로 판별한다.
    return text.contains("이미지") && text.contains("확인") && text.contains("없");
  }

  private String retryVisionWithMinimalContext(String visionModel, String imageUrl) {
    if (imageUrl == null || imageUrl.isBlank()) return null;
    try {
      List<Object> minimalParts = new ArrayList<>();
      minimalParts.add(new ResponsesInputText("input_text", "이미지에 보이는 핵심 내용을 한국어 한 줄로 설명해줘."));
      minimalParts.add(new ResponsesInputImage("input_image", imageUrl, "high"));

      List<ResponsesInputMessage> minimalInput =
          List.of(new ResponsesInputMessage("user", minimalParts));

      ResponsesCreateRequest minimalRequest =
          new ResponsesCreateRequest(visionModel, null, minimalInput, 0.0);

      String responseBody =
          restClient.post().uri("/v1/responses").body(minimalRequest).retrieve().body(String.class);
      JsonNode response = objectMapper.readTree(responseBody);
      JsonNode output = response.get("output");
      if (output == null || !output.isArray()) return null;

      for (JsonNode item : output) {
        if (item == null || !"message".equals(item.path("type").asText())) continue;
        JsonNode content = item.get("content");
        if (content == null || !content.isArray()) continue;
        for (JsonNode part : content) {
          if (part == null) continue;
          if ("output_text".equals(part.path("type").asText())) {
            String text = part.path("text").asText(null);
            if (text == null || text.isBlank()) return null;
            if (looksLikeImageFetchFailure(text)) return null;
            return text;
          }
        }
      }
      return null;
    } catch (Exception e) {
      return null;
    }
  }

  private String imageUrlToDataUrl(String imageUrl) {
    if (imageUrl == null || imageUrl.isBlank()) return imageUrl;
    try {
      URL url = new URL(imageUrl.trim());
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(10_000);
      conn.setReadTimeout(20_000);
      conn.setInstanceFollowRedirects(true);

      String contentType = conn.getContentType();
      if (contentType == null || contentType.isBlank()) {
        contentType = "image/jpeg";
      }
      // `image/*; charset=...` 같은 꼴을 제거하고, 이미지가 아니면 JPEG로 폴백한다.
      int semicolonIdx = contentType.indexOf(';');
      if (semicolonIdx >= 0) {
        contentType = contentType.substring(0, semicolonIdx).trim();
      }
      if (!contentType.startsWith("image/")) {
        contentType = "image/jpeg";
      }

      try (InputStream is = conn.getInputStream()) {
        byte[] bytes = is.readAllBytes();
        String base64 = Base64.getEncoder().encodeToString(bytes);
        return "data:" + contentType + ";base64," + base64;
      }
    } catch (Exception e) {
      // 다운로드/변환 실패 시, 원래 URL로 폴백한다.
      return imageUrl;
    }
  }
}
