export function getFamilyCopy(locale: string) {
  return locale === "uk" ? {
    family: "Родина", parents: "Батьки", spouse: "Подружжя", children: "Діти", siblings: "Брати та сестри",
    edit: "Редагувати родину", save: "Зберегти родину", cancel: "Скасувати", archived: "Архівний запис",
    add: "Додати", remove: "Прибрати", search: "Пошук учасників", create: "Створити учасника", createSelect: "Створити та вибрати",
    firstName: "Ім’я", lastName: "Прізвище", gender: "Стать", male: "Чоловіча", female: "Жіноча",
    required: "Введіть ім’я, прізвище та оберіть стать.", matches: "Учасники зі схожими іменами — виберіть запис або створіть нового учасника.",
    explicit: "Записано безпосередньо", inferred: "Спільні батьки", inferenceHint: "Щоб змінити цей зв’язок, відредагуйте відповідні батьківські зв’язки. Попередній перегляд оновиться після збереження.",
    createHint: "Новий учасник збережеться, навіть якщо ви скасуєте зміни родинних зв’язків.",
    loadError: "Не вдалося завантажити родину.", saveError: "Не вдалося зберегти. Ваші зміни збережено в редакторі.",
    spouseConflict: "Вибраний учасник уже має подружжя. Спочатку приберіть попередній зв’язок.", cycle: "Батьківські зв’язки утворюють цикл походження. Виправте вибраних батьків або дітей.", self: "Учасник не може бути власним родичем.",
    conflict: "Родинні зв’язки змінилися. Оновіть дані та повторіть зміни.", refresh: "Оновити та скинути зміни", retry: "Повторити", empty: "Немає вибраних учасників",
  } : {
    family: "Family", parents: "Parents", spouse: "Spouse", children: "Children", siblings: "Siblings",
    edit: "Edit family", save: "Save family", cancel: "Cancel", archived: "Archived",
    add: "Add", remove: "Remove", search: "Search members", create: "Create member", createSelect: "Create and select",
    firstName: "First name", lastName: "Last name", gender: "Gender", male: "Male", female: "Female",
    required: "Enter first name, last name, and gender.", matches: "Members with matching names — select an existing record or create another member.",
    explicit: "Explicitly recorded", inferred: "Shared parents", inferenceHint: "To correct this inference, edit the supporting parent connections. This preview updates after saving.",
    createHint: "The new member remains saved even if you cancel the family changes.",
    loadError: "Unable to load family.", saveError: "Unable to save. Your edits remain in the editor.",
    spouseConflict: "The selected member already has a spouse. Remove the existing spouse connection first.", cycle: "Parent connections would create an ancestry cycle. Correct the selected parents or children.", self: "A member cannot be their own relative.",
    conflict: "Family relationships changed. Refresh and reapply your edits.", refresh: "Refresh and discard edits", retry: "Retry", empty: "No members selected",
  };
}
