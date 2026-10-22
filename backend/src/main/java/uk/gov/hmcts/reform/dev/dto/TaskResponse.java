package uk.gov.hmcts.reform.dev.dto;

import uk.gov.hmcts.reform.dev.models.Task;
import uk.gov.hmcts.reform.dev.models.TaskStatus;

import java.time.Instant;
import java.time.OffsetDateTime;

public record TaskResponse(
    Long id,
    String title,
    String description,
    TaskStatus status,
    OffsetDateTime dueDate,
    Instant createdAt,
    Instant updatedAt
) {

    public static TaskResponse from(Task task) {
        return new TaskResponse(
            task.getId(),
            task.getTitle(),
            task.getDescription(),
            task.getStatus(),
            task.getDueDate(),
            task.getCreatedAt(),
            task.getUpdatedAt()
        );
    }
}
