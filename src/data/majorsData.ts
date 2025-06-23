
export interface SubMajor {
  id: string;
  nameAR: string;
  nameDE?: string;
  description: string;
}

export interface MajorCategory {
  id: string;
  title: string;
  subMajors: SubMajor[];
}

export const majorsData: MajorCategory[] = [
  {
    id: 'health-medical',
    title: 'العلوم الصحية والطبية',
    subMajors: [
      {
        id: 'public-health',
        nameAR: 'الصحة العامة',
        description: 'تعرف على تخصص الصحة العامة'
      },
      {
        id: 'bioinformatics',
        nameAR: 'المعلوماتية الحيوية',
        description: 'اكتشف دور الحوسبة في تحليل البيانات الحيوية'
      },
      {
        id: 'biomedical-engineering',
        nameAR: 'الهندسة الطبية الحيوية',
        description: 'اجمع بين الطب والهندسة لتحسين الرعاية الصحية'
      },
      {
        id: 'pharmacy',
        nameAR: 'الصيدلة',
        description: 'اكتشف فرص دراسة الصيدلة'
      },
      {
        id: 'dentistry',
        nameAR: 'طب الأسنان',
        description: 'تعرف على مسار طب الأسنان'
      },
      {
        id: 'medicine',
        nameAR: 'الطب',
        description: 'اكتشف مجال الطب وفرصه المستقبلية'
      },
      {
        id: 'physiotherapy',
        nameAR: 'العلاج الطبيعي',
        description: 'تعرف على تخصص العلاج الطبيعي'
      },
      {
        id: 'veterinary',
        nameAR: 'الطب البيطري',
        description: 'تعرف على دراسة الطب البيطري'
      },
      {
        id: 'nursing',
        nameAR: 'التمريض',
        description: 'تعرف على مسار التمريض ومستقبله'
      }
    ]
  },
  {
    id: 'engineering-technology',
    title: 'الهندسة والتكنولوجيا',
    subMajors: [
      {
        id: 'computer-engineering',
        nameAR: 'هندسة الكمبيوتر',
        description: 'اجمع بين البرمجيات والهندسة لبناء المستقبل'
      },
      {
        id: 'aerospace-engineering',
        nameAR: 'هندسة الطيران',
        description: 'صمم مستقبل الطيران والمركبات الفضائية'
      },
      {
        id: 'renewable-energy',
        nameAR: 'هندسة الطاقة المتجددة',
        description: 'كن جزءًا من مستقبل الطاقة المستدامة'
      },
      {
        id: 'software-engineering',
        nameAR: 'هندسة البرمجيات',
        description: 'استعد لبناء أنظمة البرمجيات المتقدمة'
      },
      {
        id: 'industrial-engineering',
        nameAR: 'الهندسة الصناعية',
        description: 'تعرف على تحسين العمليات وإدارة الموارد'
      },
      {
        id: 'space-engineering',
        nameAR: 'الهندسة الفضائية',
        description: 'حلّق في سماء الابتكار الفضائي'
      },
      {
        id: 'chemical-engineering',
        nameAR: 'الهندسة الكيميائية',
        description: 'كن جزءًا من الصناعات الكيميائية المتطورة'
      },
      {
        id: 'mechanical-engineering',
        nameAR: 'الهندسة الميكانيكية',
        description: 'استعد لتطوير الأنظمة الميكانيكية المبتكرة'
      },
      {
        id: 'civil-engineering',
        nameAR: 'الهندسة المدنية',
        description: 'ساهم في بناء العالم من حولك'
      },
      {
        id: 'electrical-it',
        nameAR: 'الهندسة الكهربائية وتقنية المعلومات',
        description: 'كن جزءًا من ثورة التكنولوجيا والأنظمة الذكية'
      },
      {
        id: 'electrical-engineering',
        nameAR: 'الهندسة الكهربائية',
        description: 'تعرف على مستقبل الطاقة والأنظمة الكهربائية'
      },
      {
        id: 'environmental-engineering',
        nameAR: 'الهندسة البيئية',
        description: 'ابدع في إيجاد حلول بيئية مستدامة'
      }
    ]
  },
  {
    id: 'computer-it',
    title: 'علوم الحاسوب وتكنولوجيا المعلومات',
    subMajors: [
      {
        id: 'computer-science',
        nameAR: 'علوم الحاسوب',
        description: 'استعد لمستقبل التكنولوجيا والابتكار'
      },
      {
        id: 'artificial-intelligence',
        nameAR: 'الذكاء الاصطناعي',
        description: 'تعرف على مستقبل التقنية من خلال الذكاء الاصطناعي'
      },
      {
        id: 'cybersecurity',
        nameAR: 'الأمن السيبراني',
        description: 'حافظ على أمان العالم الرقمي'
      },
      {
        id: 'data-science',
        nameAR: 'علم البيانات',
        description: 'استكشف البيانات لتحليل العالم الرقمي'
      },
      {
        id: 'cloud-computing',
        nameAR: 'الحوسبة السحابية',
        description: 'تعرف على إدارة الأنظمة السحابية المتطورة'
      },
      {
        id: 'game-development',
        nameAR: 'تطوير الألعاب',
        description: 'ابدع في تصميم ألعاب ترفيهية وتفاعلية'
      },
      {
        id: 'information-management',
        nameAR: 'إدارة تكنولوجيا المعلومات',
        description: 'كن قائدًا في إدارة الأنظمة التقنية'
      }
    ]
  },
  {
    id: 'natural-sciences',
    title: 'العلوم الطبيعية',
    subMajors: [
      {
        id: 'environmental-science',
        nameAR: 'علوم البيئة',
        description: 'كن جزءًا من الحلول البيئية العالمية'
      },
      {
        id: 'earth-sciences',
        nameAR: 'علوم الأرض',
        description: 'تعرف على التكوين الداخلي والخارجي للأرض'
      },
      {
        id: 'astronomy',
        nameAR: 'علم الفلك',
        description: 'اكتشف أسرار الفضاء والكون الواسع'
      },
      {
        id: 'mathematics',
        nameAR: 'الرياضيات',
        description: 'تعرف على لغة العلوم من خلال الرياضيات'
      },
      {
        id: 'physics',
        nameAR: 'الفيزياء',
        description: 'اكتشف أسرار الكون من خلال الفيزياء'
      },
      {
        id: 'chemistry',
        nameAR: 'الكيمياء',
        description: 'تعرف على أسرار التفاعلات الكيميائية'
      },
      {
        id: 'biology',
        nameAR: 'الأحياء',
        description: 'استكشف الحياة من حولك من خلال دراسة الأحياء'
      }
    ]
  },
  {
    id: 'humanities',
    title: 'العلوم الإنسانية',
    subMajors: [
      {
        id: 'history',
        nameAR: 'التاريخ',
        description: 'استكشف الماضي لتفهم الحاضر وتشكل المستقبل'
      },
      {
        id: 'philosophy',
        nameAR: 'الفلسفة',
        description: 'تعمق في أسئلة الوجود والمعرفة والأخلاق'
      },
      {
        id: 'literature',
        nameAR: 'الأدب',
        description: 'اكتشف جمال اللغة والتعبير الإبداعي'
      },
      {
        id: 'linguistics',
        nameAR: 'اللسانيات',
        description: 'تعرف على علم اللغة وتطورها'
      },
      {
        id: 'archaeology',
        nameAR: 'علم الآثار',
        description: 'اكتشف الحضارات القديمة من خلال البقايا الأثرية'
      }
    ]
  },
  {
    id: 'social-sciences',
    title: 'العلوم الاجتماعية',
    subMajors: [
      {
        id: 'psychology',
        nameAR: 'علم النفس',
        description: 'تعرف على سلوك الإنسان والعمليات النفسية'
      },
      {
        id: 'sociology',
        nameAR: 'علم الاجتماع',
        description: 'ادرس المجتمع وعلاقاته وتطوره'
      },
      {
        id: 'political-science',
        nameAR: 'العلوم السياسية',
        description: 'تعرف على النظم السياسية والحكم'
      },
      {
        id: 'international-relations',
        nameAR: 'العلاقات الدولية',
        description: 'ادرس التفاعلات السياسية والاقتصادية بين الدول'
      },
      {
        id: 'anthropology',
        nameAR: 'علم الإنسان',
        description: 'استكشف تطور الإنسان والثقافات المختلفة'
      }
    ]
  },
  {
    id: 'business-economics',
    title: 'إدارة الأعمال والاقتصاد',
    subMajors: [
      {
        id: 'marketing',
        nameAR: 'التسويق',
        description: 'تعرف على تقنيات التسويق الرقمي الحديثة'
      },
      {
        id: 'financial-management',
        nameAR: 'الإدارة المالية والمحاسبة',
        description: 'اكتسب مهارات تحليل وإدارة الموارد المالية'
      },
      {
        id: 'entrepreneurship',
        nameAR: 'ريادة الأعمال',
        description: 'ابدأ رحلتك في عالم الأعمال والابتكار'
      },
      {
        id: 'supply-chain',
        nameAR: 'إدارة اللوجستيات وسلاسل الإمداد',
        description: 'تعرف على أنظمة التخطيط والإمداد العالمية'
      },
      {
        id: 'human-resources',
        nameAR: 'الموارد البشرية',
        description: 'تعرف على إدارة رأس المال البشري بفعالية'
      },
      {
        id: 'economics',
        nameAR: 'الاقتصاد',
        description: 'ادرس الأنظمة الاقتصادية والأسواق المالية'
      }
    ]
  },
  {
    id: 'law',
    title: 'القانون',
    subMajors: [
      {
        id: 'international-law',
        nameAR: 'القانون الدولي',
        description: 'تعرف على القوانين التي تحكم العلاقات بين الدول'
      },
      {
        id: 'criminal-law',
        nameAR: 'القانون الجنائي',
        description: 'ادرس أسس العدالة الجنائية والقانون الجزائي'
      },
      {
        id: 'civil-law',
        nameAR: 'القانون المدني',
        description: 'تعرف على القوانين التي تنظم العلاقات بين الأفراد'
      },
      {
        id: 'commercial-law',
        nameAR: 'القانون التجاري',
        description: 'ادرس القوانين المنظمة للأنشطة التجارية والشركات'
      },
      {
        id: 'constitutional-law',
        nameAR: 'القانون الدستوري',
        description: 'تعرف على أسس الأنظمة الدستورية وحقوق الإنسان'
      }
    ]
  },
  {
    id: 'arts',
    title: 'الفنون',
    subMajors: [
      {
        id: 'fine-arts',
        nameAR: 'الفنون الجميلة',
        description: 'اكتشف عالم الرسم والنحت والفنون التشكيلية'
      },
      {
        id: 'graphic-design',
        nameAR: 'التصميم الجرافيكي',
        description: 'تعلم فن التصميم البصري والاتصال المرئي'
      },
      {
        id: 'music',
        nameAR: 'الموسيقى',
        description: 'استكشف عالم الألحان والإيقاع والتأليف الموسيقي'
      },
      {
        id: 'theater',
        nameAR: 'المسرح',
        description: 'تعرف على فن الأداء والإخراج المسرحي'
      },
      {
        id: 'film-media',
        nameAR: 'السينما والإعلام',
        description: 'ادخل عالم صناعة الأفلام والإنتاج الإعلامي'
      }
    ]
  },
  {
    id: 'education',
    title: 'التعليم',
    subMajors: [
      {
        id: 'elementary-education',
        nameAR: 'تعليم المرحلة الابتدائية',
        description: 'تخصص في تعليم الأطفال في سنوات التكوين الأولى'
      },
      {
        id: 'special-education',
        nameAR: 'التربية الخاصة',
        description: 'تعلم كيفية التعامل مع ذوي الاحتياجات الخاصة'
      },
      {
        id: 'educational-psychology',
        nameAR: 'علم النفس التربوي',
        description: 'ادرس السلوك والتعلم في البيئات التعليمية'
      },
      {
        id: 'curriculum-instruction',
        nameAR: 'المناهج وطرق التدريس',
        description: 'تعرف على أحدث أساليب التعليم وتطوير المناهج'
      },
      {
        id: 'educational-administration',
        nameAR: 'الإدارة التعليمية',
        description: 'تعلم إدارة المؤسسات التعليمية بفعالية'
      }
    ]
  },
  {
    id: 'agriculture-environment',
    title: 'الزراعة والبيئة',
    subMajors: [
      {
        id: 'agricultural-science',
        nameAR: 'العلوم الزراعية',
        description: 'تعرف على أحدث تقنيات الزراعة المستدامة'
      },
      {
        id: 'environmental-management',
        nameAR: 'إدارة البيئة',
        description: 'تعلم حماية البيئة وإدارة الموارد الطبيعية'
      },
      {
        id: 'forestry',
        nameAR: 'علوم الغابات',
        description: 'ادرس إدارة وحماية الغابات والنظم الإيكولوجية'
      },
      {
        id: 'marine-science',
        nameAR: 'علوم البحار',
        description: 'استكشف أسرار المحيطات والحياة البحرية'
      },
      {
        id: 'sustainable-development',
        nameAR: 'التنمية المستدامة',
        description: 'تعرف على مبادئ التنمية التي تحافظ على البيئة'
      }
    ]
  },
  {
    id: 'tourism-hospitality',
    title: 'السياحة والضيافة',
    subMajors: [
      {
        id: 'tourism-management',
        nameAR: 'إدارة السياحة',
        description: 'تعلم إدارة الخدمات السياحية والوجهات السياحية'
      },
      {
        id: 'hotel-management',
        nameAR: 'إدارة الفنادق',
        description: 'اكتسب مهارات إدارة الفنادق والمنتجعات السياحية'
      },
      {
        id: 'culinary-arts',
        nameAR: 'فنون الطبخ',
        description: 'تعلم فن الطهي وإدارة المطاعم'
      },
      {
        id: 'event-management',
        nameAR: 'إدارة الفعاليات',
        description: 'تخصص في تنظيم وإدارة المؤتمرات والفعاليات'
      },
      {
        id: 'travel-tourism',
        nameAR: 'السفر والسياحة',
        description: 'تعرف على صناعة السفر وخدمات السياحة'
      }
    ]
  }
];
