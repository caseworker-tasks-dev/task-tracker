package uk.gov.hmcts.reform.dev.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import uk.gov.hmcts.reform.dev.models.TaskStatus;

import java.time.OffsetDateTime;

public record CreateTaskRequest(
    @NotBlank @Size(max = 255) String title,
    @Size(max = 4000) String description,
    TaskStatus status,
    @NotNull @FutureOrPresent OffsetDateTime dueDate
) {

    public CreateTaskRequest {
        if (status == null) {
            status = TaskStatus.TODO;
        }
    }
}
