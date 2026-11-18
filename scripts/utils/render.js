/* Template rendering */

export async function renderElement(path, data) {
  const html = await foundry.applications.handlebars.renderTemplate(path, data);
  const template = document.createElement("template");
  template.innerHTML = String(html ?? "").trim();
  return template.content.firstElementChild;
}
