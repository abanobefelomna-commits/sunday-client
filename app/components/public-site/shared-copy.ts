import type { Locale } from "./messages";

export const sharedPublicCopy: Record<Locale, {
  skipToContent: string;
  heroImageAlt: string;
  getStarted: string;
  readDraft: string;
  codeOrDirectoryHint: string;
  createServantAccount: string;
}> = {
  ar: {
    skipToContent: "انتقل إلى المحتوى",
    heroImageAlt: "السيد المسيح يرحب بالأطفال ويعلمهم في أجواء كنيسة هادئة",
    getStarted: "ابدأ مساحة خدمتك",
    readDraft: "قراءة المسودة",
    codeOrDirectoryHint: "يمكنك أيضاً اختيار كنيسة من الدليل العام.",
    createServantAccount: "أنشئ حساب خادم",
  },
  en: {
    skipToContent: "Skip to content",
    heroImageAlt: "Jesus welcoming and teaching children in a peaceful church setting",
    getStarted: "Get started",
    readDraft: "Read the draft",
    codeOrDirectoryHint: "You can also select a church from the public directory.",
    createServantAccount: "Create a servant account",
  },
  fr: {
    skipToContent: "Aller au contenu",
    heroImageAlt: "Jésus accueille et enseigne des enfants dans un cadre d’église paisible",
    getStarted: "Commencer",
    readDraft: "Lire le projet",
    codeOrDirectoryHint: "Vous pouvez aussi choisir une église dans l’annuaire public.",
    createServantAccount: "Créer un compte de servant",
  },
  es: {
    skipToContent: "Saltar al contenido",
    heroImageAlt: "Jesús acoge y enseña a niños en un entorno tranquilo de iglesia",
    getStarted: "Comenzar",
    readDraft: "Leer el borrador",
    codeOrDirectoryHint: "También puedes elegir una iglesia del directorio público.",
    createServantAccount: "Crear una cuenta de servidor",
  },
  de: {
    skipToContent: "Zum Inhalt springen",
    heroImageAlt: "Jesus heißt Kinder willkommen und unterrichtet sie in einer ruhigen Kirchenumgebung",
    getStarted: "Jetzt starten",
    readDraft: "Entwurf lesen",
    codeOrDirectoryHint: "Sie können auch eine Gemeinde aus dem öffentlichen Verzeichnis auswählen.",
    createServantAccount: "Mitarbeiterkonto erstellen",
  },
  it: {
    skipToContent: "Vai al contenuto",
    heroImageAlt: "Gesù accoglie e insegna ai bambini in un ambiente sereno in chiesa",
    getStarted: "Inizia",
    readDraft: "Leggi la bozza",
    codeOrDirectoryHint: "Puoi anche scegliere una chiesa dall’elenco pubblico.",
    createServantAccount: "Crea un account collaboratore",
  },
  pt: {
    skipToContent: "Ir para o conteúdo",
    heroImageAlt: "Jesus acolhe e ensina crianças em um ambiente tranquilo de igreja",
    getStarted: "Começar",
    readDraft: "Ler o rascunho",
    codeOrDirectoryHint: "Você também pode escolher uma igreja no diretório público.",
    createServantAccount: "Criar conta de servo",
  },
  ru: {
    skipToContent: "Перейти к содержимому",
    heroImageAlt: "Иисус приветствует и учит детей в спокойной церковной обстановке",
    getStarted: "Начать",
    readDraft: "Прочитать черновик",
    codeOrDirectoryHint: "Также можно выбрать церковь из открытого каталога.",
    createServantAccount: "Создать аккаунт служителя",
  },
};
