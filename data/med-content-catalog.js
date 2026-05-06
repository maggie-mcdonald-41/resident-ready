// med-content-catalog.js
// Shared medical content catalog for Doctor Dashboard.
// This works like your standards-catalog.js, but for medical systems, competencies,
// specialties, clinical settings, difficulty levels, and error types.

window.MED_CONTENT_CATALOG = {
  topics: {
  acuteCoronarySyndrome: {
    label: "Acute Coronary Syndrome",
    system: "cardiovascular"
  },
  stemiManagement: {
    label: "STEMI Management",
    system: "cardiovascular",
    parentTopic: "acuteCoronarySyndrome"
  },
  copdExacerbation: {
    label: "COPD Exacerbation",
    system: "respiratory"
  },
  thyroidDisorders: {
    label: "Thyroid Disorders",
    system: "endocrine"
  },
  pneumoniaSepsis: {
    label: "Pneumonia with Sepsis",
    system: "respiratory"
  },
  pancreatitisEtiology: {
    label: "Pancreatitis Etiology",
    system: "gastrointestinal"
  },
  strepPharyngitis: {
    label: "Strep Pharyngitis",
    system: "infectiousDisease"
  },
  hypertensiveDisordersPregnancy: {
    label: "Hypertensive Disorders of Pregnancy",
    system: "obgyn"
  },
  diabetesCardiovascularRisk: {
    label: "Diabetes with Cardiovascular Risk",
    system: "endocrine"
  },
  lowBackPainRedFlags: {
    label: "Low Back Pain Red Flags",
    system: "osteopathicPrinciples"
  },
  acuteStrokeEvaluation: {
    label: "Acute Stroke Evaluation",
    system: "cardiovascular"
  },
  uncomplicatedCystitis: {
    label: "Uncomplicated Cystitis",
    system: "infectiousDisease"
  },
  omtContraindications: {
    label: "OMT Contraindications",
    system: "osteopathicPrinciples"
  }
},
  
  systems: {
    cardiovascular: {
      label: "Cardiovascular",
      description: "Heart, blood vessels, circulation, shock, hypertension, arrhythmias, and cardiac emergencies."
    },
    respiratory: {
      label: "Respiratory",
      description: "Pulmonary disease, oxygenation, ventilation, asthma, COPD, pneumonia, PE, and respiratory failure."
    },
    gastrointestinal: {
      label: "Gastrointestinal",
      description: "Abdominal pain, liver disease, bowel disorders, bleeding, nutrition, and GI emergencies."
    },
    endocrine: {
      label: "Endocrine",
      description: "Diabetes, thyroid disease, adrenal disorders, electrolytes, and metabolic conditions."
    },
    infectiousDisease: {
      label: "Infectious Disease",
      description: "Bacterial, viral, fungal, and parasitic infections, antibiotics, sepsis, and prevention."
    },
    pediatrics: {
      label: "Pediatrics",
      description: "Growth, development, pediatric emergencies, congenital conditions, and age-specific care."
    },
    obgyn: {
      label: "Obstetrics & Gynecology",
      description: "Pregnancy, postpartum care, gynecologic conditions, screening, and reproductive health."
    },
    osteopathicPrinciples: {
      label: "Osteopathic Principles",
      description: "OMM, osteopathic diagnosis, somatic dysfunction, contraindications, and patient-centered care."
    }
  },

  competencies: {
    diagnosis: {
      label: "Diagnosis",
      studentFriendly: "Choosing the most likely condition based on the patient’s presentation."
    },
    management: {
      label: "Management",
      studentFriendly: "Choosing the best next step in treatment or patient care."
    },
    clinicalReasoning: {
      label: "Clinical Reasoning",
      studentFriendly: "Connecting symptoms, findings, risks, and test results to make a sound clinical decision."
    },
    pharmacology: {
      label: "Pharmacology",
      studentFriendly: "Understanding medications, mechanisms, side effects, contraindications, and safe prescribing."
    },
    diagnosticsTesting: {
      label: "Diagnostic Testing",
      studentFriendly: "Choosing or interpreting labs, imaging, screening tools, or procedures."
    },
    preventionScreening: {
      label: "Prevention & Screening",
      studentFriendly: "Using evidence-based prevention, counseling, vaccination, or screening recommendations."
    },
    emergencyCare: {
      label: "Emergency Care",
      studentFriendly: "Recognizing and responding to urgent or life-threatening conditions."
    },
    ethicsProfessionalism: {
      label: "Ethics & Professionalism",
      studentFriendly: "Making patient-centered, ethical, legal, and professional decisions."
    }
  },

  specialties: {
    familyMedicine: "Family Medicine",
    internalMedicine: "Internal Medicine",
    emergencyMedicine: "Emergency Medicine",
    pediatrics: "Pediatrics",
    surgery: "Surgery",
    obgyn: "OB/GYN",
    psychiatry: "Psychiatry"
  },

  clinicalSettings: {
    outpatient: "Outpatient Clinic",
    emergencyDepartment: "Emergency Department",
    inpatient: "Inpatient Hospital",
    icu: "ICU",
    urgentCare: "Urgent Care",
    operatingRoom: "Operating Room",
    laborDelivery: "Labor & Delivery"
  },

  difficulty: {
    foundational: {
      label: "Foundational",
      description: "Core knowledge and common presentations."
    },
    intermediate: {
      label: "Intermediate",
      description: "Requires application of knowledge to a clinical scenario."
    },
    advanced: {
      label: "Advanced",
      description: "Requires prioritization, nuance, or management of competing risks."
    }
  },

  errorTypes: {
    knowledgeGap: {
      label: "Knowledge Gap",
      studentFriendly: "You may need to review the core medical fact or concept behind this question.",
      facultyDescription: "The learner likely missed foundational content knowledge."
    },
    reasoningIssue: {
      label: "Clinical Reasoning Issue",
      studentFriendly: "You may have known some facts but had trouble connecting them to the clinical picture.",
      facultyDescription: "The learner struggled with applying information to the case."
    },
    missedKeyFinding: {
      label: "Missed Key Finding",
      studentFriendly: "A key symptom, vital sign, lab, or clue may have been overlooked.",
      facultyDescription: "The learner did not appropriately weigh a critical case detail."
    },
    managementPriority: {
      label: "Management Priority Issue",
      studentFriendly: "You may need to work on choosing the safest or most urgent next step.",
      facultyDescription: "The learner struggled with sequencing or prioritizing care."
    },
    diagnosticTestingError: {
      label: "Testing/Workup Error",
      studentFriendly: "You may need to review which test is most useful at this point in the case.",
      facultyDescription: "The learner selected an inappropriate or premature diagnostic step."
    },
    pharmacologyError: {
      label: "Medication Error",
      studentFriendly: "You may need to review medication choice, side effects, contraindications, or dosing logic.",
      facultyDescription: "The learner struggled with pharmacologic decision-making."
    },
    preventionScreeningError: {
      label: "Prevention/Screening Error",
      studentFriendly: "You may need to review prevention, screening, counseling, or follow-up guidelines.",
      facultyDescription: "The learner missed a preventive care or screening concept."
    },

  // =========================
  // NEW ADVANCED TAG SYSTEMS
  // =========================

  abfmBlueprint: {
    emergentUrgentCare: { label: "Emergent & Urgent Care" },
    acuteCareDiagnosis: { label: "Acute Care & Diagnosis" },
    chronicCareManagement: { label: "Chronic Care Management" },
    preventiveCare: { label: "Preventive Care" },
    foundationsOfCare: { label: "Foundations of Care" }
  },

  comlexDomain: {
    applicationOfKnowledge: { label: "Application of Knowledge" },
    patientCare: { label: "Patient Care" },
    osteopathicPrinciples: { label: "Osteopathic Principles & Practice" },
    systemsBasedPractice: { label: "Systems-Based Practice" },
    professionalism: { label: "Professionalism" }
  },

  acgmeCompetency: {
    patientCare: { label: "Patient Care" },
    medicalKnowledge: { label: "Medical Knowledge" },
    systemsBasedPractice: { label: "Systems-Based Practice" },
    professionalism: { label: "Professionalism" },
    practiceBasedLearning: { label: "Practice-Based Learning" }
  },

  clinicalDecision: {
    diagnosis: { label: "Diagnosis" },
    nextBestStep: { label: "Next Best Step" },
    initialManagement: { label: "Initial Management" },
    longTermManagement: { label: "Long-Term Management" },
    riskStratification: { label: "Risk Stratification" },
    pharmacotherapy: { label: "Medication Selection" },
    patientSafety: { label: "Patient Safety Decision" }
  },

  diseaseStage: {
    presentation: { label: "Initial Presentation" },
    acute: { label: "Acute Phase" },
    acuteExacerbation: { label: "Acute Exacerbation" },
    chronic: { label: "Chronic Disease" }
  },

  carePhase: {
    initialEvaluation: { label: "Initial Evaluation" },
    diagnosticEvaluation: { label: "Diagnostic Workup" },
    initialManagement: { label: "Initial Management" },
    treatmentSelection: { label: "Treatment Selection" },
    triageAndDisposition: { label: "Triage & Disposition" },
    medicationOptimization: { label: "Medication Optimization" },
    preTreatmentSafetyScreening: { label: "Safety Screening Before Treatment" }
  },

  clinicalTask: {
    recognizeEmergencyAndTreat: { label: "Recognize Emergency & Treat" },
    stabilizeRespiratoryExacerbation: { label: "Stabilize Respiratory Exacerbation" },
    interpretEndocrineLabsAndSymptoms: { label: "Interpret Endocrine Labs & Symptoms" },
    recognizeSevereInfectionAndEscalateCare: { label: "Recognize Severe Infection & Escalate Care" },
    differentiateEtiologyUsingLabsAndImaging: { label: "Differentiate Etiology Using Labs & Imaging" },
    selectFirstLineAntibiotic: { label: "Select First-Line Antibiotic" },
    identifyPregnancyEmergency: { label: "Identify Pregnancy Emergency" },
    selectMedicationWithComorbidityBenefit: { label: "Select Medication with Comorbidity Benefit" },
    avoidUnnecessaryImagingAndTreatConservatively: { label: "Avoid Unnecessary Imaging & Treat Conservatively" },
    recognizeTimeSensitiveNeurologicEmergency: { label: "Recognize Time-Sensitive Neurologic Emergency" },
    differentiateLowerUrinaryTractInfection: { label: "Differentiate Lower UTI" },
    identifyContraindicationBeforeManipulation: { label: "Identify Contraindications Before OMT" }
  },

  patientPopulation: {
    adult: "Adult",
    olderAdult: "Older Adult",
    pediatric: "Pediatric",
    pregnantAdult: "Pregnant Patient"
  },

  acuity: {
    routine: { label: "Routine" },
    urgent: { label: "Urgent" },
    emergent: { label: "Emergent" }
  },

  boardRelevance: {
    high: { label: "High Board Relevance" },
    medium: { label: "Moderate Board Relevance" },
    low: { label: "Low Board Relevance" }
  },

  distractorTrap: {
    delayedTreatment: { label: "Delayed Treatment" },
    overTesting: { label: "Over-Testing" },
    unsafeDischarge: { label: "Unsafe Discharge" },
    oxygenMismanagement: { label: "Oxygen Mismanagement" },
    confusesEtiology: { label: "Confuses Etiology" },
    treatsWrongPathogen: { label: "Treats Wrong Pathogen" },
    underRecognizesSepsis: { label: "Under-recognizes Sepsis" },
    underRecognizesSeverity: { label: "Under-recognizes Severity" },
    confusesHyperthyroidAndHypothyroidStates: { label: "Confuses Thyroid States" },
    missesCardiovascularBenefit: { label: "Misses Cardiovascular Benefit" },
    overWeightsAlternateCause: { label: "Overweights Incorrect Cause" },
    missesPositiveTest: { label: "Misses Positive Test" },
    underTriage: { label: "Under-triages Patient" },
    missedRedFlag: { label: "Missed Red Flag" },
    unsafeManipulation: { label: "Unsafe Manipulation" }
  }

  }
  
};