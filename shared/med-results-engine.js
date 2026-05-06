// med-results-engine.js
// Core scoring, aggregation, and feedback logic for Doctor Dashboard.

window.MED_RESULTS_ENGINE = {
  scoreAttempt(questions, studentAnswers) {
    const results = questions.map((question) => {
      const selectedAnswer = studentAnswers[question.id] || null;
      const isCorrect = selectedAnswer === question.correctAnswer;

      const errorType = isCorrect
        ? null
        : question.errorMap?.[selectedAnswer] || "reasoningIssue";

return {
  questionId: question.id,
  selectedAnswer,
  correctAnswer: question.correctAnswer,
  isCorrect,
  errorType,
  tags: {
    ...question.tags,
    errorType: errorType ? [errorType] : [],
    distractorTrap: !isCorrect ? question.tags?.distractorTrap || [] : []
  },
  rationale: question.rationale,
  learningObjective: question.learningObjective,
  clinicalSkill: question.clinicalSkill
};
    });

    return {
      totalQuestions: results.length,
      correctCount: results.filter((r) => r.isCorrect).length,
      percentCorrect: Math.round(
        (results.filter((r) => r.isCorrect).length / results.length) * 100
      ),
      results
    };
  },

  aggregateByTag(results, tagGroup) {
    const summary = {};

    results.forEach((result) => {
      const tags = result.tags?.[tagGroup];
      if (!tags) return;

      const tagList = Array.isArray(tags) ? tags : [tags];

      tagList.forEach((tag) => {
        if (!summary[tag]) {
          summary[tag] = {
            tag,
            total: 0,
            correct: 0,
            incorrect: 0,
            percentCorrect: 0
          };
        }

        summary[tag].total += 1;

        if (result.isCorrect) {
          summary[tag].correct += 1;
        } else {
          summary[tag].incorrect += 1;
        }

        summary[tag].percentCorrect = Math.round(
          (summary[tag].correct / summary[tag].total) * 100
        );
      });
    });

    return Object.values(summary).sort(
      (a, b) => a.percentCorrect - b.percentCorrect
    );
  },

  aggregateNested(results, primaryTagGroup, secondaryTagGroup) {
    const nested = {};

    results.forEach((result) => {
      const primaryTags = result.tags?.[primaryTagGroup];
      const secondaryTags = result.tags?.[secondaryTagGroup];

      if (!primaryTags || !secondaryTags) return;

      const primaryList = Array.isArray(primaryTags) ? primaryTags : [primaryTags];
      const secondaryList = Array.isArray(secondaryTags) ? secondaryTags : [secondaryTags];

      primaryList.forEach((primary) => {
        if (!nested[primary]) {
          nested[primary] = {};
        }

        secondaryList.forEach((secondary) => {
          if (!nested[primary][secondary]) {
            nested[primary][secondary] = {
              primary,
              secondary,
              total: 0,
              correct: 0,
              incorrect: 0,
              percentCorrect: 0
            };
          }

          nested[primary][secondary].total += 1;

          if (result.isCorrect) {
            nested[primary][secondary].correct += 1;
          } else {
            nested[primary][secondary].incorrect += 1;
          }

          nested[primary][secondary].percentCorrect = Math.round(
            (nested[primary][secondary].correct /
              nested[primary][secondary].total) *
              100
          );
        });
      });
    });

    return nested;
  },

  aggregateErrors(results) {
    const errors = {};

    results.forEach((result) => {
      if (result.isCorrect || !result.errorType) return;

      if (!errors[result.errorType]) {
        errors[result.errorType] = {
          errorType: result.errorType,
          count: 0
        };
      }

      errors[result.errorType].count += 1;
    });

    return Object.values(errors).sort((a, b) => b.count - a.count);
  },

  getStrengthsAndWeaknesses(results) {
    const bySystem = this.aggregateByTag(results, "system");
    const byCompetency = this.aggregateByTag(results, "competency");

    const strengths = [...bySystem, ...byCompetency]
      .filter((item) => item.total >= 2 && item.percentCorrect >= 75)
      .sort((a, b) => b.percentCorrect - a.percentCorrect)
      .slice(0, 3);

    const weaknesses = [...bySystem, ...byCompetency]
      .filter((item) => item.total >= 2 && item.percentCorrect < 75)
      .sort((a, b) => a.percentCorrect - b.percentCorrect)
      .slice(0, 3);

    return { strengths, weaknesses };
  },

  generateStudentFeedback(scoredAttempt) {
    const catalog = window.MED_CONTENT_CATALOG;
    const results = scoredAttempt.results;

    const { strengths, weaknesses } = this.getStrengthsAndWeaknesses(results);
    const errorPatterns = this.aggregateErrors(results);

    const strongestText = strengths.length
      ? strengths
          .map((s) => this.getReadableTagLabel(s.tag))
          .join(", ")
      : "No clear strength pattern yet. Complete more questions to build a stronger profile.";

    const weakestText = weaknesses.length
      ? weaknesses
          .map((w) => this.getReadableTagLabel(w.tag))
          .join(", ")
      : "No major weak area appeared in this short diagnostic.";

    const topError = errorPatterns[0];
    const topErrorFeedback = topError
      ? catalog.errorTypes[topError.errorType]?.studentFriendly ||
        "Review your missed questions and look for patterns."
      : "You did not show a major error pattern in this attempt.";

    return {
      scoreLine: `You scored ${scoredAttempt.percentCorrect}% (${scoredAttempt.correctCount}/${scoredAttempt.totalQuestions}).`,
      strengthsLine: `Your strongest areas were: ${strongestText}.`,
      weaknessesLine: `Your best areas to review next are: ${weakestText}.`,
      errorPatternLine: topErrorFeedback,
      strengths,
      weaknesses,
      errorPatterns
    };
  },

  generateFacultySummary(scoredAttempt) {
    const results = scoredAttempt.results;

return {
  overall: {
    totalQuestions: scoredAttempt.totalQuestions,
    correctCount: scoredAttempt.correctCount,
    percentCorrect: scoredAttempt.percentCorrect
  },

  // Core medical performance
  bySystem: this.aggregateByTag(results, "system"),
  byTopic: this.aggregateByTag(results, "topic"),
  bySubtopic: this.aggregateByTag(results, "subtopic"),
  bySpecialty: this.aggregateByTag(results, "specialty"),

  // Board and residency alignment
  byExamTrack: this.aggregateByTag(results, "examTrack"),
  byResidentLevel: this.aggregateByTag(results, "residentLevel"),
  byAbfmBlueprint: this.aggregateByTag(results, "abfmBlueprint"),
  byComlexDomain: this.aggregateByTag(results, "comlexDomain"),
  byAcgmeCompetency: this.aggregateByTag(results, "acgmeCompetency"),

  // Clinical reasoning layers
  byClinicalDecision: this.aggregateByTag(results, "clinicalDecision"),
  byDiseaseStage: this.aggregateByTag(results, "diseaseStage"),
  byCarePhase: this.aggregateByTag(results, "carePhase"),
  byClinicalTask: this.aggregateByTag(results, "clinicalTask"),
  byCompetency: this.aggregateByTag(results, "competency"),

  // Context and risk
  byDifficulty: this.aggregateByTag(results, "difficulty"),
  byClinicalSetting: this.aggregateByTag(results, "clinicalSetting"),
  byPatientPopulation: this.aggregateByTag(results, "patientPopulation"),
  byAcuity: this.aggregateByTag(results, "acuity"),
  byBoardRelevance: this.aggregateByTag(results, "boardRelevance"),
  byGuidelineFocus: this.aggregateByTag(results, "guidelineFocus"),
  byOmtComponent: this.aggregateByTag(results, "omtComponent"),

  // Error and distractor analysis
  byErrorType: this.aggregateByTag(results, "errorType"),
  byDistractorTrap: this.aggregateByTag(results, "distractorTrap"),
  errorPatterns: this.aggregateErrors(results),

  // Useful faculty cross-tabs
  nestedSystemCompetency: this.aggregateNested(results, "system", "competency"),
  nestedSystemClinicalDecision: this.aggregateNested(results, "system", "clinicalDecision"),
  nestedAbfmClinicalDecision: this.aggregateNested(results, "abfmBlueprint", "clinicalDecision"),
  nestedComlexDomainClinicalDecision: this.aggregateNested(results, "comlexDomain", "clinicalDecision"),
  nestedAcuityErrorType: this.aggregateNested(results, "acuity", "errorType")
};
  },

getReadableTagLabel(tag) {
  const catalog = window.MED_CONTENT_CATALOG;

  return (
    catalog.systems?.[tag]?.label ||
    catalog.topics?.[tag]?.label ||
    catalog.competencies?.[tag]?.label ||
    catalog.specialties?.[tag] ||
    catalog.clinicalSettings?.[tag] ||
    catalog.difficulty?.[tag]?.label ||
    catalog.errorTypes?.[tag]?.label ||

    // NEW LOOKUPS
    catalog.abfmBlueprint?.[tag]?.label ||
    catalog.comlexDomain?.[tag]?.label ||
    catalog.acgmeCompetency?.[tag]?.label ||
    catalog.clinicalDecision?.[tag]?.label ||
    catalog.diseaseStage?.[tag]?.label ||
    catalog.carePhase?.[tag]?.label ||
    catalog.clinicalTask?.[tag]?.label ||
    catalog.patientPopulation?.[tag] ||
    catalog.acuity?.[tag]?.label ||
    catalog.boardRelevance?.[tag]?.label ||
    catalog.distractorTrap?.[tag]?.label ||

    tag
  );
}
};