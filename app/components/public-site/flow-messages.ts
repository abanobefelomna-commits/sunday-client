import type { Locale } from "./messages";

export interface FlowMessages {
  back: string;
  registerTitle: string;
  registerLead: string;
  churchName: string;
  churchNameHint: string;
  city: string;
  cityHint: string;
  publish: string;
  adminName: string;
  email: string;
  phone: string;
  password: string;
  passwordHint: string;
  acceptTerms: string;
  acceptPrivacy: string;
  submit: string;
  submitting: string;
  requestError: string;
  provisioningTitle: string;
  provisioningLead: string;
  provisioningWait: string;
  provisioningFailed: string;
  churchCode: string;
  copyCode: string;
  codeCopied: string;
  directoryTitle: string;
  directoryLead: string;
  search: string;
  searchSubmit: string;
  searchEmpty: string;
  searchUnavailable: string;
  verified: string;
  unverified: string;
  findAction: string;
  joinAction: string;
  joinTitle: string;
  joinLead: string;
  codeLabel: string;
  lookup: string;
  matchedChurch: string;
  cityLabel: string;
  requestJoin: string;
  requestPending: string;
  signInFirst: string;
  signIn: string;
  lookupError: string;
  joinError: string;
  policyTitle: string;
  policyReview: string;
}

