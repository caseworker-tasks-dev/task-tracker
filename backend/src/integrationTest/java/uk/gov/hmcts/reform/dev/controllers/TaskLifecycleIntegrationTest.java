package uk.gov.hmcts.reform.dev.controllers;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import uk.gov.hmcts.reform.dev.TestcontainersConfiguration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TaskLifecycleIntegrationTest {

    @Autowired
    private transient MockMvc mockMvc;

    @DisplayName("Should create, get, update the status of, then delete a task")
    @Test
    void taskLifecycle() throws Exception {
        MvcResult created = mockMvc.perform(post("/tasks").contentType(MediaType.APPLICATION_JSON)
                                                .content("{\"title\":\"Review case\","
                                                             + "\"description\":\"Check the bundle\","
                                                             + "\"dueDate\":\"2099-01-01T09:00:00Z\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("TODO"))
            .andExpect(jsonPath("$.version").value(0))
            .andExpect(jsonPath("$.createdAt").exists())
            .andReturn();

        Integer id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        assertThat(created.getResponse().getHeader("Location")).endsWith("/tasks/" + id);

        mockMvc.perform(get("/tasks/{id}", id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Review case"))
            .andExpect(jsonPath("$.description").value("Check the bundle"))
            .andExpect(jsonPath("$.dueDate").value("2099-01-01T09:00:00Z"));

        mockMvc.perform(patch("/tasks/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"DONE\",\"version\":0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DONE"))
            .andExpect(jsonPath("$.version").value(1));

        mockMvc.perform(patch("/tasks/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"IN_PROGRESS\",\"version\":0}"))
            .andExpect(status().isConflict());

        mockMvc.perform(get("/tasks/{id}", id))
            .andExpect(jsonPath("$.status").value("DONE"))
            .andExpect(jsonPath("$.version").value(1));

        mockMvc.perform(delete("/tasks/{id}", id))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/tasks/{id}", id))
            .andExpect(status().isNotFound());
    }
}
