// Server-side translations. English is the source language; keys are the English messages.
// A message can be stored as { key, vars } and rendered later in each viewer's language.
// A var given as { $t: 'Open' } is itself translated, so stored history stays language-neutral.

export const LANGS = ['en', 'uk'];

export function langOf(req) {
  const header = String(req.get?.('X-TeamOS-Lang') || '').toLowerCase();
  if (LANGS.includes(header)) return header;
  if (LANGS.includes(req.user?.lang)) return req.user.lang;
  return 'en';
}

export const msg = (key, vars) => (vars ? { key, vars } : { key });

export function tr(lang, key, vars) {
  let out = (lang === 'uk' && UK[key]) || key;
  if (vars) {
    out = out.replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in vars)) return m;
      const v = vars[k];
      return v && typeof v === 'object' && '$t' in v ? tr(lang, v.$t) : String(v ?? '');
    });
  }
  return out;
}

// Renders a stored message: { key, vars } or { plural, n }.
export function render(lang, m) {
  if (!m) return '';
  if (m.plural) return plural(lang, m.n, m.plural);
  return tr(lang, m.key, m.vars);
}

export function plural(lang, n, key) {
  const forms = PLURALS[key]?.[lang] || PLURALS[key]?.en || [key];
  const cat = new Intl.PluralRules(lang).select(n);
  const i = lang === 'uk' ? ({ one: 0, few: 1, many: 2 }[cat] ?? 1) : cat === 'one' ? 0 : 1;
  return `${n} ${forms[Math.min(i, forms.length - 1)]}`;
}

const PLURALS = {
  newCommitment: { en: ['new commitment', 'new commitments'], uk: ['новий комітмент', 'нові комітменти', 'нових комітментів'] },
  merged: { en: ['merged with existing'], uk: ['об’єднано з існуючими'] },
  statusUpdated: { en: ['status updated', 'statuses updated'], uk: ['статус оновлено', 'статуси оновлено', 'статусів оновлено'] },
  routed: { en: ['proposal sent to the requester', 'proposals sent to requesters'], uk: ['пропозицію відправлено постановнику', 'пропозиції відправлено постановникам', 'пропозицій відправлено постановникам'] },
  knowledgeSaved: { en: ['knowledge item saved', 'knowledge items saved'], uk: ['знання збережено', 'знання збережено', 'знань збережено'] },
  project: { en: ['project', 'projects'], uk: ['проєкт', 'проєкти', 'проєктів'] },
  draftHypothesis: { en: ['draft hypothesis', 'draft hypotheses'], uk: ['гіпотеза-чернетка', 'гіпотези-чернетки', 'гіпотез-чернеток'] },
  skipped: { en: ['skipped'], uk: ['пропущено'] },
};

