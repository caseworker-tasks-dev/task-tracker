package uk.gov.hmcts.reform.dev.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import uk.gov.hmcts.reform.dev.dto.CreateTaskRequest;
import uk.gov.hmcts.reform.dev.dto.TaskResponse;
import uk.gov.hmcts.reform.dev.dto.UpdateStatusRequest;
import uk.gov.hmcts.reform.dev.services.TaskService;

import java.net.URI;
import java.util.List;

import static org.springframework.http.ResponseEntity.created;
import static org.springframework.http.ResponseEntity.noContent;
import static org.springframework.http.ResponseEntity.ok;

@RestController
@RequestMapping(value = "/tasks", produces = "application/json")
@Tag(name = "Tasks", description = "Create, view, update and delete caseworker tasks")
public class TaskController {

    private static final String PROBLEM_JSON = "application/problem+json";

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    @Operation(
        summary = "Create a task",
        description = "Creates a task. Status defaults to TODO when omitted. The due date must not be in the past."
    )
    @ApiResponse(
        responseCode = "201",
        description = "Task created",
        headers = @Header(name = "Location", description = "URL of the new task")
    )
    @ApiResponse(
        responseCode = "400",
        description = "Invalid request body: missing or invalid fields, unknown status, or bad date format",
        content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(implementation = ProblemDetail.class))
    )
    public ResponseEntity<TaskResponse> create(@Valid @RequestBody CreateTaskRequest request) {
        TaskResponse task = taskService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(task.id())
            .toUri();
        return created(location).body(task);
    }

    @GetMapping
    @Operation(summary = "List all tasks", description = "Returns every task, ordered by due date, earliest first.")
    @ApiResponse(responseCode = "200", description = "Tasks returned")
    public ResponseEntity<List<TaskResponse>> findAll() {
        return ok(taskService.findAll());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a task by ID")
    @ApiResponse(responseCode = "200", description = "Task found")
    @ApiResponse(
        responseCode = "404",
        description = "No task with that ID",
        content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(implementation = ProblemDetail.class))
    )
    public ResponseEntity<TaskResponse> findById(@Parameter(description = "Task ID") @PathVariable Long id) {
        return ok(taskService.findById(id));
    }

    @PatchMapping("/{id}/status")
    @Operation(
        summary = "Update a task's status",
        description = "Changes only the status; other fields are unchanged. Send the version from your last read "
            + "of the task: if someone has changed it since, the update is rejected with 409."
    )
    @ApiResponse(responseCode = "200", description = "Status updated")
    @ApiResponse(
        responseCode = "400",
        description = "Status or version missing, or status not one of TODO, IN_PROGRESS, DONE",
        content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(implementation = ProblemDetail.class))
    )
    @ApiResponse(
        responseCode = "404",
        description = "No task with that ID",
        content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(implementation = ProblemDetail.class))
    )
    @ApiResponse(
        responseCode = "409",
        description = "The task was changed after the version you sent; reload it and try again",
        content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(implementation = ProblemDetail.class))
    )
    public ResponseEntity<TaskResponse> updateStatus(@Parameter(description = "Task ID") @PathVariable Long id,
                                                     @Valid @RequestBody UpdateStatusRequest request) {
        return ok(taskService.updateStatus(id, request.status(), request.version()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a task")
    @ApiResponse(responseCode = "204", description = "Task deleted")
    @ApiResponse(
        responseCode = "404",
        description = "No task with that ID",
        content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(implementation = ProblemDetail.class))
    )
    public ResponseEntity<Void> delete(@Parameter(description = "Task ID") @PathVariable Long id) {
        taskService.delete(id);
        return noContent().build();
    }
}
