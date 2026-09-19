import type { AlertButton, AlertOptions } from "react-native";

let nextId = 0;
const openAlerts = new Set<() => void>();

/** Authorization loss and navigation must never confirm a stale action. */
export function dismissAllWebAlerts() {
  for (const dismiss of [...openAlerts]) dismiss();
}

/** Browser modal dialogs provide focus trapping, Escape dismissal and inert background. */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (typeof document === "undefined") return;
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    const id = `app-dialog-${++nextId}`;
    dialog.className = "app-dialog";
    dialog.setAttribute("aria-labelledby", `${id}-title`);
    if (message) dialog.setAttribute("aria-describedby", `${id}-message`);
    const heading = document.createElement("h2");
    heading.id = `${id}-title`;
    heading.textContent = title;
    const body = document.createElement("p");
    body.id = `${id}-message`;
    body.textContent = message ?? "";
    const actions = document.createElement("div");
    actions.className = "app-dialog-actions";
    const choices = buttons?.length ? buttons : [{ text: "OK" }];
    let finished = false;
    const remove = (restoreFocus: boolean) => {
      if (finished) return;
      finished = true;
      openAlerts.delete(dismissSilently);
      dialog.close();
      dialog.remove();
      if (restoreFocus && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
    const dismissSilently = () => remove(false);
    const finish = (button?: AlertButton, dismissed = false) => {
      if (finished) return;
      remove(true);
      if (dismissed) options?.onDismiss?.();
      button?.onPress?.();
    };
    choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.text ?? "OK";
      button.dataset.kind = choice.style ?? "default";
      button.onclick = () => finish(choice);
      actions.append(button);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (options?.cancelable !== false) finish(choices.find((choice) => choice.style === "cancel"), true);
    });
    const css = document.createElement("style");
    css.textContent = `
      .app-dialog { box-sizing:border-box; width:calc(100% - 32px); max-width:420px; max-height:calc(100dvh - 48px); overflow:auto; padding:24px; border:1px solid var(--app-line); border-radius:16px; background:var(--app-surface); color:var(--app-text); font:inherit; }
      .app-dialog::backdrop { background:rgba(0,0,0,.48); }
      .app-dialog h2 { margin:0 0 12px; font-size:22px; line-height:1.3; overflow-wrap:anywhere; }
      .app-dialog p { margin:0 0 24px; font-size:16px; line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere; }
      .app-dialog-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px; }
      .app-dialog button { min-height:44px; padding:10px 16px; border:1px solid var(--app-line); border-radius:10px; background:var(--app-subtle); color:var(--app-text); font:inherit; font-weight:600; cursor:pointer; overflow-wrap:anywhere; }
      .app-dialog button[data-kind=destructive] { background:var(--app-dangerSoft); color:var(--app-danger); border-color:var(--app-danger); }
      .app-dialog button:hover { filter:brightness(.94); }
      .app-dialog button:active { filter:brightness(.88); }
      .app-dialog button:focus-visible { outline:2px solid var(--app-accent); outline-offset:3px; }
    `;
    dialog.append(css, heading, body, actions);
    document.body.append(dialog);
    openAlerts.add(dismissSilently);
    dialog.showModal();
    // Never initially focus the destructive action.
    const safe = actions.querySelector<HTMLButtonElement>('button[data-kind="cancel"]') ?? actions.querySelector<HTMLButtonElement>('button:not([data-kind="destructive"])');
    if (safe) safe.focus();
    else { heading.tabIndex = -1; heading.focus(); }
  },
};
