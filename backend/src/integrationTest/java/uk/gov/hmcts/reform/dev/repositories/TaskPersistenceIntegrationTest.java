package uk.gov.hmcts.reform.dev.repositories;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import uk.gov.hmcts.reform.dev.TestcontainersConfiguration;
import uk.gov.hmcts.reform.dev.models.Task;
import uk.gov.hmcts.reform.dev.models.TaskStatus;

import java.time.OffsetDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TaskPersistenceIntegrationTest {

    @Autowired
    private transient TaskRepository taskRepository;

    @Autowired
    private transient JdbcTemplate jdbcTemplate;

    @DisplayName("Database should reject a status outside TODO, IN_PROGRESS and DONE")
    @Test
    void checkConstraintRejectsUnknownStatus() {
        assertThatThrownBy(() -> jdbcTemplate.update(
            "INSERT INTO task (title, status, due_date) VALUES ('x', 'BLOCKED', now())"))
            .isInstanceOf(DataIntegrityViolationException.class)
            .hasMessageContaining("task_status_check");
    }

    @DisplayName("Database should fill version and timestamps when a row is inserted without them")
    @Test
    void columnDefaultsApplyOnInsert() {
        Long id = jdbcTemplate.queryForObject(
            "INSERT INTO task (title, status, due_date) VALUES ('x', 'TODO', now()) RETURNING id", Long.class);

        Map<String, Object> row = jdbcTemplate.queryForMap(
            "SELECT version, created_at, updated_at FROM task WHERE id = ?", id);

        assertThat(row.get("version")).isEqualTo(0L);
        assertThat(row.get("created_at")).isNotNull();
        assertThat(row.get("updated_at")).isNotNull();
    }

    @DisplayName("Due date should keep the same instant when saved with a non-UTC offset")
    @Test
    void dueDateKeepsInstantAcrossOffsets() {
        OffsetDateTime dueDate = OffsetDateTime.parse("2030-06-01T09:00:00+01:00");

        Task saved = taskRepository.save(task(TaskStatus.TODO, dueDate));
        Task reloaded = taskRepository.findById(saved.getId()).orElseThrow();

        assertThat(reloaded.getDueDate().toInstant()).isEqualTo(dueDate.toInstant());
    }

    @DisplayName("Saving a stale copy of a task should fail instead of overwriting a newer change")
    @Test
    void staleUpdateIsRejected() {
        Long id = taskRepository.save(task(TaskStatus.TODO, OffsetDateTime.now().plusDays(1))).getId();
        Task firstCaseworker = taskRepository.findById(id).orElseThrow();
        Task secondCaseworker = taskRepository.findById(id).orElseThrow();

        firstCaseworker.setStatus(TaskStatus.DONE);
        taskRepository.saveAndFlush(firstCaseworker);

        secondCaseworker.setStatus(TaskStatus.IN_PROGRESS);
        assertThatThrownBy(() -> taskRepository.saveAndFlush(secondCaseworker))
            .isInstanceOf(ObjectOptimisticLockingFailureException.class);
        assertThat(taskRepository.findById(id).orElseThrow().getStatus()).isEqualTo(TaskStatus.DONE);
    }

    private static Task task(TaskStatus status, OffsetDateTime dueDate) {
        Task task = new Task();
        task.setTitle("Review case");
        task.setStatus(status);
        task.setDueDate(dueDate);
        return task;
    }
}
