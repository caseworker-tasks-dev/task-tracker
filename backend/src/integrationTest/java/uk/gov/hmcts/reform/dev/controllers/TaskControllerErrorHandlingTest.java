package uk.gov.hmcts.reform.dev.controllers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import uk.gov.hmcts.reform.dev.exceptions.TaskNotFoundException;
import uk.gov.hmcts.reform.dev.services.TaskService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskController.class)
class TaskControllerErrorHandlingTest {

    @Autowired
    private transient MockMvc mockMvc;

    @MockitoBean
    private transient TaskService taskService;

    @DisplayName("Should return 404 problem detail when task does not exist")
    @Test
    void taskNotFound() throws Exception {
        when(taskService.findById(999L)).thenThrow(new TaskNotFoundException(999L));

        mockMvc.perform(get("/tasks/999"))
            .andExpect(status().isNotFound())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.detail").value("Task 999 not found"));
    }

    @DisplayName("Should list each invalid field when validation fails")
    @Test
    void validationFailure() throws Exception {
        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\" \",\"dueDate\":\"2020-01-01T00:00:00Z\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.errors.title").value("must not be blank"))
            .andExpect(jsonPath("$.errors.dueDate").exists());
    }

    @DisplayName("Should name the field and allowed values for an unknown status")
    @Test
    void invalidStatus() throws Exception {
        mockMvc.perform(patch("/tasks/1/status").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"BLOCKED\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.errors.status").value("must be one of [TODO, IN_PROGRESS, DONE]"));
    }

    @DisplayName("Should name the field when the due date cannot be parsed")
    @Test
    void invalidDate() throws Exception {
        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"x\",\"dueDate\":\"tomorrow\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors.dueDate").exists());
    }

    @DisplayName("Should return 400 without field errors for malformed JSON")
    @Test
    void malformedJson() throws Exception {
        when(taskService.create(any())).thenThrow(new IllegalStateException("should not be called"));

        mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON).content("{\"title\":"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("Malformed request body"))
            .andExpect(jsonPath("$.errors").doesNotExist());
    }
}