export const flowMessages: Record<Locale, FlowMessages> = {
  ar: {
    back: "العودة للرئيسية", registerTitle: "سجّل كنيستك في المنصة", registerLead: "بيانات الكنيسة وأمين الخدمة الأول مطلوبة لبدء طلب التسجيل. لن تُعرض بيانات التواصل في دليل الكنائس.",
    churchName: "اسم الكنيسة", churchNameHint: "اكتب الاسم المستخدم رسمياً في الكنيسة.", city: "المدينة أو المنطقة", cityHint: "اختياري؛ لن يظهر في الدليل إلا بعد اختيار النشر.", publish: "أوافق على عرض اسم الكنيسة والمدينة والوصف العام في الدليل بعد تفعيل النشر.",
    adminName: "اسم أمين الخدمة", email: "البريد الإلكتروني", phone: "رقم الهاتف", password: "كلمة المرور", passwordHint: "استخدم 12 حرفاً على الأقل.", acceptTerms: "أوافق على شروط الخدمة.", acceptPrivacy: "أقر بأنني قرأت إشعار الخصوصية.", submit: "إرسال طلب التسجيل", submitting: "جارٍ إرسال الطلب…", requestError: "تعذر إرسال الطلب الآن. يرجى المحاولة لاحقاً.",
    provisioningTitle: "جارٍ تجهيز مساحة الكنيسة", provisioningLead: "قد يستغرق تجهيز قاعدة بيانات مستقلة بضع دقائق. لن تُفعّل الكنيسة إلا بعد نجاح جميع خطوات التجهيز.", provisioningWait: "جارٍ تجهيز قاعدة البيانات والأدوار وأمين الخدمة…", provisioningFailed: "تعذر إكمال التجهيز. لم يتم تفعيل الكنيسة. احتفظ برقم الطلب وتواصل مع فريق المنصة عند نشر قناة الدعم.", churchCode: "رمز الكنيسة الخاص", copyCode: "نسخ الرمز", codeCopied: "تم نسخ الرمز",
    directoryTitle: "دليل الكنائس", directoryLead: "ابحث عن كنيسة اختارت نشر بياناتها العامة. لا يحتوي الدليل على رموز دعوة أو بيانات أعضاء.", search: "ابحث باسم الكنيسة أو المدينة", searchSubmit: "بحث", searchEmpty: "لا توجد نتائج مطابقة حالياً.", searchUnavailable: "تعذر تحميل الدليل. يمكنك إعادة المحاولة بعد قليل.", verified: "كنيسة موثّقة", unverified: "لم يتم التحقق منها", findAction: "طلب الانضمام", joinAction: "انضم برمز الكنيسة",
    joinTitle: "انضم إلى كنيسة كخادم", joinLead: "ابحث في الدليل أو أدخل الرمز الذي شاركه مسؤول الكنيسة. الرمز يساعد على العثور على الكنيسة فقط ولا يمنح عضوية.", codeLabel: "رمز الكنيسة", lookup: "العثور على الكنيسة", matchedChurch: "هل هذه هي الكنيسة المقصودة؟", cityLabel: "المدينة", requestJoin: "إرسال طلب انضمام", requestPending: "تم إرسال الطلب للمراجعة. لن تحصل على عضوية أو صلاحية قبل موافقة مسؤول الكنيسة.", signInFirst: "سجّل الدخول أو أنشئ حساب خادم أولاً، ثم عُد لإرسال الطلب.", signIn: "تسجيل الدخول", lookupError: "لم نتمكن من العثور على كنيسة بهذا الرمز. تحقق منه مع مسؤول الكنيسة.", joinError: "تعذر إرسال طلب الانضمام الآن.",
    policyTitle: "مسودة قيد المراجعة", policyReview: "المحتوى القانوني النهائي لم يُعتمد بعد. لا تستخدم هذه الصفحة بديلاً عن الشروط أو إشعار الخصوصية الرسميين.",
  },
  en: {
    back: "Back to home", registerTitle: "Register your church", registerLead: "Church details and the first administrator's information are needed to start registration. Contact details will not appear in the church directory.",
    churchName: "Church name", churchNameHint: "Use the name recognized by your church.", city: "City or area", cityHint: "Optional. It appears in the directory only if you opt in.", publish: "I agree to show the church name, city, and public description in the directory after publishing is enabled.",
    adminName: "First church administrator", email: "Email address", phone: "Phone number", password: "Password", passwordHint: "Use at least 12 characters.", acceptTerms: "I agree to the Terms of Service.", acceptPrivacy: "I acknowledge the Privacy Notice.", submit: "Submit registration", submitting: "Submitting…", requestError: "We could not submit the request. Please try again later.",
    provisioningTitle: "Preparing the church workspace", provisioningLead: "Creating a dedicated database can take a few minutes. The church will not be activated until every provisioning step succeeds.", provisioningWait: "Preparing the database, roles, and church administrator…", provisioningFailed: "Provisioning could not be completed. The church has not been activated. Keep your request ID and contact the platform team when a support channel is published.", churchCode: "Private church code", copyCode: "Copy code", codeCopied: "Code copied",
    directoryTitle: "Church directory", directoryLead: "Search for a church that opted to publish its public information. The directory never shows invitation codes or member details.", search: "Search by church or city", searchSubmit: "Search", searchEmpty: "No matching churches were found.", searchUnavailable: "The directory is temporarily unavailable. Try again shortly.", verified: "Verified church", unverified: "Not verified", findAction: "Request to join", joinAction: "Join with a church code",
    joinTitle: "Join a church as a servant", joinLead: "Search the directory or enter a code shared by a church administrator. A code only helps find the church; it does not grant membership.", codeLabel: "Church code", lookup: "Find church", matchedChurch: "Is this the church you meant?", cityLabel: "City", requestJoin: "Send join request", requestPending: "Your request was sent for review. Membership and permissions wait for a church administrator's approval.", signInFirst: "Sign in or create a servant account first, then return to send your request.", signIn: "Log in", lookupError: "We couldn't find a church with that code. Check it with the church administrator.", joinError: "We couldn't send the join request right now.",
    policyTitle: "Draft under review", policyReview: "Final legal copy has not been approved. Do not treat this page as a substitute for the official Terms or Privacy Notice.",
  },
  fr: {
    back: "Retour à l’accueil", registerTitle: "Inscrire votre église", registerLead: "Les informations de l’église et du premier administrateur sont nécessaires pour commencer. Les coordonnées ne seront pas publiées dans l’annuaire.",
    churchName: "Nom de l’église", churchNameHint: "Utilisez le nom reconnu par votre église.", city: "Ville ou région", cityHint: "Facultatif. La ville ne paraîtra dans l’annuaire qu’avec votre accord.", publish: "J’accepte d’afficher le nom, la ville et la description publique de l’église lorsque la publication sera activée.",
    adminName: "Premier administrateur de l’église", email: "Adresse e-mail", phone: "Téléphone", password: "Mot de passe", passwordHint: "Utilisez au moins 12 caractères.", acceptTerms: "J’accepte les conditions d’utilisation.", acceptPrivacy: "Je reconnais avoir lu l’avis de confidentialité.", submit: "Envoyer l’inscription", submitting: "Envoi…", requestError: "Impossible d’envoyer la demande. Réessayez plus tard.",
    provisioningTitle: "Préparation de l’espace de l’église", provisioningLead: "La création d’une base dédiée peut prendre quelques minutes. L’église ne sera activée qu’après la réussite de toutes les étapes.", provisioningWait: "Préparation de la base, des rôles et du compte administrateur…", provisioningFailed: "La préparation a échoué. L’église n’a pas été activée. Conservez le numéro de demande et contactez l’équipe quand un canal d’assistance sera publié.", churchCode: "Code privé de l’église", copyCode: "Copier le code", codeCopied: "Code copié",
    directoryTitle: "Annuaire des églises", directoryLead: "Recherchez une église qui a choisi de publier ses informations publiques. Aucun code ni renseignement sur les membres n’est affiché.", search: "Rechercher par église ou ville", searchSubmit: "Rechercher", searchEmpty: "Aucun résultat correspondant.", searchUnavailable: "L’annuaire est momentanément indisponible. Réessayez bientôt.", verified: "Église vérifiée", unverified: "Non vérifiée", findAction: "Demander à rejoindre", joinAction: "Rejoindre avec un code",
    joinTitle: "Rejoindre une église comme servant", joinLead: "Recherchez l’église ou saisissez le code transmis par son administrateur. Le code sert à trouver l’église et ne donne aucun accès.", codeLabel: "Code de l’église", lookup: "Trouver l’église", matchedChurch: "Est-ce la bonne église ?", cityLabel: "Ville", requestJoin: "Envoyer la demande", requestPending: "La demande est envoyée pour examen. L’adhésion et les droits attendent l’approbation d’un administrateur.", signInFirst: "Connectez-vous ou créez un compte servant, puis revenez envoyer la demande.", signIn: "Connexion", lookupError: "Aucune église trouvée avec ce code. Vérifiez-le auprès de l’administrateur.", joinError: "Impossible d’envoyer la demande pour le moment.",
    policyTitle: "Projet en cours de révision", policyReview: "Le texte juridique final n’a pas été approuvé. Cette page ne remplace pas les conditions ni l’avis de confidentialité officiels.",
  },
  es: {
    back: "Volver al inicio", registerTitle: "Registra tu iglesia", registerLead: "Necesitamos los datos de la iglesia y del primer administrador para iniciar el registro. Los datos de contacto no aparecerán en el directorio.",
    churchName: "Nombre de la iglesia", churchNameHint: "Usa el nombre reconocido por tu iglesia.", city: "Ciudad o zona", cityHint: "Opcional. Solo se mostrará en el directorio si lo autorizas.", publish: "Acepto mostrar el nombre, la ciudad y la descripción pública de la iglesia cuando se habilite la publicación.",
    adminName: "Primer administrador de la iglesia", email: "Correo electrónico", phone: "Teléfono", password: "Contraseña", passwordHint: "Usa al menos 12 caracteres.", acceptTerms: "Acepto los Términos del servicio.", acceptPrivacy: "Confirmo que he leído el Aviso de privacidad.", submit: "Enviar registro", submitting: "Enviando…", requestError: "No se pudo enviar la solicitud. Inténtalo más tarde.",
    provisioningTitle: "Preparando el espacio de la iglesia", provisioningLead: "Crear una base de datos dedicada puede tardar unos minutos. La iglesia no se activará hasta que finalicen correctamente todos los pasos.", provisioningWait: "Preparando la base de datos, los roles y el administrador…", provisioningFailed: "No se pudo completar la preparación. La iglesia no se ha activado. Guarda el número de solicitud y contacta al equipo cuando se publique un canal de soporte.", churchCode: "Código privado de la iglesia", copyCode: "Copiar código", codeCopied: "Código copiado",
    directoryTitle: "Directorio de iglesias", directoryLead: "Busca iglesias que hayan elegido publicar información pública. No se muestran códigos de invitación ni datos de miembros.", search: "Buscar por iglesia o ciudad", searchSubmit: "Buscar", searchEmpty: "No se encontraron iglesias.", searchUnavailable: "El directorio no está disponible ahora. Inténtalo de nuevo pronto.", verified: "Iglesia verificada", unverified: "Sin verificar", findAction: "Solicitar unirme", joinAction: "Unirme con un código",
    joinTitle: "Únete a una iglesia como servidor", joinLead: "Busca en el directorio o introduce el código compartido por el administrador. El código solo permite encontrar la iglesia; no concede membresía.", codeLabel: "Código de la iglesia", lookup: "Buscar iglesia", matchedChurch: "¿Es esta la iglesia correcta?", cityLabel: "Ciudad", requestJoin: "Enviar solicitud", requestPending: "La solicitud se envió para revisión. La membresía y los permisos esperan la aprobación del administrador.", signInFirst: "Inicia sesión o crea una cuenta de servidor y vuelve para enviar la solicitud.", signIn: "Iniciar sesión", lookupError: "No encontramos una iglesia con ese código. Confírmalo con su administrador.", joinError: "No se pudo enviar la solicitud ahora.",
    policyTitle: "Borrador en revisión", policyReview: "El texto legal final aún no está aprobado. Esta página no sustituye los términos ni el aviso de privacidad oficiales.",
  },
  de: {
    back: "Zurück zur Startseite", registerTitle: "Gemeinde registrieren", registerLead: "Für die Registrierung benötigen wir Angaben zur Gemeinde und zum ersten Administrator. Kontaktdaten erscheinen nicht im Verzeichnis.",
    churchName: "Name der Gemeinde", churchNameHint: "Verwenden Sie den in Ihrer Gemeinde bekannten Namen.", city: "Stadt oder Gebiet", cityHint: "Optional. Die Stadt erscheint nur mit Ihrer Zustimmung im Verzeichnis.", publish: "Ich stimme zu, dass Name, Stadt und öffentliche Beschreibung der Gemeinde angezeigt werden, sobald die Veröffentlichung aktiviert ist.",
    adminName: "Erster Administrator der Gemeinde", email: "E-Mail-Adresse", phone: "Telefonnummer", password: "Passwort", passwordHint: "Mindestens 12 Zeichen verwenden.", acceptTerms: "Ich stimme den Nutzungsbedingungen zu.", acceptPrivacy: "Ich bestätige, den Datenschutzhinweis gelesen zu haben.", submit: "Registrierung senden", submitting: "Wird gesendet…", requestError: "Die Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen.",
    provisioningTitle: "Gemeindebereich wird eingerichtet", provisioningLead: "Das Erstellen einer eigenen Datenbank kann einige Minuten dauern. Aktiviert wird die Gemeinde erst nach erfolgreichem Abschluss aller Schritte.", provisioningWait: "Datenbank, Rollen und Administrator werden eingerichtet…", provisioningFailed: "Die Einrichtung ist fehlgeschlagen. Die Gemeinde wurde nicht aktiviert. Bitte Anfragenummer aufbewahren und das Team kontaktieren, sobald ein Supportweg veröffentlicht wird.", churchCode: "Privater Gemeindecode", copyCode: "Code kopieren", codeCopied: "Code kopiert",
    directoryTitle: "Gemeindeverzeichnis", directoryLead: "Suchen Sie nach Gemeinden, die ihre öffentlichen Angaben freigegeben haben. Einladungs-Codes und Mitgliederdaten werden nicht angezeigt.", search: "Nach Gemeinde oder Stadt suchen", searchSubmit: "Suchen", searchEmpty: "Keine passende Gemeinde gefunden.", searchUnavailable: "Das Verzeichnis ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.", verified: "Verifizierte Gemeinde", unverified: "Nicht verifiziert", findAction: "Beitritt anfragen", joinAction: "Mit Gemeindecode beitreten",
    joinTitle: "Als Mitarbeiter einer Gemeinde beitreten", joinLead: "Suchen Sie im Verzeichnis oder geben Sie einen Code der Gemeindeleitung ein. Der Code hilft nur beim Finden und gewährt keine Mitgliedschaft.", codeLabel: "Gemeindecode", lookup: "Gemeinde finden", matchedChurch: "Ist dies die richtige Gemeinde?", cityLabel: "Stadt", requestJoin: "Beitrittsanfrage senden", requestPending: "Die Anfrage wurde zur Prüfung gesendet. Mitgliedschaft und Rechte werden erst nach Freigabe erteilt.", signInFirst: "Bitte anmelden oder ein Mitarbeiterkonto erstellen und danach zurückkehren.", signIn: "Anmelden", lookupError: "Mit diesem Code wurde keine Gemeinde gefunden. Bitte bei der Gemeindeleitung prüfen.", joinError: "Die Anfrage konnte gerade nicht gesendet werden.",
    policyTitle: "Entwurf in Prüfung", policyReview: "Der endgültige Rechtstext wurde noch nicht genehmigt. Diese Seite ersetzt weder die offiziellen Bedingungen noch den Datenschutzhinweis.",
  },
  it: {
    back: "Torna alla home", registerTitle: "Registra la tua chiesa", registerLead: "Per avviare la registrazione servono i dati della chiesa e del primo amministratore. I contatti non appariranno nell’elenco pubblico.",
    churchName: "Nome della chiesa", churchNameHint: "Usa il nome riconosciuto dalla tua chiesa.", city: "Città o zona", cityHint: "Facoltativo. La città apparirà nell’elenco solo con il tuo consenso.", publish: "Acconsento a mostrare nome, città e descrizione pubblica della chiesa quando la pubblicazione sarà attivata.",
    adminName: "Primo amministratore della chiesa", email: "Indirizzo e-mail", phone: "Telefono", password: "Password", passwordHint: "Usa almeno 12 caratteri.", acceptTerms: "Accetto i Termini di servizio.", acceptPrivacy: "Dichiaro di aver letto l’Informativa sulla privacy.", submit: "Invia registrazione", submitting: "Invio…", requestError: "Impossibile inviare la richiesta. Riprova più tardi.",
    provisioningTitle: "Preparazione dello spazio della chiesa", provisioningLead: "La creazione di un database dedicato può richiedere alcuni minuti. La chiesa sarà attivata solo dopo il completamento di tutte le fasi.", provisioningWait: "Preparazione del database, dei ruoli e dell’amministratore…", provisioningFailed: "Preparazione non completata. La chiesa non è stata attivata. Conserva il numero della richiesta e contatta il team quando sarà pubblicato un canale di supporto.", churchCode: "Codice privato della chiesa", copyCode: "Copia codice", codeCopied: "Codice copiato",
    directoryTitle: "Elenco delle chiese", directoryLead: "Cerca le chiese che hanno scelto di pubblicare le proprie informazioni. Codici e dati dei membri non sono mostrati.", search: "Cerca per chiesa o città", searchSubmit: "Cerca", searchEmpty: "Nessuna chiesa corrispondente.", searchUnavailable: "L’elenco non è disponibile al momento. Riprova tra poco.", verified: "Chiesa verificata", unverified: "Non verificata", findAction: "Richiedi di unirti", joinAction: "Unisciti con un codice",
    joinTitle: "Unisciti a una chiesa come collaboratore", joinLead: "Cerca nell’elenco o inserisci un codice condiviso dall’amministratore. Il codice serve solo a trovare la chiesa e non concede l’adesione.", codeLabel: "Codice della chiesa", lookup: "Trova la chiesa", matchedChurch: "È la chiesa che cercavi?", cityLabel: "Città", requestJoin: "Invia richiesta di adesione", requestPending: "La richiesta è stata inviata per la revisione. Adesione e permessi attendono l’approvazione dell’amministratore.", signInFirst: "Accedi o crea prima un account collaboratore, poi torna per inviare la richiesta.", signIn: "Accedi", lookupError: "Nessuna chiesa trovata con questo codice. Verificalo con l’amministratore.", joinError: "Impossibile inviare la richiesta al momento.",
    policyTitle: "Bozza in revisione", policyReview: "Il testo legale definitivo non è ancora stato approvato. Questa pagina non sostituisce i Termini o l’Informativa sulla privacy ufficiali.",
  },
  pt: {
    back: "Voltar ao início", registerTitle: "Cadastre sua igreja", registerLead: "Os dados da igreja e do primeiro administrador são necessários para iniciar o cadastro. As informações de contato não aparecerão no diretório.",
    churchName: "Nome da igreja", churchNameHint: "Use o nome reconhecido pela sua igreja.", city: "Cidade ou região", cityHint: "Opcional. Só será exibida no diretório se você autorizar.", publish: "Aceito exibir o nome, a cidade e a descrição pública da igreja quando a publicação estiver disponível.",
    adminName: "Primeiro administrador da igreja", email: "E-mail", phone: "Telefone", password: "Senha", passwordHint: "Use pelo menos 12 caracteres.", acceptTerms: "Aceito os Termos de Serviço.", acceptPrivacy: "Confirmo que li o Aviso de Privacidade.", submit: "Enviar cadastro", submitting: "Enviando…", requestError: "Não foi possível enviar o pedido. Tente novamente mais tarde.",
    provisioningTitle: "Preparando o espaço da igreja", provisioningLead: "Criar um banco de dados dedicado pode levar alguns minutos. A igreja só será ativada após a conclusão bem-sucedida de todas as etapas.", provisioningWait: "Preparando banco de dados, funções e administrador…", provisioningFailed: "Não foi possível concluir a preparação. A igreja não foi ativada. Guarde o número do pedido e fale com a equipe quando um canal de suporte for publicado.", churchCode: "Código privado da igreja", copyCode: "Copiar código", codeCopied: "Código copiado",
    directoryTitle: "Diretório de igrejas", directoryLead: "Pesquise igrejas que optaram por publicar informações públicas. Códigos e dados de membros não são exibidos.", search: "Buscar por igreja ou cidade", searchSubmit: "Buscar", searchEmpty: "Nenhuma igreja correspondente foi encontrada.", searchUnavailable: "O diretório está temporariamente indisponível. Tente novamente em breve.", verified: "Igreja verificada", unverified: "Não verificada", findAction: "Pedir para participar", joinAction: "Participar com código",
    joinTitle: "Participe de uma igreja como servo", joinLead: "Pesquise no diretório ou informe um código compartilhado pelo administrador. O código apenas ajuda a encontrar a igreja; não concede participação.", codeLabel: "Código da igreja", lookup: "Encontrar igreja", matchedChurch: "Esta é a igreja certa?", cityLabel: "Cidade", requestJoin: "Enviar pedido de participação", requestPending: "Seu pedido foi enviado para análise. A participação e as permissões aguardam aprovação do administrador.", signInFirst: "Entre ou crie uma conta de servo e volte para enviar o pedido.", signIn: "Entrar", lookupError: "Não encontramos uma igreja com esse código. Confirme com o administrador.", joinError: "Não foi possível enviar o pedido agora.",
    policyTitle: "Rascunho em análise", policyReview: "O texto jurídico final ainda não foi aprovado. Esta página não substitui os Termos nem o Aviso de Privacidade oficiais.",
  },
  ru: {
    back: "На главную", registerTitle: "Регистрация церкви", registerLead: "Для начала регистрации нужны сведения о церкви и первом администраторе. Контактные данные не появятся в каталоге.",
    churchName: "Название церкви", churchNameHint: "Укажите название, принятое в вашей церкви.", city: "Город или район", cityHint: "Необязательно. Город будет показан в каталоге только с вашего согласия.", publish: "Согласен показывать название, город и общедоступное описание церкви, когда публикация будет включена.",
    adminName: "Первый администратор церкви", email: "Электронная почта", phone: "Телефон", password: "Пароль", passwordHint: "Не менее 12 символов.", acceptTerms: "Принимаю Условия использования.", acceptPrivacy: "Подтверждаю, что прочитал уведомление о конфиденциальности.", submit: "Отправить регистрацию", submitting: "Отправка…", requestError: "Не удалось отправить запрос. Повторите попытку позже.",
    provisioningTitle: "Подготовка пространства церкви", provisioningLead: "Создание отдельной базы данных может занять несколько минут. Церковь будет активирована только после успешного завершения всех этапов.", provisioningWait: "Подготавливаются база данных, роли и учётная запись администратора…", provisioningFailed: "Не удалось завершить подготовку. Церковь не активирована. Сохраните номер запроса и обратитесь в команду после публикации канала поддержки.", churchCode: "Приватный код церкви", copyCode: "Скопировать код", codeCopied: "Код скопирован",
    directoryTitle: "Каталог церквей", directoryLead: "Найдите церковь, которая разрешила показывать общедоступные сведения. Коды приглашений и данные участников не отображаются.", search: "Поиск по названию или городу", searchSubmit: "Найти", searchEmpty: "Подходящих церквей не найдено.", searchUnavailable: "Каталог временно недоступен. Попробуйте позже.", verified: "Проверенная церковь", unverified: "Не проверена", findAction: "Запросить вступление", joinAction: "Вступить по коду",
    joinTitle: "Присоединиться к церкви как служитель", joinLead: "Найдите церковь в каталоге или введите код от её администратора. Код помогает найти церковь, но сам по себе не даёт членство.", codeLabel: "Код церкви", lookup: "Найти церковь", matchedChurch: "Это нужная церковь?", cityLabel: "Город", requestJoin: "Отправить запрос", requestPending: "Запрос отправлен на рассмотрение. Членство и права появятся только после одобрения администратора церкви.", signInFirst: "Сначала войдите или создайте учётную запись служителя, затем вернитесь, чтобы отправить запрос.", signIn: "Войти", lookupError: "По этому коду церковь не найдена. Уточните код у администратора.", joinError: "Сейчас не удалось отправить запрос.",
    policyTitle: "Черновик на проверке", policyReview: "Итоговый юридический текст ещё не утверждён. Эта страница не заменяет официальные условия или уведомление о конфиденциальности.",
  },
};

export function getFlowMessages(locale: Locale): FlowMessages {
  return flowMessages[locale];
}
