
import * as z from 'zod';

// --- Data Structures ---

export const countries = {
  DE: { nameKey: 'germany', currency: 'EUR', flag: '🇩🇪' },
  RO: { nameKey: 'romania', currency: 'RON', flag: '🇷🇴' },
  JO: { nameKey: 'jordan', currency: 'JOD', flag: '🇯🇴' },
};

export const banksByCountry = {
  DE: [
    { id: 'n26', nameKey: 'banks.n26', fee: 0 },
    { id: 'dkb', nameKey: 'banks.dkb', fee: 0 },
    { id: 'sparkasse', nameKey: 'banks.sparkasse', fee: 20 },
    { id: 'deutsche', nameKey: 'banks.deutsche', fee: 40 },
  ],
  RO: [
    { id: 'bancatransilvania', nameKey: 'banks.bancatransilvania', fee: 9 },
    { id: 'brd', nameKey: 'banks.brd', fee: 18 },
    { id: 'ing', nameKey: 'banks.ing', fee: 5 },
    { id: 'raiffeisen', nameKey: 'banks.raiffeisen', fee: 13 },
  ],
  JO: [
    { id: 'arab', nameKey: 'banks.arab', fee: 35 },
    { id: 'cairoamman', nameKey: 'banks.cairoamman', fee: 25 },
    { id: 'etihad', nameKey: 'banks.etihad', fee: 30 },
    { id: 'housing', nameKey: 'banks.housing', fee: 40 },
  ],
};

export const mockApiData = {
  EUR: {
    leumi: { name: 'بنك لئومي', rate: 0.25, fee: 25, time: 'arrivesInDays' },
    hapoalim: { name: 'بنك هبوعليم', rate: 0.252, fee: 22, time: 'arrivesInHours' },
    mizrahitefahot: { name: 'بنك مزراحي تفحوت', rate: 0.248, fee: 30, time: 'arrivesInDays' },
  },
  JOD: {
    leumi: { name: 'بنك لئومي', rate: 0.18, fee: 30, time: 'arrivesInDays' },
    hapoalim: { name: 'بنك هبوعليم', rate: 0.182, fee: 28, time: 'arrivesInHours' },
    mizrahitefahot: { name: 'بنك مزراحي تفحوت', rate: 0.178, fee: 35, time: 'arrivesInDays' },
  },
  RON: {
    leumi: { name: 'بنك لئومي', rate: 1.25, fee: 20, time: 'arrivesInDays' },
    hapoalim: { name: 'بنك هبوعليم', rate: 1.26, fee: 18, time: 'arrivesInHours' },
    mizrahitefahot: { name: 'بنك مزراحي تفحوت', rate: 1.24, fee: 25, time: 'arrivesInDays' },
  },
};

export const timeToSortValue = {
  arrivesInHours: 1,
  arrivesInDays: 2,
};

export const formSchema = z.object({
  amount: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive({ message: 'الرجاء إدخال مبلغ صحيح' })
  ),
  targetCountry: z.enum(['DE', 'RO', 'JO']),
  receivingBank: z.string({ required_error: "الرجاء اختيار بنك" }).nonempty("الرجاء اختيار بنك"),
  deliverySpeed: z.enum(['fastest', 'cheapest', 'balanced']),
  paymentMethod: z.enum(['bank', 'card', 'pickup']),
});

export type FormValues = z.infer<typeof formSchema>;

export type Result = { 
  service: string; 
  bank: string;
  rate: number; 
  serviceFee: number;
  bankFee: number;
  totalFee: number;
  time: string; 
  timeValue: number;
  received: number; 
};
