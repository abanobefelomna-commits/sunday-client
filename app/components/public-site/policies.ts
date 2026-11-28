export interface PolicySection {
  heading: string;
  paragraphs: string[];
}

export interface PolicyDoc {
  title: string;
  updated: string;
  intro: string;
  sections: PolicySection[];
}

const CONTACT_NOTE_AR =
  "للتواصل معنا أو الإبلاغ عن أي مشكلة تتعلق بالخصوصية أو الاستخدام، يمكنك مراسلتنا عبر واتساب أو الاتصال على الرقم 012 7498 9983.";

const CONTACT_NOTE_EN =
  "To contact us or report any privacy or usage concern, message us on WhatsApp or call 012 7498 9983.";

export const privacyPolicy: Record<"ar" | "en", PolicyDoc> = {
  ar: {
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: 27 نوفمبر 2026",
    intro:
      "تصف هذه السياسة كيف تتعامل منصة مدارس الأحد مع البيانات التي تُدخلها الكنائس والخدام. نحرص على أن تكون هذه السياسة واضحة ومفهومة، وتميّز بين مسؤولية المنصة الفنية، ومسؤولية الكنيسة عن البيانات التي تُدخلها، ومسؤوليتك أنت عن حماية حسابك.",
    sections: [
      {
        heading: "ما البيانات التي نجمعها",
        paragraphs: [
          "بيانات الحساب: عند إنشاء حساب نخزّن اسمك وبريدك الإلكتروني ورقم هاتفك وكلمة مرورك (مخزّنة بصيغة مشفّرة لا يمكن قراءتها).",
          "بيانات الكنيسة: اسم الكنيسة، المدينة التي تختار نشرها، وبيانات التواصل التي يقدّمها مسؤول الكنيسة عند التسجيل.",
          "بيانات الأطفال والطلاب: تُدخلها الكنيسة لتنظيم الفصول، وتشمل الاسم والفصل والجنس وسجلات الحضور وملاحظات المتابعة والتقدم التعليمي.",
          "الصور والملفات المرفوعة: صور الخدام والفصول والإعلانات التي يرفعها المستخدمون المخوّلون، وتُخزَّن داخل قاعدة بيانات الكنيسة.",
        ],
      },
      {
        heading: "لماذا نجمع البيانات وكيف نستخدمها",
        paragraphs: [
          "تُستخدم البيانات لتنظيم خدمة مدارس الأحد داخل كنيستك: إدارة الفصول والخدام والأطفال، وتسجيل الحضور، ومتابعة التقدم، ونشر الإعلانات داخل الكنيسة.",
          "لا نبيع بياناتك ولا نستخدم بيانات الأطفال لأغراض تسويقية. لا تظهر بيانات الأطفال في الدليل العام للمنصة.",
        ],
      },
      {
        heading: "من يمكنه الوصول إلى البيانات",
        paragraphs: [
          "الوصول قائم على الدور والصلاحية: يرى الخادم فصله المعيّن فقط، ويرى قائد الفصل فصله، ويرى المسؤول والكاهن بيانات الكنيسة التي يخدمان فيها وفق صلاحياتهما.",
          "لا يمكن لأي مستخدم من كنيسة أخرى الاطلاع على بيانات كنيستك، لأن لكل كنيسة قاعدة بيانات مستقلة ومعزولة.",
        ],
      },
      {
        heading: "أمان البيانات",
        paragraphs: [
          "كلمات المرور تُخزَّن مشفّرة بخوارزمية Argon2، ولا يمكن لأحد قراءتها.",
          "كل كنيسة لها قاعدة بيانات مستقلة تمامًا، مع تحقق من هوية كل طلب وعزل صارم بين الكنائس.",
          "الصور المرفوعة تُفحص للتأكد من نوعها قبل قبولها، ونحدّ من حجمها (5 ميجابايت كحد أقصى).",
        ],
      },
      {
        heading: "الاحتفاظ بالبيانات والحذف",
        paragraphs: [
          "نحتفظ بالبيانات طالما كانت الكنيسة تستخدم المنصة. عند حذف سجل من الواجهة نحذفه نهائيًا من قاعدة بيانات الكنيسة مع السجلات التابعة له، فلا يظهر في الواجهات ولا من أي حساب آخر.",
          "يمكنك طلب حذف حسابك من مسؤول الكنيسة أو بالتواصل معنا، ويُحذف حسابك مع البيانات المرتبطة به وفق صلاحياتك.",
          "سجلات التدقيق الخاصة بأحداث الأمان تُحتفظ بها لفترة أطول لأغراض الحماية والمساءلة.",
        ],
      },
      {
        heading: "الوسائط المرفوعة",
        paragraphs: [
          "الصور التي ترفعها تُخزَّن داخل قاعدة بيانات كنيستك ولا تُنشر خارجها إلا إذا نشرتها أنت داخل منصة كنيستك.",
          "تقع مسؤولية المحتوى الذي ترفعه عليك وعلى كنيستك، ويجب ألا يحتوي على مواد محظورة أو مخالفة.",
        ],
      },
      {
        heading: "الكوكيز والتخزين المحلي",
        paragraphs: [
          "نستخدم كوكيز آمنة (HttpOnly) لحفظ جلسة تسجيل الدخول وتفضيل اللغة. لا نخزّن كلمة مرورك في متصفحك.",
        ],
      },
      {
        heading: "البيانات دون اتصال بالإنترنت",
        paragraphs: [
          "حاليًا لا تخزّن المنصة بيانات الخدمة على جهازك للعمل دون اتصال. إذا أضفنا ميزات العمل دون اتصال مستقبلًا، سنحدّث هذه السياسة لتوضيح كيفية تخزين البيانات محليًا ومزامنتها.",
        ],
      },
      {
        heading: "خدمات الطرف الثالث",
        paragraphs: [
          "نعتمد على مزوّد استضافة لقواعد البيانات لتشغيل المنصة، وقد تستخدم ميزة المساعد الذكي نماذج خارجية لمعالجة الأسئلة التي تكتبها.",
        ],
      },
      {
        heading: "مسؤولياتك",
        paragraphs: [
          "حافظ على سرية كلمة مرورك ولا تشاركها مع أحد، وأبلغنا فورًا إذا شككت في وصول غير مصرّح به لحسابك.",
        ],
      },
      {
        heading: "حقوقك",
        paragraphs: [
          "يمكنك الاطلاع على بياناتك وتصحيحها أو طلب حذفها بالتواصل مع مسؤول الكنيسة أو معنا، وسنستجيب للطلبات في حدود صلاحياتنا ومسؤولياتنا القانونية.",
          "إذا كنت وليّ أمر وتعتقد أن بيانات طفل أُدخلت دون موافقتك، تواصل معنا أو مع مسؤول الكنيسة لمراجعة البيانات وحذفها عند اللزوم.",
        ],
      },
      {
        heading: "خصوصية الأطفال",
        paragraphs: [
          "بيانات الأطفال مخصّصة لخدمة الكنيسة فقط، ولا تُستخدم للتسويق ولا تُنشر في الدليل العام للمنصة.",
          "الكنيسة مسؤولة عن الحصول على موافقة ولي الأمر أو الأساس القانوني المناسب قبل إدخال بيانات الطفل، وعن تحديد من يمكنه الاطلاع عليها.",
        ],
      },
      {
        heading: "المساعد الذكي",
        paragraphs: [
          "عند استخدام المساعد الذكي تُرسل الرسائل والمرفقات التي تكتبها إلى مزوّد نماذج خارجي لمعالجة طلبك. لا نحتفظ بسجل المحادثات في قاعدة بياناتنا، ولا نرسل بيانات الأطفال إلا في نطاق ما تسمح به صلاحياتك.",
          "قد تكون إجابات المساعد غير دقيقة. راجعها قبل الاعتماد عليها، ولا تُدخل بيانات حساسة لا تحتاجها فعلاً.",
        ],
      },
      {
        heading: "نقل البيانات خارج بلدك",
        paragraphs: [
          "قد يعالج مزوّدو الاستضافة وقواعد البيانات والنماذج بيانات المنصة خارج بلدك، مع اتخاذ تدابير تعاقدية وتقنية مناسبة لحماية البيانات.",
        ],
      },
      {
        heading: "التغييرات على هذه السياسة",
        paragraphs: [
          "قد نحدّث هذه السياسة عند تغيّر المنصة أو المتطلبات القانونية، وسننشر النسخة المحدّثة هنا مع تاريخ التحديث. استمرار استخدام المنصة بعد النشر يعني قبول النسخة المحدّثة.",
        ],
      },
      {
        heading: "الإبلاغ والتواصل",
        paragraphs: [CONTACT_NOTE_AR],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: 27 November 2026",
    intro:
      "This policy explains how the Sunday School platform handles the data entered by churches and servants. It clearly distinguishes the platform's technical responsibilities, each church's responsibility for the data it enters, and your personal responsibility for protecting your account.",
    sections: [
      {
        heading: "What data we collect",
        paragraphs: [
          "Account data: when you create an account we store your name, email, phone number, and a password stored in an unreadable, hashed form.",
          "Church data: the church name, the city it chooses to publish, and the contact details the church administrator provides at registration.",
          "Children and student data: entered by the church to organise classes, including name, class, gender, attendance records, follow-up notes, and educational progress.",
          "Uploaded images and files: servant, class, and announcement images uploaded by authorised users and stored inside the church's database.",
        ],
      },
      {
        heading: "Why we collect it and how we use it",
        paragraphs: [
          "The data is used to run Sunday School ministry inside your church: managing classes, servants and children, recording attendance, tracking progress, and publishing announcements within the church.",
          "We do not sell your data or use children's data for marketing. Children's data never appears in the public church directory.",
        ],
      },
      {
        heading: "Who can access the data",
        paragraphs: [
          "Access is role-based: a servant sees only their assigned class, a class leader sees their class, and an administrator or priest sees the church they serve according to their permissions.",
          "No user from another church can view your church's data, because each church has its own isolated database.",
        ],
      },
      {
        heading: "Data security",
        paragraphs: [
          "Passwords are stored hashed with Argon2 and cannot be read by anyone.",
          "Each church has a fully independent database, with per-request identity verification and strict isolation between churches.",
          "Uploaded images are signature-checked before acceptance, and limited to 5 MB.",
        ],
      },
      {
        heading: "Retention and deletion",
        paragraphs: [
          "We keep data while the church uses the platform. When a record is deleted from the interface, it is permanently removed from the church database together with its dependent records, so it appears neither in the interface nor from any other account.",
          "You can request deletion of your account through the church administrator or by contacting us, and your account is removed together with its linked data according to your permissions.",
          "Security audit records are kept longer for protection and accountability.",
        ],
      },
      {
        heading: "Uploaded media",
        paragraphs: [
          "Images you upload are stored inside your church's database and are not published outside it unless you publish them inside your church's platform.",
          "You and your church are responsible for the content you upload, which must not contain prohibited or infringing material.",
        ],
      },
      {
        heading: "Cookies and local storage",
        paragraphs: [
          "We use secure (HttpOnly) cookies to hold your login session and language preference. We never store your password in your browser.",
        ],
      },
      {
        heading: "Offline data",
        paragraphs: [
          "The platform does not currently store ministry data on your device for offline use. If we add offline features in the future, we will update this policy to explain local storage and synchronisation.",
        ],
      },
      {
        heading: "Third-party services",
        paragraphs: [
          "We use a database hosting provider to run the platform, and the AI assistant feature may use external models to process the questions you type.",
        ],
      },
      {
        heading: "Your responsibilities",
        paragraphs: [
          "Keep your password secret and never share it, and tell us immediately if you suspect unauthorised access to your account.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can review, correct, or request deletion of your data through the church administrator or by contacting us; we respond within our permissions and legal obligations.",
          "If you are a parent or guardian and believe a child's data was entered without your consent, contact us or the church administrator so the data can be reviewed and, where appropriate, deleted.",
        ],
      },
      {
        heading: "Children's privacy",
        paragraphs: [
          "Children's data is used for church ministry only, never for marketing, and never published in the platform's public directory.",
          "The church is responsible for obtaining parental consent or another lawful basis before entering a child's data, and for deciding who may access it.",
        ],
      },
      {
        heading: "AI assistant",
        paragraphs: [
          "When you use the AI assistant, the messages and attachments you write are sent to an external model provider to process your request. We do not keep a conversation history in our database, and we do not send children's data beyond what your permissions allow.",
          "Assistant answers may be inaccurate. Review them before relying on them, and do not enter sensitive data you do not actually need.",
        ],
      },
      {
        heading: "International processing",
        paragraphs: [
          "Our hosting, database, and model providers may process platform data outside your country, under appropriate contractual and technical safeguards.",
        ],
      },
      {
        heading: "Changes to this policy",
        paragraphs: [
          "We may update this policy when the platform or legal requirements change, publishing the revised version here with an updated date. Continued use after publication means acceptance of the revised policy.",
        ],
      },
      {
        heading: "Reporting and contact",
        paragraphs: [CONTACT_NOTE_EN],
      },
    ],
  },
};

export const termsPolicy: Record<"ar" | "en", PolicyDoc> = {
  ar: {
    title: "شروط الاستخدام",
    updated: "آخر تحديث: 27 نوفمبر 2026",
    intro:
      "تحكم هذه الشروط استخدامك لمنصة مدارس الأحد. باستخدامك المنصة فإنك توافق على هذه الشروط. تميّز هذه الشروط بين مسؤولية المنصة الفنية، ومسؤولية الكنيسة عن بياناتها ومستخدميها، ومسؤوليتك أنت.",
    sections: [
      {
        heading: "قبول الشروط",
        paragraphs: [
          "بتسجيلك أو استخدامك المنصة فإنك تقرّ بأنك قرأت هذه الشروط ووافقت عليها، وتتعهد بالالتزام بها.",
        ],
      },
      {
        heading: "الأهلية والحساب",
        paragraphs: [
          "يجب أن تكون أهلاً قانونيًا لاستخدام المنصة وفق قوانين بلدك، أو تستخدمها تحت إشراف مسؤول الكنيسة. أنت مسؤول عن دقة بيانات حسابك (الاسم والبريد الإلكتروني والهاتف) وعن تحديثها.",
        ],
      },
      {
        heading: "العضوية في مساحة الكنيسة",
        paragraphs: [
          "يتم الانضمام إلى مساحة الكنيسة عبر رابط الكنيسة أو دليل الكنائس أو رمز الدعوة. قد يمنح الانضمام المفتوح حساب خادم دون صلاحية على أي فصل حتى يعيّنك مسؤول الكنيسة أو قائد الفصل.",
          "يحق لمسؤول الكنيسة تعديل دورك أو صلاحياتك أو إيقاف وصولك إلى مساحة الكنيسة وفق سياسات الكنيسة.",
        ],
      },
      {
        heading: "الاستخدام المقبول",
        paragraphs: [
          "المنصة مخصّصة لتنظيم خدمة مدارس الأحد. استخدمها فقط للغرض الذي صُمّمت لأجله وبما يليق بالخدمة الكنسية.",
        ],
      },
      {
        heading: "مسؤولياتك",
        paragraphs: [
          "أنت مسؤول عن صحة البيانات التي تُدخلها، وعن الحفاظ على سرية بيانات دخولك، وعن كل نشاط يتم عبر حسابك.",
        ],
      },
      {
        heading: "مسؤوليات مسؤول الكنيسة",
        paragraphs: [
          "مسؤول الكنيسة مسؤول عن بيانات الكنيسة ومستخدميها، وعن إدارة من ينضم إلى مساحة الكنيسة ومنحهم الصلاحيات المناسبة، وعن ضمان دقة بيانات الأطفال وموافقة أولياء الأمور حيثما يتطلب الأمر.",
        ],
      },
      {
        heading: "حماية بيانات الأطفال",
        paragraphs: [
          "بيانات الأطفال حساسة. يجب ألا تُنشر خارج نطاق الكنيسة، ويجب التعامل معها بأقصى درجات الحذر، ويقع الالتزام بحمايتها على الكنيسة ومسؤوليها.",
          "لا تظهر بيانات الأطفال في الدليل العام للمنصة.",
        ],
      },
      {
        heading: "أمان الحساب",
        paragraphs: [
          "اختر كلمة مرور قوية ولا تشاركها. لا تشارك رموز الدعوة أو رموز الأدوار إلا مع الأشخاص المصرّح لهم، لأنها تمنح الوصول لدور محدد.",
        ],
      },
      {
        heading: "المحتوى المرفوع",
        paragraphs: [
          "أنت مسؤول عن الصور والمحتوى الذي ترفعه، وتضمن أن لديك الحق في استخدامه وأنه لا يخالف القانون أو حقوق الآخرين.",
        ],
      },
      {
        heading: "الاستخدامات المحظورة",
        paragraphs: [
          "يُحظر: محاولة الوصول إلى بيانات كنيسة أخرى، أو تعطيل المنصة، أو إدخال محتوى مسيء أو غير قانوني، أو انتحال هوية الآخرين، أو استغلال المنصة في أي نشاط ضار.",
        ],
      },
      {
        heading: "توفر الخدمة وقيودها",
        paragraphs: [
          "نسعى لتوفير خدمة مستقرة، لكننا لا نضمن خلوّها من الانقطاعات المؤقتة. قد تتوقف الخدمة مؤقتًا للصيانة أو بسبب ظروف خارجة عن إرادتنا.",
        ],
      },
      {
        heading: "دقة البيانات",
        paragraphs: [
          "المنصة أداة تنظيم ولا تتحقق من صحة كل معلومة تُدخلها الكنائس. دقة البيانات ومسؤوليتها تقع على من يدخلها.",
        ],
      },
      {
        heading: "التعليق والحذف",
        paragraphs: [
          "يجوز تعليق أو حذف الحسابات التي تنتهك هذه الشروط أو تشكّل خطرًا على أمان المنصة أو بيانات الآخرين، مع إشعارك حيثما أمكن.",
        ],
      },
      {
        heading: "التغييرات على الخدمة والشروط",
        paragraphs: [
          "قد نطوّر المنصة أو نعدّل هذه الشروط من وقت لآخر، وسننشر النسخة المحدّثة هنا. استمرارك في الاستخدام يعني قبولك للتعديلات.",
        ],
      },
      {
        heading: "حدود المسؤولية",
        paragraphs: [
          "إلى الحد الذي يسمح به القانون، لا تتحمل المنصة مسؤولية الأضرار غير المباشرة أو فقدان البيانات الناتج عن سوء الاستخدام أو عن قرارات الإدارة داخل الكنيسة.",
        ],
      },
      {
        heading: "برنامج Preview والمدفوعات",
        paragraphs: [
          "المنصة مجانية خلال فترة Preview المعلنة، ومدتها سنتان تبدأ من تاريخ الإطلاق الرسمي الموحّد للمنصة، دون بطاقة ائتمان أو مدفوعات. قد نغيّر الميزات أو حدود الاستخدام خلال الفترة، وسنعلن أي تغيير جوهري.",
        ],
      },
      {
        heading: "المساعد الذكي",
        paragraphs: [
          "قد تستخدم المنصة نماذج ذكاء اصطناعي خارجية لتشغيل المساعد. الإجابات قد تكون غير دقيقة أو غير مكتملة، وليست نصيحة رعوية أو طبية أو قانونية. أنت مسؤول عن مراجعة الإجابة قبل الاعتماد عليها، ويُحظر استخدام المساعد لإدخال محتوى مخالف أو بيانات لا تملك حق معالجتها.",
        ],
      },
      {
        heading: "الملكية الفكرية",
        paragraphs: [
          "الكنيسة تملك بياناتها ومحتواها. تمنحنا ترخيصًا محدودًا لاستضافة هذه البيانات ومعالجتها وتقديم الخدمة. المنصة وبرمجياتها وعلامتها مملوكة لنا، ولا يجوز نسخها أو إعادة توزيعها دون إذن.",
        ],
      },
      {
        heading: "إخلاء المسؤولية",
        paragraphs: [
          "تُقدَّم المنصة كما هي، ونبذل جهدًا معقولًا للحفاظ على استقرارها وأمانها، لكننا لا نضمن خلوّها من الأخطاء أو الانقطاعات. الكنيسة مسؤولة عن مراجعة بياناتها والاحتفاظ بنسخ احتياطية منها عند الحاجة.",
        ],
      },
      {
        heading: "القانون الواجب التطبيق",
        paragraphs: [
          "تخضع هذه الشروط لأحكام جمهورية مصر العربية. نسعى لحل أي خلاف وديًا أولًا، وإذا تعذّر ذلك تختص المحاكم المصرية.",
        ],
      },
      {
        heading: "التواصل",
        paragraphs: [CONTACT_NOTE_AR],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: 27 November 2026",
    intro:
      "These terms govern your use of the Sunday School platform. By using the platform you agree to them. They distinguish the platform's technical responsibilities, each church's responsibility for its data and users, and your own responsibility.",
    sections: [
      {
        heading: "Acceptance of terms",
        paragraphs: [
          "By registering or using the platform you confirm that you have read and agreed to these terms and will comply with them.",
        ],
      },
      {
        heading: "Eligibility and account",
        paragraphs: [
          "You must be legally able to use the platform under the laws of your country, or use it under the supervision of the church administrator. You are responsible for the accuracy of your account details (name, email, phone) and for keeping them up to date.",
        ],
      },
      {
        heading: "Church workspace membership",
        paragraphs: [
          "You join a church workspace through the church link, the church directory, or an invitation code. Open joining may create a servant account with no class access until the church administrator or class leader assigns you.",
          "The church administrator may change your role or permissions, or suspend your access to the church workspace, in line with the church's policies.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "The platform is for organising Sunday School ministry. Use it only for its intended purpose and in a manner fitting church service.",
        ],
      },
      {
        heading: "Your responsibilities",
        paragraphs: [
          "You are responsible for the accuracy of the data you enter, for keeping your credentials secret, and for all activity performed through your account.",
        ],
      },
      {
        heading: "Church administrator responsibilities",
        paragraphs: [
          "The church administrator is responsible for the church's data and users, for managing who joins the church workspace and granting appropriate permissions, and for ensuring children's data is accurate and, where required, that parental consent is obtained.",
        ],
      },
      {
        heading: "Protecting children's data",
        paragraphs: [
          "Children's data is sensitive. It must not be published outside the church, must be handled with the utmost care, and the church and its officers are responsible for protecting it.",
          "Children's data does not appear in the public directory.",
        ],
      },
      {
        heading: "Account security",
        paragraphs: [
          "Choose a strong password and do not share it. Share invitation or role codes only with authorised people, since they grant access for a specific role.",
        ],
      },
      {
        heading: "Uploaded content",
        paragraphs: [
          "You are responsible for the images and content you upload and warrant that you have the right to use them and that they do not violate the law or others' rights.",
        ],
      },
      {
        heading: "Prohibited misuse",
        paragraphs: [
          "Prohibited: attempting to access another church's data, disrupting the platform, entering offensive or unlawful content, impersonating others, or using the platform for any harmful activity.",
        ],
      },
      {
        heading: "Availability and limitations",
        paragraphs: [
          "We aim for a stable service but do not guarantee it will be free of temporary interruptions. The service may pause briefly for maintenance or due to circumstances beyond our control.",
        ],
      },
      {
        heading: "Data accuracy",
        paragraphs: [
          "The platform is an organising tool and does not verify every piece of information churches enter. Accuracy of data is the responsibility of whoever enters it.",
        ],
      },
      {
        heading: "Suspension and deletion",
        paragraphs: [
          "Accounts that violate these terms or endanger the platform's security or others' data may be suspended or deleted, with notice where possible.",
        ],
      },
      {
        heading: "Changes to the service and terms",
        paragraphs: [
          "We may improve the platform or amend these terms from time to time, publishing the updated version here. Continued use means acceptance of the changes.",
        ],
      },
      {
        heading: "Limitation of liability",
        paragraphs: [
          "To the extent permitted by law, the platform is not liable for indirect damages or data loss arising from misuse or from management decisions inside a church.",
        ],
      },
      {
        heading: "Preview program and payments",
        paragraphs: [
          "The platform is free during the announced Preview period, which lasts two years from the platform's single official launch date, with no credit card or payment. We may change features or usage limits during that period and will announce any material change.",
        ],
      },
      {
        heading: "AI assistant",
        paragraphs: [
          "The platform may use external AI models to run the assistant. Answers may be inaccurate or incomplete and are not pastoral, medical, or legal advice. You are responsible for reviewing an answer before relying on it, and you may not use the assistant to enter unlawful content or data you have no right to process.",
        ],
      },
      {
        heading: "Intellectual property",
        paragraphs: [
          "The church owns its data and content. It grants us a limited licence to host and process that data and provide the service. The platform, its software, and its brand are ours and may not be copied or redistributed without permission.",
        ],
      },
      {
        heading: "Disclaimer",
        paragraphs: [
          "The platform is provided as is. We make reasonable efforts to keep it stable and secure but do not guarantee it will be error-free or uninterrupted. The church is responsible for reviewing its data and keeping backups where needed.",
        ],
      },
      {
        heading: "Governing law",
        paragraphs: [
          "These terms are governed by the laws of the Arab Republic of Egypt. We aim to resolve any dispute amicably first; otherwise the Egyptian courts have jurisdiction.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [CONTACT_NOTE_EN],
      },
    ],
  },
};
