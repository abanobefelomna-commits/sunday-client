"use client";

import Link from "next/link";
import { PublicFlowShell } from "./PublicFlowShell";
import { usePublicLocale } from "./use-public-locale";

const policyNotes = {
  ar: ["لم يُنشر بعد نص رسمي معتمد لسياسة الخصوصية أو شروط الاستخدام. لذلك لا ينبغي إدخال بيانات شخصية أو بيانات أطفال عبر هذه الصفحات قبل نشر النص النهائي وتفعيل خدمة التسجيل.", "لا يحتوي العرض التسويقي أو دليل الكنائس على سجلات أطفال حقيقية. تفاصيل جمع البيانات ومدة الاحتفاظ بها وحقوق المستخدمين تحتاج إلى مراجعة واعتماد قبل الإطلاق."],
  en: ["Approved official Privacy and Terms text has not been published yet. Do not submit personal or children's information through these pages until final copy is published and registration is active.", "The marketing demonstration and church directory contain no real children's records. Data collection, retention, and user-rights details require review and approval before launch."],
  fr: ["Aucun texte officiel approuvé sur la confidentialité ou les conditions d’utilisation n’a encore été publié. Ne transmettez pas de données personnelles ou d’enfants avant la publication du texte final et l’activation de l’inscription.", "La démonstration et l’annuaire ne contiennent aucun dossier réel d’enfant. La collecte, la conservation des données et les droits des utilisateurs doivent être examinés avant le lancement."],
  es: ["Aún no se ha publicado un texto oficial aprobado sobre privacidad o condiciones de uso. No envíes datos personales ni de niños hasta que se publique el texto final y se active el registro.", "La demostración y el directorio no contienen registros reales de niños. La recopilación, conservación de datos y los derechos de los usuarios deben revisarse antes del lanzamiento."],
  de: ["Ein genehmigter offizieller Datenschutz- oder Bedingungstext wurde noch nicht veröffentlicht. Übermitteln Sie keine personenbezogenen Daten oder Kinderdaten, bevor der endgültige Text veröffentlicht und die Registrierung aktiviert ist.", "Demo und Verzeichnis enthalten keine echten Kinderdatensätze. Datenerhebung, Aufbewahrung und Nutzerrechte müssen vor dem Start geprüft werden."],
  it: ["Non è ancora stato pubblicato un testo ufficiale approvato per la privacy o le condizioni d’uso. Non inviare dati personali o di minori finché il testo definitivo non sarà pubblicato e la registrazione attivata.", "La dimostrazione e l’elenco non contengono dati reali di minori. Raccolta e conservazione dei dati e diritti degli utenti devono essere esaminati prima del lancio."],
  pt: ["Ainda não foi publicado um texto oficial aprovado de Privacidade ou Termos. Não envie dados pessoais ou de crianças até que o texto final seja publicado e o cadastro esteja ativo.", "A demonstração e o diretório não contêm registros reais de crianças. A coleta, retenção de dados e os direitos dos usuários precisam ser revisados antes do lançamento."],
  ru: ["Официальный текст политики конфиденциальности и условий ещё не опубликован. Не передавайте личные данные и сведения о детях, пока не будут утверждены документы и не заработает регистрация.", "В демонстрации и каталоге нет реальных записей о детях. Сбор и хранение данных, а также права пользователей должны быть проверены до запуска."],
} as const;

export default function PolicyNotice({ kind }: { kind: "privacy" | "terms" }) {
  const { locale, flow, messages } = usePublicLocale();
  const title = kind === "privacy" ? messages.privacy : messages.terms;
  return <PublicFlowShell>
    <article className={"pf-policyBody"}>
      <span className={"pf-flowEyebrow"}>{messages.name}</span>
      <h1>{title}</h1>
      <h2>{flow.policyTitle}</h2>
      <p>{flow.policyReview}</p>
      <p>{policyNotes[locale][0]}</p>
      <p>{policyNotes[locale][1]}</p>
      <Link className={"pf-flowAction"} href="/">{messages.nav.home}</Link>
    </article>
  </PublicFlowShell>;
}
