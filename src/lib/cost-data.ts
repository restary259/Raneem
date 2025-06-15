
export const JOD_TO_EUR = 1.32;

export const costData = {
  germany: {
    livingCost: { basic: 250, moderate: 1000, comfortable: 1200 }, // Monthly in EUR
    accommodation: { dormitory: 250, shared: 475, private: 850 }, // Monthly in EUR
    tuition: { // Annual in EUR
      public: 0,
      private: 12000,
    },
    semesterFee: 100, // Per semester in EUR
    healthInsurance: 100, // Monthly in EUR
    visaFee: 100, // One-time in EUR
    languagePrep: 1200, // One-time in EUR
  },
  jordan: {
    livingCost: { basic: 300 * JOD_TO_EUR, moderate: 450 * JOD_TO_EUR, comfortable: 600 * JOD_TO_EUR },
    accommodation: { dormitory: 150 * JOD_TO_EUR, shared: 200 * JOD_TO_EUR, private: 300 * JOD_TO_EUR },
    tuition: { // Annual in EUR
      public: 200 * JOD_TO_EUR, // Registration fees
      private: 2000 * JOD_TO_EUR,
    },
    semesterFee: 0,
    healthInsurance: 8.33 * JOD_TO_EUR, // Monthly in EUR, from 100 JOD/year
    visaFee: 50 * JOD_TO_EUR,
    languagePrep: 1000 * JOD_TO_EUR,
  },
  romania: {
    livingCost: { basic: 150, moderate: 400, comfortable: 500 },
    accommodation: { dormitory: 75, shared: 150, private: 250 },
    tuition: { // Annual in EUR
      engineering: 2200,
      medicine: 5000,
      business: 2200,
      humanities: 2000,
      private_multiplier: 1.5,
    },
    semesterFee: 0,
    healthInsurance: 10, // Monthly in EUR, from 120 EUR/year
    visaFee: 50,
    languagePrep: 1000,
  },
};
