
export const JOD_TO_EUR = 1.32;

export const costData = {
  germany: {
    livingCost: { basic: 870, moderate: 1000, comfortable: 1200 }, // Monthly in EUR
    accommodation: { dormitory: 300, shared: 475, private: 850 }, // Monthly in EUR
    tuition: { // Annual in EUR
      public: 0,
      private: 12000,
    },
    semesterFee: 300, // Per semester in EUR
    healthInsurance: 125, // Monthly in EUR
    visaFee: 90, // One-time in EUR
    languagePrep: 1200, // One-time in EUR
  },
  jordan: {
    livingCost: { basic: 300 * JOD_TO_EUR, moderate: 450 * JOD_TO_EUR, comfortable: 600 * JOD_TO_EUR },
    accommodation: { dormitory: 150 * JOD_TO_EUR, shared: 200 * JOD_TO_EUR, private: 300 * JOD_TO_EUR },
    tuition: { // Annual in EUR
      public: 200 * JOD_TO_EUR, // Registration fees
      private: 3500 * JOD_TO_EUR,
    },
    semesterFee: 0,
    healthInsurance: 0, // Not a standard mandatory cost for visa
    visaFee: 70 * JOD_TO_EUR,
    languagePrep: 1000 * JOD_TO_EUR,
  },
  romania: {
    livingCost: { basic: 300, moderate: 400, comfortable: 500 },
    accommodation: { dormitory: 100, shared: 150, private: 250 },
    tuition: { // Annual in EUR
      engineering: 2700,
      medicine: 5000,
      business: 2500,
      humanities: 2200,
      private_multiplier: 1.5,
    },
    semesterFee: 0,
    healthInsurance: 0, // Often included or lower cost
    visaFee: 120,
    languagePrep: 1000,
  },
};
