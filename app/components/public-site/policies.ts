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
          "نحتفظ بالبيانات طالما كانت الكنيسة تستخدم المنصة. عند حذف سجل، نحذفه أو نميّزه كمحذوف بحيث لا يظهر في الواجهات العادية.",
          "يمكنك حذف حسابك من إعداداتك، ويُحذف حسابك مع بياناتك المرتبطة به وفق ما تحدده صلاحياتك.",
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
          "We keep data while the church uses the platform. When a record is deleted, it is removed or marked deleted so it no longer appears in normal views.",
          "You can delete your account from your settings, and your account and its linked data are removed according to your permissions.",
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
          "مسؤول الكنيسة مسؤول عن بيانات الكنيسة ومستخدميها، وعن منح الصلاحيات للأدوار المناسبة، وعن مراجعة طلبات الانضمام قبل اعتمادها، وعن ضمان دقة بيانات الأطفال وموافقة أولياء الأمور حيثما يتطلب الأمر.",
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
          "The church administrator is responsible for the church's data and users, for granting permissions to the right roles, for reviewing join requests before approval, and for ensuring children's data is accurate and, where required, that parental consent is obtained.",
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
        heading: "Contact",
        paragraphs: [CONTACT_NOTE_EN],
      },
    ],
  },
};
