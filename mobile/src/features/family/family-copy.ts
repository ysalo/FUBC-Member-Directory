export function getFamilyCopy(locale: string) {
  return locale === "uk" ? {
    family: "Родина", parents: "Батьки", spouse: "Подружжя", children: "Діти", siblings: "Брати та сестри",
    edit: "Редагувати родину", save: "Зберегти родину", cancel: "Скасувати", archived: "Архівний запис",
    add: "Додати", remove: "Прибрати", search: "Пошук учасників", create: "Створити учасника", createSelect: "Створити та вибрати",
    firstName: "Ім’я", lastName: "Прізвище", gender: "Стать", male: "Чоловіча", female: "Жіноча",
    required: "Введіть ім’я, прізвище та оберіть стать.", matches: "Учасники зі схожими іменами — виберіть запис або створіть нового учасника.",
    explicit: "Додано вручну", inferred: "Спільні батьки", inferenceHint: "Цей зв’язок з’являється через спільних батьків. Щоб змінити його, відредагуйте зв’язки з батьками. Зміни з’являться після збереження.",
    editHint: "Керуйте родинними зв’язками", chooseOne: "Оберіть одного учасника", chooseMany: "Оберіть кількох учасників", done: "Готово", clearSearch: "Очистити пошук", noMatches: "Учасників не знайдено", selected: (count: number) => `Вибрано: ${count}`, unsaved: "Незбережені зміни", saved: "Зв’язки родини збережено",
    sharedChildrenHint: "Діти спільні для подружжя. Додавання або вилучення дитини застосовується до обох після збереження.",
    createHint: "Збережіть нового учасника на наступній сторінці, а потім окремо збережіть родинні зв’язки. Якщо скасувати зміни родини, створений учасник залишиться в довіднику.",
    loadError: "Не вдалося завантажити родину.", saveError: "Не вдалося зберегти. Ваші зміни збережено в редакторі.",
    spouseConflict: "Вибраний учасник уже має подружжя. Спочатку приберіть попередній зв’язок.", cycle: "Батьківські зв’язки утворюють цикл походження. Виправте вибраних батьків або дітей.", self: "Учасник не може бути власним родичем.",
    conflict: "Родинні зв’язки змінилися. Оновіть дані та повторіть зміни.", refresh: "Оновити та скинути зміни", retry: "Повторити", empty: "Немає вибраних учасників",
  } : {
    family: "Family", parents: "Parents", spouse: "Spouse", children: "Children", siblings: "Siblings",
    edit: "Edit family", save: "Save family", cancel: "Cancel", archived: "Archived",
    add: "Add", remove: "Remove", search: "Search members", create: "Create member", createSelect: "Create and select",
    firstName: "First name", lastName: "Last name", gender: "Gender", male: "Male", female: "Female",
    required: "Enter first name, last name, and gender.", matches: "Members with matching names — select an existing record or create another member.",
    explicit: "Added directly", inferred: "Shared parents", inferenceHint: "This connection appears because the members share a parent. To change it, edit their parent connections. The result updates after saving.",
    editHint: "Manage family connections", chooseOne: "Choose one member", chooseMany: "Choose multiple members", done: "Done", clearSearch: "Clear search", noMatches: "No members found", selected: (count: number) => `${count} selected`, unsaved: "Unsaved changes", saved: "Family connections saved",
    sharedChildrenHint: "Spouses share children. Adding or removing a child updates both spouses after saving.",
    createHint: "Save the new member on the next page, then save the family connections separately. Canceling family changes leaves the created member in the directory.",
    loadError: "Unable to load family.", saveError: "Unable to save. Your edits remain in the editor.",
    spouseConflict: "The selected member already has a spouse. Remove the existing spouse connection first.", cycle: "Parent connections would create an ancestry cycle. Correct the selected parents or children.", self: "A member cannot be their own relative.",
    conflict: "Family relationships changed. Refresh and reapply your edits.", refresh: "Refresh and discard edits", retry: "Retry", empty: "No members selected",
  };
}
