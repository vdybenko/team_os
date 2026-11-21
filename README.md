# TeamOS v0.1

Другий мозок команди, який наповнюється з мітингів. Специфікація: [docs/01-vision-and-ui-spec.md](docs/01-vision-and-ui-spec.md), клікабельний прототип: [prototype/index.html](prototype/index.html).

## Що є у v0.1

- **Вхід через Google** (OAuth 2.0, будь-який акаунт). Особистий простір створюється автоматично.
- **Команди**: створення, запрошення посиланням, ролі Owner / Admin / Member, передача ownership.
- **Інбокс**: вставити транскрипт / нотатку або завантажити `.txt .md .vtt .srt`. Claude (`claude-opus-5-5`) витягує задачі, оновлення статусів, знання, нові проєкти й гіпотези — з цитатою-доказом. Нічого не зберігається без підтвердження в **Review**.
- **Задачі** (комітменти): матриця Ейзенхауера, канбан, список, «делеговане»; бокова панель із коментарями та історією. Статус і поля змінює **лише постановник**; виконавець коментує. Пропозиція AI змінити статус чужої задачі йде в інбокс постановника.
- **Проєкти** (статус: активний / пауза / завершено / архів, vision, цілі) і **гіпотези** («Якщо… то… бо…», статус: чернетка / тестуємо / підтверджено / спростовано, метрика, learnings, вердикт).
- **Знання** (рішення, домовленості, факти, процеси, контекст; приватні або командні; заміна старого рішення новим) і **Team vision**.

Ще не зроблено (див. §10 специфікації): календар, Gmail/Drive, ⌘K Ask з RAG, Meeting mode, щоденний дайджест, надсилання листів-запрошень.

## Запуск

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

Відкрий http://localhost:3000. Поки Google OAuth не налаштовано, на localhost працює вхід за email (тільки для розробки).

### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID → Web application**.
2. **Authorized redirect URI**: `http://localhost:3000/auth/google/callback` (для продакшену — `${BASE_URL}/auth/google/callback`).
3. OAuth consent screen: режим **Testing** і додай тестових користувачів (до 100 — без верифікації Google). Потрібні лише scopes `openid email profile`.
4. Впиши `GOOGLE_CLIENT_ID` і `GOOGLE_CLIENT_SECRET` у `.env`, перезапусти сервер.

### AI-аналіз

Впиши `ANTHROPIC_API_KEY` у `.env`. Без ключа записи в інбоксі зберігаються, а пропозиції додаються вручну в Review. Якщо модель відмовляє в аналізі, API автоматично повторює запит на резервній моделі (server-side fallbacks).

## Як зберігаються дані

Усе — звичайні файли в `DATA_DIR` (за замовчуванням `./data`, у `.gitignore`). Задачі, проєкти й гіпотези — JSON, знання — Markdown з front matter. У кожній папці є `index.md` — точка входу, з якої посиланнями можна дійти до кожного файлу (генерується автоматично після кожного запису).

```
data/
  index.md                          ← корінь: усі команди й користувачі
  users/<userId>/
    index.md                        ← точка входу користувача
    profile.json                    ← ім’я, email-и, aliases для транскриптів
    teams/<teamId>/                 ← окрема папка на кожну команду користувача
      index.md
      inbox/<id>.json               ← запис інбоксу + пропозиції AI
      inbox/<id>.md                 ← сирий транскрипт (бачить лише автор)
      tasks/<id>.json               ← приватні задачі (бере участь лише один учасник)
      knowledge/<id>.md             ← приватні знання
  teams/<teamId>/                   ← папка команди, поза папками користувачів
    index.md                        ← точка входу команди
    team.json                       ← учасники, ролі, запрошення
    vision.md                       ← Team vision
    projects/<id>.json
    hypotheses/<id>.json
    tasks/<id>.json                 ← спільні задачі (виконавець ≠ постановник)
    knowledge/<id>.md               ← спільна база знань
```

Особистий простір — це команда з одним учасником (`teams/personal-<userId>`). Задача переїжджає між папкою користувача і папкою команди автоматично, коли змінюється її виконавець.

## Структура коду

- [server/index.js](server/index.js) — HTTP API, права доступу, застосування пропозицій з Review.
- [server/store.js](server/store.js) — файлове сховище і генерація `index.md`.
- [server/auth.js](server/auth.js) — Google OAuth і підписана сесійна cookie.
- [server/ai.js](server/ai.js) — аналізатор інбоксу на Claude API (structured outputs).
- [public/](public/) — клієнт без збірки (vanilla JS), стилі з прототипу.
