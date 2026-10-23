package uk.gov.hmcts.reform.dev.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import uk.gov.hmcts.reform.dev.dto.CreateTaskRequest;
import uk.gov.hmcts.reform.dev.dto.TaskResponse;
import uk.gov.hmcts.reform.dev.exceptions.TaskNotFoundException;
import uk.gov.hmcts.reform.dev.models.Task;
import uk.gov.hmcts.reform.dev.models.TaskStatus;
import uk.gov.hmcts.reform.dev.repositories.TaskRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    private static final OffsetDateTime DUE_DATE = OffsetDateTime.parse("2030-01-01T09:00:00Z");

    @Mock
    private transient TaskRepository taskRepository;

    @InjectMocks
    private transient TaskService taskService;

    @DisplayName("Should save a new task from the request and return it")
    @Test
    void createSavesTask() {
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> {
            Task saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        TaskResponse response = taskService.create(
            new CreateTaskRequest("Review case", "Check documents", TaskStatus.IN_PROGRESS, DUE_DATE));

        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(captor.capture());
        assertThat(captor.getValue().getTitle()).isEqualTo("Review case");
        assertThat(captor.getValue().getDescription()).isEqualTo("Check documents");
        assertThat(captor.getValue().getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(captor.getValue().getDueDate()).isEqualTo(DUE_DATE);
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.title()).isEqualTo("Review case");
    }

    @DisplayName("Should return all tasks in the order the repository gives them")
    @Test
    void findAllReturnsTasksByDueDate() {
        when(taskRepository.findAllByOrderByDueDateAsc())
            .thenReturn(List.of(task(1L, "First"), task(2L, "Second")));

        List<TaskResponse> tasks = taskService.findAll();

        assertThat(tasks).extracting(TaskResponse::title).containsExactly("First", "Second");
    }

    @DisplayName("Should return the task when it exists")
    @Test
    void findByIdReturnsTask() {
        when(taskRepository.findById(1L)).thenReturn(Optional.of(task(1L, "Review case")));

        TaskResponse response = taskService.findById(1L);

        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.title()).isEqualTo("Review case");
    }

    @DisplayName("Should throw TaskNotFoundException when getting a missing task")
    @Test
    void findByIdThrowsWhenMissing() {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.findById(99L))
            .isInstanceOf(TaskNotFoundException.class)
            .hasMessage("Task 99 not found");
    }

    @DisplayName("Should change the status and save the task")
    @Test
    void updateStatusSavesNewStatus() {
        Task existing = task(1L, "Review case");
        when(taskRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(taskRepository.saveAndFlush(existing)).thenReturn(existing);

        TaskResponse response = taskService.updateStatus(1L, TaskStatus.DONE, 0L);

        assertThat(response.status()).isEqualTo(TaskStatus.DONE);
        verify(taskRepository).saveAndFlush(existing);
    }

    @DisplayName("Should throw TaskNotFoundException and save nothing when updating a missing task")
    @Test
    void updateStatusThrowsWhenMissing() {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.updateStatus(99L, TaskStatus.DONE, 0L))
            .isInstanceOf(TaskNotFoundException.class);
        verify(taskRepository, never()).saveAndFlush(any());
    }

    @DisplayName("Should reject the update and save nothing when the version is out of date")
    @Test
    void updateStatusThrowsWhenVersionIsStale() {
        Task existing = task(1L, "Review case");
        existing.setVersion(3L);
        when(taskRepository.findById(1L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> taskService.updateStatus(1L, TaskStatus.DONE, 2L))
            .isInstanceOf(ObjectOptimisticLockingFailureException.class);
        assertThat(existing.getStatus()).isEqualTo(TaskStatus.TODO);
        verify(taskRepository, never()).saveAndFlush(any());
    }

    @DisplayName("Should delete the task when it exists")
    @Test
    void deleteRemovesTask() {
        Task existing = task(1L, "Review case");
        when(taskRepository.findById(1L)).thenReturn(Optional.of(existing));

        taskService.delete(1L);

        verify(taskRepository).delete(existing);
    }

    @DisplayName("Should throw TaskNotFoundException and delete nothing when deleting a missing task")
    @Test
    void deleteThrowsWhenMissing() {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.delete(99L))
            .isInstanceOf(TaskNotFoundException.class);
        verify(taskRepository, never()).delete(any());
    }

    private static Task task(Long id, String title) {
        Task task = new Task();
        task.setId(id);
        task.setTitle(title);
        task.setStatus(TaskStatus.TODO);
        task.setDueDate(DUE_DATE);
        task.setVersion(0L);
        return task;
    }
}
