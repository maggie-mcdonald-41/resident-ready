// test-runner.js
// Temporary file to simulate a diagnostic session without UI

(function runDiagnosticTest() {
  console.log("🚀 Running Doctor Dashboard Diagnostic Test...\n");

  // Simulated student answers (intentionally mixed performance)
  const studentAnswers = {
    dx001: "B", // correct
    dx002: "A", // correct
    dx003: "A", // wrong (should be B)
    dx004: "B", // correct
    dx005: "B", // wrong (should be C)
    dx006: "A", // correct
    dx007: "C", // wrong
    dx008: "A", // correct
    dx009: "B", // correct
    dx010: "A", // correct
    dx011: "A", // correct
    dx012: "A"  // wrong
  };

  // Step 1: Score attempt
  const scored = MED_RESULTS_ENGINE.scoreAttempt(
    MED_SAMPLE_QUESTIONS,
    studentAnswers
  );

  console.log("📊 SCORED ATTEMPT:");
  console.log(scored);

  // Step 2: Student Feedback
  const studentFeedback = MED_RESULTS_ENGINE.generateStudentFeedback(scored);

  console.log("\n🎓 STUDENT FEEDBACK:");
  console.log(studentFeedback);

  // Step 3: Faculty Summary
  const facultySummary = MED_RESULTS_ENGINE.generateFacultySummary(scored);

  console.log("\n👩‍⚕️ FACULTY SUMMARY:");
  console.log(facultySummary);
  console.log("📊 SCORED ATTEMPT:");
console.table(scored.results);

console.log("🎓 STUDENT FEEDBACK:");
console.log(studentFeedback.scoreLine);
console.log(studentFeedback.strengthsLine);
console.log(studentFeedback.weaknessesLine);
console.log(studentFeedback.errorPatternLine);

console.log("👩‍⚕️ FACULTY SUMMARY:");
console.table(facultySummary.bySystem);
console.table(facultySummary.byCompetency);
console.table(facultySummary.errorPatterns);

})();