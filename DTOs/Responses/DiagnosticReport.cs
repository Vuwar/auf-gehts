namespace Api.DTOs.Responses;

public record DiagnosticReport(
    int WindowHours,
    DateTime SinceUtc,
    DiagnosticTotals Totals,
    List<DiagnosticFinding> Findings
);

public record DiagnosticTotals(
    long Requests,
    long SlowRequests,
    long Errors,
    double P50Ms,
    double P95Ms,
    double P99Ms,
    int ConcurrencyPeak
);

public record DiagnosticFinding(
    string Severity,
    string Category,
    string Title,
    string Summary,
    Dictionary<string, object?> Evidence
);
