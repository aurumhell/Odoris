/* Prepare a return request in the visitor's email client. */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("return-request-form");
    const note = document.getElementById("return-form-note");
    if (!form || !note) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const data = new FormData(form);
        const order = String(data.get("order") || "").trim();
        const product = String(data.get("product") || "").trim();
        const reason = String(data.get("reason") || "").trim();
        const details = String(data.get("details") || "").trim();
        const contact = String(data.get("contact") || "").trim();
        const subject = `Обращение по возврату заказа ${order}`;
        const body = [
            `Номер заказа: ${order}`,
            `Товар: ${product}`,
            `Причина: ${reason}`,
            `Комментарий: ${details || "Не указан"}`,
            `Контакт для ответа: ${contact}`
        ].join("\n");

        note.textContent = "Открываем почтовую программу. Проверьте адресата и содержание письма, затем отправьте его вручную.";
        window.location.href = `mailto:odoris.support@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
});
