package uk.gov.hmcts.reform.dev.controllers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import uk.gov.hmcts.reform.dev.dto.CreateTaskRequest;
import uk.gov.hmcts.reform.dev.dto.TaskResponse;
import uk.gov.hmcts.reform.dev.exceptions.TaskNotFoundException;
import uk.gov.hmcts.reform.dev.models.Task;
import uk.gov.hmcts.reform.dev.models.TaskStatus;
import uk.gov.hmcts.reform.dev.services.TaskService;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskController.class)
class TaskControllerTest {

    private static final OffsetDateTime DUE_DATE = OffsetDateTime.parse("2099-01-01T09:00:00Z");

    @Autowired
    private transient MockMvc mockMvc;

    @MockitoBean
    private transient TaskService taskService;

    @DisplayName("POST /tasks should return 201 with a Location header and the created task")
    @Test
    void createReturns201() throws Exception {
        when(taskService.create(any())).thenReturn(response(1L, TaskStatus.TODO));

        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Review case\",\"dueDate\":\"2099-01-01T09:00:00Z\"}"))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "http://localhost/tasks/1"))
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.title").value("Review case"));
    }

    @DisplayName("POST /tasks should default the status to TODO when none is given")
    @Test
    void createDefaultsStatusToTodo() throws Exception {
        when(taskService.create(any())).thenReturn(response(1L, TaskStatus.TODO));

        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Review case\",\"dueDate\":\"2099-01-01T09:00:00Z\"}"))
            .andExpect(status().isCreated());

        ArgumentCaptor<CreateTaskRequest> captor = ArgumentCaptor.forClass(CreateTaskRequest.class);
        verify(taskService).create(captor.capture());
        assertThat(captor.getValue().status()).isEqualTo(TaskStatus.TODO);
    }

    @DisplayName("GET /tasks should return 200 with every task")
    @Test
    void findAllReturns200() throws Exception {
        when(taskService.findAll()).thenReturn(List.of(response(1L, TaskStatus.TODO), response(2L, TaskStatus.DONE)));

        mockMvc.perform(get("/tasks"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].id").value(1))
            .andExpect(jsonPath("$[1].id").value(2));
    }

    @DisplayName("GET /tasks/{id} should return 200 with the task")
    @Test
    void findByIdReturns200() throws Exception {
        when(taskService.findById(1L)).thenReturn(response(1L, TaskStatus.TODO));

        mockMvc.perform(get("/tasks/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.dueDate").value("2099-01-01T09:00:00Z"));
    }

    @DisplayName("GET /tasks/{id} should return a 404 problem detail when the task does not exist")
    @Test
    void findByIdReturns404() throws Exception {
        when(taskService.findById(999L)).thenThrow(new TaskNotFoundException(999L));

        mockMvc.perform(get("/tasks/999"))
            .andExpect(status().isNotFound())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.detail").value("Task 999 not found"));
    }

    @DisplayName("PATCH /tasks/{id}/status should return 200 with the updated task")
    @Test
    void updateStatusReturns200() throws Exception {
        when(taskService.updateStatus(1L, TaskStatus.DONE)).thenReturn(response(1L, TaskStatus.DONE));

        mockMvc.perform(patch("/tasks/1/status").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"DONE\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DONE"));
    }

    @DisplayName("PATCH /tasks/{id}/status should return 404 when the task does not exist")
    @Test
    void updateStatusReturns404() throws Exception {
        when(taskService.updateStatus(999L, TaskStatus.DONE)).thenThrow(new TaskNotFoundException(999L));

        mockMvc.perform(patch("/tasks/999/status").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"DONE\"}"))
            .andExpect(status().isNotFound());
    }

    @DisplayName("PATCH /tasks/{id}/status should return 409 when someone else changed the task first")
    @Test
    void updateStatusReturns409OnConcurrentUpdate() throws Exception {
        when(taskService.updateStatus(1L, TaskStatus.DONE))
            .thenThrow(new ObjectOptimisticLockingFailureException(Task.class, 1L));

        mockMvc.perform(patch("/tasks/1/status").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"DONE\"}"))
            .andExpect(status().isConflict())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.detail").value("Task was changed by someone else. Reload it and try again."));
    }

    @DisplayName("DELETE /tasks/{id} should return 204 with no body")
    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(delete("/tasks/1"))
            .andExpect(status().isNoContent())
            .andExpect(content().string(""));

        verify(taskService).delete(1L);
    }

    @DisplayName("DELETE /tasks/{id} should return 404 when the task does not exist")
    @Test
    void deleteReturns404() throws Exception {
        doThrow(new TaskNotFoundException(999L)).when(taskService).delete(999L);

        mockMvc.perform(delete("/tasks/999"))
            .andExpect(status().isNotFound());
    }

    @DisplayName("POST /tasks should list each invalid field when validation fails")
    @Test
    void createReturns400ForInvalidFields() throws Exception {
        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\" \",\"dueDate\":\"2020-01-01T00:00:00Z\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.errors.title").value("must not be blank"))
            .andExpect(jsonPath("$.errors.dueDate").value("must be a date in the present or in the future"));

        verifyNoInteractions(taskService);
    }

    @DisplayName("POST /tasks should return 400 when the due date is missing")
    @Test
    void createReturns400ForMissingDueDate() throws Exception {
        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Review case\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors.dueDate").value("must not be null"));
    }

    @DisplayName("POST /tasks should return 400 when title or description is too long")
    @Test
    void createReturns400ForOversizedFields() throws Exception {
        String body = "{\"title\":\"" + "x".repeat(256) + "\",\"description\":\"" + "x".repeat(4001)
            + "\",\"dueDate\":\"2099-01-01T09:00:00Z\"}";

        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors.title").exists())
            .andExpect(jsonPath("$.errors.description").exists());
    }

    @DisplayName("POST /tasks should name the field when the due date cannot be parsed")
    @Test
    void createReturns400ForBadDate() throws Exception {
        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Review case\",\"dueDate\":\"tomorrow\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors.dueDate").exists());
    }

    @DisplayName("POST /tasks should return 400 without field errors for malformed JSON")
    @Test
    void createReturns400ForMalformedJson() throws Exception {
        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON).content("{\"title\":"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("Malformed request body"))
            .andExpect(jsonPath("$.errors").doesNotExist());
    }

    @DisplayName("PATCH /tasks/{id}/status should return 400 when status is missing")
    @Test
    void updateStatusReturns400ForMissingStatus() throws Exception {
        mockMvc.perform(patch("/tasks/1/status").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors.status").value("must not be null"));

        verifyNoInteractions(taskService);
    }

    @DisplayName("PATCH /tasks/{id}/status should name the allowed values for an unknown status")
    @Test
    void updateStatusReturns400ForUnknownStatus() throws Exception {
        mockMvc.perform(patch("/tasks/1/status").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"BLOCKED\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors.status").value("must be one of [TODO, IN_PROGRESS, DONE]"));
    }

    @DisplayName("GET /tasks/{id} should return 400 for a non-numeric ID")
    @Test
    void findByIdReturns400ForNonNumericId() throws Exception {
        mockMvc.perform(get("/tasks/abc"))
            .andExpect(status().isBadRequest());
    }

    private static TaskResponse response(Long id, TaskStatus status) {
        Instant now = Instant.parse("2026-10-23T00:00:00Z");
        return new TaskResponse(id, "Review case", null, status, DUE_DATE, 0L, now, now);
    }
}
