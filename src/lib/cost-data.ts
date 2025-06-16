export const JOD_TO_EUR = 1.28; // Updated exchange rate for 2025

export const costData = {
  germany: {
    livingCost: { basic: 800, moderate: 1000, comfortable: 1200 }, // Monthly in EUR, including rent
    accommodation: { dormitory: 250, shared: 475, private: 850 }, // Monthly in EUR
    food: { basic: 150, moderate: 225, comfortable: 300 }, // Monthly in EUR
    transportation: 50, // Monthly in EUR, often included in semester fee
    healthInsurance: 100, // Monthly in EUR
    miscellaneous: { basic: 200, moderate: 300, comfortable: 400 }, // Monthly in EUR
    semesterFee: 100, // Per semester in EUR
    visaFee: 100, // One-time in EUR
    languagePrep: 1200, // One-time in EUR
  },
  jordan: {
    livingCost: { basic: 600, moderate: 750, comfortable: 900 }, // Monthly in EUR, including rent
    accommodation: { dormitory: 172, shared: 230, private: 345 }, // Monthly in EUR (JOD 150-300 at 1.28)
    food: { basic: 107, moderate: 142, comfortable: 178 }, // Monthly in EUR (JOD 85-140)
    transportation: 35, // Monthly in EUR (JOD 27)
    healthInsurance: 10, // Monthly in EUR (from JOD 100/year)
    miscellaneous: { basic: 100, moderate: 150, comfortable: 200 }, // Monthly in EUR
    semesterFee: 0,
    visaFee: 64, // One-time in EUR (JOD 50)
    languagePrep: 1280, // One-time in EUR (JOD 1000)
  },
  romania: {
    livingCost: { basic: 500, moderate: 650, comfortable: 800 }, // Monthly in EUR, including rent
    accommodation: { dormitory: 75, shared: 200, private: 400 }, // Monthly in EUR
    food: { basic: 100, moderate: 150, comfortable: 200 }, // Monthly in EUR
    transportation: 35, // Monthly in EUR
    healthInsurance: 15, // Monthly in EUR (from 180 EUR/year)
    miscellaneous: { basic: 120, moderate: 180, comfortable: 240 }, // Monthly in EUR
    semesterFee: 0,
    visaFee: 50, // One-time in EUR
    languagePrep: 1000, // One-time in EUR
  },
  italy: {
    livingCost: { basic: 750, moderate: 1050, comfortable: 1550 }, // Monthly in EUR, including rent
    accommodation: { dormitory: 200, shared: 500, private: 1200 }, // Monthly in EUR
    food: { basic: 150, moderate: 250, comfortable: 350 }, // Monthly in EUR
    transportation: 45, // Monthly in EUR
    healthInsurance: 30, // Monthly in EUR
    miscellaneous: { basic: 200, moderate: 325, comfortable: 450 }, // Monthly in EUR
    semesterFee: 0,
    visaFee: 50, // One-time in EUR
    languagePrep: 1500, // One-time in EUR
  },
};
