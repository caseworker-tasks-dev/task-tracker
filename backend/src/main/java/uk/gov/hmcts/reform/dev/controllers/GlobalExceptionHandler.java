package uk.gov.hmcts.reform.dev.controllers;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.exc.InvalidFormatException;
import uk.gov.hmcts.reform.dev.exceptions.TaskNotFoundException;

import java.time.temporal.Temporal;
import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(TaskNotFoundException.class)
    public ProblemDetail handleTaskNotFound(TaskNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
                                                         HttpHeaders headers,
                                                         HttpStatusCode status,
                                                         WebRequest request) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                error -> error.getField(),
                error -> String.valueOf(error.getDefaultMessage()),
                (first, second) -> first
            ));
        ProblemDetail problem = ex.getBody();
        problem.setDetail("Validation failed");
        problem.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(problem);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
                                                         HttpHeaders headers,
                                                         HttpStatusCode status,
                                                         WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Malformed request body");
        if (ex.getCause() instanceof InvalidFormatException cause) {
            problem.setDetail("Validation failed");
            problem.setProperty("errors", Map.of(fieldPath(cause), invalidValueMessage(cause)));
        }
        return ResponseEntity.badRequest().body(problem);
    }

    private static String fieldPath(InvalidFormatException ex) {
        return ex.getPath().stream()
            .map(JacksonException.Reference::getPropertyName)
            .collect(Collectors.joining("."));
    }

    private static String invalidValueMessage(InvalidFormatException ex) {
        Class<?> targetType = ex.getTargetType();
        if (targetType.isEnum()) {
            return "must be one of " + Arrays.toString(targetType.getEnumConstants());
        }
        if (Temporal.class.isAssignableFrom(targetType)) {
            return "must be an ISO-8601 date-time with offset, e.g. 2030-01-01T09:00:00Z";
        }
        return "has an invalid value";
    }
}
