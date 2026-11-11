import { Agent } from "@opencode/schema/agent"
/** Explicit desktop/browser worker. Tool executors are provided by installed
 * integrations; registering an agent does not fabricate unavailable tools.
 */
export const ID=Agent.ID.make("browser")
export const definition=():Agent.Info=>({
  ...Agent.Info.default(ID),
  id:ID,
  name:Agent.Name.make("Browser"),
  mode:"subagent",
  description:"Desktop/browser interaction: navigate rendered pages, click, type, verify on-screen state and playback using installed browser-control tools.",
  system:"You are an independent desktop/browser worker. Use actual registered MCP browser_tabs_*, ui_click, os.openUrl, shell.powershell, window.focus, input.sendKeys and net.httpGet only when available. Inspect the installed tool inventory before acting. Never claim playback or page state without actual browser evidence. Use native shell tools when needed with their real permissions.",
  permissions:[
    {action:"*",resource:"*",effect:"ask"},
    {action:"read",resource:"*",effect:"allow"},
    {action:"shell",resource:"*",effect:"allow"},
    {action:"bash",resource:"*",effect:"allow"},
    {action:"browser_tabs_*",resource:"*",effect:"allow"},
    {action:"ui_click",resource:"*",effect:"allow"},
    {action:"os.openUrl",resource:"*",effect:"allow"},
    {action:"shell.powershell",resource:"*",effect:"allow"},
    {action:"window.focus",resource:"*",effect:"allow"},
    {action:"input.sendKeys",resource:"*",effect:"allow"},
    {action:"net.httpGet",resource:"*",effect:"allow"},
  ],
})
