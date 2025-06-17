
export const costData = {
  germany: {
    tuition: {
      public: 0,
      private: 20000,
    },
    livingCost: {
      basic: 800,
      moderate: 1000,
      comfortable: 1200,
    },
    accommodation: {
      dormitory: 300,
      shared: 400,
      private: 600,
    },
    healthInsurance: 110,
    semesterFee: 300,
    visaFee: 75,
    languagePrep: 800,
  },
  jordan: {
    tuition: {
      public: 3000,
      private: 8000,
    },
    livingCost: {
      basic: 400,
      moderate: 600,
      comfortable: 800,
    },
    accommodation: {
      dormitory: 150,
      shared: 200,
      private: 300,
    },
    healthInsurance: 50,
    visaFee: 50,
    languagePrep: 500,
  },
  romania: {
    tuition: {
      engineering: 4000,
      medicine: 6000,
      business: 3500,
      humanities: 3000,
      private_multiplier: 1.5,
    },
    livingCost: {
      basic: 500,
      moderate: 700,
      comfortable: 900,
    },
    accommodation: {
      dormitory: 200,
      shared: 250,
      private: 400,
    },
    healthInsurance: 60,
    visaFee: 120,
    languagePrep: 600,
  },
} as const;
