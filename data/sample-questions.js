// sample-questions.js
// Starter diagnostic question set for Doctor Dashboard.
// These are original sample questions for prototype development only.

window.MED_SAMPLE_QUESTIONS = [
  {
    id: "dx001",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 58-year-old man presents with substernal chest pressure radiating to his left arm. The pain began 45 minutes ago while walking. He is diaphoretic and nauseated. ECG shows ST-segment elevation in leads II, III, and aVF. What is the best next step in management?",
    choices: [
      { id: "A", text: "Schedule an outpatient stress test" },
      { id: "B", text: "Begin immediate reperfusion therapy" },
      { id: "C", text: "Order a CT angiogram of the chest" },
      { id: "D", text: "Give a proton pump inhibitor and observe" }
    ],
    correctAnswer: "B",
    rationale:
      "This patient has an inferior STEMI. The priority is immediate reperfusion therapy, typically PCI if available within the appropriate time window.",
    choiceRationales: {
      A: "A stress test is inappropriate in an acute STEMI.",
      B: "Correct. STEMI requires immediate reperfusion therapy.",
      C: "CT angiography may be useful for suspected aortic dissection or PE, but the ECG confirms STEMI.",
      D: "GI treatment would delay life-saving cardiac care."
    },
    tags: {
      specialty: ["internalMedicine", "emergencyMedicine", "familyMedicine"],
      system: ["cardiovascular"],
      topic: ["acuteCoronarySyndrome"],
      subtopic: ["stemiManagement"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["emergentUrgentCare", "acuteCareDiagnosis"],
      comlexDomain: ["applicationOfKnowledge", "patientCare"],
      acgmeCompetency: ["patientCare", "medicalKnowledge"],

      clinicalDecision: "nextBestStep",
      diseaseStage: "acute",
      carePhase: "initialManagement",
      clinicalTask: "recognizeEmergencyAndTreat",

      competency: ["management", "emergencyCare", "diagnosticInterpretation"],
      errorType: ["managementPriority", "diagnosticTestingError", "missedKeyFinding"],
      distractorTrap: ["delayedTreatment", "overTesting", "anchoringOnNonCardiacCause"],

      clinicalSetting: ["emergencyDepartment"],
      patientPopulation: ["adult", "olderAdult"],
      acuity: "emergent",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: true,
      omtComponent: false
    },
    learningObjective:
      "Recognize STEMI and prioritize immediate reperfusion therapy.",
    clinicalSkill:
      "Identify time-sensitive acute coronary syndrome management from ECG and symptom presentation.",
    errorMap: {
      A: "managementPriority",
      C: "diagnosticTestingError",
      D: "missedKeyFinding"
    }
  },

  {
    id: "dx002",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 67-year-old woman with COPD presents with worsening dyspnea, increased sputum production, and wheezing. Oxygen saturation is 86% on room air. Which treatment is most appropriate initially?",
    choices: [
      { id: "A", text: "Inhaled bronchodilators, systemic corticosteroids, and controlled oxygen therapy" },
      { id: "B", text: "Immediate discharge with outpatient pulmonology follow-up" },
      { id: "C", text: "High-flow oxygen without monitoring carbon dioxide retention" },
      { id: "D", text: "Anticoagulation as first-line therapy" }
    ],
    correctAnswer: "A",
    rationale:
      "COPD exacerbation is treated initially with bronchodilators, systemic steroids, and controlled oxygen. Antibiotics may be added depending on sputum and severity.",
    choiceRationales: {
      A: "Correct. This addresses bronchospasm, inflammation, and hypoxemia.",
      B: "She is hypoxemic and needs acute treatment.",
      C: "Oxygen is needed, but it should be titrated and monitored.",
      D: "Anticoagulation is not first-line unless PE is strongly suspected."
    },
    tags: {
      specialty: ["internalMedicine", "emergencyMedicine", "familyMedicine"],
      system: ["respiratory"],
      topic: ["copd"],
      subtopic: ["copdExacerbation"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["emergentUrgentCare", "chronicCareManagement"],
      comlexDomain: ["applicationOfKnowledge", "patientCare"],
      acgmeCompetency: ["patientCare", "medicalKnowledge"],

      clinicalDecision: "initialManagement",
      diseaseStage: "acuteExacerbation",
      carePhase: "initialTreatment",
      clinicalTask: "stabilizeRespiratoryExacerbation",

      competency: ["management", "emergencyCare", "chronicDiseaseManagement"],
      errorType: ["managementPriority", "reasoningIssue", "missedKeyFinding"],
      distractorTrap: ["unsafeDischarge", "oxygenMismanagement", "wrongDiseasePathway"],

      clinicalSetting: ["emergencyDepartment", "inpatient"],
      patientPopulation: ["olderAdult"],
      acuity: "urgent",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: true,
      omtComponent: false
    },
    learningObjective:
      "Manage an acute COPD exacerbation with bronchodilators, systemic steroids, and controlled oxygen.",
    clinicalSkill:
      "Recognize hypoxemic COPD exacerbation and select appropriate initial therapy.",
    errorMap: {
      B: "managementPriority",
      C: "reasoningIssue",
      D: "missedKeyFinding"
    }
  },

  {
    id: "dx003",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 24-year-old woman has palpitations, heat intolerance, weight loss, and a diffusely enlarged thyroid. TSH is low and free T4 is elevated. Which diagnosis is most likely?",
    choices: [
      { id: "A", text: "Hashimoto thyroiditis" },
      { id: "B", text: "Graves disease" },
      { id: "C", text: "Primary hypothyroidism" },
      { id: "D", text: "Subclinical hypothyroidism" }
    ],
    correctAnswer: "B",
    rationale:
      "Low TSH with elevated free T4 indicates hyperthyroidism. Diffuse goiter and symptoms of thyrotoxicosis are consistent with Graves disease.",
    choiceRationales: {
      A: "Hashimoto thyroiditis usually causes hypothyroidism, though transient hyperthyroidism can occur.",
      B: "Correct. Graves disease is a common cause of hyperthyroidism with diffuse goiter.",
      C: "Primary hypothyroidism typically has high TSH and low free T4.",
      D: "Subclinical hypothyroidism has high TSH with normal free T4."
    },
    tags: {
      specialty: ["internalMedicine", "familyMedicine"],
      system: ["endocrine"],
      topic: ["thyroidDisease"],
      subtopic: ["gravesDisease", "hyperthyroidism"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["acuteCareDiagnosis", "chronicCareManagement"],
      comlexDomain: ["applicationOfKnowledge", "patientCare"],
      acgmeCompetency: ["medicalKnowledge", "patientCare"],

      clinicalDecision: "diagnosis",
      diseaseStage: "presentation",
      carePhase: "diagnosticEvaluation",
      clinicalTask: "interpretEndocrineLabsAndSymptoms",

      competency: ["diagnosis", "labInterpretation"],
      errorType: ["knowledgeGap", "diagnosticTestingError"],
      distractorTrap: ["confusesHyperthyroidAndHypothyroidStates", "misreadsTshPattern"],

      clinicalSetting: ["outpatientClinic"],
      patientPopulation: ["adult"],
      acuity: "routine",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: false,
      omtComponent: false
    },
    learningObjective:
      "Interpret thyroid function testing and recognize Graves disease as a cause of hyperthyroidism.",
    clinicalSkill:
      "Connect symptoms of thyrotoxicosis with low TSH and elevated free T4.",
    errorMap: {
      A: "knowledgeGap",
      C: "knowledgeGap",
      D: "diagnosticTestingError"
    }
  },

  {
    id: "dx004",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 72-year-old man presents with fever, productive cough, confusion, blood pressure 86/54 mmHg, and respiratory rate 30/min. Chest x-ray shows a right lower-lobe infiltrate. What is the most appropriate next step?",
    choices: [
      { id: "A", text: "Oral antibiotics and discharge home" },
      { id: "B", text: "Hospital admission with IV antibiotics and sepsis management" },
      { id: "C", text: "Repeat chest x-ray in 6 weeks only" },
      { id: "D", text: "Inhaled corticosteroids only" }
    ],
    correctAnswer: "B",
    rationale:
      "This patient has pneumonia with signs of sepsis and instability. He requires inpatient care, IV antibiotics, fluids, and close monitoring.",
    choiceRationales: {
      A: "He is unstable and not appropriate for outpatient treatment.",
      B: "Correct. Pneumonia with hypotension and confusion requires urgent inpatient management.",
      C: "Follow-up imaging may be considered later but is not the immediate priority.",
      D: "Inhaled steroids do not treat bacterial pneumonia or sepsis."
    },
    tags: {
      specialty: ["internalMedicine", "emergencyMedicine", "familyMedicine"],
      system: ["respiratory", "infectiousDisease"],
      topic: ["pneumonia", "sepsis"],
      subtopic: ["communityAcquiredPneumonia", "sepsisRecognition"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["emergentUrgentCare", "acuteCareDiagnosis"],
      comlexDomain: ["applicationOfKnowledge", "patientCare", "systemsBasedPractice"],
      acgmeCompetency: ["patientCare", "medicalKnowledge", "systemsBasedPractice"],

      clinicalDecision: "riskStratification",
      diseaseStage: "acute",
      carePhase: "triageAndDisposition",
      clinicalTask: "recognizeSevereInfectionAndEscalateCare",

      competency: ["management", "emergencyCare", "riskStratification"],
      errorType: ["managementPriority", "knowledgeGap"],
      distractorTrap: ["unsafeDischarge", "delayedTreatment", "underRecognizesSepsis"],

      clinicalSetting: ["emergencyDepartment", "inpatient"],
      patientPopulation: ["olderAdult"],
      acuity: "emergent",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: true,
      omtComponent: false
    },
    learningObjective:
      "Recognize pneumonia with sepsis features and select inpatient management.",
    clinicalSkill:
      "Identify instability and escalate care for pneumonia complicated by hypotension and confusion.",
    errorMap: {
      A: "managementPriority",
      C: "managementPriority",
      D: "knowledgeGap"
    }
  },

  {
    id: "dx005",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 45-year-old woman has epigastric abdominal pain radiating to the back, nausea, and vomiting. Lipase is elevated. Which finding would most strongly suggest gallstone pancreatitis?",
    choices: [
      { id: "A", text: "Elevated triglycerides" },
      { id: "B", text: "Heavy alcohol use" },
      { id: "C", text: "Elevated ALT and gallstones on ultrasound" },
      { id: "D", text: "Positive stool occult blood test" }
    ],
    correctAnswer: "C",
    rationale:
      "Gallstones are a common cause of acute pancreatitis. Elevated ALT and gallstones on ultrasound support biliary pancreatitis.",
    choiceRationales: {
      A: "Hypertriglyceridemia can cause pancreatitis but does not suggest gallstone pancreatitis.",
      B: "Alcohol is another common cause but does not indicate gallstones.",
      C: "Correct. Ultrasound evidence of gallstones with liver enzyme elevation supports biliary etiology.",
      D: "Occult GI bleeding does not explain pancreatitis."
    },
    tags: {
      specialty: ["internalMedicine", "emergencyMedicine", "familyMedicine"],
      system: ["gastrointestinal"],
      topic: ["pancreatitis"],
      subtopic: ["gallstonePancreatitis", "biliaryDisease"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["acuteCareDiagnosis"],
      comlexDomain: ["applicationOfKnowledge", "patientCare"],
      acgmeCompetency: ["medicalKnowledge", "patientCare"],

      clinicalDecision: "diagnosis",
      diseaseStage: "acute",
      carePhase: "diagnosticEvaluation",
      clinicalTask: "differentiateEtiologyUsingLabsAndImaging",

      competency: ["diagnosis", "diagnosticTesting", "clinicalReasoning"],
      errorType: ["reasoningIssue", "missedKeyFinding"],
      distractorTrap: ["confusesEtiology", "ignoresSupportingImaging", "overWeightsAlternateCause"],

      clinicalSetting: ["emergencyDepartment", "inpatient"],
      patientPopulation: ["adult"],
      acuity: "urgent",
      difficulty: "foundational",

      boardRelevance: "medium",
      guidelineFocus: false,
      omtComponent: false
    },
    learningObjective:
      "Identify evidence supporting gallstone pancreatitis in a patient with acute pancreatitis.",
    clinicalSkill:
      "Use laboratory and ultrasound findings to determine the likely cause of pancreatitis.",
    errorMap: {
      A: "reasoningIssue",
      B: "reasoningIssue",
      D: "missedKeyFinding"
    }
  },

  {
    id: "dx006",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 9-year-old boy has fever, sore throat, tonsillar exudates, and tender anterior cervical lymphadenopathy. Rapid strep test is positive. Which treatment is appropriate?",
    choices: [
      { id: "A", text: "Amoxicillin" },
      { id: "B", text: "Oseltamivir" },
      { id: "C", text: "No treatment because this is viral" },
      { id: "D", text: "Inhaled albuterol" }
    ],
    correctAnswer: "A",
    rationale:
      "Group A streptococcal pharyngitis is treated with penicillin or amoxicillin to reduce symptoms, transmission, and complications.",
    choiceRationales: {
      A: "Correct. Amoxicillin is appropriate for confirmed strep pharyngitis.",
      B: "Oseltamivir treats influenza, not strep pharyngitis.",
      C: "A positive rapid strep test supports bacterial infection.",
      D: "Albuterol treats bronchospasm, not pharyngitis."
    },
    tags: {
      specialty: ["pediatrics", "familyMedicine"],
      system: ["infectiousDisease", "ent"],
      topic: ["pharyngitis"],
      subtopic: ["groupAStrep"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["acuteCareDiagnosis", "foundationsOfCare"],
      comlexDomain: ["applicationOfKnowledge", "patientCare"],
      acgmeCompetency: ["patientCare", "medicalKnowledge"],

      clinicalDecision: "pharmacotherapy",
      diseaseStage: "acute",
      carePhase: "treatmentSelection",
      clinicalTask: "selectFirstLineAntibiotic",

      competency: ["management", "pharmacology", "infectiousDiseaseTreatment"],
      errorType: ["pharmacologyError", "knowledgeGap"],
      distractorTrap: ["treatsWrongPathogen", "missesPositiveTest", "confusesRespiratoryMedicationUse"],

      clinicalSetting: ["outpatientClinic", "urgentCare"],
      patientPopulation: ["pediatric"],
      acuity: "routine",
      difficulty: "foundational",

      boardRelevance: "medium",
      guidelineFocus: true,
      omtComponent: false
    },
    learningObjective:
      "Treat confirmed group A streptococcal pharyngitis with appropriate antibiotic therapy.",
    clinicalSkill:
      "Differentiate bacterial strep pharyngitis from viral causes and select first-line treatment.",
    errorMap: {
      B: "pharmacologyError",
      C: "knowledgeGap",
      D: "knowledgeGap"
    }
  },

  {
    id: "dx007",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 32-year-old pregnant patient at 34 weeks has severe headache, visual changes, blood pressure 168/112 mmHg, and proteinuria. What is the most appropriate diagnosis?",
    choices: [
      { id: "A", text: "Gestational hypertension without severe features" },
      { id: "B", text: "Preeclampsia with severe features" },
      { id: "C", text: "Normal third-trimester symptoms" },
      { id: "D", text: "Hyperemesis gravidarum" }
    ],
    correctAnswer: "B",
    rationale:
      "Severe hypertension with headache, visual symptoms, and proteinuria after 20 weeks is consistent with preeclampsia with severe features.",
    choiceRationales: {
      A: "This patient has severe features and proteinuria.",
      B: "Correct. Severe-range blood pressure and neurologic symptoms indicate severe features.",
      C: "These symptoms are not normal and require urgent evaluation.",
      D: "Hyperemesis causes severe nausea/vomiting, usually earlier in pregnancy."
    },
    tags: {
      specialty: ["obstetricsGynecology", "familyMedicine", "emergencyMedicine"],
      system: ["obstetrics"],
      topic: ["hypertensiveDisordersOfPregnancy"],
      subtopic: ["preeclampsiaWithSevereFeatures"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["emergentUrgentCare", "acuteCareDiagnosis"],
      comlexDomain: ["applicationOfKnowledge", "patientCare"],
      acgmeCompetency: ["patientCare", "medicalKnowledge"],

      clinicalDecision: "diagnosis",
      diseaseStage: "acute",
      carePhase: "diagnosticRecognition",
      clinicalTask: "identifyPregnancyEmergency",

      competency: ["diagnosis", "emergencyCare", "riskStratification"],
      errorType: ["missedKeyFinding", "managementPriority", "knowledgeGap"],
      distractorTrap: ["underRecognizesSeverity", "normalizesDangerSymptoms", "confusesPregnancyConditions"],

      clinicalSetting: ["emergencyDepartment", "laborAndDelivery"],
      patientPopulation: ["pregnantAdult"],
      acuity: "emergent",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: true,
      omtComponent: false
    },
    learningObjective:
      "Recognize preeclampsia with severe features based on blood pressure, proteinuria, and neurologic symptoms.",
    clinicalSkill:
      "Distinguish severe hypertensive disease of pregnancy from uncomplicated gestational hypertension.",
    errorMap: {
      A: "missedKeyFinding",
      C: "managementPriority",
      D: "knowledgeGap"
    }
  },

  {
    id: "dx008",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 61-year-old man with type 2 diabetes has an A1c of 9.4% despite lifestyle changes and metformin. He also has established atherosclerotic cardiovascular disease. Which medication class would provide glucose-lowering benefit and cardiovascular benefit?",
    choices: [
      { id: "A", text: "GLP-1 receptor agonist" },
      { id: "B", text: "Short course of antibiotics" },
      { id: "C", text: "Loop diuretic only" },
      { id: "D", text: "High-dose NSAID" }
    ],
    correctAnswer: "A",
    rationale:
      "Certain GLP-1 receptor agonists provide glycemic control and cardiovascular benefit in patients with type 2 diabetes and ASCVD.",
    choiceRationales: {
      A: "Correct. GLP-1 receptor agonists are appropriate in many patients with T2DM and ASCVD.",
      B: "Antibiotics do not treat hyperglycemia or cardiovascular risk.",
      C: "Loop diuretics do not manage diabetes.",
      D: "NSAIDs do not improve diabetes control and may add risk."
    },
    tags: {
      specialty: ["internalMedicine", "familyMedicine"],
      system: ["endocrine", "cardiovascular"],
      topic: ["diabetesMellitus", "cardiovascularRiskReduction"],
      subtopic: ["type2Diabetes", "glp1ReceptorAgonist", "ascvd"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["chronicCareManagement", "preventiveCare"],
      comlexDomain: ["applicationOfKnowledge", "patientCare", "systemsBasedPractice"],
      acgmeCompetency: ["patientCare", "medicalKnowledge", "systemsBasedPractice"],

      clinicalDecision: "longTermManagement",
      diseaseStage: "chronic",
      carePhase: "medicationOptimization",
      clinicalTask: "selectMedicationWithComorbidityBenefit",

      competency: ["management", "pharmacology", "chronicDiseaseManagement"],
      errorType: ["knowledgeGap", "pharmacologyError"],
      distractorTrap: ["ignoresComorbidity", "choosesNonTherapeuticMedication", "missesCardiovascularBenefit"],

      clinicalSetting: ["outpatientClinic"],
      patientPopulation: ["olderAdult"],
      acuity: "routine",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: true,
      omtComponent: false
    },
    learningObjective:
      "Select diabetes therapy that improves glycemic control and cardiovascular outcomes in a patient with ASCVD.",
    clinicalSkill:
      "Apply chronic disease management principles to diabetes with cardiovascular comorbidity.",
    errorMap: {
      B: "knowledgeGap",
      C: "pharmacologyError",
      D: "pharmacologyError"
    }
  },

  {
    id: "dx009",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A patient with acute low back pain has no fever, neurologic deficit, trauma, cancer history, or bowel/bladder dysfunction. Which approach is most appropriate initially?",
    choices: [
      { id: "A", text: "Immediate MRI for all patients" },
      { id: "B", text: "Conservative management with activity as tolerated and follow-up" },
      { id: "C", text: "Emergency spinal surgery consult" },
      { id: "D", text: "Long-term opioid therapy as first-line treatment" }
    ],
    correctAnswer: "B",
    rationale:
      "Uncomplicated acute low back pain without red flags is usually managed conservatively with activity, non-opioid analgesia when appropriate, education, and follow-up.",
    choiceRationales: {
      A: "Imaging is not routinely needed without red flags.",
      B: "Correct. Conservative care is appropriate initially.",
      C: "Surgery is not indicated without red flags or neurologic compromise.",
      D: "Long-term opioids are not first-line for uncomplicated acute low back pain."
    },
    tags: {
      specialty: ["familyMedicine", "internalMedicine", "osteopathicMedicine"],
      system: ["musculoskeletal"],
      topic: ["lowBackPain"],
      subtopic: ["uncomplicatedAcuteLowBackPain", "redFlagScreening"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP", "ISE_CORTEX"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["acuteCareDiagnosis", "foundationsOfCare"],
      comlexDomain: ["applicationOfKnowledge", "patientCare", "osteopathicPrinciples"],
      acgmeCompetency: ["patientCare", "medicalKnowledge", "systemsBasedPractice"],

      clinicalDecision: "initialManagement",
      diseaseStage: "acute",
      carePhase: "initialEvaluation",
      clinicalTask: "avoidUnnecessaryImagingAndTreatConservatively",

      competency: ["management", "diagnosticStewardship", "patientCounseling"],
      errorType: ["diagnosticTestingError", "managementPriority", "pharmacologyError"],
      distractorTrap: ["overTesting", "unnecessaryReferral", "unsafeOpioidUse"],

      clinicalSetting: ["outpatientClinic", "urgentCare"],
      patientPopulation: ["adult"],
      acuity: "routine",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: true,
      omtComponent: true
    },
    learningObjective:
      "Manage uncomplicated acute low back pain conservatively when red flags are absent.",
    clinicalSkill:
      "Use red-flag screening to avoid unnecessary imaging and select safe initial management.",
    errorMap: {
      A: "diagnosticTestingError",
      C: "managementPriority",
      D: "pharmacologyError"
    }
  },

  {
    id: "dx010",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 70-year-old patient presents with sudden left-sided weakness and facial droop that began 45 minutes ago. Blood glucose is normal. What is the most appropriate next step?",
    choices: [
      { id: "A", text: "Noncontrast CT head and urgent stroke evaluation" },
      { id: "B", text: "Outpatient neurology referral" },
      { id: "C", text: "Reassurance and discharge" },
      { id: "D", text: "Delay evaluation until symptoms persist for 24 hours" }
    ],
    correctAnswer: "A",
    rationale:
      "Acute focal neurologic deficits require urgent stroke evaluation. Noncontrast CT helps assess for hemorrhage and treatment eligibility.",
    choiceRationales: {
      A: "Correct. This is a time-sensitive possible stroke.",
      B: "Outpatient referral is inappropriate for acute stroke symptoms.",
      C: "New focal deficits require emergency evaluation.",
      D: "Waiting delays time-sensitive treatment."
    },
    tags: {
      specialty: ["emergencyMedicine", "internalMedicine", "familyMedicine"],
      system: ["neurology"],
      topic: ["stroke"],
      subtopic: ["acuteIschemicStrokeEvaluation"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["emergentUrgentCare", "acuteCareDiagnosis"],
      comlexDomain: ["applicationOfKnowledge", "patientCare", "systemsBasedPractice"],
      acgmeCompetency: ["patientCare", "medicalKnowledge", "systemsBasedPractice"],

      clinicalDecision: "nextBestStep",
      diseaseStage: "acute",
      carePhase: "initialEvaluation",
      clinicalTask: "recognizeTimeSensitiveNeurologicEmergency",

      competency: ["management", "emergencyCare", "diagnosticTesting"],
      errorType: ["managementPriority", "missedKeyFinding"],
      distractorTrap: ["delayedTreatment", "unsafeDischarge", "underTriage"],

      clinicalSetting: ["emergencyDepartment"],
      patientPopulation: ["olderAdult"],
      acuity: "emergent",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: true,
      omtComponent: false
    },
    learningObjective:
      "Recognize acute stroke symptoms and initiate urgent stroke evaluation.",
    clinicalSkill:
      "Prioritize time-sensitive evaluation for sudden focal neurologic deficits.",
    errorMap: {
      B: "managementPriority",
      C: "missedKeyFinding",
      D: "managementPriority"
    }
  },

  {
    id: "dx011",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A 28-year-old woman has dysuria, urinary frequency, and no flank pain or fever. Urinalysis shows leukocyte esterase and nitrites. Which diagnosis is most likely?",
    choices: [
      { id: "A", text: "Acute uncomplicated cystitis" },
      { id: "B", text: "Acute pyelonephritis" },
      { id: "C", text: "Nephrolithiasis with obstruction" },
      { id: "D", text: "Pelvic inflammatory disease" }
    ],
    correctAnswer: "A",
    rationale:
      "Dysuria and frequency with nitrites and leukocyte esterase, without fever or flank pain, are most consistent with acute uncomplicated cystitis.",
    choiceRationales: {
      A: "Correct. This presentation fits lower urinary tract infection.",
      B: "Pyelonephritis usually includes fever, flank pain, or systemic symptoms.",
      C: "Stones often cause colicky flank pain and hematuria.",
      D: "PID usually includes pelvic pain, cervical motion tenderness, or vaginal discharge."
    },
    tags: {
      specialty: ["familyMedicine", "internalMedicine", "obstetricsGynecology"],
      system: ["genitourinary", "infectiousDisease"],
      topic: ["urinaryTractInfection"],
      subtopic: ["acuteUncomplicatedCystitis"],

      examTrack: ["COMLEX_LEVEL_3", "USMLE_STEP_3", "ITE", "ABFM", "AOBFP"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["acuteCareDiagnosis", "foundationsOfCare"],
      comlexDomain: ["applicationOfKnowledge", "patientCare"],
      acgmeCompetency: ["medicalKnowledge", "patientCare"],

      clinicalDecision: "diagnosis",
      diseaseStage: "acute",
      carePhase: "diagnosticEvaluation",
      clinicalTask: "differentiateLowerUrinaryTractInfection",

      competency: ["diagnosis", "diagnosticTesting", "clinicalReasoning"],
      errorType: ["missedKeyFinding", "reasoningIssue"],
      distractorTrap: ["confusesUpperAndLowerUti", "overWeightsAlternateDiagnosis", "missesAbsenceOfSystemicSymptoms"],

      clinicalSetting: ["outpatientClinic", "urgentCare"],
      patientPopulation: ["adult"],
      acuity: "routine",
      difficulty: "foundational",

      boardRelevance: "medium",
      guidelineFocus: true,
      omtComponent: false
    },
    learningObjective:
      "Diagnose acute uncomplicated cystitis using symptoms and urinalysis findings.",
    clinicalSkill:
      "Differentiate lower urinary tract infection from pyelonephritis, stones, and pelvic infection.",
    errorMap: {
      B: "missedKeyFinding",
      C: "reasoningIssue",
      D: "reasoningIssue"
    }
  },

  {
    id: "dx012",
    setId: "comlex-level-3-diagnostic-core-001",
    type: "multiple_choice",
    questionStem:
      "A patient asks whether osteopathic manipulative treatment is appropriate for acute low back pain. The patient has fever, midline spinal tenderness, and a history of IV drug use. What is the best response?",
    choices: [
      { id: "A", text: "Proceed with high-velocity low-amplitude manipulation immediately" },
      { id: "B", text: "Evaluate for serious underlying pathology before manipulation" },
      { id: "C", text: "Reassure the patient that infection is impossible" },
      { id: "D", text: "Treat only with stretching and no further evaluation" }
    ],
    correctAnswer: "B",
    rationale:
      "Fever, spinal tenderness, and IV drug use are red flags for spinal infection. Serious pathology should be evaluated before OMT.",
    choiceRationales: {
      A: "Manipulation should not proceed before red flags are evaluated.",
      B: "Correct. Red flags require workup before OMT.",
      C: "Infection is possible and must be considered.",
      D: "Stretching alone would miss a potentially serious condition."
    },
    tags: {
      specialty: ["osteopathicMedicine", "familyMedicine"],
      system: ["musculoskeletal", "osteopathicPrinciples"],
      topic: ["omtSafety", "lowBackPain"],
      subtopic: ["omtContraindications", "redFlagScreening"],

      examTrack: ["COMLEX_LEVEL_3", "AOBFP", "ISE_CORTEX"],
      residentLevel: ["PGY1", "PGY2", "PGY3"],

      abfmBlueprint: ["acuteCareDiagnosis", "foundationsOfCare"],
      comlexDomain: ["osteopathicPrinciples", "patientCare", "applicationOfKnowledge"],
      acgmeCompetency: ["patientCare", "medicalKnowledge", "professionalism"],

      clinicalDecision: "patientSafety",
      diseaseStage: "acute",
      carePhase: "preTreatmentSafetyScreening",
      clinicalTask: "identifyContraindicationBeforeManipulation",

      competency: ["management", "patientSafety", "osteopathicPrinciples"],
      errorType: ["managementPriority", "knowledgeGap", "missedKeyFinding"],
      distractorTrap: ["missedRedFlag", "unsafeManipulation", "prematureTreatment"],

      clinicalSetting: ["outpatientClinic", "urgentCare"],
      patientPopulation: ["adult"],
      acuity: "urgent",
      difficulty: "foundational",

      boardRelevance: "high",
      guidelineFocus: true,
      omtComponent: true
    },
    learningObjective:
      "Identify red flags that require evaluation before osteopathic manipulative treatment.",
    clinicalSkill:
      "Apply OMT safety principles by screening for serious pathology before manipulation.",
    errorMap: {
      A: "managementPriority",
      C: "knowledgeGap",
      D: "missedKeyFinding"
    }
  }
];