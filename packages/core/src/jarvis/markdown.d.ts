/** Bun's text loader embeds the Markdown persona in the compiled Linux executable. */
declare module "*.md" {
  const content: string
  export default content
}
