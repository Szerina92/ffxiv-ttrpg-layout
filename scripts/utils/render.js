/** FFXIV TTRPG Layout — template rendering helper. */

/**
 * Render a Handlebars template and return its first root element.
 *
 * @param {string} path Template path.
 * @param {object} data Template data.
 * @returns {Promise<HTMLElement|null>}
 */
export async function renderElement(path, data) {
  const html = await foundry.applications.handlebars.renderTemplate(path, data);
  const template = document.createElement("template");
  template.innerHTML = String(html ?? "").trim();
  return template.content.firstElementChild;
}