const UK = {
  // statuses (used as { $t } vars)
  'Open': 'Відкрито', 'In progress': 'В роботі', 'Waiting': 'Очікує', 'Done': 'Готово', 'Cancelled': 'Скасовано',
  'no deadline': 'без дедлайну',

  // generic
  'Server error': 'Помилка сервера',
  'Not found': 'Не знайдено',
  'Not signed in': 'Потрібно увійти',
  'S3 storage is temporarily unavailable.': 'Сховище S3 тимчасово недоступне.',
  'No permission': 'Немає прав',
  'Unknown status': 'Невідомий статус',

  // teams & members
  'Team not found': 'Команду не знайдено',
  'You are not a member of this team': 'Ти не учасник цієї команди',
  '{field}: this person is not on the team': '{field}: людина не з команди',
  'Owner': 'Виконавець',
  'Requester': 'Постановник',
  'Responsible': 'Відповідальний',
  'Project owner': 'Owner проєкту',
  'At least one side must be a team member': 'Хоча б одна сторона має бути з команди',
  'Team name is required': 'Назва команди обов’язкова',
  'Only Owner or Admin': 'Лише Owner або Admin',
  'Only the Owner can rename the team': 'Перейменовує лише Owner',
  'Owner and Admin edit the Team vision': 'Team vision редагують Owner і Admin',
  'Owner and Admin can invite': 'Запрошувати можуть Owner і Admin',
  'You can’t invite people to a personal space. Create a team.': 'В особистий простір не запрошують. Створи команду.',
  'Enter a valid email address for the invite': 'Вкажи дійсну адресу електронної пошти для запрошення',
  'Invite not found or revoked': 'Запрошення не знайдено або відкликано',
  'This invite was sent to another address. Sign in with the address the team owner entered.': 'Це запрошення надіслано на іншу адресу. Увійди з адресою, яку вказав власник команди.',
  'Owner and Admin change roles': 'Ролі змінюють Owner і Admin',
  'Member not found': 'Учасника не знайдено',
  'The Owner role changes only by transferring ownership': 'Роль Owner змінюється лише через передачу ownership',
  'Unknown role': 'Невідома роль',
  'Owner and Admin remove members': 'Видаляти учасників можуть Owner і Admin',
  'The Owner can’t leave — transfer ownership first': 'Owner не може вийти — спершу передай ownership',
  'Only the Owner can transfer ownership': 'Передати ownership може лише Owner',
  'The team name doesn’t match': 'Назва команди не збігається',
  'Choose a member': 'Обери учасника',

  // tasks
  'Task not found': 'Задачу не знайдено',
  'Write what needs to be done': 'Напиши, що треба зробити',
  '{name}, who set the task, changes its status and fields. Write a comment.': 'Статус і поля змінює {name} — той, хто поставив задачу. Напиши коментар.',
  'Choose an owner': 'Вкажи виконавця',
  'Only the requester can delete it': 'Видалити може лише постановник',
  'Empty comment': 'Порожній коментар',
  'Created manually': 'Створено вручну',
  '{from} → {to}': '{from} → {to}',
  'owner: {from} → {to}': 'виконавець: {from} → {to}',
  'deadline → {due}': 'дедлайн → {due}',
  'Created from “{title}”, confirmed by {name}': 'Створено з «{title}», підтвердив {name}',
  'from “{title}”, confirmed by {name}': 'з «{title}», підтвердив {name}',
  'Mentioned again in “{title}”': 'Згадано ще раз у «{title}»',
  'Mentioned again in “{title}”: “{quote}”': 'Згадано ще раз у «{title}»: “{quote}”',

  // knowledge
  'Write the text': 'Напиши текст',
  'Knowledge entry not found': 'Не знайдено',
  'The author or Owner/Admin can edit': 'Редагує автор або Owner/Admin',
  'The author or Owner/Admin can delete': 'Видаляє автор або Owner/Admin',
  'Source not found': 'Джерело не знайдено',
  'The source has no file': 'У джерела немає файлу',
  'The file is not a PDF.': 'Файл не є PDF.',
  'The PDF is password-protected.': 'PDF захищений паролем.',
  'Couldn’t read the PDF.': 'Не вдалося прочитати PDF.',
  'The PDF has no text layer (it may be a scan). Run OCR on it first.': 'У PDF немає текстового шару (можливо, це скан). Спершу розпізнайте текст (OCR).',
  'The file is too large (max 20 MB)': 'Файл завеликий (максимум 20 МБ)',

  // projects & hypotheses
  'Project name is required': 'Назва проєкту обов’язкова',
  'A hypothesis must belong to a project': 'Гіпотеза має належати проєкту',
  'Fill in “If…” and “then…”': 'Заповни «Якщо…» і «то…»',
  'Owner and Admin create projects': 'Проєкти створюють Owner і Admin',
  'Owner and Admin edit projects': 'Проєкти редагують Owner і Admin',
  'Project not found': 'Проєкт не знайдено',
  'Delete or move the project’s hypotheses first': 'Спершу видали або перенеси гіпотези проєкту',
  'Hypothesis not found': 'Гіпотезу не знайдено',
  'The responsible person or Owner/Admin edits the hypothesis': 'Гіпотезу редагує її відповідальний або Owner/Admin',
  'Write a learning': 'Напиши висновок',

  // inbox & review
  'Paste text or choose a file': 'Встав текст або обери файл',
  'Note — {date}': 'Нотатка — {date}',
  'Voice note — {date}': 'Голосова нотатка — {date}',
  'Voice recording': 'Голосовий запис',
  'Unsupported audio format': 'Непідтримуваний формат аудіо',
  'The recording is empty': 'Запис порожній',
  'The recording is too long (max 20 MB)': 'Запис задовгий (макс. 20 МБ)',
  'No transcript: speech recognition didn’t catch anything and server transcription isn’t configured': 'Немає транскрипції: браузер нічого не розпізнав, а серверну транскрипцію не налаштовано',
  'The recording has no recognizable speech.': 'У записі не вдалося розпізнати мову.',
  'The source has no recording': 'У джерела немає аудіозапису',
  'The transcription service didn’t respond. Try again later.': 'Сервіс транскрипції не відповів. Спробуй пізніше.',
  'Transcription failed ({status}).': 'Транскрипція не вдалася ({status}).',
  'Entry — {date}': 'Запис — {date}',
  'Pasted text': 'Вставлений текст',
  'Item not found': 'Запис не знайдено',
  'Item not found (the inbox is personal)': 'Запис не знайдено (інбокс особистий)',
  'This item is already being saved. Try again in a moment.': 'Цей запис уже зберігається. Спробуй ще раз за мить.',
  'This item has no source to analyze': 'Цей запис не має джерела для аналізу',
  'Finish saving this item first.': 'Спершу заверши збереження цього запису.',
  'This item has already been processed': 'Цей запис уже розібрано',
  'Nothing was saved': 'Нічого не збережено',
  'AI analysis is not configured. Add proposals manually, or configure a provider and run the analysis again.': 'AI-аналіз не налаштовано. Додай пропозиції вручну або налаштуй провайдер і запусти аналіз ще раз.',
  'Project “{name}” was not created: the Admin role is required': 'Проєкт «{name}» не створено: потрібна роль Admin',
  'A hypothesis without a project was skipped — choose a project': 'Гіпотезу без проєкту пропущено — обери проєкт',
  '{name}: update on “{title}”': '{name}: оновлення по «{title}»',
  'From {name} · from “{title}”': 'Від {name} · з «{title}»',
  '{name} proposes changing the status of “{title}” to “{status}”.': '{name} пропонує змінити статус задачі «{title}» на «{status}».',
  '{name} proposes: “{title}” → {status}': '{name} пропонує: «{title}» → {status}',
  'Quote from “{title}”{ts}:': 'Цитата з «{title}»{ts}:',

  // assistant
  'Chat not found': 'Чат не знайдено',
  'Enter a question of up to 2,000 characters.': 'Введи запитання до 2 000 символів.',
  'This message ID has already been used.': 'Цей ідентифікатор повідомлення вже використано.',
  'The AI assistant is temporarily unavailable.': 'AI-асистент тимчасово недоступний.',
  'Wait for the answer to your previous question.': 'Зачекай на відповідь на попереднє запитання.',
  'There are no records or documents in this space yet that I could rely on.': 'У цьому просторі поки немає записів або документів, на які я міг би спиратися.',
  'The assistant returned an empty answer. Try again.': 'Асистент повернув порожню відповідь. Спробуй ще раз.',
  'The assistant could not verify its document citations. Try again.': 'Асистент не зміг звірити цитати з документом. Спробуй ще раз.',
  'The document dated {date} describes a proposal under discussion.': 'Документ від {date} фіксує пропозицію на етапі обговорення.',
  'The document describes a proposal under discussion.': 'Документ фіксує пропозицію на етапі обговорення.',
  'Open questions included {items}.': 'Відкритими залишалися такі питання: {items}.',
  'The available records do not establish what happened afterwards. The current status is unknown.': 'Що відбулося після цього, надані джерела не встановлюють. Поточний стан невідомий.',

  // AI providers
  'The model returned a result that doesn’t match the expected format.': 'Модель повернула результат, який не відповідає очікуваному формату.',
  'The model returned invalid JSON.': 'Модель повернула некоректний JSON.',
  'OpenAI is unavailable or didn’t respond in time. Try again later.': 'OpenAI недоступний або не відповів вчасно. Спробуй пізніше.',
  'OpenAI: the project’s quota is used up or there is no available balance.': 'OpenAI: у проєкті вичерпано квоту або немає доступного балансу.',
  'OpenAI: request limit exceeded. Try again later.': 'OpenAI: перевищено ліміт запитів. Спробуй пізніше.',
  'OpenAI: check the key and access to the model.': 'OpenAI: перевір ключ і доступ до моделі.',
  'OpenAI: request failed ({status}).': 'OpenAI: помилка запиту ({status}).',
  'The model refused to analyze this source.': 'Модель відмовилася аналізувати це джерело.',
  'The analysis was cut off. Split the source into shorter parts.': 'Аналіз обірвався. Розділи джерело на коротші частини.',
  'OpenAI didn’t finish the analysis. Try again.': 'OpenAI не завершив аналіз. Спробуй ще раз.',
  'Invalid AWS_REGION for Bedrock.': 'Некоректний AWS_REGION для Bedrock.',
  'Bedrock is unavailable or didn’t respond in time. Try again later.': 'Bedrock недоступний або не відповів вчасно. Спробуй пізніше.',
  'Bedrock: request limit exceeded. Try again later.': 'Bedrock: перевищено ліміт запитів. Спробуй пізніше.',
  'Bedrock: check the key and access to the model.': 'Bedrock: перевір ключ і доступ до моделі.',
  'Bedrock: request failed ({status}).': 'Bedrock: помилка запиту ({status}).',
  'Claude API: invalid key (ANTHROPIC_API_KEY).': 'Claude API: невірний ключ (ANTHROPIC_API_KEY).',
  'Claude API: request limit exceeded, try again later.': 'Claude API: перевищено ліміт запитів, спробуй пізніше.',
  'Claude API is unavailable: no connection.': 'Claude API недоступний: немає з’єднання.',
  'Claude API error {status}: {message}': 'Claude API помилка {status}: {message}',

  // S3 records
  'The record has changed. Refresh the page and try again.': 'Запис уже змінився. Онови сторінку й повтори дію.',
  'The record is being moved. Refresh the page and try again.': 'Запис переміщується. Онови сторінку й повтори дію.',

  // sign-in
  'Email sign-in is temporarily unavailable.': 'Вхід через email тимчасово недоступний.',
  'Open TeamOS and try again.': 'Відкрий TeamOS і спробуй ще раз.',
  'Enter a valid email address.': 'Введи дійсну email-адресу.',
  'Too many requests. Please try again later.': 'Забагато запитів. Спробуй пізніше.',
  'We couldn’t send the email. Please try again later.': 'Не вдалося надіслати лист. Спробуй пізніше.',
  'This link has expired or has already been used. Request a new link.': 'Посилання застаріло або вже використане. Отримай нове посилання.',
  'A different TeamOS account is signed in to this browser. Sign out and open this link again.': 'У цьому браузері вже виконано вхід в інший акаунт TeamOS. Вийди й відкрий посилання ще раз.',
  'We couldn’t complete sign-in. Request a new link.': 'Не вдалося завершити вхід. Отримай нове посилання.',
  'Dev login is disabled': 'Вхід для розробки вимкнено',

  // goals & knowledge (shared with MCP)
  'The entry to replace was not found': 'Запис, який треба замінити, не знайдено',
  'Goal not found': 'Ціль не знайдено',
  'Write the goal': 'Напиши ціль',
  'A project can have up to 20 goals': 'У проєкту може бути до 20 цілей',

  // MCP connector (server/mcp.js)
  'Personal': 'Особисте',
  'Choose a workspace: pass team_id. Available: {list}': 'Обери простір: передай team_id. Доступні: {list}',
  'This connection has no access to this workspace': 'Це підключення не має доступу до цього простору',
  'Write what to search for': 'Напиши, що шукати',
  'Created via {app}': 'Створено через {app}',
  'via {app}': 'через {app}',
  'Added via {app}': 'Додано через {app}',
  'This connection is limited to one workspace. Reconnect with access to all workspaces to create teams.': 'Це підключення обмежене одним простором. Щоб створювати команди, підключи TeamOS з доступом до всіх просторів.',
  'Send this link to the person. TeamOS does not email invites yet.': 'Надішли це посилання людині. TeamOS поки не надсилає запрошення листом.',
  'This connection doesn’t allow “{tool}”. Reconnect TeamOS with a higher access level.': 'Це підключення не дозволяє «{tool}». Підключи TeamOS заново з вищим рівнем доступу.',

  // OAuth consent & connected apps (server/oauth.js)
  'Connection failed': 'Не вдалося підключити',
  'This app is not registered with TeamOS. Add the connector again.': 'Цей застосунок не зареєстрований у TeamOS. Додай конектор заново.',
  'The app’s return address doesn’t match its registration.': 'Адреса повернення застосунку не збігається з реєстрацією.',
  'Something went wrong. Try connecting again.': 'Щось пішло не так. Спробуй підключити ще раз.',
  'This connection request has expired. Start connecting again from the app.': 'Запит на підключення застарів. Почни підключення заново із застосунку.',
  '{app} wants to connect to your TeamOS.': '{app} хоче підключитися до твого TeamOS.',
  'It will return to {host}.': 'Після цього повернешся на {host}.',
  'Sign in to connect': 'Увійди, щоб підключити',
  'Sign in to connect {app}': 'Увійди, щоб підключити {app}',
  'Email': 'Email',
  'Name (dev login)': 'Ім’я (вхід для розробки)',
  'Email me a sign-in link': 'Надіслати посилання для входу',
  'Dev sign-in': 'Вхід для розробки',
  'Connect {app}': 'Підключити {app}',
  'Connect {app} to TeamOS': 'Підключити {app} до TeamOS',
  'Signed in as {email}.': 'Ти увійшов як {email}.',
  'The app sees and does only what you can in TeamOS.': 'Застосунок бачить і робить лише те, що можеш ти в TeamOS.',
  'Access': 'Доступ',
  'Read only': 'Лише читання',
  'Search and read tasks, knowledge, projects, goals, hypotheses and your inbox.': 'Пошук і читання задач, знань, проєктів, цілей, гіпотез і твого інбоксу.',
  'Read and write': 'Читання і запис',
  'Also create and change tasks, knowledge, projects, goals and hypotheses, and add items to your inbox.': 'А також створення і зміна задач, знань, проєктів, цілей і гіпотез, додавання в інбокс.',
  'Full, including team management': 'Повний, з керуванням командами',
  'Also create teams, invite and remove members and change their roles (only where you are Owner or Admin).': 'А також створення команд, запрошення і видалення учасників, зміна їхніх ролей (лише там, де ти Owner або Admin).',
  'Workspaces': 'Простори',
  'All my workspaces, including ones I join later': 'Усі мої простори, зокрема ті, до яких я приєднаюся пізніше',
  'All my workspaces': 'Усі мої простори',
  'Only: {name}': 'Лише: {name}',
  'Allow access': 'Дозволити доступ',
  'Cancel': 'Скасувати',
  'You can disconnect the app at any time.': 'Відключити застосунок можна будь-коли.',
  'Connected apps': 'Підключені застосунки',
  'Sign in to TeamOS first.': 'Спершу увійди в TeamOS.',
  'Sign in to TeamOS': 'Увійти в TeamOS',
  'Connected {date}': 'Підключено {date}',
  'Last used {date}': 'Востаннє {date}',
  'Disconnect': 'Відключити',
  'Apps such as Claude or Codex that can reach your TeamOS through MCP.': 'Застосунки на кшталт Claude чи Codex, які мають доступ до твого TeamOS через MCP.',
  'MCP server address': 'Адреса MCP-сервера',
  'No apps are connected yet.': 'Поки що немає підключених застосунків.',
  'Back to TeamOS': 'Назад до TeamOS',
};
