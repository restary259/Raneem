import { fact } from './factTypes';
import type { IntelSource } from './factTypes';
import type { DeadlineValue } from './types';

const CHECKED = '2026-09-27';

export const STANDARD_APPLICATION_DEADLINE_SOURCE: IntelSource = {
  id: 'uni-assist-general-deadlines',
  url: 'https://www.uni-assist.de/en/how-to-apply/plan-your-application/deadlines-processing-time/',
  title: 'uni-assist — General application deadlines in Germany',
  titleAR: 'uni-assist — المواعيد العامة للتقديم في ألمانيا',
  authority: 'uni_assist',
  checkedAt: CHECKED,
};

export const STANDARD_APPLICATION_DEADLINE = fact<DeadlineValue>(
  {
    semester: 'Typical national planning dates',
    semesterAR: 'مواعيد التخطيط الشائعة في ألمانيا',
    deadline: '15.07. for winter semester · 15.01. for summer semester',
  },
  'DARB_OPERATIONAL_GUIDANCE',
  STANDARD_APPLICATION_DEADLINE_SOURCE.id,
  CHECKED,
  {
    note:
      'Planning fallback only. uni-assist says 15 July for winter and 15 January for summer are common dates, but explicitly notes that many universities and programmes use different deadlines.',
    noteAR:
      'موعد تخطيطي فقط. تذكر uni-assist أن 15 يوليو للفصل الشتوي و15 يناير للفصل الصيفي مواعيد شائعة، لكنها توضح صراحةً أن جامعات وبرامج كثيرة تستخدم مواعيد مختلفة.',
  },
);
